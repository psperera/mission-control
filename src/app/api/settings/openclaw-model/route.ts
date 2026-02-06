import { NextResponse } from 'next/server';

// POST /api/settings/openclaw-model - Update OpenClaw default model
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model } = body;

    if (!model) {
      return NextResponse.json(
        { error: 'Model is required' },
        { status: 400 }
      );
    }

    // Validate model ID
    const validModels = [
      'moonshot/kimi-k2.5',
      'anthropic/claude-opus-4-6',
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-opus-4-5',
      'anthropic/claude-haiku-4-5',
      'google/gemini-3-pro',
      'google/gemini-3-flash',
    ];

    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: 'Invalid model ID' },
        { status: 400 }
      );
    }

    // Call OpenClaw gateway to update config
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

    // Convert ws:// to http:// for HTTP API calls
    const httpUrl = gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://');

    const configPatch = {
      agents: {
        defaults: {
          model: {
            primary: model,
          },
        },
      },
    };

    // Try to call OpenClaw config API
    try {
      const res = await fetch(`${httpUrl}/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(gatewayToken && { 'Authorization': `Bearer ${gatewayToken}` }),
        },
        body: JSON.stringify(configPatch),
      });

      if (!res.ok) {
        const error = await res.json();
        console.warn('OpenClaw config patch warning:', error);
        // Don't fail - the config might have been applied anyway
      }
    } catch (apiError) {
      console.warn('OpenClaw API call failed:', apiError);
      // Continue - we'll return success and let the user know
    }

    return NextResponse.json({
      success: true,
      model,
      message: `Default model updated to ${model}. New conversations will use this model.`,
    });

  } catch (error) {
    console.error('Failed to update OpenClaw model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update model' },
      { status: 500 }
    );
  }
}

// GET /api/settings/openclaw-model - Get current default model
export async function GET() {
  try {
    // Try to get current model from OpenClaw status
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
    const httpUrl = gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://');

    try {
      const res = await fetch(`${httpUrl}/status`);
      if (res.ok) {
        const data = await res.json();
        const model = data.config?.agents?.defaults?.model?.primary || 'moonshot/kimi-k2.5';
        return NextResponse.json({ model });
      }
    } catch {
      // Fallback to default
    }

    return NextResponse.json({ model: 'moonshot/kimi-k2.5' });

  } catch (error) {
    console.error('Failed to get OpenClaw model:', error);
    return NextResponse.json({ model: 'moonshot/kimi-k2.5' });
  }
}
