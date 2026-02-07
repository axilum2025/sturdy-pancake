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
        <h2 className="text-lg font-semibold gradient-text flex items-center gap-2">
          <Bot className="w-5 h-5 glow-icon" />
          Assistant AI
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
        {isTyping && (
          <div className="flex gap-3 animate-fade-in-up">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/20 border border-purple-500/30">
              <Bot className="w-4 h-4 text-purple-400 glow-icon" />
            </div>
            <div className="glass-card bg-purple-500/10 border-purple-500/20 px-4 py-3 rounded-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Décrivez ce que vous voulez construire..."
            className="flex-1 input-futuristic text-white px-4 py-3 rounded-lg"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isTyping}
            className="btn-gradient px-4 py-3 rounded-lg text-white flex items-center justify-center disabled:opacity-50"
          >
            {isTyping ? (
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
