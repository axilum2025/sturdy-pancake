import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X, Bot, User, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PlaygroundProps {
  agentId: string;
  onClose?: () => void;
}

interface PlaygroundMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export default function Playground({ agentId, onClose }: PlaygroundProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadAgentWelcome();
  }, [agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAgentWelcome = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/agents/${agentId}`, { headers });
      if (res.ok) {
        const agent = await res.json();
        if (agent.config?.welcomeMessage) {
          setWelcomeMessage(agent.config.welcomeMessage);
        }
      }
    } catch (error) {
      console.error('Error loading agent:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: PlaygroundMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const assistantMsg: PlaygroundMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      // Build conversation history for the API
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) throw new Error(`Chat failed: ${res.statusText}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content' && parsed.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + parsed.content }
                      : m
                  )
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Playground chat error:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: t('playground.error'), isStreaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400 glow-icon" />
          <span className="font-semibold gradient-text">{t('playground.title')}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            {t('playground.live')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            onClick={clearChat}
            title={t('playground.reset')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-8 animate-fade-in-up">
            <Bot className="w-12 h-12 mx-auto mb-3 text-blue-400/40" />
            <p className="text-white/50 mb-1 text-sm">{t('playground.testAgent')}</p>
            {welcomeMessage && (
              <div className="mt-4 mx-auto max-w-md bg-white/[0.04] rounded-xl p-4 border border-white/10">
                <p className="text-sm text-white/60 italic">"{welcomeMessage}"</p>
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500/20 border border-blue-500/30 text-white/90'
                  : 'bg-white/[0.04] border border-white/10 text-white/80'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content || (msg.isStreaming ? '...' : '')}</p>
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 -mb-0.5" />
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-white/60" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('playground.placeholder')}
            className="flex-1 bg-white/[0.04] text-white/90 px-4 py-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10"
            rows={2}
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="p-3 rounded-xl btn-gradient disabled:opacity-30 transition-all"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
