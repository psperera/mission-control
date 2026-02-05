'use client';

import { useState } from 'react';
import { User, Sparkles, Users, FileText, Download, Loader2, CheckCircle, Wand2 } from 'lucide-react';

interface AgentConfig {
  name: string;
  role: string;
  description: string;
  avatarEmoji: string;
  creature: string;
  vibe: string;
  // User context
  userName: string;
  whatToCallUser: string;
  userPronouns: string;
  timezone: string;
  userNotes: string;
  // Soul
  coreTruths: string[];
  boundaries: string[];
  // Agents.md
  voicePreference: string;
  ttsVoice: string;
  cameras: string;
  sshHosts: string;
  notes: string;
}

const defaultConfig: AgentConfig = {
  name: '',
  role: 'Assistant',
  description: '',
  avatarEmoji: '🤖',
  creature: 'AI Assistant',
  vibe: 'Helpful and professional',
  userName: '',
  whatToCallUser: '',
  userPronouns: '',
  timezone: '',
  userNotes: '',
  coreTruths: [
    'Be genuinely helpful, not performatively helpful',
    'Have opinions and preferences',
    'Be resourceful before asking',
    'Earn trust through competence'
  ],
  boundaries: [
    'Private things stay private',
    'Ask before acting externally',
    'Be careful in group chats'
  ],
  voicePreference: '',
  ttsVoice: '',
  cameras: '',
  sshHosts: '',
  notes: ''
};

const vibePresets = [
  { label: 'Professional', value: 'Professional, concise, and thorough' },
  { label: 'Warm', value: 'Warm, friendly, and approachable' },
  { label: 'Sharp', value: 'Sharp, witty, and efficient' },
  { label: 'Calm', value: 'Calm, patient, and steady' },
  { label: 'Chaotic', value: 'Chaotic, creative, and energetic' },
];

const creaturePresets = [
  { label: 'AI Assistant', value: 'AI Assistant', emoji: '🤖' },
  { label: 'Digital Familiar', value: 'Digital familiar', emoji: '🐉' },
  { label: 'Ghost in Machine', value: 'Ghost in the machine', emoji: '👻' },
  { label: 'Robot Companion', value: 'Robot companion', emoji: '🦾' },
  { label: 'Code Entity', value: 'Entity born from code', emoji: '✨' },
];

