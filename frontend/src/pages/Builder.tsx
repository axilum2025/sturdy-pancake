import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Package } from 'lucide-react';
import ChatPanel from '../components/ChatPanel';
import PreviewPanel from '../components/PreviewPanel';
import TimelinePanel from '../components/TimelinePanel';
import MCPSettings from '../components/MCPSettings';
import MCPBrowser from '../components/MCPBrowser';
import { useSessionStore } from '../store/sessionStore';

export default function Builder() {
  const { projectId } = useParams();
  const { currentSession, createSession } = useSessionStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showMCPSettings, setShowMCPSettings] = useState(false);
  const [showMCPBrowser, setShowMCPBrowser] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      if (!currentSession) {
        await createSession({ 
          projectId: projectId || 'new-project',
          userId: 'demo-user' 
        });
      }
      setIsLoading(false);
    };

    initSession();
  }, [projectId, currentSession, createSession]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Initialisation...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">
          AI App Builder - {projectId || 'Nouveau Projet'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMCPBrowser(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            title="Outils et Ressources MCP"
          >
            <Package className="w-4 h-4" />
            MCP
          </button>
          <button
            onClick={() => setShowMCPSettings(true)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            title="Paramètres MCP"
          >
            <Settings className="w-4 h-4" />
            Paramètres
          </button>
        </div>
      </header>

      {/* Modals */}
      {showMCPSettings && <MCPSettings onClose={() => setShowMCPSettings(false)} />}
      {showMCPBrowser && <MCPBrowser onClose={() => setShowMCPBrowser(false)} />}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat + Timeline */}
        <div className="w-96 flex flex-col border-r border-gray-700">
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
          <div className="h-64 border-t border-gray-700">
            <TimelinePanel />
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1">
          <PreviewPanel />
        </div>
      </div>
    </div>
  );
}
