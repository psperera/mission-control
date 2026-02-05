import { randomUUID } from 'crypto';

// Model definitions
export interface ModelDefinition {
  id: string;
  provider: string;
  openrouterId?: string;
  aliases: string[];
  capabilities: string[];
  contextWindow: number;
  costTier: 'low' | 'medium' | 'high';
  speed: 'very-fast' | 'fast' | 'medium' | 'slow';
  bestFor: string[];
  icon?: string;
  color?: string;
}

// Model chain for fallback
export interface ModelChain {
  name: string;
  primary: string;
  fallbacks: string[];
  description: string;
}

// Session override
export interface SessionOverride {
  sessionId: string;
  modelId: string;
  chain?: string;
  expiresAt?: Date;
  reason?: string;
  setAt: Date;
}

// Routing context
export interface RoutingContext {
  useCase?: string;
  contextLength?: number;
  requiresMultimodal?: boolean;
  urgency?: 'low' | 'medium' | 'high';
  budget?: 'low' | 'medium' | 'high';
}

// Model selection result
export interface ModelSelection {
  primary: string;
  chain: string[];
  reason: string;
  estimatedCost: 'low' | 'medium' | 'high';
  confidence: number;
}

// Default model definitions
export const MODELS: Record<string, ModelDefinition> = {
  'anthropic/claude-opus-4-5': {
    id: 'anthropic/claude-opus-4-5',
    provider: 'anthropic',
    aliases: ['opus', 'claude-opus', 'smart'],
    capabilities: ['coding', 'analysis', 'complex-reasoning', 'long-context'],
    contextWindow: 200000,
    costTier: 'high',
    speed: 'medium',
    bestFor: ['complex-analysis', 'coding', 'research'],
    icon: '🧠',
    color: '#D4A574',
  },
  'anthropic/claude-opus-4-6': {
    id: 'anthropic/claude-opus-4-6',
    provider: 'anthropic',
    aliases: ['opus-4-6', 'claude-opus-4-6', 'opus46', 'latest-opus', 'latest-coding'],
    capabilities: ['coding', 'analysis', 'complex-reasoning', 'long-context', 'agentic', 'extended-thinking'],
    contextWindow: 200000,
    costTier: 'high',
    speed: 'medium',
    bestFor: ['complex-analysis', 'coding', 'research', 'agentic-tasks', 'long-running-tasks'],
    icon: '🧠',
    color: '#C4956A',
  },
  'anthropic/claude-sonnet-4-5': {
    id: 'anthropic/claude-sonnet-4-5',
    provider: 'anthropic',
    aliases: ['sonnet', 'claude-sonnet', 'balanced'],
    capabilities: ['general', 'balanced', 'coding', 'fast'],
    contextWindow: 200000,
    costTier: 'medium',
    speed: 'fast',
    bestFor: ['general-tasks', 'coding', 'writing'],
    icon: '⚡',
    color: '#E8B86D',
  },
  'anthropic/claude-haiku-4-5': {
    id: 'anthropic/claude-haiku-4-5',
    provider: 'anthropic',
    aliases: ['haiku', 'claude-haiku', 'quick'],
    capabilities: ['fast', 'simple-tasks', 'cost-effective'],
    contextWindow: 200000,
    costTier: 'low',
    speed: 'very-fast',
    bestFor: ['quick-tasks', 'simple-queries', 'high-volume'],
    icon: '🍃',
    color: '#90D5C7',
  },
  'google/gemini-3-pro': {
    id: 'google/gemini-3-pro',
    provider: 'google',
    aliases: ['gemini-pro', 'gemini-3', 'long'],
    capabilities: ['multimodal', 'analysis', 'long-context'],
    contextWindow: 1000000,
    costTier: 'medium',
    speed: 'fast',
    bestFor: ['multimodal', 'long-documents', 'analysis'],
    icon: '🔮',
    color: '#4285F4',
  },
  'google/gemini-3-flash': {
    id: 'google/gemini-3-flash',
    provider: 'google',
    aliases: ['gemini-flash', 'fast'],
    capabilities: ['fast', 'multimodal', 'cost-effective'],
    contextWindow: 1000000,
    costTier: 'low',
    speed: 'very-fast',
    bestFor: ['quick-tasks', 'high-volume', 'simple-multimodal'],
    icon: '⚡',
    color: '#34A853',
  },
  'moonshot/kimi-k2.5': {
    id: 'moonshot/kimi-k2.5',
    provider: 'moonshot',
    aliases: ['kimi', 'kimi-k2'],
    capabilities: ['long-context', 'reasoning', 'analysis'],
    contextWindow: 256000,
    costTier: 'medium',
    speed: 'medium',
    bestFor: ['long-context', 'analysis', 'reasoning'],
    icon: '🌙',
    color: '#6366F1',
  },
  'deepseek/deepseek-chat': {
    id: 'deepseek/deepseek-chat',
    provider: 'deepseek',
    aliases: ['deepseek', 'cheap', 'code'],
    capabilities: ['coding', 'reasoning', 'cost-effective'],
    contextWindow: 64000,
    costTier: 'low',
    speed: 'fast',
    bestFor: ['coding', 'quick-analysis', 'cost-effective'],
    icon: '🔍',
    color: '#10B981',
  },
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    provider: 'openai',
    aliases: ['gpt4o', '4o', 'openai'],
    capabilities: ['general', 'multimodal', 'strong-reasoning'],
    contextWindow: 128000,
    costTier: 'high',
    speed: 'fast',
    bestFor: ['general-tasks', 'multimodal', 'complex-tasks'],
    icon: '🤖',
    color: '#10A37F',
  },
  'openai/gpt-4o-mini': {
    id: 'openai/gpt-4o-mini',
    provider: 'openai',
    aliases: ['gpt4o-mini', '4o-mini', 'mini'],
    capabilities: ['fast', 'cost-effective', 'general'],
    contextWindow: 128000,
    costTier: 'low',
    speed: 'very-fast',
    bestFor: ['quick-tasks', 'simple-queries', 'high-volume'],
    icon: '💨',
    color: '#19C37D',
  },
};

