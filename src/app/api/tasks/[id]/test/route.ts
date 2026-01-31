/**
 * Task Test API
 * Runs automated browser tests on task deliverables
 * Called by orchestrating LLM (Charlie) to verify work before human review
 */

import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { queryOne, queryAll, run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { Task, TaskDeliverable } from '@/lib/types';

interface TestResult {
  passed: boolean;
  deliverable: {
    id: string;
    title: string;
    path: string;
  };
  httpStatus: number | null;
  consoleErrors: string[];
  consoleWarnings: string[];
  screenshotPath: string | null;
  duration: number;
  error?: string;
}

interface TestResponse {
  taskId: string;
  taskTitle: string;
  passed: boolean;
  results: TestResult[];
  summary: string;
  testedAt: string;
}

const SCREENSHOTS_DIR = '/Users/chris/mission-control-projects/.screenshots';

/**
 * POST /api/tasks/[id]/test
 * Run automated browser tests on all deliverables for a task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: taskId } = await params;

    // Get task
    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get deliverables
    const deliverables = queryAll<TaskDeliverable>(
      'SELECT * FROM task_deliverables WHERE task_id = ? AND deliverable_type = ?',
      [taskId, 'file']
    );

    if (deliverables.length === 0) {
      return NextResponse.json(
        { error: 'No file deliverables to test' },
        { status: 400 }
      );
    }

    // Ensure screenshots directory exists
    if (!existsSync(SCREENSHOTS_DIR)) {
      mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const results: TestResult[] = [];

    for (const deliverable of deliverables) {
      const result = await testDeliverable(browser, deliverable, taskId);
      results.push(result);
    }

    await browser.close();

    // Determine overall pass/fail
    const passed = results.every(r => r.passed);
    const failedCount = results.filter(r => !r.passed).length;

    // Build summary
    let summary: string;
    if (passed) {
      summary = `✅ All ${results.length} deliverable(s) passed automated testing. No console errors detected.`;
    } else {
      const errors = results
        .filter(r => !r.passed)
        .map(r => `${r.deliverable.title}: ${r.consoleErrors.length} errors`)
        .join(', ');
      summary = `❌ ${failedCount}/${results.length} deliverable(s) failed. Issues: ${errors}`;
    }

    // Log activity
    const activityMessage = passed
      ? `✅ Automated test passed - ${results.length} deliverable(s) verified, no console errors`
      : `❌ Automated test failed - ${summary}`;

    run(
      `INSERT INTO task_activities (id, task_id, activity_type, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        taskId,
        passed ? 'test_passed' : 'test_failed',
        activityMessage,
        JSON.stringify({ results: results.map(r => ({
          deliverable: r.deliverable.title,
          passed: r.passed,
          errors: r.consoleErrors.length,
          screenshot: r.screenshotPath
        })) }),
        new Date().toISOString()
      ]
    );

    // If failed, move back to assigned
    if (!passed) {
      run(
        'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
        ['assigned', new Date().toISOString(), taskId]
      );

      run(
        `INSERT INTO task_activities (id, task_id, activity_type, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          taskId,
          'status_changed',
          'Task moved back to ASSIGNED due to failed automated tests',
          new Date().toISOString()
        ]
      );
    }

    const response: TestResponse = {
      taskId,
      taskTitle: task.title,
      passed,
      results,
      summary,
      testedAt: new Date().toISOString()
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Test execution error:', error);
    return NextResponse.json(
      { error: 'Test execution failed', details: String(error) },
      { status: 500 }
    );
  }
}

async function testDeliverable(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  deliverable: TaskDeliverable,
  taskId: string
): Promise<TestResult> {
  const startTime = Date.now();
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  let httpStatus: number | null = null;
  let screenshotPath: string | null = null;

  try {
    // Check file exists
    if (!deliverable.path || !existsSync(deliverable.path)) {
      return {
        passed: false,
        deliverable: {
          id: deliverable.id,
          title: deliverable.title,
          path: deliverable.path || 'unknown'
        },
        httpStatus: null,
        consoleErrors: [`File does not exist: ${deliverable.path}`],
        consoleWarnings: [],
        screenshotPath: null,
        duration: Date.now() - startTime,
        error: 'File not found'
      };
    }

    // Only test HTML files
    if (!deliverable.path.endsWith('.html') && !deliverable.path.endsWith('.htm')) {
      return {
        passed: true,
        deliverable: {
          id: deliverable.id,
          title: deliverable.title,
          path: deliverable.path
        },
        httpStatus: null,
        consoleErrors: [],
        consoleWarnings: [],
        screenshotPath: null,
        duration: Date.now() - startTime,
        error: 'Skipped - not an HTML file'
      };
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push(`Page error: ${error.message}`);
    });

    // Load page via file:// protocol
    const fileUrl = `file://${deliverable.path}`;
    const response = await page.goto(fileUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    httpStatus = response?.status() || null;

    // Wait a bit for any async JS to run
    await page.waitForTimeout(1000);

    // Take screenshot
    const screenshotFilename = `${taskId}-${deliverable.id}-${Date.now()}.png`;
    screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await context.close();

    // Determine pass/fail (no console errors = pass)
    const passed = consoleErrors.length === 0;

    return {
      passed,
      deliverable: {
        id: deliverable.id,
        title: deliverable.title,
        path: deliverable.path
      },
      httpStatus,
      consoleErrors,
      consoleWarnings,
      screenshotPath,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      passed: false,
      deliverable: {
        id: deliverable.id,
        title: deliverable.title,
        path: deliverable.path || 'unknown'
      },
      httpStatus,
      consoleErrors: [...consoleErrors, `Test error: ${error}`],
      consoleWarnings,
      screenshotPath,
      duration: Date.now() - startTime,
      error: String(error)
    };
  }
}

/**
 * GET /api/tasks/[id]/test
 * Get info about the test endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const deliverables = queryAll<TaskDeliverable>(
    'SELECT * FROM task_deliverables WHERE task_id = ? AND deliverable_type = ?',
    [taskId, 'file']
  );

  return NextResponse.json({
    taskId,
    taskTitle: task.title,
    taskStatus: task.status,
    deliverableCount: deliverables.length,
    testableFiles: deliverables
      .filter(d => d.path?.endsWith('.html') || d.path?.endsWith('.htm'))
      .map(d => ({ id: d.id, title: d.title, path: d.path })),
    usage: {
      method: 'POST',
      description: 'Run automated browser tests on all HTML deliverables',
      returns: 'Test results with pass/fail, console errors, and screenshots'
    }
  });
}
