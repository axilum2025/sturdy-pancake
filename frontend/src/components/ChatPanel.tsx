import { useState } from 'react';
import { Send } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { sendAgentTask } from '../services/api';

export default function ChatPanel() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const { currentSession } = useSessionStore();

  const handleSend = async () => {
    if (!message.trim() || !currentSession) return;

    const userMessage = { role: 'user' as const, content: message };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');

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
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-gray-400 text-center mt-8">
            <p>Commencez à décrire votre application...</p>
            <p className="text-sm mt-2">Exemple: "Crée une landing page avec un hero moderne"</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white ml-8'
                  : 'bg-gray-700 text-gray-100 mr-8'
              }`}
            >
              {msg.content}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Décrivez ce que vous voulez construire..."
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
