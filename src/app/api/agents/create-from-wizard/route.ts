import { NextResponse } from 'next/server';
import { run } from '@/lib/db';
import { randomUUID } from 'crypto';

interface CreateAgentFromWizardRequest {
  name: string;
  role: string;
  description: string;
  avatarEmoji: string;
  creature: string;
  vibe: string;
  // Content for the files
  soulMd: string;
  userMd: string;
  agentsMd: string;
  // User context
  userName: string;
  whatToCallUser: string;
  userPronouns: string;
  timezone: string;
  userNotes: string;
}

export async function POST(request: Request) {
  try {
    const body: CreateAgentFromWizardRequest = await request.json();
    const {
      name,
      role,
      description,
      avatarEmoji,
      creature,
      vibe,
      soulMd,
      userMd,
      agentsMd,
      userName,
      whatToCallUser,
      userPronouns,
      timezone,
      userNotes
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    const agentId = randomUUID();
    const now = new Date().toISOString();

    // Insert agent into database
    run(
      `INSERT INTO agents (
        id, name, role, description, avatar_emoji, 
        status, is_master, soul_md, user_md, agents_md,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agentId,
        name,
        role || 'Assistant',
        description || `${creature} - ${vibe}`,
        avatarEmoji || '🤖',
        'standby',
        0, // Not master by default
        soulMd,
        userMd,
        agentsMd,
        now,
        now
      ]
    );

    // Create a conversation for this agent
    const conversationId = randomUUID();
    run(
      `INSERT INTO conversations (id, title, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [conversationId, `Chat with ${name}`, 'direct', now, now]
    );

    // Log creation event
    run(
      `INSERT INTO events (id, type, agent_id, message, created_at) VALUES (?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        'agent_joined',
        agentId,
        `Agent "${name}" created via Agent Creation Wizard`,
        now
      ]
    );

    return NextResponse.json({
      success: true,
      agent: {
        id: agentId,
        name,
        role: role || 'Assistant',
        avatar_emoji: avatarEmoji || '🤖',
        status: 'standby',
        conversation_id: conversationId
      },
      message: `Agent "${name}" created successfully!`
    });

  } catch (error) {
    console.error('Failed to create agent from wizard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create agent' },
      { status: 500 }
    );
  }
}
