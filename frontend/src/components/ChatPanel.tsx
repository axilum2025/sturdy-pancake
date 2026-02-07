import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, User, Loader2, Sparkles, Copy, Check, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { copilotChatStream, getCopilotStatus, CopilotMessage } from '../services/api';
import { useBuilderStore } from '../store/builderStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export default function ChatPanel() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [copilotAvailable, setCopilotAvailable] = useState<boolean | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { projectId } = useBuilderStore();

  // Check Copilot availability on mount
  useEffect(() => {
    getCopilotStatus()
      .then((status) => setCopilotAvailable(status.available))
      .catch(() => setCopilotAvailable(false));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // ----------------------------------------------------------
  // Parse SSE stream from the Copilot backend
  // ----------------------------------------------------------
  const readCopilotStream = useCallback(
    async (response: Response, assistantMsgId: string) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const payload = trimmed.slice(6);
            if (payload === '[DONE]') break;

            try {
              const chunk = JSON.parse(payload);
              if (chunk.type === 'content' && chunk.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + chunk.content }
                      : m,
                  ),
                );
              } else if (chunk.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + `\n\n⚠️ Erreur: ${chunk.error}`, isStreaming: false }
                      : m,
                  ),
                );
              }
            } catch {
              // ignore malformed JSON lines
            }
          }
        }
      } finally {
        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m,
          ),
        );
      }
    },
    [],
  );

  // ----------------------------------------------------------
  // Send a message
  // ----------------------------------------------------------
  const handleSend = async () => {
    if (!message.trim()) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setMessage('');
    setIsTyping(true);

    // Build conversation history for the API
    const conversationHistory: CopilotMessage[] = messages
      .filter((m) => !m.isStreaming)
      .map((m) => ({ role: m.role, content: m.content }));

    conversationHistory.push({ role: 'user', content: message });

    try {
      abortControllerRef.current = new AbortController();

      const response = await copilotChatStream({
        messages: conversationHistory,
        stream: true,
        projectContext: projectId
          ? {
              projectId,
              techStack: ['React', 'Tailwind', 'Vite'],
            }
          : undefined,
      });

      await readCopilotStream(response, assistantMsg.id);
    } catch (error: any) {
      console.error('Copilot error:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: `❌ Erreur de connexion au Copilot: ${error.message}`,
                isStreaming: false,
              }
            : m,
        ),
      );
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  // ----------------------------------------------------------
  // Stop streaming
  // ----------------------------------------------------------
  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsTyping(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  };

  // ----------------------------------------------------------
  // Copy message content
  // ----------------------------------------------------------
  const handleCopy = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // ----------------------------------------------------------
  // Quick action buttons
  // ----------------------------------------------------------
  const quickActions = [
    { label: 'Landing page', prompt: 'Crée une landing page moderne avec hero, features et pricing' },
    { label: 'Dashboard', prompt: 'Crée un dashboard admin avec sidebar, stats cards et graphiques' },
    { label: 'Auth form', prompt: 'Crée un formulaire de connexion/inscription avec validation' },
    { label: 'API CRUD', prompt: 'Crée une API REST CRUD complète avec Express et TypeScript' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400 glow-icon" />
          <h2 className="text-lg font-semibold gradient-text">GiLo AI</h2>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              copilotAvailable === true
                ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                : copilotAvailable === false
                ? 'bg-red-400'
                : 'bg-yellow-400 animate-pulse'
            }`}
          />
          <span className="text-xs text-white/40">
            {copilotAvailable === true
              ? 'Copilot connecté'
              : copilotAvailable === false
              ? 'Copilot hors ligne'
              : 'Vérification...'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center mt-8 animate-fade-in-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center animate-pulse-glow">
              <Bot className="w-8 h-8 text-blue-400 glow-icon" />
            </div>
            <p className="text-white/60 mb-1">Bienvenue dans <strong className="gradient-text">GiLo AI</strong></p>
            <p className="text-sm text-white/40 mb-6">Propulsé par GitHub Copilot</p>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setMessage(action.prompt);
                  }}
                  className="glass-card bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-xs text-white/70 hover:text-white transition-all duration-200 text-left"
                >
                  <Zap className="w-3 h-3 inline mr-1 text-yellow-400" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 animate-fade-in-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-blue-500/20 border border-blue-500/30'
                    : 'bg-purple-500/20 border border-purple-500/30'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-blue-400" />
                ) : (
                  <Bot className="w-4 h-4 text-purple-400 glow-icon" />
                )}
              </div>
              <div
                className={`flex-1 max-w-[85%] group ${
                  msg.role === 'user' ? '' : 'relative'
                }`}
              >
                <div
                  className={`p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'glass-card bg-blue-500/10 border-blue-500/20 glow-blue'
                      : 'glass-card bg-purple-500/10 border-purple-500/20 glow-purple'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="text-white/90 text-sm prose prose-invert prose-sm max-w-none prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg prose-code:text-purple-300 prose-a:text-blue-400">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || (msg.isStreaming ? '...' : '')}
                      </ReactMarkdown>
                      {msg.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1" />
                      )}
                    </div>
                  ) : (
                    <p className="text-white/90 text-sm">{msg.content}</p>
                  )}
                </div>
                {/* Copy button for assistant messages */}
                {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="absolute -right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/10"
                    title="Copier"
                  >
                    {copiedMessageId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-white/50" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isTyping && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-3 animate-fade-in-up">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/20 border border-purple-500/30">
              <Bot className="w-4 h-4 text-purple-400 glow-icon" />
            </div>
            <div className="glass-card bg-purple-500/10 border-purple-500/20 px-4 py-3 rounded-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        {/* Stop button when streaming */}
        {isTyping && (
          <button
            onClick={handleStop}
            className="w-full mb-2 py-1.5 rounded-lg text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            ■ Arrêter la génération
          </button>
        )}
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              !e.shiftKey &&
              (e.preventDefault(), handleSend())
            }
            placeholder="Décrivez ce que vous voulez construire..."
            rows={4}
            className="w-full input-futuristic text-white px-4 py-3 pr-12 rounded-lg resize-none h-24"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isTyping}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white flex items-center justify-center disabled:opacity-50 hover:bg-white/10 transition-colors"
          >
            {isTyping ? (
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
      </div>
    </div>
  );
}
