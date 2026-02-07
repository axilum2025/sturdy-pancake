import { useState } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { sendAgentTask } from '../services/api';

export default function ChatPanel() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { currentSession } = useSessionStore();

  const handleSend = async () => {
    if (!message.trim() || !currentSession) return;

    const userMessage = { role: 'user' as const, content: message };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    try {
      const response = await sendAgentTask({
        sessionId: currentSession.id,
        prompt: message,
        constraints: {
          stack: ['React', 'Tailwind', 'Vite'],
          accessibility: true,
          mobileFirst: true
        }
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Tâche créée: ${response.id}. L'agent travaille sur votre demande...`
      }]);
    } catch (error) {
      console.error('Error sending task:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erreur lors de l\'envoi de la tâche.'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-lg font-semibold gradient-text">
          GiLo AI
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center mt-8 animate-fade-in-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center animate-pulse-glow">
              <Bot className="w-8 h-8 text-blue-400 glow-icon" />
            </div>
            <p className="text-white/60">Commencez à décrire votre application...</p>
            <p className="text-sm text-white/40 mt-2">Exemple: "Crée une landing page avec un hero moderne"</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 animate-fade-in-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === 'user'
                  ? 'bg-blue-500/20 border border-blue-500/30'
                  : 'bg-purple-500/20 border border-purple-500/30'
              }`}>
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-blue-400" />
                ) : (
                  <Bot className="w-4 h-4 text-purple-400 glow-icon" />
                )}
              </div>
              <div className={`flex-1 max-w-[80%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'glass-card bg-blue-500/10 border-blue-500/20 glow-blue'
                  : 'glass-card bg-purple-500/10 border-purple-500/20 glow-purple'
              }`}>
                <p className="text-white/90 text-sm">{msg.content}</p>
              </div>
            </div>
          ))
        )}

      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.shiftKey === false && (e.preventDefault(), handleSend())}
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
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
