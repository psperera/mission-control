'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Plus, X, Zap } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Message, Conversation, Agent, OpenClawHistoryMessage } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

export function ChatPanel() {
  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    messages,
    setMessages,
    addMessage,
    agents,
    addEvent,
    agentOpenClawSessions,
    openclawMessages,
    setOpenclawMessages,
  } = useMissionControl();

  const [newMessage, setNewMessage] = useState('');
  const [selectedSender, setSelectedSender] = useState<string>('');
  const [showConversationList, setShowConversationList] = useState(true);
  const [showNewConvoModal, setShowNewConvoModal] = useState(false);
  const [isSendingToOpenClaw, setIsSendingToOpenClaw] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Find if conversation has any OpenClaw-linked agent (other than self)
  const getOpenClawLinkedAgent = useCallback(() => {
    if (!currentConversation?.participants) return null;
    for (const participant of currentConversation.participants) {
      const session = agentOpenClawSessions[participant.id];
      if (session) {
        return { agent: participant, session };
      }
    }
    return null;
  }, [currentConversation?.participants, agentOpenClawSessions]);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversation) {
      fetchMessages(currentConversation.id);
      setShowConversationList(false);
    }
  }, [currentConversation?.id]);

  // Poll OpenClaw for messages when conversation has linked agent
  useEffect(() => {
    const linkedAgent = getOpenClawLinkedAgent();

    // Clear existing poll
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (!linkedAgent || !currentConversation) {
      setOpenclawMessages([]);
      return;
    }

    // Fetch OpenClaw history immediately
    const fetchOpenClawHistory = async () => {
      try {
        const res = await fetch(`/api/openclaw/sessions/${linkedAgent.session.openclaw_session_id}/history`);
        if (res.ok) {
          const data = await res.json();
          const history = data.history as OpenClawHistoryMessage[];

          // Convert OpenClaw history to Message format
          const convertedMessages: Message[] = history.map((msg, index) => ({
            id: `openclaw-${index}-${msg.timestamp || Date.now()}`,
            conversation_id: currentConversation.id,
            sender_agent_id: msg.role === 'assistant' ? linkedAgent.agent.id : undefined,
            content: msg.content,
            message_type: 'text',
            created_at: msg.timestamp || new Date().toISOString(),
            sender: msg.role === 'assistant' ? linkedAgent.agent : undefined,
            // Mark as OpenClaw message for UI styling
            metadata: JSON.stringify({ source: 'openclaw', role: msg.role }),
          }));

          setOpenclawMessages(convertedMessages);
        }
      } catch (error) {
        console.error('Failed to fetch OpenClaw history:', error);
      }
    };

    fetchOpenClawHistory();

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(fetchOpenClawHistory, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [currentConversation?.id, getOpenClawLinkedAgent, setOpenclawMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, openclawMessages]);

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentConversation || !selectedSender) return;

    const linkedAgent = getOpenClawLinkedAgent();
    const messageContent = newMessage;
    setNewMessage('');

    // If conversation has an OpenClaw-linked agent, send via OpenClaw
    if (linkedAgent) {
      setIsSendingToOpenClaw(true);
      try {
        // Use the session's channel (telegram or webchat)
        const channel = linkedAgent.session.channel || 'webchat';
        const res = await fetch(`/api/openclaw/sessions/${linkedAgent.session.openclaw_session_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: messageContent, channel }),
        });

        if (res.ok) {
          const sender = agents.find((a) => a.id === selectedSender);
          if (sender) {
            addEvent({
              id: crypto.randomUUID(),
              type: 'message_sent',
              agent_id: selectedSender,
              message: `${sender.name} sent a message to ${linkedAgent.agent.name} via OpenClaw`,
              created_at: new Date().toISOString(),
            });
          }
        } else {
          console.error('Failed to send message via OpenClaw');
        }
      } catch (error) {
        console.error('Failed to send message via OpenClaw:', error);
      } finally {
        setIsSendingToOpenClaw(false);
      }
      return;
    }

    // Otherwise, send to local DB (existing behavior)
    const tempMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: currentConversation.id,
      sender_agent_id: selectedSender,
      content: messageContent,
      message_type: 'text',
      created_at: new Date().toISOString(),
      sender: agents.find((a) => a.id === selectedSender),
    };

    // Optimistic update
    addMessage(tempMessage);

    try {
      const res = await fetch(`/api/conversations/${currentConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_agent_id: selectedSender,
          content: messageContent,
        }),
      });

      if (res.ok) {
        const sender = agents.find((a) => a.id === selectedSender);
        if (sender) {
          addEvent({
            id: crypto.randomUUID(),
            type: 'message_sent',
            agent_id: selectedSender,
            message: `${sender.name} sent a message`,
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const linkedAgentInfo = getOpenClawLinkedAgent();

  // Combine and sort messages (local + openclaw) for OpenClaw conversations
  const displayMessages = linkedAgentInfo
    ? openclawMessages // For OpenClaw convos, only show OpenClaw messages
    : messages; // For local convos, show local messages

  if (showConversationList) {
    return (
      <ConversationList
        conversations={conversations}
        onSelect={(conv) => setCurrentConversation(conv)}
        onNewConversation={() => setShowNewConvoModal(true)}
        showNewConvoModal={showNewConvoModal}
        setShowNewConvoModal={setShowNewConvoModal}
      />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-mc-bg-secondary">
      {/* CLI-style Header */}
      <div className="px-3 py-2 border-b border-mc-border flex items-center gap-3 font-mono text-sm bg-mc-bg-secondary">
        <button
          onClick={() => setShowConversationList(true)}
          className="text-mc-text-secondary hover:text-mc-text"
          title="Back to list"
        >
          ←
        </button>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-mc-text-tertiary">#</span>
          <span className="text-mc-text">
            {currentConversation?.title?.toLowerCase().replace(/\s+/g, '-') || 'chat'}
          </span>
          {linkedAgentInfo && (
            <>
              <span className="text-mc-text-tertiary">|</span>
              <span className="text-green-400 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {linkedAgentInfo.session.channel || 'webchat'}
              </span>
            </>
          )}
        </div>
        <div className="text-mc-text-tertiary text-xs">
          {currentConversation?.participants?.map((p) => p.name.toLowerCase()).join(', ')}
        </div>
        <button
          onClick={() => {
            setCurrentConversation(null);
            setShowConversationList(true);
          }}
          className="text-mc-text-secondary hover:text-red-400"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Messages - CLI style */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono bg-mc-bg">
        {displayMessages.length === 0 && (
          <div className="text-mc-text-tertiary text-sm">
            {linkedAgentInfo ? (
              <>
                <div className="text-green-400/60">// connected to {linkedAgentInfo.agent.name.toLowerCase()}</div>
                <div className="text-green-400/60">// channel: {linkedAgentInfo.session.channel || 'webchat'}</div>
                <div className="mt-2">type a message to begin...</div>
              </>
            ) : (
              <>
                <div className="text-blue-400/60">// local conversation</div>
                <div className="mt-2">select a sender and type a message...</div>
              </>
            )}
          </div>
        )}
        {displayMessages.map((message) => (
          <MessageBubble key={message.id} message={message} isOpenClaw={!!linkedAgentInfo} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* CLI-style Input */}
      <form onSubmit={handleSendMessage} className="border-t border-mc-border bg-mc-bg">
        {/* Channel indicator */}
        <div className="px-3 py-1.5 border-b border-mc-border/50 flex items-center gap-2 text-xs font-mono">
          {linkedAgentInfo ? (
            <>
              <span className="text-green-400">⚡ openclaw</span>
              <span className="text-mc-text-tertiary">→</span>
              <span className="text-yellow-400">{linkedAgentInfo.agent.name.toLowerCase()}</span>
              <span className="text-mc-text-tertiary ml-auto">
                {linkedAgentInfo.session.channel === 'telegram' ? '📱 telegram' : '💬 webchat'}
              </span>
            </>
          ) : (
            <>
              <span className="text-blue-400">💬 local</span>
              {selectedSender && (
                <>
                  <span className="text-mc-text-tertiary">as</span>
                  <span className="text-cyan-400">
                    {agents.find(a => a.id === selectedSender)?.name.toLowerCase()}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* Sender Selection - hidden for OpenClaw convos */}
        {!linkedAgentInfo && (
          <div className="px-3 py-2 border-b border-mc-border/50">
            <select
              value={selectedSender}
              onChange={(e) => setSelectedSender(e.target.value)}
              className="w-full bg-transparent border-none text-sm font-mono text-mc-text focus:outline-none"
            >
              <option value="" className="bg-mc-bg">select sender...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id} className="bg-mc-bg">
                  {agent.avatar_emoji} {agent.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* CLI-style input */}
        <div className="flex items-center px-3 py-2 font-mono">
          <span className="text-green-400 mr-2">{'>'}</span>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={linkedAgentInfo ? 'type message...' : 'type message...'}
            className="flex-1 bg-transparent border-none text-sm text-mc-text focus:outline-none placeholder:text-mc-text-tertiary"
            disabled={isSendingToOpenClaw}
            autoFocus
          />
          {isSendingToOpenClaw ? (
            <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <button
              type="submit"
              disabled={!newMessage.trim() || (!linkedAgentInfo && !selectedSender)}
              className="text-mc-text-secondary hover:text-green-400 disabled:opacity-30 disabled:hover:text-mc-text-secondary transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message, isOpenClaw }: { message: Message; isOpenClaw?: boolean }) {
  const sender = message.sender as Agent | undefined;

  // Parse metadata to check if this is an OpenClaw message and get role
  let openclawRole: string | null = null;
  let messageChannel: string | null = null;
  if (message.metadata) {
    try {
      const meta = JSON.parse(message.metadata);
      if (meta.source === 'openclaw') {
        openclawRole = meta.role;
      }
      messageChannel = meta.channel;
    } catch {
      // Ignore parse errors
    }
  }

  // For OpenClaw user messages (your messages), show differently
  const isYourMessage = openclawRole === 'user';

  // CLI-style formatting
  const timestamp = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const senderName = isYourMessage ? 'you' : (sender?.name?.toLowerCase() || 'agent');
  const channelIndicator = messageChannel === 'telegram' ? '📱' : (isOpenClaw ? '⚡' : '💬');

  return (
    <div className="font-mono text-sm animate-slide-in group">
      {/* CLI-style header */}
      <div className="flex items-center gap-2 text-mc-text-secondary text-xs mb-1">
        <span className="text-mc-text-tertiary">{timestamp}</span>
        <span className={`${isYourMessage ? 'text-blue-400' : 'text-green-400'}`}>
          {channelIndicator} {senderName}
        </span>
        {isOpenClaw && !isYourMessage && (
          <span className="text-yellow-500/60">via openclaw</span>
        )}
      </div>
      {/* Message content - CLI style */}
      <div className={`pl-4 border-l-2 ${isYourMessage ? 'border-blue-500/30' : 'border-green-500/30'}`}>
        <pre className="text-mc-text whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </pre>
      </div>
    </div>
  );
}

interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (conv: Conversation) => void;
  onNewConversation: () => void;
  showNewConvoModal: boolean;
  setShowNewConvoModal: (show: boolean) => void;
}

function ConversationList({
  conversations,
  onSelect,
  onNewConversation,
  showNewConvoModal,
  setShowNewConvoModal,
}: ConversationListProps) {
  const { agents, setConversations } = useMissionControl();
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [title, setTitle] = useState('');

  const handleCreateConversation = async () => {
    if (selectedAgents.length < 1) return;

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'New Conversation',
          type: selectedAgents.length > 2 ? 'group' : 'direct',
          participant_ids: selectedAgents,
        }),
      });

      if (res.ok) {
        const newConvo = await res.json();
        setConversations([newConvo, ...conversations]);
        setShowNewConvoModal(false);
        setSelectedAgents([]);
        setTitle('');
        onSelect(newConvo);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-mc-bg-secondary">
      <div className="p-3 border-b border-mc-border flex items-center justify-between">
        <h3 className="font-medium text-sm">Conversations</h3>
        <button
          onClick={onNewConversation}
          className="p-1.5 bg-mc-accent text-mc-bg rounded hover:bg-mc-accent/90"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className="w-full p-3 text-left rounded hover:bg-mc-bg-tertiary transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {conv.participants?.slice(0, 3).map((p) => (
                  <span key={p.id} className="text-lg">
                    {p.avatar_emoji}
                  </span>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {conv.title || conv.participants?.map((p) => p.name).join(', ')}
                </p>
                {conv.last_message && (
                  <p className="text-xs text-mc-text-secondary truncate">
                    {conv.last_message.content}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}

        {conversations.length === 0 && (
          <div className="text-center py-8 text-mc-text-secondary text-sm">
            No conversations yet
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConvoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-mc-bg-secondary border border-mc-border rounded-lg w-full max-w-md p-4">
            <h3 className="font-semibold mb-4">New Conversation</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Conversation name..."
                  className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
                />
              </div>

              <div>
                <label className="block text-sm mb-2">Participants</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {agents.map((agent) => (
                    <label
                      key={agent.id}
                      className="flex items-center gap-2 p-2 hover:bg-mc-bg-tertiary rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgents.includes(agent.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAgents([...selectedAgents, agent.id]);
                          } else {
                            setSelectedAgents(selectedAgents.filter((id) => id !== agent.id));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-lg">{agent.avatar_emoji}</span>
                      <span className="text-sm">{agent.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowNewConvoModal(false)}
                className="px-4 py-2 text-sm text-mc-text-secondary hover:text-mc-text"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConversation}
                disabled={selectedAgents.length < 1}
                className="px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
