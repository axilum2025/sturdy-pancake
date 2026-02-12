import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Bot, User, Sun, Moon, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../services/api';

// ─── Types ───────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
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

// ─── Markdown renderer (matches chat.html) ───────────────────
function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = escapeHtml(text);
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // List items
  html = html.replace(/^- (.+)/gm, '<li>$1</li>');
  // Newlines
  html = html.replace(/\n/g, '<br>');
  return html;
}

// ─── CSS variables for theme (mirrors chat.html exactly) ─────
const THEME_VARS = {
  dark: {
    '--chat-bg': '#0f172a',
    '--chat-surface': '#1e293b',
    '--chat-border': 'rgba(255,255,255,0.06)',
    '--chat-text': '#f1f5f9',
    '--chat-text-90': 'rgba(241,245,249,0.9)',
    '--chat-text-85': 'rgba(241,245,249,0.85)',
    '--chat-text-80': 'rgba(241,245,249,0.8)',
    '--chat-text-60': 'rgba(241,245,249,0.6)',
    '--chat-text-50': 'rgba(241,245,249,0.5)',
    '--chat-text-40': 'rgba(241,245,249,0.4)',
    '--chat-text-30': 'rgba(241,245,249,0.3)',
    '--chat-text-20': 'rgba(241,245,249,0.2)',
    '--chat-blue': '#3b82f6',
    '--chat-blue-glow': 'rgba(59,130,246,0.25)',
    '--chat-overlay-4': 'rgba(255,255,255,0.04)',
    '--chat-overlay-5': 'rgba(255,255,255,0.05)',
    '--chat-overlay-10': 'rgba(255,255,255,0.1)',
    '--chat-header-bg': 'rgba(15,23,42,0.8)',
    '--chat-user-bubble-bg': 'rgba(59,130,246,0.2)',
    '--chat-user-bubble-border': 'rgba(59,130,246,0.2)',
    '--chat-code-bg': 'rgba(0,0,0,0.35)',
    '--chat-code-color': '#93c5fd',
    '--chat-link-color': '#60a5fa',
  },
  light: {
    '--chat-bg': '#f8fafc',
    '--chat-surface': '#ffffff',
    '--chat-border': 'rgba(0,0,0,0.08)',
    '--chat-text': '#1e293b',
    '--chat-text-90': 'rgba(30,41,59,0.9)',
    '--chat-text-85': 'rgba(30,41,59,0.85)',
    '--chat-text-80': 'rgba(30,41,59,0.8)',
    '--chat-text-60': 'rgba(30,41,59,0.6)',
    '--chat-text-50': 'rgba(30,41,59,0.5)',
    '--chat-text-40': 'rgba(30,41,59,0.4)',
    '--chat-text-30': 'rgba(30,41,59,0.3)',
    '--chat-text-20': 'rgba(30,41,59,0.2)',
    '--chat-blue': '#3b82f6',
    '--chat-blue-glow': 'rgba(59,130,246,0.15)',
    '--chat-overlay-4': 'rgba(0,0,0,0.03)',
    '--chat-overlay-5': 'rgba(0,0,0,0.05)',
    '--chat-overlay-10': 'rgba(0,0,0,0.08)',
    '--chat-header-bg': 'rgba(255,255,255,0.85)',
    '--chat-user-bubble-bg': 'rgba(59,130,246,0.1)',
    '--chat-user-bubble-border': 'rgba(59,130,246,0.2)',
    '--chat-code-bg': 'rgba(0,0,0,0.06)',
    '--chat-code-color': '#2563eb',
    '--chat-link-color': '#2563eb',
  },
} as const;

const CATEGORY_COLORS: Record<string, string> = {
  productivity: 'from-blue-500 to-indigo-600',
  support: 'from-green-500 to-green-600',
  education: 'from-amber-500 to-amber-600',
  creative: 'from-indigo-500 to-indigo-600',
  'dev-tools': 'from-indigo-400 to-blue-600',
  marketing: 'from-green-400 to-green-600',
  data: 'from-blue-400 to-blue-600',
  entertainment: 'from-red-500 to-red-600',
  other: 'from-blue-400 to-indigo-500',
};

