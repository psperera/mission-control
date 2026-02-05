'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Zap, Sparkles, Cpu, Wind, Search, Moon, Bot, ChevronDown, Check, Info, Layers, Link2, RefreshCw } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  provider: string;
  aliases: string[];
  capabilities: string[];
  contextWindow: number;
  costTier: 'low' | 'medium' | 'high';
  speed: 'very-fast' | 'fast' | 'medium' | 'slow';
  bestFor: string[];
  icon: string;
  color: string;
}

interface Chain {
  name: string;
  primary: string;
  fallbacks: string[];
  description: string;
}

interface SessionModel {
  primary: string;
  chain: string[];
  reason: string;
  estimatedCost: string;
  confidence: number;
  model?: Model;
  override?: {
    modelId: string;
    model: Model;
    setAt: string;
    reason?: string;
  } | null;
}

interface ModelChainSelectorProps {
  sessionId: string;
}

const iconMap: Record<string, React.ReactNode> = {
  '🧠': <Brain className="w-5 h-5" />,
  '⚡': <Zap className="w-5 h-5" />,
  '🍃': <Wind className="w-5 h-5" />,
  '🔮': <Sparkles className="w-5 h-5" />,
  '🌙': <Moon className="w-5 h-5" />,
  '🔍': <Search className="w-5 h-5" />,
  '🤖': <Bot className="w-5 h-5" />,
  '💨': <Wind className="w-5 h-5" />,
};

const providerColors: Record<string, string> = {
  anthropic: 'from-orange-400 to-yellow-400',
  google: 'from-blue-400 to-cyan-400',
  moonshot: 'from-indigo-400 to-purple-400',
  deepseek: 'from-green-400 to-emerald-400',
  openai: 'from-teal-400 to-green-400',
};

