import { NextResponse } from 'next/server';
import { modelRouter, type RoutingContext } from '@/lib/model-ontology/router';

// GET /api/models - List all available models
export async function GET() {
  try {
    const models = modelRouter.getAllModels();
    const chains = modelRouter.getAllChains();

    return NextResponse.json({
      models: models.map(m => ({
        id: m.id,
        name: m.id.split('/').pop(),
        provider: m.provider,
        aliases: m.aliases,
        capabilities: m.capabilities,
        contextWindow: m.contextWindow,
        costTier: m.costTier,
        speed: m.speed,
        bestFor: m.bestFor,
        icon: m.icon,
        color: m.color,
      })),
      chains: chains.map(c => ({
        name: c.name,
        primary: c.primary,
        fallbacks: c.fallbacks,
        description: c.description,
      })),
    });
  } catch (error) {
    console.error('Failed to list models:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list models' },
      { status: 500 }
    );
  }
}

// POST /api/models/route - Route a message to the best model
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, context, sessionId } = body;

    let selection;

    // If session ID provided, check for override first
    if (sessionId) {
      selection = modelRouter.getModelForSession(sessionId, context);
    } else {
      // Otherwise route based on context
      selection = modelRouter.route(message || '', context as RoutingContext);
    }

    return NextResponse.json({
      selection: {
        ...selection,
        model: modelRouter.getModel(selection.primary),
      },
    });
  } catch (error) {
    console.error('Failed to route model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to route model' },
      { status: 500 }
    );
  }
}
