import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ChatPanel from '../components/ChatPanel';
import PreviewPanel from '../components/PreviewPanel';
import TimelinePanel from '../components/TimelinePanel';
import { useSessionStore } from '../store/sessionStore';

export default function Builder() {
  const { projectId } = useParams();
  const { currentSession, createSession } = useSessionStore();
  const [isLoading, setIsLoading] = useState(true);

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
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-xl font-bold text-white">
          AI App Builder - {projectId || 'Nouveau Projet'}
        </h1>
      </header>

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
