import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Bot, User, Loader2, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentAppearance {
  theme?: 'dark' | 'light' | 'auto';
  accentColor?: string;
  chatBackground?: string;
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
    appearance?: AgentAppearance;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  productivity: 'from-blue-500 to-blue-600',
  support: 'from-green-500 to-green-600',
  education: 'from-amber-500 to-amber-600',
  creative: 'from-indigo-500 to-indigo-600',
  'dev-tools': 'from-indigo-400 to-blue-600',
  marketing: 'from-green-400 to-green-600',
  data: 'from-blue-400 to-blue-600',
  entertainment: 'from-red-500 to-red-600',
  other: 'from-blue-400 to-indigo-500',
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
  const [isDark, setIsDark] = useState(true);

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

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const fetchAgent = async () => {
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers['x-access-token'] = accessToken;
      const res = await fetch(`${API_BASE}/api/store/${agentId}`, { headers });
      const data = await res.json();
      setAgent(data);

      // Set initial theme from agent appearance
      const theme = data.configSnapshot?.appearance?.theme;
      if (theme === 'light') setIsDark(false);
      else if (theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches) setIsDark(false);

      // Track usage
      fetch(`${API_BASE}/api/store/${agentId}/use`, { method: 'POST' });

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

      const response = await fetch(`${API_BASE}/api/store/${agentId}/chat`, {
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
      <div className="h-screen bg-t-page flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const chatBg = agent?.configSnapshot?.appearance?.chatBackground;
  const accentColor = agent?.configSnapshot?.appearance?.accentColor || '#3b82f6';

  return (
    <div
      className={`h-screen flex flex-col transition-colors duration-300 ${
        isDark ? 'bg-[#0f172a] text-[#f1f5f9]' : 'bg-[#f8fafc] text-[#1e293b]'
      }`}
      style={chatBg ? {
        backgroundImage: `url(${chatBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {/* Background overlay when image is set */}
      {chatBg && (
        <div className="fixed inset-0 z-0" style={{
          background: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(248,250,252,0.88)',
        }} />
      )}

      {/* Header */}
      <header
        className="flex-shrink-0 relative z-10"
        style={{
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
          background: isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              color: isDark ? 'rgba(241,245,249,0.5)' : 'rgba(30,41,59,0.5)',
            }}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Agent avatar mini */}
          <div
            className={`w-9 h-9 rounded-[22%] bg-gradient-to-br ${catColor} flex items-center justify-center flex-shrink-0`}
          >
            {agent?.icon ? (
              <img src={agent.icon} alt="" className="w-full h-full rounded-[22%] object-cover" />
            ) : (
              <span className="text-sm font-bold" style={{ color: isDark ? 'rgba(241,245,249,0.9)' : 'rgba(30,41,59,0.9)' }}>
                {agent?.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate" style={{ color: isDark ? 'rgba(241,245,249,0.9)' : 'rgba(30,41,59,0.9)' }}>
              {agent?.name}
            </h1>
          </div>

          <button
            onClick={() => navigate(`/store/${agentId}`)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: isDark ? 'rgba(241,245,249,0.5)' : 'rgba(30,41,59,0.5)' }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            onClick={handleClear}
            className="p-2 rounded-lg transition-colors"
            style={{ color: isDark ? 'rgba(241,245,249,0.3)' : 'rgba(30,41,59,0.3)' }}
            title={t('store.newConversation')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="text-center py-20 animate-fade-in-up">
              <div
                className={`w-20 h-20 rounded-[26%] bg-gradient-to-br ${catColor} flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden`}
                style={{ boxShadow: `0 8px 40px ${accentColor}40` }}
              >
                {agent?.icon ? (
                  <img src={agent.icon} alt="" className="w-full h-full object-cover rounded-[26%]" />
                ) : (
                  <span className="text-3xl font-bold" style={{ color: isDark ? 'rgba(241,245,249,0.9)' : 'rgba(30,41,59,0.9)' }}>
                    {agent?.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: isDark ? 'rgba(241,245,249,0.8)' : 'rgba(30,41,59,0.8)' }}>
                {agent?.name}
              </h2>
              <p className="text-sm" style={{ color: isDark ? 'rgba(241,245,249,0.4)' : 'rgba(30,41,59,0.4)' }}>
                {t('store.startConversation')}
              </p>
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
                  className={`w-8 h-8 rounded-[22%] bg-gradient-to-br ${catColor} flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden`}
                >
                  {agent?.icon ? (
                    <img src={agent.icon} alt="" className="w-full h-full rounded-[22%] object-cover" />
                  ) : (
                    <Bot className="w-4 h-4" style={{ color: isDark ? 'rgba(241,245,249,0.8)' : 'rgba(30,41,59,0.8)' }} />
                  )}
                </div>
              )}

              <div
                className="max-w-[80%] sm:max-w-[70%] px-4 py-3"
                style={{
                  borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  background: msg.role === 'user'
                    ? (isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)')
                    : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                  border: `1px solid ${msg.role === 'user'
                    ? 'rgba(59,130,246,0.2)'
                    : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                  }`,
                }}
              >
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                  style={{ color: isDark ? 'rgba(241,245,249,0.85)' : 'rgba(30,41,59,0.85)' }}
                >
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
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}
                >
                  <User className="w-4 h-4" style={{ color: isDark ? 'rgba(241,245,249,0.6)' : 'rgba(30,41,59,0.6)' }} />
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div
        className="flex-shrink-0 relative z-10"
        style={{
          background: isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('store.messagePlaceholder', { name: agent?.name || 'Agent' })}
                rows={4}
                className="w-full rounded-2xl px-4 py-3 pr-12 text-sm focus:outline-none resize-none max-h-[200px]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                  color: isDark ? 'rgba(241,245,249,0.9)' : 'rgba(30,41,59,0.9)',
                }}
                disabled={isStreaming}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors"
                style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}
              >
                {isStreaming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: isDark ? 'rgba(241,245,249,0.2)' : 'rgba(30,41,59,0.2)' }}>
            {t('store.poweredBy', { name: agent?.name })}
          </p>
        </div>
      </div>
    </div>
  );
}
