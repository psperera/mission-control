import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { queryAll } from '@/lib/db';

interface MissionDeliverable {
  id: string;
  mission_id: string;
  phase_id?: string;
  title: string;
  description?: string;
  file_path: string;
  file_type?: string;
  status: 'draft' | 'review' | 'approved' | 'archived';
  created_at: string;
}

interface MissionPhase {
  id: string;
  mission_id: string;
  phase_number: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  deliverable_path?: string;
}

interface FromMissionRequest {
  missionId: string;
  phases?: number[]; // Which phase numbers to include (1-4)
  format?: 'executive_summary' | 'full_report' | 'phase_by_phase';
  includeRawData?: boolean;
}

// Generate markdown from mission deliverables
async function generateMissionMarkdown(
  missionId: string, 
  format: string, 
  phases?: number[],
  includeRawData?: boolean
): Promise<{ markdown: string; title: string }> {
  
  const missionsDir = process.env.MISSIONS_PATH || path.join(os.homedir(), '.openclaw', 'missions');
  const missionDir = path.join(missionsDir, missionId);
  
  // Get mission info from README
  let missionTitle = missionId;
  let missionDescription = '';
  const readmePath = path.join(missionDir, 'README.md');
  
  if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf-8');
    const titleMatch = readmeContent.match(/^#\s+(.+)$/m);
    if (titleMatch) missionTitle = titleMatch[1];
    
    // Extract description (first paragraph after title)
    const descMatch = readmeContent.match(/^#[^\n]+\n\n(.+?)(?:\n\n|\n##|$)/s);
    if (descMatch) missionDescription = descMatch[1].trim();
  }

  // Get phases from database
  const dbPhases = queryAll<MissionPhase>(
    'SELECT * FROM mission_phases WHERE mission_id = ? ORDER BY phase_number',
    [missionId]
  );

  // Get deliverables from database
  const deliverables = queryAll<MissionDeliverable>(
    'SELECT * FROM mission_deliverables WHERE mission_id = ? ORDER BY created_at DESC',
    [missionId]
  );

  // Filter phases if specified
  const selectedPhases = phases && phases.length > 0
    ? dbPhases.filter(p => phases.includes(p.phase_number))
    : dbPhases;

  // Build markdown content
  let markdown = '';
  
  if (format === 'executive_summary') {
    // Executive Summary Format
    markdown = `# Executive Summary: ${missionTitle}

**Generated:** ${new Date().toLocaleDateString()}  
**Mission ID:** ${missionId}  
**Status:** ${dbPhases.some(p => p.status === 'completed') ? 'In Progress' : 'Pending'}

## Overview

${missionDescription || 'This mission focuses on comprehensive analysis and strategic recommendations.'}

## Key Findings

`;

    // Add key findings from completed deliverables
    const approvedDeliverables = deliverables.filter(d => d.status === 'approved');
    for (const deliverable of approvedDeliverables.slice(0, 5)) {
      markdown += `### ${deliverable.title}\n\n`;
      if (deliverable.description) {
        markdown += `${deliverable.description}\n\n`;
      }
      
      // Try to read deliverable content if it's a markdown file
      if (deliverable.file_path && deliverable.file_path.endsWith('.md')) {
        try {
          const fullPath = path.join(missionDir, deliverable.file_path);
          if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // Extract executive summary or first section
            const execMatch = content.match(/## Executive Summary\s*\n\n([\s\S]*?)(?:\n## |\n# |$)/i);
            if (execMatch) {
              markdown += `${execMatch[1].trim()}\n\n`;
            } else {
              // Take first 500 chars
              markdown += `${content.replace(/^#.*\n/, '').trim().substring(0, 500)}...\n\n`;
            }
          }
        } catch (e) {
          // Ignore read errors
        }
      }
    }

    markdown += `## Progress Summary

| Phase | Status | Deliverables |
|-------|--------|--------------|
`;
    for (const phase of selectedPhases) {
      const phaseDeliverables = deliverables.filter(d => d.phase_id === phase.id);
      const status = phase.status === 'completed' ? '✅ Complete' : 
                    phase.status === 'in_progress' ? '🔄 In Progress' : '⏳ Pending';
      markdown += `| ${phase.phase_number}. ${phase.title} | ${status} | ${phaseDeliverables.length} |\n`;
    }

    markdown += `\n## Next Steps\n\n`;
    const pendingPhases = selectedPhases.filter(p => p.status !== 'completed');
    for (const phase of pendingPhases.slice(0, 3)) {
      markdown += `1. **${phase.title}** - ${phase.status === 'in_progress' ? 'Currently in progress' : 'Scheduled'}\n`;
    }

  } else if (format === 'full_report') {
    // Full Report Format
    markdown = `# ${missionTitle}: Comprehensive Report

**Generated:** ${new Date().toLocaleDateString()}  
**Mission ID:** ${missionId}

---

## Table of Contents

`;
    for (const phase of selectedPhases) {
      markdown += `${phase.phase_number}. [${phase.title}](#phase-${phase.phase_number})\n`;
    }
    markdown += `\n---\n\n`;

    // Mission Overview
    markdown += `## Mission Overview\n\n${missionDescription || 'Comprehensive analysis mission.'}\n\n`;

    // Progress Overview
    markdown += `### Progress Overview\n\n| Phase | Status | Description |\n|-------|--------|-------------|\n`;
    for (const phase of selectedPhases) {
      const status = phase.status === 'completed' ? '✅ Complete' : 
                    phase.status === 'in_progress' ? '🔄 In Progress' : 
                    phase.status === 'blocked' ? '🚫 Blocked' : '⏳ Pending';
      markdown += `| ${phase.phase_number}. ${phase.title} | ${status} | ${phase.description || ''} |\n`;
    }
    markdown += `\n`;

    // Each phase section
    for (const phase of selectedPhases) {
      markdown += `---\n\n# Phase ${phase.phase_number}: ${phase.title} {#phase-${phase.phase_number}}\n\n`;
      if (phase.description) {
        markdown += `**Description:** ${phase.description}\n\n`;
      }
      markdown += `**Status:** ${phase.status}\n\n`;

      // Add deliverables for this phase
      const phaseDeliverables = deliverables.filter(d => d.phase_id === phase.id);
      if (phaseDeliverables.length > 0) {
        markdown += `## Deliverables\n\n`;
        for (const deliverable of phaseDeliverables) {
          markdown += `### ${deliverable.title}\n\n`;
          if (deliverable.description) {
            markdown += `${deliverable.description}\n\n`;
          }
          
          // Try to include full content
          if (includeRawData && deliverable.file_path) {
            try {
              const fullPath = path.join(missionDir, deliverable.file_path);
              if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                // Remove title if present
                const cleanContent = content.replace(/^#.*\n/, '').trim();
                markdown += `${cleanContent}\n\n`;
              }
            } catch (e) {
              // Ignore
            }
          }
          
          markdown += `**File:** ${deliverable.file_path || 'N/A'}  \n`;
          markdown += `**Status:** ${deliverable.status}  \n\n`;
        }
      } else {
        markdown += `*No deliverables yet for this phase.*\n\n`;
      }
    }

  } else {
    // Phase by Phase format
    markdown = `# ${missionTitle}\n\n`;
    for (const phase of selectedPhases) {
      markdown += `## Phase ${phase.phase_number}: ${phase.title}\n\n`;
      if (phase.description) {
        markdown += `${phase.description}\n\n`;
      }
      
      const phaseDeliverables = deliverables.filter(d => d.phase_id === phase.id);
      if (phaseDeliverables.length > 0) {
        for (const deliverable of phaseDeliverables) {
          markdown += `### ${deliverable.title}\n\n`;
          if (includeRawData && deliverable.file_path) {
            try {
              const fullPath = path.join(missionDir, deliverable.file_path);
              if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                markdown += `${content.replace(/^#.*\n/, '').trim()}\n\n`;
              }
            } catch (e) {
              markdown += `*[Content unavailable]*\n\n`;
            }
          } else if (deliverable.description) {
            markdown += `${deliverable.description}\n\n`;
          }
        }
      }
      markdown += `\n`;
    }
  }

  return { markdown, title: missionTitle };
}

