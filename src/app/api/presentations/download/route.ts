import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('mission');
    const filename = searchParams.get('file');

    if (!missionId || !filename) {
      return NextResponse.json(
        { error: 'mission and file parameters are required' },
        { status: 400 }
      );
    }

    // Security: Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    // Construct file path
    const missionsDir = process.env.MISSIONS_PATH || path.join(os.homedir(), '.openclaw', 'missions');
    const filePath = path.join(missionsDir, missionId, 'presentations', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get file stats
    const stats = fs.statSync(filePath);

    // Read file
    const fileBuffer = fs.readFileSync(filePath);

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.docx' 
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : ext === '.md'
      ? 'text/markdown'
      : 'application/octet-stream';

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Failed to download presentation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download file' },
      { status: 500 }
    );
  }
}
