import { NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import path from 'path';
import fs from 'fs';

interface MissionPhase {
  id: string;
  mission_id: string;
  phase_number: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  assigned_agent_id?: string;
  deliverable_path?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
}

interface MissionDeliverable {
  id: string;
  mission_id: string;
  phase_id?: string;
  title: string;
  description?: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  download_count: number;
  last_downloaded_at?: string;
  status: 'draft' | 'review' | 'approved' | 'archived';
  created_by_agent_id?: string;
  created_at: string;
  updated_at: string;
}

// GET /api/missions - List all missions
export async function GET() {
  try {
    // Get all unique mission IDs from the filesystem
    const missionsDir = process.env.MISSIONS_PATH || path.join(process.env.HOME || '', 'openclaw', 'missions');
    
    let missions: Array<{
      id: string;
      name: string;
      status: string;
      progress: number;
      phases: MissionPhase[];
      deliverables: MissionDeliverable[];
    }> = [];

    if (fs.existsSync(missionsDir)) {
      const entries = fs.readdirSync(missionsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const missionId = entry.name;
          const readmePath = path.join(missionsDir, missionId, 'README.md');
          
          let name = missionId;
          let status = 'unknown';
          
          if (fs.existsSync(readmePath)) {
            const content = fs.readFileSync(readmePath, 'utf-8');
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const statusMatch = content.match(/\*\*Status:\*\*\s*(\w+)/i);
            
            if (titleMatch) name = titleMatch[1];
            if (statusMatch) status = statusMatch[1].toLowerCase();
          }

          // Get phases from database
          const phases = queryAll<MissionPhase>(
            'SELECT * FROM mission_phases WHERE mission_id = ? ORDER BY phase_number',
            [missionId]
          );

          // Get deliverables from database
          const deliverables = queryAll<MissionDeliverable>(
            'SELECT * FROM mission_deliverables WHERE mission_id = ? ORDER BY created_at DESC',
            [missionId]
          );

          // Calculate progress
          const totalPhases = phases.length || 4; // Default to 4 phases if not in DB
          const completedPhases = phases.filter(p => p.status === 'completed').length;
          const inProgressPhases = phases.filter(p => p.status === 'in_progress').length;
          // Count in-progress as 50% complete
          const progress = totalPhases > 0 
            ? Math.round(((completedPhases + (inProgressPhases * 0.5)) / totalPhases) * 100) 
            : 0;

          missions.push({
            id: missionId,
            name,
            status,
            progress,
            phases,
            deliverables
          });
        }
      }
    }

    return NextResponse.json({ missions });
  } catch (error) {
    console.error('Failed to list missions:', error);
    return NextResponse.json(
      { error: 'Failed to list missions' },
      { status: 500 }
    );
  }
}

// POST /api/missions - Create a new mission
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phases = [] } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Mission ID and name are required' },
        { status: 400 }
      );
    }

    // Create mission directory structure
    const missionsDir = process.env.MISSIONS_PATH || path.join(process.env.HOME || '', 'openclaw', 'missions');
    const missionDir = path.join(missionsDir, id);
    
    fs.mkdirSync(missionDir, { recursive: true });
    fs.mkdirSync(path.join(missionDir, '01-research'), { recursive: true });
    fs.mkdirSync(path.join(missionDir, '02-analysis'), { recursive: true });
    fs.mkdirSync(path.join(missionDir, '03-deliverables'), { recursive: true });
    fs.mkdirSync(path.join(missionDir, '04-outputs'), { recursive: true });

    // Create README.md template
    const readmeContent = `# ${name}

**Mission ID:** ${id}  
**Status:** ACTIVE  
**Created:** ${new Date().toISOString().split('T')[0]}  

## Mission Overview

[Add mission description here]

## Phase Progress

| Phase | Status | Deliverable | Due | Owner |
|-------|--------|-------------|-----|-------|
${phases.map((p: {title: string}, i: number) => `| ${i + 1}. ${p.title} | ⚪ Pending | - | - | - |`).join('\n')}

## Downloadable Deliverables

| File | Phase | Status | Size | Last Updated |
|------|-------|--------|------|--------------|
| [📄 README.md](./README.md) | - | ✅ Complete | - | ${new Date().toISOString().split('T')[0]} |

`;

    fs.writeFileSync(path.join(missionDir, 'README.md'), readmeContent);

    // Create STATUS.md
    const statusContent = `# Mission Status: ${name}

**Status:** ACTIVE  
**Created:** ${new Date().toISOString().split('T')[0]}  
**Priority:** NORMAL  

## Progress
${phases.map((p: {title: string}, i: number) => `- [ ] ${p.title}`).join('\n')}

## Agents Assigned
- TBD

## Next Actions
1. [Add next actions here]

## Notes
[Add notes here]
`;

    fs.writeFileSync(path.join(missionDir, 'STATUS.md'), statusContent);

    // Insert phases into database
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      run(
        `INSERT INTO mission_phases (id, mission_id, phase_number, title, description, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `${id}-phase-${i + 1}`,
          id,
          i + 1,
          phase.title,
          phase.description || null,
          'pending',
          new Date().toISOString()
        ]
      );
    }

    return NextResponse.json({ 
      success: true, 
      mission: { id, name, path: missionDir },
      phases: phases.length
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create mission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create mission' },
      { status: 500 }
    );
  }
}
