import { NextResponse } from 'next/server';
import { modelRouter } from '@/lib/model-ontology/router';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id]/model - Get current model for session
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Parse routing context from query params
    const context: any = {};
    if (searchParams.has('useCase')) context.useCase = searchParams.get('useCase');
    if (searchParams.has('contextLength')) context.contextLength = parseInt(searchParams.get('contextLength')!);
    if (searchParams.has('requiresMultimodal')) context.requiresMultimodal = searchParams.get('requiresMultimodal') === 'true';
    if (searchParams.has('urgency')) context.urgency = searchParams.get('urgency');
    if (searchParams.has('budget')) context.budget = searchParams.get('budget');

    const selection = modelRouter.getModelForSession(sessionId, context);
    const override = modelRouter.getSessionOverride(sessionId);

    return NextResponse.json({
      ...selection,
      model: modelRouter.getModel(selection.primary),
      override: override ? {
        modelId: override.modelId,
        model: modelRouter.getModel(override.modelId),
        setAt: override.setAt,
        reason: override.reason,
      } : null,
    });
  } catch (error) {
    console.error('Failed to get session model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get session model' },
      { status: 500 }
    );
  }
}

// POST /api/sessions/[id]/model - Set model override for session
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { model: aliasOrId, reason } = body;

    if (!aliasOrId) {
      return NextResponse.json(
        { error: 'model is required' },
        { status: 400 }
      );
    }

    // Check if it's a command
    const command = modelRouter.parseCommand(aliasOrId);
    
    if (command?.type === 'reset') {
      const cleared = modelRouter.clearSessionOverride(sessionId);
      return NextResponse.json({
        success: cleared,
        message: cleared ? 'Model override cleared' : 'No override to clear',
      });
    }

    if (command?.type === 'info') {
      const current = modelRouter.getModelForSession(sessionId);
      const override = modelRouter.getSessionOverride(sessionId);
      return NextResponse.json({
        current,
        override,
      });
    }

    // Try to resolve and set the model
    const success = modelRouter.setSessionOverride(sessionId, aliasOrId, reason);

    if (!success) {
      return NextResponse.json(
        { error: `Unknown model or alias: ${aliasOrId}` },
        { status: 400 }
      );
    }

    const override = modelRouter.getSessionOverride(sessionId);
    const model = override ? modelRouter.getModel(override.modelId) : null;

    return NextResponse.json({
      success: true,
      message: `Switched to ${model?.id || aliasOrId}`,
      override: override ? {
        modelId: override.modelId,
        model,
        setAt: override.setAt,
        reason: override.reason,
      } : null,
    });
  } catch (error) {
    console.error('Failed to set session model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set session model' },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id]/model - Clear model override
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const cleared = modelRouter.clearSessionOverride(sessionId);

    return NextResponse.json({
      success: cleared,
      message: cleared ? 'Model override cleared' : 'No override to clear',
    });
  } catch (error) {
    console.error('Failed to clear session model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear session model' },
      { status: 500 }
    );
  }
}
