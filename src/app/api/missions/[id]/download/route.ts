import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/missions/[id]/download?file=path/to/file
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('file');

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Security: Ensure the file is within the mission directory
    const missionsDir = process.env.MISSIONS_PATH || path.join(process.env.HOME || '', 'openclaw', 'missions');
    const missionDir = path.join(missionsDir, id);
    const fullPath = path.join(missionDir, filePath);
    
    // Resolve and check if file is within mission directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedMissionDir = path.resolve(missionDir);
    
    if (!resolvedPath.startsWith(resolvedMissionDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const stat = fs.statSync(resolvedPath);
    
    if (stat.isDirectory()) {
      return NextResponse.json(
        { error: 'Cannot download a directory' },
        { status: 400 }
      );
    }

    // Read file content
    const content = fs.readFileSync(resolvedPath);
    
    // Determine content type
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    const fileName = path.basename(resolvedPath);

    // Return file with appropriate headers
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': stat.size.toString(),
      },
    });
  } catch (error) {
    console.error('Failed to download file:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
