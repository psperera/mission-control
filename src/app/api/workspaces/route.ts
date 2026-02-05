import { NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';

// GET /api/workspaces - List all workspaces
export async function GET() {
  try {
    const workspaces = queryAll<{
      id: string;
      name: string;
      description: string;
      email_recipient: string;
      email_enabled: number;
      auto_send_on_complete: number;
      created_at: string;
    }>(
      `SELECT id, name, description, email_recipient, email_enabled, 
              auto_send_on_complete, created_at 
       FROM businesses 
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Failed to fetch workspaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}

// POST /api/workspaces - Create new workspace
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, email_recipient, auto_send_on_complete } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    run(
      `INSERT INTO businesses (id, name, description, email_recipient, auto_send_on_complete)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, description || null, email_recipient || null, auto_send_on_complete ? 1 : 0]
    );

    return NextResponse.json({
      success: true,
      workspace: {
        id,
        name,
        description,
        email_recipient,
        auto_send_on_complete
      }
    });
  } catch (error) {
    console.error('Failed to create workspace:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
