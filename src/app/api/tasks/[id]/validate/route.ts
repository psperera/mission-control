import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { getProjectsPath } from '@/lib/config';
import * as fs from 'fs';
import * as path from 'path';
import type { Task, TaskDeliverable, TaskActivity } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// AI Slop detection patterns
const AI_SLOP_PATTERNS = [
  /\bin conclusion\b/gi,
  /\bit's worth noting\b/gi,
  /\bit is important to note\b/gi,
  /\bas we can see\b/gi,
  /\blet's dive in\b/gi,
  /\blet's explore\b/gi,
  /\bin today's world\b/gi,
  /\bin this day and age\b/gi,
  /\bgame.?changer\b/gi,
  /\bcutting.?edge\b/gi,
  /\bstate.?of.?the.?art\b/gi,
  /\brobust\b/gi,
  /\bleverag(e|ing)\b/gi,
  /\bsynerg(y|ies|istic)\b/gi,
  /\bholistic\b/gi,
  /\bparadigm\b/gi,
  /\bseamless(ly)?\b/gi,
  /\bempowering?\b/gi,
  /\bdelve\b/gi,
  /\bunlock(ing)?\b/gi,
  /\bjourney\b/gi,
  /\btransformative\b/gi,
  /\bvibrant\b/gi,
  /\btapestry\b/gi,
  /\blandscape\b/gi,
  /\becosystem\b/gi,
  /\bfostering?\b/gi,
  /\bnuanced?\b/gi,
  /\bmultifaceted\b/gi,
  /\bunderscores?\b/gi,
  /\bhighlight(s|ing)?\b/gi,
  /\bpivotal\b/gi,
  /\bcrucial(ly)?\b/gi,
  /\bfurthermore\b/gi,
  /\bmoreover\b/gi,
  /\badditionally\b/gi,
  /\bnevertheless\b/gi,
  /\bnonetheless\b/gi,
];

const QUALITY_RULES = {
  minWordCount: 100,
  maxRepeatedPhrases: 3,
  minUniqueWords: 50,
  maxAISlopScore: 5,
};

function detectAISlop(content: string): { score: number; matches: string[] } {
  const matches: string[] = [];
  let score = 0;

  for (const pattern of AI_SLOP_PATTERNS) {
    const found = content.match(pattern);
    if (found) {
      matches.push(...found);
      score += found.length;
    }
  }

  return { score, matches: Array.from(new Set(matches)) };
}

function countWords(content: string): number {
  return content.split(/\s+/).filter(w => w.length > 0).length;
}

function countUniqueWords(content: string): number {
  const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  return new Set(words).size;
}

function detectCitations(content: string): string[] {
  const patterns = [
    /\[\d+\]/g,
    /\([\w\s]+,?\s*\d{4}\)/g,
    /https?:\/\/[^\s<>"]+/g,
    /doi:\s*[\d.\/\w-]+/gi,
  ];

  const citations: string[] = [];
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) citations.push(...matches);
  }

  return citations;
}

function validateContent(content: string): {
  passed: boolean;
  qualityScore: number;
  issues: string[];
  warnings: string[];
  metrics: Record<string, unknown>;
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const metrics: Record<string, unknown> = {};

  // Word count check
  const wordCount = countWords(content);
  metrics.wordCount = wordCount;
  if (wordCount < QUALITY_RULES.minWordCount) {
    issues.push(`Content too short: ${wordCount} words (minimum: ${QUALITY_RULES.minWordCount})`);
  }

  // Unique words check
  const uniqueWords = countUniqueWords(content);
  metrics.uniqueWords = uniqueWords;
  if (uniqueWords < QUALITY_RULES.minUniqueWords) {
    warnings.push(`Low vocabulary diversity: ${uniqueWords} unique words`);
  }

  // AI Slop detection
  const aiSlop = detectAISlop(content);
  metrics.aiSlopScore = aiSlop.score;
  metrics.aiSlopMatches = aiSlop.matches;

  if (aiSlop.score > QUALITY_RULES.maxAISlopScore) {
    issues.push(`High AI slop score: ${aiSlop.score} (max: ${QUALITY_RULES.maxAISlopScore})`);
    issues.push(`Detected phrases: ${aiSlop.matches.slice(0, 10).join(', ')}`);
  } else if (aiSlop.score > 0) {
    warnings.push(`Minor AI slop detected: ${aiSlop.matches.join(', ')}`);
  }

  // Citations check
  const citations = detectCitations(content);
  metrics.citationCount = citations.length;
  if (citations.length === 0) {
    warnings.push('No citations found - consider adding sources');
  }

  const passed = issues.length === 0;
  const qualityScore = Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5) - (aiSlop.score * 3));

  return { passed, qualityScore, issues, warnings, metrics };
}