// Default chains
export const CHAINS: Record<string, ModelChain> = {
  default: {
    name: 'Default',
    primary: 'anthropic/claude-sonnet-4-5',
    fallbacks: [
      'google/gemini-3-pro',
      'moonshot/kimi-k2.5',
      'deepseek/deepseek-chat',
      'anthropic/claude-haiku-4-5',
    ],
    description: 'Balanced chain for general use',
  },
  coding: {
    name: 'Coding',
    primary: 'anthropic/claude-opus-4-6',
    fallbacks: [
      'anthropic/claude-opus-4-5',
      'anthropic/claude-sonnet-4-5',
      'deepseek/deepseek-chat',
      'google/gemini-3-pro',
    ],
    description: 'Optimized for code generation and analysis',
  },
  agentic: {
    name: 'Agentic Tasks',
    primary: 'anthropic/claude-opus-4-6',
    fallbacks: [
      'anthropic/claude-opus-4-5',
      'anthropic/claude-sonnet-4-5',
      'google/gemini-3-pro',
      'moonshot/kimi-k2.5',
    ],
    description: 'For long-running agentic tasks and extended thinking',
  },
  analysis: {
    name: 'Analysis',
    primary: 'google/gemini-3-pro',
    fallbacks: [
      'anthropic/claude-opus-4-6',
      'anthropic/claude-opus-4-5',
      'moonshot/kimi-k2.5',
      'anthropic/claude-sonnet-4-5',
    ],
    description: 'Optimized for deep analysis and reasoning',
  },
  fast: {
    name: 'Fast Response',
    primary: 'google/gemini-3-flash',
    fallbacks: [
      'anthropic/claude-haiku-4-5',
      'openai/gpt-4o-mini',
      'deepseek/deepseek-chat',
    ],
    description: 'Fast responses with lower cost',
  },
  longContext: {
    name: 'Long Context',
    primary: 'google/gemini-3-pro',
    fallbacks: [
      'moonshot/kimi-k2.5',
      'anthropic/claude-opus-4-5',
      'anthropic/claude-sonnet-4-5',
    ],
    description: 'For very long documents and context',
  },
  subagent: {
    name: 'Subagent',
    primary: 'anthropic/claude-sonnet-4-5',
    fallbacks: [
      'google/gemini-3-pro',
      'moonshot/kimi-k2.5',
      'deepseek/deepseek-chat',
      'anthropic/claude-haiku-4-5',
    ],
    description: 'Balanced chain for subagent tasks',
  },
  multimodal: {
    name: 'Multimodal',
    primary: 'google/gemini-3-pro',
    fallbacks: [
      'openai/gpt-4o',
      'google/gemini-3-flash',
      'anthropic/claude-sonnet-4-5',
    ],
    description: 'For image and document understanding',
  },
};

