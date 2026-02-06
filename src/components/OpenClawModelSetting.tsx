'use client';

import { useState, useEffect } from 'react';
import { Bot, Check, Loader2, AlertCircle, Save } from 'lucide-react';

interface ModelOption {
  id: string;
  name: string;
  description: string;
  provider: string;
  icon: string;
  color: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'moonshot/kimi-k2.5',
    name: '💰 Cost Saving',
    description: 'Kimi K2.5 - Great balance of quality and cost (Recommended)',
    provider: 'Moonshot',
    icon: '🌙',
    color: 'from-indigo-500 to-purple-500',
  },
  {
    id: 'anthropic/claude-opus-4-6',
    name: '🎯 Best Quality',
    description: 'Claude Opus 4.6 - Maximum capability for complex tasks',
    provider: 'Anthropic',
    icon: '🧠',
    color: 'from-orange-400 to-yellow-400',
  },
  {
    id: 'anthropic/claude-sonnet-4-5',
    name: '⚡ Balanced',
    description: 'Claude Sonnet 4.5 - Good balance of speed and quality',
    provider: 'Anthropic',
    icon: '⚡',
    color: 'from-blue-400 to-cyan-400',
  },
];

export function OpenClawModelSetting() {
  const [currentModel, setCurrentModel] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchCurrentModel();
  }, []);

  const fetchCurrentModel = async () => {
    setIsLoading(true);
    try {
      // Try to get current model from OpenClaw
      const res = await fetch('/api/openclaw/status');
      if (res.ok) {
        const data = await res.json();
        // Extract current model from status
        const model = data.defaults?.model || 'moonshot/kimi-k2.5';
        setCurrentModel(model);
        setSelectedModel(model);
      }
    } catch (err) {
      console.error('Failed to fetch current model:', err);
      // Default to Kimi if can't fetch
      setCurrentModel('moonshot/kimi-k2.5');
      setSelectedModel('moonshot/kimi-k2.5');
    } finally {
      setIsLoading(false);
    }
  };

  const saveModel = async () => {
    if (selectedModel === currentModel) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/settings/openclaw-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });

      if (res.ok) {
        setCurrentModel(selectedModel);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update model');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedOption = MODEL_OPTIONS.find(m => m.id === selectedModel);
  const currentOption = MODEL_OPTIONS.find(m => m.id === currentModel);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Bot className="w-6 h-6 text-[#005EB8]" />
        <h3 className="text-lg font-semibold text-gray-900">OpenClaw Default Model</h3>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Choose the default AI model for your OpenClaw gateway. This affects all new conversations.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading current model...
        </div>
      ) : (
        <>
          {/* Current Model Display */}
          {currentOption && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Currently Active:</p>
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentOption.icon}</span>
                <span className="font-medium text-gray-900">{currentOption.name}</span>
                <span className="text-xs text-gray-400">({currentOption.provider})</span>
              </div>
            </div>
          )}

          {/* Model Selection */}
          <div className="space-y-3 mb-4">
            {MODEL_OPTIONS.map((option) => (
              <label
                key={option.id}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedModel === option.id
                    ? 'border-[#005EB8] bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="openclaw-model"
                  value={option.id}
                  checked={selectedModel === option.id}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="mt-1 w-4 h-4 text-[#005EB8]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{option.icon}</span>
                    <span className="font-semibold text-gray-900">{option.name}</span>
                    {option.id === 'moonshot/kimi-k2.5' && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                  <p className="text-xs text-gray-400 mt-1">Provider: {option.provider}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg mb-4">
              <Check className="w-4 h-4" />
              Model updated successfully! New conversations will use this model.
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={saveModel}
            disabled={isSaving || selectedModel === currentModel}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#005EB8] text-white rounded-lg hover:bg-[#004a93] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : selectedModel === currentModel ? (
              'Current Model Active'
            ) : (
              <>
                <Save className="w-4 h-4" />
                Update Default Model
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 mt-3 text-center">
            Changes take effect immediately for new conversations.
          </p>
        </>
      )}
    </div>
  );
}