/**
 * POST /api/tasks/[id]/validate
 *
 * Validates task deliverables for research integrity.
 * Called during TESTING phase to check for AI slop and quality issues.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { autoRework = false } = body;

    // Get task
    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get deliverables
    const deliverables = queryAll<TaskDeliverable>(
      'SELECT * FROM task_deliverables WHERE task_id = ?',
      [id]
    );

    if (deliverables.length === 0) {
      return NextResponse.json({
        passed: false,
        error: 'No deliverables found for task',
        taskId: id,
      }, { status: 400 });
    }

    const results: Array<{
      deliverable: string;
      path: string | undefined;
      validation: ReturnType<typeof validateContent> & { error?: string };
    }> = [];

    // Validate each file deliverable
    for (const deliverable of deliverables) {
      if (deliverable.deliverable_type === 'file' && deliverable.path) {
        try {
          let content = fs.readFileSync(deliverable.path, 'utf-8');
          const ext = path.extname(deliverable.path).toLowerCase();

          // For HTML files, extract text content
          if (ext === '.html' || ext === '.htm') {
            content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
          }

          const validation = validateContent(content);
          results.push({
            deliverable: deliverable.title,
            path: deliverable.path,
            validation,
          });
        } catch (error) {
          results.push({
            deliverable: deliverable.title,
            path: deliverable.path,
            validation: {
              passed: false,
              qualityScore: 0,
              issues: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`],
              warnings: [],
              metrics: {},
              error: 'File read error',
            },
          });
        }
      }
    }

    const now = new Date().toISOString();
    const allPassed = results.every(r => r.validation.passed);
    const avgScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.validation.qualityScore, 0) / results.length)
      : 0;

    // Log validation activity
    run(
      `INSERT INTO task_activities (id, task_id, activity_type, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        id,
        'status_changed',
        allPassed
          ? `Validation passed (score: ${avgScore}/100)`
          : `Validation failed - ${results.filter(r => !r.validation.passed).length} issues found`,
        JSON.stringify({ results, avgScore }),
        now,
      ]
    );

    // Broadcast activity
    const activity: TaskActivity = {
      id: uuidv4(),
      task_id: id,
      activity_type: 'status_changed',
      message: allPassed ? 'Validation passed' : 'Validation failed - rework needed',
      created_at: now,
    };
    broadcast({ type: 'activity_logged', payload: activity });

    // If validation failed and autoRework is enabled, move back to in_progress
    if (!allPassed && autoRework) {
      run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', ['in_progress', now, id]);

      const updatedTask = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
      if (updatedTask) {
        broadcast({ type: 'task_updated', payload: updatedTask });
      }

      // Log rework event
      run(
        `INSERT INTO events (id, type, task_id, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), 'task_status_changed', id, `Task "${task.title}" sent back for rework due to validation failures`, now]
      );
    }

    return NextResponse.json({
      taskId: id,
      passed: allPassed,
      averageQualityScore: avgScore,
      deliverableCount: deliverables.length,
      validatedCount: results.length,
      failedCount: results.filter(r => !r.validation.passed).length,
      results,
      autoRework: !allPassed && autoRework,
      timestamp: now,
    });
  } catch (error) {
    console.error('Validation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks/[id]/validate
 *
 * Get last validation result for a task.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get last validation activity
    const activity = queryOne<TaskActivity>(
      `SELECT * FROM task_activities
       WHERE task_id = ? AND message LIKE 'Validation%'
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );

    if (!activity) {
      return NextResponse.json({ message: 'No validation results found' }, { status: 404 });
    }

    return NextResponse.json({
      taskId: id,
      lastValidation: activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
    });
  } catch (error) {
    console.error('Failed to get validation results:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get validation results' },
      { status: 500 }
    );
  }
}
