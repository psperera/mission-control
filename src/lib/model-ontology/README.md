# Model Ontology & Routing System

## Overview

A sophisticated model selection system with fallback chains, aliases, and routing for different use cases.

## Model Ontology

### Base Models (via OpenRouter)

```yaml
models:
  # Anthropic Models
  claude-opus-4-5:
    provider: anthropic
    id: anthropic/claude-opus-4-5
    aliases: [opus, claude-opus]
    capabilities: [coding, analysis, complex-reasoning, long-context]
    context_window: 200k
    cost_tier: high
    speed: medium
    best_for: [complex-analysis, coding, research]
    
  claude-sonnet-4-5:
    provider: anthropic
    id: anthropic/claude-sonnet-4-5
    aliases: [sonnet, claude-sonnet]
    capabilities: [general, balanced, coding]
    context_window: 200k
    cost_tier: medium
    speed: fast
    best_for: [general-tasks, coding, writing]
    
  claude-haiku-4-5:
    provider: anthropic
    id: anthropic/claude-haiku-4-5
    aliases: [haiku, claude-haiku]
    capabilities: [fast, simple-tasks, cost-effective]
    context_window: 200k
    cost_tier: low
    speed: very-fast
    best_for: [quick-tasks, simple-queries, high-volume]

  # Google Models
  gemini-3-pro:
    provider: google
    id: google/gemini-3-pro
    aliases: [gemini-pro, gemini-3]
    capabilities: [multimodal, analysis, long-context]
    context_window: 1m
    cost_tier: medium
    speed: fast
    best_for: [multimodal, long-documents, analysis]
    
  gemini-3-flash:
    provider: google
    id: google/gemini-3-flash
    aliases: [gemini-flash]
    capabilities: [fast, multimodal, cost-effective]
    context_window: 1m
    cost_tier: low
    speed: very-fast
    best_for: [quick-tasks, high-volume, simple-multimodal]

  # Moonshot Models (via OpenRouter)
  kimi-k2-5:
    provider: moonshot
    id: moonshot/kimi-k2.5
    aliases: [kimi, kimi-k2]
    capabilities: [long-context, reasoning, analysis]
    context_window: 256k
    cost_tier: medium
    speed: medium
    best_for: [long-context, analysis, reasoning]

  # DeepSeek Models
  deepseek-chat:
    provider: deepseek
    id: deepseek/deepseek-chat
    aliases: [deepseek]
    capabilities: [coding, reasoning, cost-effective]
    context_window: 64k
    cost_tier: low
    speed: fast
    best_for: [coding, quick-analysis, cost-effective]

  # OpenAI Models (via OpenRouter)
  gpt-4o:
    provider: openai
    id: openai/gpt-4o
    aliases: [gpt4o, 4o]
    capabilities: [general, multimodal, strong-reasoning]
    context_window: 128k
    cost_tier: high
    speed: fast
    best_for: [general-tasks, multimodal, complex-tasks]
    
  gpt-4o-mini:
    provider: openai
    id: openai/gpt-4o-mini
    aliases: [gpt4o-mini, 4o-mini, mini]
    capabilities: [fast, cost-effective, general]
    context_window: 128k
    cost_tier: low
    speed: very-fast
    best_for: [quick-tasks, simple-queries, high-volume]
```

## Routing Chains

### Default Fallback Chain
```yaml
default_chain:
  - anthropic/claude-sonnet-4-5  # Primary
  - google/gemini-3-pro          # Fallback 1
  - moonshot/kimi-k2.5           # Fallback 2
  - deepseek/deepseek-chat       # Fallback 3
```

### Use-Case Specific Chains

```yaml
chains:
  coding:
    primary: anthropic/claude-opus-4-5
    fallbacks:
      - anthropic/claude-sonnet-4-5
      - google/gemini-3-pro
      - deepseek/deepseek-chat
      
  analysis:
    primary: google/gemini-3-pro
    fallbacks:
      - anthropic/claude-opus-4-5
      - moonshot/kimi-k2.5
      - anthropic/claude-sonnet-4-5
      
  fast_response:
    primary: google/gemini-3-flash
    fallbacks:
      - anthropic/claude-haiku-4-5
      - openai/gpt-4o-mini
      - deepseek/deepseek-chat
      
  long_context:
    primary: google/gemini-3-pro
    fallbacks:
      - moonshot/kimi-k2.5
      - anthropic/claude-opus-4-5
      - anthropic/claude-sonnet-4-5
      
  subagent:
    primary: anthropic/claude-sonnet-4-5
    fallbacks:
      - google/gemini-3-pro
      - moonshot/kimi-k2.5
      - deepseek/deepseek-chat
      - anthropic/claude-haiku-4-5
```

## Aliases

```yaml
aliases:
  # Capability aliases
  smart: anthropic/claude-opus-4-5
  fast: google/gemini-3-flash
  cheap: deepseek/deepseek-chat
  balanced: anthropic/claude-sonnet-4-5
  
  # Version aliases
  latest: anthropic/claude-sonnet-4-5
  latest-opus: anthropic/claude-opus-4-5
  latest-haiku: anthropic/claude-haiku-4-5
  
  # Use case aliases
  code: anthropic/claude-opus-4-5
  write: anthropic/claude-sonnet-4-5
  quick: google/gemini-3-flash
```

## Routing Logic

```typescript
interface ModelRouter {
  // Resolve alias to concrete model
  resolve(alias: string): string;
  
  // Get chain for use case
  getChain(useCase: string): ModelChain;
  
  // Get next fallback in chain
  getFallback(modelId: string, chain?: string): string | null;
  
  // Check if model is available
  isAvailable(modelId: string): boolean;
  
  // Route based on message characteristics
  route(message: string, context: RoutingContext): ModelSelection;
}

interface ModelSelection {
  primary: string;
  chain: string[];
  reason: string;
  estimatedCost: number;
}

interface RoutingContext {
  useCase?: string;
  contextLength?: number;
  requiresMultimodal?: boolean;
  urgency?: 'low' | 'medium' | 'high';
  budget?: 'low' | 'medium' | 'high';
}
```

## Session Override

```typescript
interface SessionOverride {
  sessionId: string;
  modelId: string;
  expiresAt?: Date;
  reason?: string;
}

// Commands:
// "switch to sonnet" → use alias resolution
// "switch to anthropic/claude-sonnet-4-5" → use specific model
// "use fast model" → use capability alias
// "reset model" → clear override, use default chain
```

## OpenRouter Integration

For models without direct API access:

```typescript
const openrouterModels = {
  'anthropic/claude-opus-4-5': {
    openrouterId: 'anthropic/claude-3-opus-20240229',
    provider: 'openrouter'
  },
  'google/gemini-3-pro': {
    openrouterId: 'google/gemini-1.5-pro-latest',
    provider: 'openrouter'
  },
  // etc.
};
```

## Usage Examples

```typescript
// Simple alias resolution
const model = router.resolve('sonnet'); 
// → 'anthropic/claude-sonnet-4-5'

// Get chain for coding
const chain = router.getChain('coding');
// → ['anthropic/claude-opus-4-5', 'anthropic/claude-sonnet-4-5', ...]

// Route based on message
const selection = router.route(
  "Analyze this 500-page document",
  { contextLength: 150000, useCase: 'analysis' }
);
// → { primary: 'google/gemini-3-pro', reason: 'Long context required', ... }

// Session override
router.setSessionOverride(sessionId, 'opus');
// All messages in this session now use Claude Opus
```
