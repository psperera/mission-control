import { NextResponse } from 'next/server';
import { queryAll, run } from '@/lib/db';

// POST /api/missions/[id]/advance-phase
// Automatically advance phases based on task completion
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get all phases for this mission
    const phases = queryAll<{
      id: string;
      phase_number: number;
      title: string;
      status: string;
    }>(
      'SELECT id, phase_number, title, status FROM mission_phases WHERE mission_id = ? ORDER BY phase_number',
      [id]
    );
    
    // Get all tasks for this mission
    const tasks = queryAll<{
      id: string;
      status: string;
    }>(
      'SELECT id, status FROM tasks WHERE business_id = ?',
      [id.replace(/-/g, '_')]
    );
    
    // Phase to task prefix mapping
    const phaseMapping: Record<number, string[]> = {
      1: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'R1', 'R2', 'R3', 'R4', 'L1'],
      2: ['R5', 'R6', 'SC1', 'SC2', 'SC3', 'SC4', 'SC5'],
      3: ['W1', 'W2', 'W3', 'W4'],
      4: ['C1', 'EXEC']
    };
    
    const threshold = 0.8; // 80% completion to auto-advance
    const advanced: string[] = [];
    
    for (const phase of phases) {
      if (phase.status === 'completed') continue;
      
      const prefixes = phaseMapping[phase.phase_number] || [];
      const phaseTasks = tasks.filter(t => 
        prefixes.some(p => t.id.startsWith(p))
      );
      
      if (phaseTasks.length === 0) continue;
      
      const completed = phaseTasks.filter(t => t.status === 'done').length;
      const completionRate = completed / phaseTasks.length;
      
      if (completionRate >= threshold && phase.status !== 'completed') {
        // Mark current phase as completed
        run(
          'UPDATE mission_phases SET status = ?, completed_at = datetime("now") WHERE id = ?',
          ['completed', phase.id]
        );
        
        // Advance to next phase
        const nextPhase = phases.find(p => p.phase_number === phase.phase_number + 1);
        if (nextPhase && nextPhase.status === 'pending') {
          run(
            'UPDATE mission_phases SET status = ? WHERE id = ?',
            ['in_progress', nextPhase.id]
          );
        }
        
        advanced.push(`${phase.title} (${completed}/${phaseTasks.length} = ${Math.round(completionRate * 100)}%)`);
      }
    }
    
    return NextResponse.json({
      success: true,
      advanced,
      message: advanced.length > 0 
        ? `Advanced ${advanced.length} phase(s)` 
        : 'No phases met advancement criteria (need 80% task completion)'
    });
  } catch (error) {
    console.error('Failed to advance phases:', error);
    return NextResponse.json(
      { error: 'Failed to advance phases' },
      { status: 500 }
    );
  }
}
