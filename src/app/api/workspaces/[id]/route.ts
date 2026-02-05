import { NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/workspaces/[id] - Get workspace details
export async function GET(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    const workspace = queryOne<{
      id: string;
      name: string;
      description: string;
      email_recipient: string;
      email_subject_template: string;
      email_enabled: number;
      auto_send_on_complete: number;
      created_at: string;
    }>(
      `SELECT id, name, description, email_recipient, email_subject_template,
              email_enabled, auto_send_on_complete, created_at
       FROM businesses WHERE id = ?`,
      [id]
    );

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Failed to fetch workspace:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace' },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/[id] - Update workspace
export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, email_recipient, email_enabled, auto_send_on_complete } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (email_recipient !== undefined) {
      updates.push('email_recipient = ?');
      values.push(email_recipient);
    }
    if (email_enabled !== undefined) {
      updates.push('email_enabled = ?');
      values.push(email_enabled ? 1 : 0);
    }
    if (auto_send_on_complete !== undefined) {
      updates.push('auto_send_on_complete = ?');
      values.push(auto_send_on_complete ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);

    run(
      `UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update workspace:', error);
    return NextResponse.json(
      { error: 'Failed to update workspace' },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id] - Delete workspace
export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Check if workspace has tasks
    const hasTasks = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM tasks WHERE business_id = ?',
      [id]
    );

    if (hasTasks && hasTasks.count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete workspace with existing tasks. Move or delete tasks first.' },
        { status: 400 }
      );
    }

    run('DELETE FROM businesses WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
