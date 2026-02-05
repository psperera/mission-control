import { NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { sendWorkspaceDeliverables } from '@/lib/email/workspaceDelivery';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/workspaces/[id]/send-deliverables
// Send deliverables to workspace's configured email
export async function POST(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const { missionId, zipPath, customMessage } = await request.json();

    // Get workspace configuration
    const workspace = queryOne<{
      name: string;
      email_recipient: string;
      email_enabled: number;
      email_subject_template: string;
    }>(
      `SELECT name, email_recipient, email_enabled, email_subject_template
       FROM businesses WHERE id = ?`,
      [id]
    );

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    if (!workspace.email_enabled) {
      return NextResponse.json(
        { error: 'Email is disabled for this workspace' },
        { status: 400 }
      );
    }

    if (!workspace.email_recipient) {
      return NextResponse.json(
        { error: 'No email recipient configured for this workspace' },
        { status: 400 }
      );
    }

    // Get mission info
    const mission = queryOne<{ name: string }>(
      'SELECT name FROM mission_phases WHERE mission_id = ? LIMIT 1',
      [missionId]
    );

    const missionName = mission?.name || 'Mission';
    const subject = workspace.email_subject_template?.replace('{mission_name}', missionName) 
                   || `Mission Deliverables - ${missionName}`;

    // Send email
    const result = await sendWorkspaceDeliverables({
      to: workspace.email_recipient,
      subject,
      workspaceName: workspace.name,
      missionName,
      zipPath,
      customMessage,
      dashboardUrl: `http://openclaw.hyflux.net`
    });

    // Log the email
    run(
      `INSERT INTO workspace_email_logs (id, workspace_id, mission_id, recipient, subject, files_attached, status, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        crypto.randomUUID(),
        id,
        missionId,
        workspace.email_recipient,
        subject,
        zipPath ? JSON.stringify([zipPath]) : null,
        result.success ? 'sent' : 'failed'
      ]
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    // Update last email sent timestamp
    run(
      'UPDATE businesses SET last_email_sent_at = datetime("now") WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      recipient: workspace.email_recipient,
      subject
    });
  } catch (error) {
    console.error('Failed to send deliverables:', error);
    return NextResponse.json(
      { error: 'Failed to send deliverables' },
      { status: 500 }
    );
  }
}
