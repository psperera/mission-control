'use client';

import { useState } from 'react';
import { Brain, Zap, Sparkles, Cpu, ChevronDown, Check, Info } from 'lucide-react';

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  contextWindow: string;
  speed: 'fast' | 'medium' | 'slow';
  cost: 'low' | 'medium' | 'high';
  icon: React.ReactNode;
  color: string;
}

const MODELS: ModelOption[] = [
  {
    id: 'moonshot/kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'Moonshot',
    description: 'Best for complex reasoning and long context',
    capabilities: ['Long context (256K)', 'Strong reasoning', 'Code generation', 'Analysis'],
    contextWindow: '256K tokens',
    speed: 'medium',
    cost: 'medium',
    icon: <Brain className="w-5 h-5" />,
    color: 'bg-purple-500',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Most capable for general tasks',
    capabilities: ['Multimodal', 'Fast responses', 'Excellent reasoning', 'Creative tasks'],
    contextWindow: '128K tokens',
    speed: 'fast',
    cost: 'high',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'bg-green-500',
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Excellent for writing and analysis',
    capabilities: ['Long context', 'Careful reasoning', 'Document analysis', 'Writing'],
    contextWindow: '200K tokens',
    speed: 'medium',
    cost: 'medium',
    icon: <Cpu className="w-5 h-5" />,
    color: 'bg-orange-500',
  },
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    description: 'Fast and cost-effective',
    capabilities: ['Very fast', 'Multimodal', 'Large context', 'Efficient'],
    contextWindow: '1M tokens',
    speed: 'fast',
    cost: 'low',
    icon: <Zap className="w-5 h-5" />,
    color: 'bg-blue-500',
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    description: 'Good balance of speed and quality',
    capabilities: ['Fast responses', 'Code generation', 'Reasoning', 'Cost-effective'],
    contextWindow: '64K tokens',
    speed: 'fast',
    cost: 'low',
    icon: <Zap className="w-5 h-5" />,
    color: 'bg-cyan-500',
  },
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const selected = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  const getSpeedBadge = (speed: string) => {
    const colors: Record<string, string> = {
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

  return (
    <div className="relative">
      {/* Selected Model Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
          isOpen 
            ? 'border-[#005EB8] bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300 bg-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className={`w-8 h-8 ${selected.color} rounded-lg flex items-center justify-center text-white`}>
          {selected.icon}
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">{selected.name}</p>
          <p className="text-xs text-gray-500">{selected.provider}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">Select Model</p>
            <p className="text-xs text-gray-500">Choose the best model for your task</p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {MODELS.map((model) => (
              <div key={model.id}>
                <button
                  onClick={() => {
                    onModelChange(model.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors text-left ${
                    selectedModel === model.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`w-10 h-10 ${model.color} rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                    {model.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{model.name}</p>
                      {selectedModel === model.id && (
                        <Check className="w-4 h-4 text-[#005EB8]" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{model.provider} • {model.contextWindow}</p>
                    <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${getSpeedBadge(model.speed)}`}>
                        {model.speed}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getCostBadge(model.cost)}`}>
                        {model.cost} cost
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetails(showDetails === model.id ? null : model.id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Info className="w-4 h-4 text-gray-400" />
                  </button>
                </button>

                {/* Expanded Details */}
                {showDetails === model.id && (
                  <div className="px-3 pb-3 bg-gray-50">
                    <div className="pl-13 ml-12">
                      <p className="text-xs font-medium text-gray-700 mb-1">Capabilities:</p>
                      <ul className="text-xs text-gray-600 space-y-0.5">
                        {model.capabilities.map((cap, idx) => (
                          <li key={idx}>• {cap}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
            <p className="text-xs text-gray-500">
              Tip: Use faster models for quick tasks, larger models for complex analysis.
            </p>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