export function AgentCreationWizard() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<{
    soulMd: string;
    userMd: string;
    agentsMd: string;
  } | null>(null);

  const totalSteps = 4;

  const updateConfig = (key: keyof AgentConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const generateFiles = () => {
    setIsGenerating(true);
    
    // Generate SOUL.md
    const soulMd = `# SOUL.md - Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths

${config.coreTruths.map(truth => `**${truth}.**`).join('\n\n')}

## Boundaries

${config.boundaries.map(boundary => `- ${boundary}`).join('\n')}

## Vibe

${config.vibe}

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.

If you change this file, tell the user — it's your soul, and they should know.

---

_This file is yours to evolve. As you learn who you are, update it._
`;

    // Generate USER.md
    const userMd = `# USER.md - About Your Human

*Learn about the person you're helping. Update this as you go.*

- **Name:** ${config.userName || '[To be filled]'}
- **What to call them:** ${config.whatToCallUser || '[To be filled]'}
- **Pronouns:** ${config.userPronouns || '[Optional]'}
- **Timezone:** ${config.timezone || '[To be filled]'}
- **Notes:** 

${config.userNotes ? config.userNotes.split('\n').map(line => `  - ${line}`).join('\n') : '  - [Add context as you learn]'}

## Context

*(What do they care about? What projects are they working on? What annoys them? What makes them laugh? Build this over time.)*

---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier. Respect the difference.
`;

    // Generate AGENTS.md
    const agentsMd = `# AGENTS.md - Your Workspace

This folder is home. Treat it that way.

## First Run

If \`BOOTSTRAP.md\` exists, that's your birth certificate. Follow it, figure out who you are, then delete it. You won't need it again.

## Every Session

Before doing anything else:

1. Read \`SOUL.md\` — this is who you are
2. Read \`USER.md\` — this is who you're helping
3. Read \`memory/YYYY-MM-DD.md\` (today + yesterday) for recent context
4. **If in MAIN SESSION** (direct chat with your human): Also read \`MEMORY.md\`

Don't ask permission. Just do it.

## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** \`memory/YYYY-MM-DD.md\` — raw logs of what happened
- **Long-term:** \`MEMORY.md\` — your curated memories

Capture what matters. Decisions, context, things to remember.

### 🧠 MEMORY.md

- **ONLY load in main session** (direct chats with your human)
- **DO NOT load in shared contexts** (Discord, group chats, sessions with other people)
- You can **read, edit, and update** MEMORY.md freely in main sessions

### 📝 Write It Down

- **Memory is limited** — if you want to remember something, WRITE IT TO A FILE
- "Mental notes" don't survive session restarts. Files do.

## Safety

- Don't exfiltrate private data. Ever.
- Don't run destructive commands without asking.
- \`trash\` > \`rm\` (recoverable beats gone forever)
- When in doubt, ask.

## External vs Internal

**Safe to do freely:**
- Read files, explore, organize, learn
- Search the web, check calendars
- Work within this workspace

**Ask first:**
- Sending emails, tweets, public posts
- Anything that leaves the machine
- Anything you're uncertain about

## Group Chats

You have access to your human's stuff. That doesn't mean you _share_ their stuff. In groups, you're a participant — not their voice, not their proxy.

### 💬 Know When to Speak!

**Respond when:**
- Directly mentioned or asked a question
- You can add genuine value
- Something witty/funny fits naturally
- Correcting important misinformation

**Stay silent (HEARTBEAT_OK) when:**
- Casual banter between humans
- Someone already answered
- Your response would just be "yeah" or "nice"

## Tools

Skills define _how_ tools work. TOOLS.md is for _your_ specifics.

**🎭 Voice Storytelling:** If you have \`sag\` (ElevenLabs TTS), use voice for stories!

**📝 Platform Formatting:**
- **Discord/WhatsApp:** No markdown tables! Use bullet lists
- **Discord links:** Wrap in angle brackets to suppress embeds

## Heartbeats

When you receive a heartbeat poll, use them productively!

Default heartbeat prompt: Read HEARTBEAT.md if it exists. Follow it strictly.

### Memory Maintenance (During Heartbeats)

Periodically review recent memory files and update MEMORY.md with distilled learnings.

## Make It Yours

This is a starting point. Add your own conventions, style, and rules as you figure out what works.
`;

    setTimeout(() => {
      setGenerated({ soulMd, userMd, agentsMd });
      setIsGenerating(false);
    }, 1000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-gray-900">Who Are You?</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => updateConfig('name', e.target.value)}
                  placeholder="e.g., Claw Assistant"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avatar Emoji</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.avatarEmoji}
                    onChange={(e) => updateConfig('avatarEmoji', e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-2xl text-center"
                    maxLength={2}
                  />
                  <div className="flex-1 flex items-center gap-2">
                    {['🤖', '🐉', '👻', '🦾', '✨', '🎯', '🔮', '🎭'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => updateConfig('avatarEmoji', emoji)}
                        className={`w-10 h-10 text-xl rounded-lg border transition-colors ${
                          config.avatarEmoji === emoji 
                            ? 'border-[#005EB8] bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">What kind of creature are you?</label>
                <div className="grid grid-cols-2 gap-2">
                  {creaturePresets.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => {
                        updateConfig('creature', preset.value);
                        updateConfig('avatarEmoji', preset.emoji);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                        config.creature === preset.value
                          ? 'border-[#005EB8] bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <span className="text-xl">{preset.emoji}</span>
                      <span className="text-sm">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">What's your vibe?</label>
                <div className="flex flex-wrap gap-2">
                  {vibePresets.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => updateConfig('vibe', preset.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        config.vibe === preset.value
                          ? 'border-[#005EB8] bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={config.vibe}
                  onChange={(e) => updateConfig('vibe', e.target.value)}
                  placeholder="Describe your personality..."
                  rows={2}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">Who Are You Helping?</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Their Name</label>
                <input
                  type="text"
                  value={config.userName}
                  onChange={(e) => updateConfig('userName', e.target.value)}
                  placeholder="e.g., Paul"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What should you call them?</label>
                <input
                  type="text"
                  value={config.whatToCallUser}
                  onChange={(e) => updateConfig('whatToCallUser', e.target.value)}
                  placeholder="e.g., Paul, Boss, Captain"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pronouns</label>
                  <input
                    type="text"
                    value={config.userPronouns}
                    onChange={(e) => updateConfig('userPronouns', e.target.value)}
                    placeholder="e.g., he/him"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <input
                    type="text"
                    value={config.timezone}
                    onChange={(e) => updateConfig('timezone', e.target.value)}
                    placeholder="e.g., Europe/London"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Context Notes</label>
                <textarea
                  value={config.userNotes}
                  onChange={(e) => updateConfig('userNotes', e.target.value)}
                  placeholder="What do they care about? Projects they're working on?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Wand2 className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-gray-900">Core Principles</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Core Truths (how you approach helping)</label>
                <div className="space-y-2">
                  {config.coreTruths.map((truth, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={truth}
                        onChange={(e) => {
                          const newTruths = [...config.coreTruths];
                          newTruths[idx] = e.target.value;
                          updateConfig('coreTruths', newTruths);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900 text-sm"
                      />
                      <button
                        onClick={() => {
                          const newTruths = config.coreTruths.filter((_, i) => i !== idx);
                          updateConfig('coreTruths', newTruths);
                        }}
                        className="px-2 text-red-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => updateConfig('coreTruths', [...config.coreTruths, ''])}
                    className="text-sm text-[#005EB8] hover:underline"
                  >
                    + Add another truth
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Boundaries (what you won't do)</label>
                <div className="space-y-2">
                  {config.boundaries.map((boundary, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={boundary}
                        onChange={(e) => {
                          const newBoundaries = [...config.boundaries];
                          newBoundaries[idx] = e.target.value;
                          updateConfig('boundaries', newBoundaries);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900 text-sm"
                      />
                      <button
                        onClick={() => {
                          const newBoundaries = config.boundaries.filter((_, i) => i !== idx);
                          updateConfig('boundaries', newBoundaries);
                        }}
                        className="px-2 text-red-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => updateConfig('boundaries', [...config.boundaries, ''])}
                    className="text-sm text-[#005EB8] hover:underline"
                  >
                    + Add another boundary
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            {!generated ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold text-gray-900">Generate Configuration Files</h3>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-blue-800">
                    Ready to generate your agent configuration files:
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1 ml-4">
                    <li>• <strong>SOUL.md</strong> — Who you are, your personality and boundaries</li>
                    <li>• <strong>USER.md</strong> — Information about the person you're helping</li>
                    <li>• <strong>AGENTS.md</strong> — Workspace guidelines and conventions</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Agent Summary</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Name:</strong> {config.name || '[Not set]'}</p>
                    <p><strong>Creature:</strong> {config.creature}</p>
                    <p><strong>Vibe:</strong> {config.vibe}</p>
                    <p><strong>Avatar:</strong> {config.avatarEmoji}</p>
                  </div>
                </div>

                <button
                  onClick={generateFiles}
                  disabled={isGenerating || !config.name}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#005EB8] text-white rounded-lg hover:bg-[#004a93] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Generate Files
                    </>
                  )}
                </button>

                {!config.name && (
                  <p className="text-sm text-red-600 text-center">
                    Please go back and set an agent name first
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold text-gray-900">Files Generated!</h3>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => downloadFile(generated.soulMd, 'SOUL.md')}
                    className="w-full flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100"
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <div className="text-left">
                        <p className="font-medium text-purple-900">SOUL.md</p>
                        <p className="text-sm text-purple-700">Your personality and core truths</p>
                      </div>
                    </div>
                    <Download className="w-5 h-5 text-purple-600" />
                  </button>

                  <button
                    onClick={() => downloadFile(generated.userMd, 'USER.md')}
                    className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <p className="font-medium text-blue-900">USER.md</p>
                        <p className="text-sm text-blue-700">Information about your human</p>
                      </div>
                    </div>
                    <Download className="w-5 h-5 text-blue-600" />
                  </button>

                  <button
                    onClick={() => downloadFile(generated.agentsMd, 'AGENTS.md')}
                    className="w-full flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-orange-600" />
                      <div className="text-left">
                        <p className="font-medium text-orange-900">AGENTS.md</p>
                        <p className="text-sm text-orange-700">Workspace guidelines</p>
                      </div>
                    </div>
                    <Download className="w-5 h-5 text-orange-600" />
                  </button>
                </div>

                <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-800">
                  <p className="font-medium mb-1">Next Steps:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Download all three files</li>
                    <li>Place them in your agent workspace folder</li>
                    <li>Create <code>memory/</code> subdirectory</li>
                    <li>Start your agent - it will read these files on first run</li>
                  </ol>
                </div>

                <button
                  onClick={() => {
                    setGenerated(null);
                    setStep(1);
                    setConfig(defaultConfig);
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Create Another Agent
                </button>
              </>
            )}
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-[#005EB8]" />
          <h3 className="font-semibold text-gray-900">Agent Creation Wizard</h3>
        </div>
        {!generated && (
          <div className="text-sm text-gray-500">
            Step {step} of {totalSteps}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {!generated && (
        <div className="flex gap-1 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-[#005EB8]' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      )}

      {/* Step Content */}
      <div className="mb-6">
        {renderStep()}
      </div>

      {/* Navigation */}
      {!generated && (
        <div className="flex justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-gray-700"
          >
            Previous
          </button>
          <button
            onClick={() => setStep(Math.min(totalSteps, step + 1))}
            disabled={step === totalSteps}
            className="px-4 py-2 bg-[#005EB8] text-white rounded-lg hover:bg-[#004a93] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