export async function POST(request: Request) {
  try {
    const body: FromMissionRequest = await request.json();
    const { missionId, phases, format = 'executive_summary', includeRawData = false } = body;

    if (!missionId) {
      return NextResponse.json(
        { error: 'missionId is required' },
        { status: 400 }
      );
    }

    // Generate markdown from mission
    const { markdown, title } = await generateMissionMarkdown(missionId, format, phases, includeRawData);

    // Determine template based on format
    const template = format === 'executive_summary' ? 'executive' : 
                    format === 'full_report' ? 'detailed' : 'minimal';

    // Call the generate endpoint
    const generateResponse = await fetch(new URL('/api/presentations/generate', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionId,
        title: format === 'executive_summary' ? `Executive Summary - ${title}` : title,
        content: markdown,
        template,
        author: 'Mission Control System',
        company: 'Next Horizons'
      })
    });

    if (!generateResponse.ok) {
      const error = await generateResponse.json();
      throw new Error(error.error || 'Failed to generate presentation');
    }

    const result = await generateResponse.json();

    return NextResponse.json({
      success: true,
      ...result,
      format,
      phasesIncluded: phases || 'all'
    });

  } catch (error) {
    console.error('Failed to generate presentation from mission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate presentation' },
      { status: 500 }
    );
  }
}
