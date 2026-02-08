import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Trash2, Bot, User, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  category: string;
  configSnapshot: {
    model: string;
    welcomeMessage: string;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  productivity: 'from-blue-500 to-blue-600',
  support: 'from-green-500 to-emerald-600',
  education: 'from-amber-500 to-orange-600',
  creative: 'from-pink-500 to-rose-600',
  'dev-tools': 'from-purple-500 to-violet-600',
  marketing: 'from-emerald-500 to-teal-600',
  data: 'from-cyan-500 to-blue-600',
  entertainment: 'from-red-500 to-pink-600',
  other: 'from-gray-500 to-gray-600',
};

export default function AgentChat() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token') || '';

  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const fetchAgent = async () => {
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers['x-access-token'] = accessToken;
      const res = await fetch(`/api/store/${agentId}`, { headers });
      const data = await res.json();
      setAgent(data);

      // Track usage
      fetch(`/api/store/${agentId}/use`, { method: 'POST' });

      // Add welcome message
      if (data.configSnapshot?.welcomeMessage) {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: data.configSnapshot.welcomeMessage,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    // Create assistant placeholder
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages([...updatedMessages, assistantMsg]);

    try {
      // Build conversation history for the API (exclude welcome message if id === 'welcome')
      const apiMessages = updatedMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['x-access-token'] = accessToken;

      const response = await fetch(`/api/store/${agentId}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        throw new Error(`Erreur: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream non disponible');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
                );
              }
              if (data.done) break;
            } catch {
              // skip
            }
          }
        }
      }
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Désolé, une erreur est survenue : ${error.message}` }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    const welcome = agent?.configSnapshot?.welcomeMessage;
    setMessages(
      welcome
        ? [{ id: 'welcome', role: 'assistant', content: welcome, timestamp: new Date() }]
        : []
    );
  };

  const catColor = CATEGORY_COLORS[agent?.category || 'other'] || CATEGORY_COLORS.other;

  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="glass-strong border-b border-white/10 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate(`/store/${agentId}`)}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Agent avatar mini */}
          <div
            className={`w-9 h-9 rounded-[22%] bg-gradient-to-br ${catColor} flex items-center justify-center flex-shrink-0`}
          >
            {agent?.icon ? (
              <img src={agent.icon} alt="" className="w-full h-full rounded-[22%] object-cover" />
            ) : (
              <span className="text-sm font-bold text-white/90">
                {agent?.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white/90 truncate">{agent?.name}</h1>
            <p className="text-xs text-white/30 truncate">
              {agent?.configSnapshot?.model?.split('/').pop()}
            </p>
          </div>

          <button
            onClick={handleClear}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title={t('store.newConversation')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="text-center py-20 animate-fade-in-up">
              <div
                className={`w-20 h-20 rounded-[26%] bg-gradient-to-br ${catColor} flex items-center justify-center mx-auto mb-4 shadow-lg`}
                style={{ boxShadow: `0 8px 40px ${agent?.iconColor || '#3b82f6'}40` }}
              >
                <span className="text-3xl font-bold text-white/90">
                  {agent?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-white/80 mb-2">{agent?.name}</h2>
              <p className="text-white/40 text-sm">{t('store.startConversation')}</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 mb-6 animate-fade-in-up ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div
                  className={`w-8 h-8 rounded-[22%] bg-gradient-to-br ${catColor} flex items-center justify-center flex-shrink-0 mt-0.5`}
                >
                  {agent?.icon ? (
                    <img src={agent.icon} alt="" className="w-full h-full rounded-[22%] object-cover" />
                  ) : (
                    <Bot className="w-4 h-4 text-white/80" />
                  )}
                </div>
              )}

              <div
                className={`max-w-[80%] sm:max-w-[70%] ${
                  msg.role === 'user'
                    ? 'bg-blue-500/20 border border-blue-500/20 rounded-2xl rounded-tr-md'
                    : 'bg-white/[0.04] border border-white/5 rounded-2xl rounded-tl-md'
                } px-4 py-3`}
              >
                <div className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap break-words">
                  {msg.content}
                  {msg.role === 'assistant' && msg.content === '' && isStreaming && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-white/60" />
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-white/10 glass-strong">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('store.messagePlaceholder', { name: agent?.name || 'Agent' })}
                rows={1}
                className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 pr-12 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-none max-h-[200px]"
                disabled={isStreaming}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="absolute right-2 bottom-2 p-2 rounded-xl btn-gradient disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-white/20 mt-2">
            {t('store.poweredBy', { name: agent?.name })}
          </p>
        </div>
      </div>
    </div>
  );
}
