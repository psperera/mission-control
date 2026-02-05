import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';

interface PresentationFile {
  filename: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('mission');

    if (!missionId) {
      return NextResponse.json(
        { error: 'mission parameter is required' },
        { status: 400 }
      );
    }

    // Security: Validate missionId
    if (missionId.includes('..') || missionId.includes('/') || missionId.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid mission ID' },
        { status: 400 }
      );
    }

    // Construct presentations directory path
    const missionsDir = process.env.MISSIONS_PATH || path.join(os.homedir(), '.openclaw', 'missions');
    const presentationsDir = path.join(missionsDir, missionId, 'presentations');

    // Check if directory exists
    if (!fs.existsSync(presentationsDir)) {
      return NextResponse.json({ presentations: [] });
    }

    // List files
    const files = fs.readdirSync(presentationsDir);
    const presentations: PresentationFile[] = [];

    for (const filename of files) {
      const filePath = path.join(presentationsDir, filename);
      const stats = fs.statSync(filePath);

      // Only include files (not directories)
      if (stats.isFile()) {
        presentations.push({
          filename,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
          downloadUrl: `/api/presentations/download?mission=${encodeURIComponent(missionId)}&file=${encodeURIComponent(filename)}`
        });
      }
    }

    // Sort by creation date (newest first)
    presentations.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ presentations });

  } catch (error) {
    console.error('Failed to list presentations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list presentations' },
      { status: 500 }
    );
  }
}