export function ModelChainSelector({ sessionId }: ModelChainSelectorProps) {
  const [models, setModels] = useState<Record<string, Model>>({});
  const [chains, setChains] = useState<Record<string, Chain>>({});
  const [sessionModel, setSessionModel] = useState<SessionModel | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'models' | 'chains'>('models');
  const [isLoading, setIsLoading] = useState(false);
  const [showChain, setShowChain] = useState(false);

  useEffect(() => {
    fetchModels();
    fetchSessionModel();
  }, [sessionId]);

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        const modelMap: Record<string, Model> = {};
        data.models.forEach((m: Model) => {
          modelMap[m.id] = m;
        });
        setModels(modelMap);
        
        const chainMap: Record<string, Chain> = {};
        data.chains.forEach((c: Chain) => {
          chainMap[c.name.toLowerCase().replace(/\s+/g, '')] = c;
        });
        setChains(chainMap);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const fetchSessionModel = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/model`);
      if (res.ok) {
        const data = await res.json();
        setSessionModel(data);
      }
    } catch (error) {
      console.error('Failed to fetch session model:', error);
    }
  };

  const switchModel = async (modelIdOrChain: string, isChain = false) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: modelIdOrChain,
          reason: isChain ? `Switched to ${modelIdOrChain} chain` : 'User selection'
        }),
      });

      if (res.ok) {
        await fetchSessionModel();
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to switch model:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetModel = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'reset' }),
      });

      if (res.ok) {
        await fetchSessionModel();
      }
    } catch (error) {
      console.error('Failed to reset model:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSpeedBadge = (speed: string) => {
    const colors: Record<string, string> = {
      'very-fast': 'bg-green-100 text-green-700',
      fast: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      slow: 'bg-red-100 text-red-700',
    };
    return colors[speed] || colors.medium;
  };

  const getCostBadge = (cost: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-red-100 text-red-700',
    };
    return colors[cost] || colors.medium;
  };

  const formatContextWindow = (tokens: number) => {
    if (tokens >= 1000000) return '1M';
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
    return tokens.toString();
  };

  const currentModel = sessionModel?.override?.model || sessionModel?.model;
  const currentChain = sessionModel?.chain || [];

  return (
    <div className="relative">
      {/* Selected Model Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
          sessionModel?.override 
            ? 'border-orange-400 bg-orange-50' 
            : isOpen 
              ? 'border-[#005EB8] bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300 bg-white'
        } ${isLoading ? 'opacity-50' : ''}`}
      >
        {currentModel ? (
          <>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${providerColors[currentModel.provider] || 'from-gray-400 to-gray-500'}`}>
              {iconMap[currentModel.icon] || <Cpu className="w-5 h-5" />}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">
                  {currentModel.id.split('/').pop()}
                </p>
                {sessionModel?.override && (
                  <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                    override
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {currentModel.provider} • {formatContextWindow(currentModel.contextWindow)} tokens
              </p>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500">Loading...</div>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Chain Preview */}
      {currentChain.length > 0 && (
        <button
          onClick={() => setShowChain(!showChain)}
          className="absolute -bottom-6 left-0 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <Layers className="w-3 h-3" />
          {showChain ? 'Hide' : 'Show'} fallback chain ({currentChain.length} models)
        </button>
      )}

      {/* Chain Display */}
      {showChain && currentChain.length > 0 && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-gray-50 border border-gray-200 rounded-lg p-3 z-40">
          <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            Fallback Chain
          </p>
          <div className="space-y-1">
            {currentChain.map((modelId, idx) => {
              const model = models[modelId];
              if (!model) return null;
              return (
                <div key={modelId} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-4">{idx + 1}.</span>
                  <span className="text-gray-700">{model.id.split('/').pop()}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${getCostBadge(model.costTier)}`}>
                    {model.costTier}
                  </span>
                </div>
              );
            })}
          </div>
          {sessionModel?.reason && (
            <p className="text-xs text-gray-500 mt-2 italic">{sessionModel.reason}</p>
          )}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-[450px] bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Model Selection</p>
              {sessionModel?.override && (
                <button
                  onClick={resetModel}
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset to default
                </button>
              )}
            </div>
            
            {/* Tabs */}
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('models')}
                className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                  activeTab === 'models' 
                    ? 'bg-[#005EB8] text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Models
              </button>
              <button
                onClick={() => setActiveTab('chains')}
                className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                  activeTab === 'chains' 
                    ? 'bg-[#005EB8] text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Chains
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {activeTab === 'models' ? (
              <div className="p-2">
                {Object.values(models).map((model) => (
                  <button
                    key={model.id}
                    onClick={() => switchModel(model.id)}
                    className={`w-full flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors text-left rounded-lg ${
                      currentModel?.id === model.id ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br ${providerColors[model.provider] || 'from-gray-400 to-gray-500'}`}>
                      {iconMap[model.icon] || <Cpu className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{model.id.split('/').pop()}</p>
                        {currentModel?.id === model.id && <Check className="w-4 h-4 text-[#005EB8]" />}
                      </div>
                      <p className="text-xs text-gray-500">{model.provider} • {formatContextWindow(model.contextWindow)} tokens</p>
                      <p className="text-sm text-gray-600 mt-1">{model.bestFor.join(', ')}</p>
                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${getSpeedBadge(model.speed)}`}>
                          {model.speed}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getCostBadge(model.costTier)}`}>
                          {model.costTier}
                        </span>
                      </div>
                      {model.aliases.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Aliases: {model.aliases.join(', ')}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-2">
                {Object.values(chains).map((chain) => (
                  <button
                    key={chain.name}
                    onClick={() => switchModel(chain.name.toLowerCase().replace(/\s+/g, ''), true)}
                    className={`w-full flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors text-left rounded-lg`}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br from-purple-400 to-pink-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{chain.name}</p>
                      <p className="text-sm text-gray-600">{chain.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          Primary: {chain.primary.split('/').pop()}
                        </span>
                        {chain.fallbacks.slice(0, 2).map((fb, idx) => (
                          <span key={fb} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {idx + 2}. {fb.split('/').pop()}
                          </span>
                        ))}
                        {chain.fallbacks.length > 2 && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">
                            +{chain.fallbacks.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
            <p className="text-xs text-gray-500">
              Tip: You can also type commands like "switch to sonnet" or "use fast chain"
            </p>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