// In-memory session overrides
const sessionOverrides: Map<string, SessionOverride> = new Map();

export class ModelRouter {
  // Resolve alias to concrete model ID
  resolve(alias: string): string | null {
    // Check if it's already a full model ID
    if (MODELS[alias]) {
      return alias;
    }

    // Check aliases
    for (const [modelId, model] of Object.entries(MODELS)) {
      if (model.aliases.includes(alias.toLowerCase())) {
        return modelId;
      }
    }

    return null;
  }

  // Get model definition
  getModel(modelId: string): ModelDefinition | null {
    const resolved = this.resolve(modelId);
    return resolved ? MODELS[resolved] : null;
  }

  // Get all models
  getAllModels(): ModelDefinition[] {
    return Object.values(MODELS);
  }

  // Get all chains
  getAllChains(): ModelChain[] {
    return Object.values(CHAINS);
  }

  // Get chain by name
  getChain(name: string): ModelChain {
    return CHAINS[name] || CHAINS.default;
  }

  // Get next fallback in chain
  getFallback(modelId: string, chainName?: string): string | null {
    const chain = chainName ? this.getChain(chainName) : CHAINS.default;
    const allModels = [chain.primary, ...chain.fallbacks];
    const index = allModels.indexOf(modelId);
    
    if (index >= 0 && index < allModels.length - 1) {
      return allModels[index + 1];
    }
    
    return null;
  }

  // Set session override
  setSessionOverride(sessionId: string, aliasOrId: string, reason?: string): boolean {
    const modelId = this.resolve(aliasOrId);
    if (!modelId) {
      return false;
    }

    const override: SessionOverride = {
      sessionId,
      modelId,
      setAt: new Date(),
      reason,
    };

    sessionOverrides.set(sessionId, override);
    return true;
  }

  // Get session override
  getSessionOverride(sessionId: string): SessionOverride | null {
    const override = sessionOverrides.get(sessionId);
    if (override && override.expiresAt && new Date() > override.expiresAt) {
      sessionOverrides.delete(sessionId);
      return null;
    }
    return override || null;
  }

  // Clear session override
  clearSessionOverride(sessionId: string): boolean {
    return sessionOverrides.delete(sessionId);
  }

