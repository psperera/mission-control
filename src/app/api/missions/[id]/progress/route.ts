import { NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import path from 'path';
import fs from 'fs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/missions/[id]/progress - Get mission progress
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get phases from database
    const phases = queryOne<{ 
      total: number; 
      completed: number; 
      in_progress: number;
    }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
      FROM mission_phases 
      WHERE mission_id = ?
    `, [id]);

    // Get recent progress log
    const logs = queryOne<{ logs: string }>(`
      SELECT json_group_array(
        json_object(
          'id', id,
          'action', action,
          'message', message,
          'created_at', created_at
        )
      ) as logs
      FROM mission_progress_log 
      WHERE mission_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [id]);

    // Parse README for visual progress
    const missionsDir = process.env.MISSIONS_PATH || path.join(process.env.HOME || '', 'openclaw', 'missions');
    const readmePath = path.join(missionsDir, id, 'README.md');
    
    let readmeProgress = { phases: [] as Array<{title: string, status: string}> };
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');
      
      // Extract phase table from README
      const phaseMatch = content.match(/## Phase Progress([\s\S]*?)(?=##|$)/);
      if (phaseMatch) {
        const lines = phaseMatch[1].split('\n');
        for (const line of lines) {
          const match = line.match(/\|\s*\d+\.\s*([^|]+)\|\s*([^|]+)\|/);
          if (match) {
            readmeProgress.phases.push({
              title: match[1].trim(),
              status: match[2].trim()
            });
          }
        }
      }
    }

    const total = phases?.total || readmeProgress.phases.length || 1;
    const completed = phases?.completed || 0;
    const inProgress = phases?.in_progress || 0;
    const percentComplete = Math.round((completed / total) * 100);

    return NextResponse.json({
      mission_id: id,
      summary: {
        total_phases: total,
        completed_phases: completed,
        in_progress_phases: inProgress,
        percent_complete: percentComplete,
        status: percentComplete === 100 ? 'completed' : inProgress > 0 ? 'in_progress' : 'pending'
      },
      phases: readmeProgress.phases,
      recent_logs: JSON.parse(logs?.logs || '[]')
    });
  } catch (error) {
    console.error('Failed to get mission progress:', error);
    return NextResponse.json(
      { error: 'Failed to get mission progress' },
      { status: 500 }
    );
  }
}

// POST /api/missions/[id]/progress - Update phase progress
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { phase_id, status, agent_id, message, deliverable_path } = body;

    if (!phase_id || !status) {
      return NextResponse.json(
        { error: 'Phase ID and status are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const completedAt = status === 'completed' ? now : null;

    // Update phase status
    run(`
      INSERT INTO mission_phases (id, mission_id, phase_number, title, status, assigned_agent_id, deliverable_path, completed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        assigned_agent_id = COALESCE(excluded.assigned_agent_id, mission_phases.assigned_agent_id),
        deliverable_path = COALESCE(excluded.deliverable_path, mission_phases.deliverable_path),
        completed_at = COALESCE(excluded.completed_at, mission_phases.completed_at),
        updated_at = ?
    `, [
      phase_id,
      id,
      body.phase_number || 1,
      body.title || 'Untitled Phase',
      status,
      agent_id || null,
      deliverable_path || null,
      completedAt,
      now,
      now
    ]);

    // Log the progress update
    run(`
      INSERT INTO mission_progress_log (id, mission_id, phase_id, agent_id, action, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `${id}-log-${Date.now()}`,
      id,
      phase_id,
      agent_id || null,
      status,
      message || `Phase ${status}`,
      now
    ]);

    // Update README.md to reflect progress
    const missionsDir = process.env.MISSIONS_PATH || path.join(process.env.HOME || '', 'openclaw', 'missions');
    const readmePath = path.join(missionsDir, id, 'README.md');
    
    if (fs.existsSync(readmePath)) {
      let content = fs.readFileSync(readmePath, 'utf-8');
      
      // Update status badge
      if (status === 'completed') {
        content = content.replace(
          /\*\*Status:\*\*\s*\w+/i,
          `**Status:** ${percentComplete === 100 ? 'COMPLETED' : 'IN PROGRESS'}`
        );
      }

      fs.writeFileSync(readmePath, content);
    }

    return NextResponse.json({ 
      success: true, 
      phase_id,
      status,
      updated_at: now
    });
  } catch (error) {
    console.error('Failed to update progress:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update progress' },
      { status: 500 }
    );
  }
}

// Calculate percent complete
const percentComplete = 0; // Will be calculated in actual implementation