// ─── Component ───────────────────────────────────────────────
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
  const [isThinking, setIsThinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Theme persistence key
  const themeKey = useMemo(() => `gilo-store-theme-${agentId}`, [agentId]);

  // ── CSS variables for current theme ──
  const vars = isDark ? THEME_VARS.dark : THEME_VARS.light;

  useEffect(() => {
    fetchAgent();
    return () => { abortControllerRef.current?.abort(); };
  }, [agentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(themeKey, next ? 'dark' : 'light');
      return next;
    });
  }, [themeKey]);

  const fetchAgent = async () => {
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers['x-access-token'] = accessToken;
      const res = await fetch(`${API_BASE}/api/store/${agentId}`, { headers });
      const data = await res.json();
      setAgent(data);

      // Theme: check localStorage first, then agent appearance, then default dark
      const stored = localStorage.getItem(`gilo-store-theme-${agentId}`);
      if (stored) {
        setIsDark(stored === 'dark');
      } else {
        const theme = data.configSnapshot?.appearance?.theme;
        if (theme === 'light') setIsDark(false);
        else if (theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches) setIsDark(false);
      }

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

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

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
    setIsThinking(true);

    const assistantId = `assistant-${Date.now()}`;
    abortControllerRef.current = new AbortController();

    try {
      const apiMessages = updatedMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['x-access-token'] = accessToken;

      const response = await fetch(`${API_BASE}/api/store/${agentId}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Erreur: ${response.statusText}`);
      }

      // Remove thinking, add empty assistant message
      setIsThinking(false);
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);

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
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent, isStreaming: true } : m))
                );
              }
              if (data.done) break;
            } catch {
              // skip
            }
          }
        }
      }

      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
      );
    } catch (error: any) {
      setIsThinking(false);
      if (error.name !== 'AbortError') {
        const assistantMsg: Message = {
          id: assistantId,
          role: 'assistant',
          content: `⚠️ ${error.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) =>
          prev.some((m) => m.id === assistantId)
            ? prev.map((m) => (m.id === assistantId ? assistantMsg : m))
            : [...prev, assistantMsg]
        );
      }
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
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
      <div className="h-screen flex items-center justify-center" style={{ background: vars['--chat-bg'] }}>
        <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const chatBg = agent?.configSnapshot?.appearance?.chatBackground;
  const accentColor = agent?.configSnapshot?.appearance?.accentColor || '#3b82f6';

  // Build avatar HTML for bot
  const BotAvatar = () => (
    <div
      className={`w-8 h-8 rounded-[22%] bg-gradient-to-br ${catColor} flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden`}
    >
      {agent?.icon ? (
        <img src={agent.icon} alt="" className="w-full h-full rounded-[22%] object-cover" />
      ) : (
        <Bot className="w-4 h-4" style={{ color: vars['--chat-text-80'] }} />
      )}
    </div>
  );

  return (
    <div
      className="agent-chat-root"
      style={{
        height: '100vh',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: vars['--chat-bg'],
        color: vars['--chat-text'],
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.3s, color 0.3s',
      }}
    >
      {/* Background image (identical to chat.html .chat-bg) */}
      {chatBg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            backgroundImage: `url(${chatBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            background: vars['--chat-bg'],
            opacity: 0.85,
          }} />
        </div>
      )}

      {/* ── Header (matches chat.html .header) ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          flexShrink: 0,
          borderBottom: `1px solid ${vars['--chat-border']}`,
          background: vars['--chat-header-bg'],
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Agent avatar */}
        <div
          className={`w-9 h-9 rounded-[22%] bg-gradient-to-br ${catColor} flex items-center justify-center flex-shrink-0 overflow-hidden`}
        >
          {agent?.icon ? (
            <img src={agent.icon} alt="" className="w-full h-full rounded-[22%] object-cover" />
          ) : (
            <span style={{ fontSize: 14, fontWeight: 700, color: vars['--chat-text-90'] }}>
              {agent?.name?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Agent name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: 14,
            fontWeight: 600,
            color: vars['--chat-text-90'],
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: 0,
          }}>
            {agent?.name}
          </h1>
        </div>

        {/* Back button (store-specific) */}
        <button
          onClick={() => navigate(`/store/${agentId}`)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${vars['--chat-border']}`,
            background: vars['--chat-overlay-4'],
            color: vars['--chat-text-50'],
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          title={t('store.backToStore')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Clear conversation */}
        <button
          onClick={handleClear}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${vars['--chat-border']}`,
            background: vars['--chat-overlay-4'],
            color: vars['--chat-text-30'],
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          title={t('store.newConversation')}
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${vars['--chat-border']}`,
            background: vars['--chat-overlay-4'],
            color: vars['--chat-text-50'],
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          title="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      {/* ── Messages area (matches chat.html .messages) ── */}
      <div
        ref={messagesContainerRef}
        className="agent-chat-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          scrollBehavior: 'smooth',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '24px 16px' }}>
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="agent-chat-fade-in" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
            }}>
              <div
                className={`w-20 h-20 rounded-[26%] bg-gradient-to-br ${catColor} flex items-center justify-center overflow-hidden`}
                style={{
                  marginBottom: 16,
                  boxShadow: `0 8px 40px ${accentColor}40`,
                }}
              >
                {agent?.icon ? (
                  <img src={agent.icon} alt="" className="w-full h-full object-cover rounded-[26%]" />
                ) : (
                  <span style={{ fontSize: 30, fontWeight: 700, color: vars['--chat-text-90'] }}>
                    {agent?.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: vars['--chat-text-80'], marginBottom: 8 }}>
                {agent?.name}
              </div>
              <div style={{ fontSize: 14, color: vars['--chat-text-40'] }}>
                {t('store.startConversation')}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="agent-chat-fade-in"
              style={{
                display: 'flex',
                gap: 12,
                marginBottom: 24,
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'assistant' && <BotAvatar />}

              <div
                className={msg.role === 'assistant' ? 'agent-chat-bot-bubble' : ''}
                style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: vars['--chat-text-85'],
                  wordBreak: 'break-word' as const,
                  ...(msg.role === 'user'
                    ? {
                        background: vars['--chat-user-bubble-bg'],
                        border: `1px solid ${vars['--chat-user-bubble-border']}`,
                        borderRadius: '16px',
                        borderTopRightRadius: '6px',
                        whiteSpace: 'pre-wrap' as const,
                      }
                    : {
                        background: vars['--chat-overlay-4'],
                        border: `1px solid ${vars['--chat-overlay-5']}`,
                        borderRadius: '16px',
                        borderTopLeftRadius: '6px',
                      }),
                }}
                {...(msg.role === 'assistant'
                  ? {
                      dangerouslySetInnerHTML: {
                        __html:
                          renderMarkdown(msg.content) +
                          (msg.isStreaming ? '<span class="agent-chat-cursor"></span>' : ''),
                      },
                    }
                  : { children: msg.content })}
              />

              {msg.role === 'user' && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: vars['--chat-overlay-10'],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <User className="w-4 h-4" style={{ color: vars['--chat-text-60'] }} />
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator (matches chat.html .thinking-wrapper) */}
          {isThinking && (
            <div className="agent-chat-fade-in" style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <BotAvatar />
              <div style={{
                display: 'inline-flex',
                gap: 4,
                padding: '12px 16px',
                borderRadius: 16,
                borderTopLeftRadius: 6,
                background: vars['--chat-overlay-4'],
                border: `1px solid ${vars['--chat-overlay-5']}`,
              }}>
                <span className="agent-chat-dot" style={{ animationDelay: '0ms' }} />
                <span className="agent-chat-dot" style={{ animationDelay: '150ms' }} />
                <span className="agent-chat-dot" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area (matches chat.html .input-area) ── */}
      <div
        style={{
          flexShrink: 0,
          background: vars['--chat-header-bg'],
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '12px 16px' }}>
          {/* Stop button */}
          {isStreaming && (
            <button
              onClick={handleStop}
              className="agent-chat-fade-in"
              style={{
                width: '100%',
                padding: 6,
                marginBottom: 8,
                borderRadius: 8,
                border: `1px solid ${vars['--chat-border']}`,
                background: vars['--chat-overlay-4'],
                color: vars['--chat-text-40'],
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <Square className="w-3 h-3" />
              {t('store.stopGenerating')}
            </button>
          )}

          {/* Textarea wrapper */}
          <div style={{ position: 'relative' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('store.messagePlaceholder', { name: agent?.name || 'Agent' })}
              rows={4}
              className="agent-chat-textarea"
              style={{
                width: '100%',
                background: vars['--chat-overlay-4'],
                border: `1px solid ${vars['--chat-overlay-10']}`,
                borderRadius: 16,
                padding: '12px 48px 12px 16px',
                color: vars['--chat-text-90'],
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                maxHeight: 200,
                minHeight: 100,
                lineHeight: 1.5,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              disabled={isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 36,
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: vars['--chat-text'],
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !input.trim() || isStreaming ? 0.4 : 1,
                transition: 'background 0.2s',
              }}
              title={t('store.send')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          {/* Footer link (matches chat.html) */}
          <a
            href="https://www.gilo.dev/"
            target="_blank"
            rel="noopener"
            style={{
              display: 'block',
              textAlign: 'center',
              fontSize: 10,
              color: vars['--chat-text-20'],
              textDecoration: 'none',
              marginTop: 8,
              paddingBottom: 'env(safe-area-inset-bottom, 4px)',
              transition: 'color 0.2s',
            }}
          >
            {t('store.poweredBy', { name: agent?.name })}
          </a>
        </div>
      </div>
    </div>
  );
}