  // Route based on context
  route(message: string, context: RoutingContext = {}): ModelSelection {
    const { useCase, contextLength, requiresMultimodal, urgency, budget } = context;

    // Check for explicit use case
    if (useCase && CHAINS[useCase]) {
      const chain = CHAINS[useCase];
      return {
        primary: chain.primary,
        chain: [chain.primary, ...chain.fallbacks],
        reason: `Explicit use case: ${chain.name}`,
        estimatedCost: MODELS[chain.primary].costTier,
        confidence: 0.9,
      };
    }

    // Check context length
    if (contextLength && contextLength > 200000) {
      const chain = CHAINS.longContext;
      return {
        primary: chain.primary,
        chain: [chain.primary, ...chain.fallbacks],
        reason: `Long context required (${contextLength} tokens)`,
        estimatedCost: MODELS[chain.primary].costTier,
        confidence: 0.85,
      };
    }

    // Check multimodal requirement
    if (requiresMultimodal) {
      const chain = CHAINS.multimodal;
      return {
        primary: chain.primary,
        chain: [chain.primary, ...chain.fallbacks],
        reason: 'Multimodal capabilities required',
        estimatedCost: MODELS[chain.primary].costTier,
        confidence: 0.9,
      };
    }

    // Check urgency (fast response needed)
    if (urgency === 'high') {
      const chain = CHAINS.fast;
      return {
        primary: chain.primary,
        chain: [chain.primary, ...chain.fallbacks],
        reason: 'High urgency - fast response prioritized',
        estimatedCost: 'low',
        confidence: 0.8,
      };
    }

    // Check budget
    if (budget === 'low') {
      const cheapModel = 'deepseek/deepseek-chat';
      return {
        primary: cheapModel,
        chain: [cheapModel, 'google/gemini-3-flash', 'anthropic/claude-haiku-4-5'],
        reason: 'Low budget - cost-optimized selection',
        estimatedCost: 'low',
        confidence: 0.75,
      };
    }

    // Default to balanced chain
    const chain = CHAINS.default;
    return {
      primary: chain.primary,
      chain: [chain.primary, ...chain.fallbacks],
      reason: 'Default balanced selection',
      estimatedCost: MODELS[chain.primary].costTier,
      confidence: 0.7,
    };
  }

  // Get model for session (with override support)
  getModelForSession(sessionId: string, context?: RoutingContext): ModelSelection {
    // Check for session override first
    const override = this.getSessionOverride(sessionId);
    if (override) {
      const model = MODELS[override.modelId];
      return {
        primary: override.modelId,
        chain: [override.modelId, ...(model ? this.getChainForModel(override.modelId) : [])],
        reason: `Session override: ${override.reason || 'User preference'}`,
        estimatedCost: model?.costTier || 'medium',
        confidence: 1.0,
      };
    }

    // Otherwise route based on context
    return context ? this.route('', context) : this.route('');
  }

  // Get chain for a specific model
  private getChainForModel(modelId: string): string[] {
    for (const chain of Object.values(CHAINS)) {
      if (chain.primary === modelId || chain.fallbacks.includes(modelId)) {
        return [chain.primary, ...chain.fallbacks].filter(id => id !== modelId);
      }
    }
    return Object.keys(MODELS).filter(id => id !== modelId).slice(0, 3);
  }

  // Parse natural language model command
  parseCommand(input: string): { type: 'switch' | 'reset' | 'info'; model?: string; chain?: string } | null {
    const lower = input.toLowerCase().trim();

    // Reset commands
    if (lower.match(/^(reset|clear|default)\s+(model|override)/)) {
      return { type: 'reset' };
    }

    // Info commands
    if (lower.match(/^(what|which|show|current)\s+(model|chain)/)) {
      return { type: 'info' };
    }

    // Switch commands
    const switchMatch = lower.match(/(?:switch|use|change)\s+(?:to\s+)?(.+)/);
    if (switchMatch) {
      const target = switchMatch[1].trim();
      
      // Check if it's a chain name
      if (CHAINS[target]) {
        return { type: 'switch', chain: target };
      }
      
      // Otherwise treat as model alias
      const modelId = this.resolve(target);
      if (modelId) {
        return { type: 'switch', model: modelId };
      }
    }

    return null;
  }
}

// Export singleton instance
export const modelRouter = new ModelRouter();

// Export for use in other modules
export default modelRouter;
