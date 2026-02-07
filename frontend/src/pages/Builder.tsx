import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Package, Code2, Rocket, Loader2, CheckCircle, XCircle, ArrowLeft, Eye, Clock } from 'lucide-react';
import ChatPanel from '../components/ChatPanel';
import PreviewPanel from '../components/PreviewPanel';
import TimelinePanel from '../components/TimelinePanel';
import MCPSettings from '../components/MCPSettings';
import MCPBrowser from '../components/MCPBrowser';
import FileEditor from '../components/FileEditor';
import { useSessionStore } from '../store/sessionStore';
import { useBuilderStore } from '../store/builderStore';
import { deployProject, getDeployment } from '../services/api';

export default function Builder() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentSession, createSession } = useSessionStore();
  const { setProjectId, deployment, isDeploying, deploymentError, setDeployment, setIsDeploying, setDeploymentError, clearDeployment } = useBuilderStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showMCPSettings, setShowMCPSettings] = useState(false);
  const [showMCPBrowser, setShowMCPBrowser] = useState(false);
  const [showFileEditor, setShowFileEditor] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const initSession = async () => {
      const id = projectId || 'new-project';
      if (!currentSession) {
        await createSession({ 
          projectId: id,
          userId: 'demo-user' 
        });
      }
      setProjectId(id);
      setIsLoading(false);
    };

    initSession();
  }, [projectId, currentSession, createSession, setProjectId]);

  // Poll deployment status when deploying
  useEffect(() => {
    if (deployment && (deployment.status === 'pending' || deployment.status === 'building')) {
      const interval = setInterval(async () => {
        try {
          const updatedDeployment = await getDeployment(deployment.deploymentId);
          setDeployment(updatedDeployment);
          
          if (updatedDeployment.status === 'deployed' || updatedDeployment.status === 'failed') {
            setIsDeploying(false);
            if (interval) clearInterval(interval);
          }
        } catch (error) {
          console.error('Error polling deployment status:', error);
          setDeploymentError('Erreur lors de la vérification du statut de déploiement');
          setIsDeploying(false);
          if (interval) clearInterval(interval);
        }
      }, 3000);
      
      setPollingInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [deployment, setDeployment, setIsDeploying, setDeploymentError]);

  const handleDeploy = async () => {
    if (!projectId) {
      setDeploymentError('ID de projet manquant');
      return;
    }

    setIsDeploying(true);
    setDeploymentError(null);
    clearDeployment();

    try {
      const response = await deployProject(projectId);
      setDeployment({
        deploymentId: response.deployment.id,
        status: response.deployment.status as any,
      });
    } catch (error: any) {
      console.error('Deployment error:', error);
      setDeploymentError(error.response?.data?.error || 'Erreur lors du déploiement');
      setIsDeploying(false);
    }
  };

  const getDeploymentStatusIcon = () => {
    if (isDeploying) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    if (deployment?.status === 'deployed') {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (deployment?.status === 'failed') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <Rocket className="w-4 h-4" />;
  };

  const getDeploymentStatusText = () => {
    if (isDeploying) {
      return 'Déploiement en cours...';
    }
    if (deployment?.status === 'deployed') {
      return 'Déployé';
    }
    if (deployment?.status === 'failed') {
      return 'Échec';
    }
    return 'Déployer';
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-mesh bg-grid">
        <div className="text-white text-xl animate-pulse-glow">Initialisation...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex pb-12 md:pb-8 bg-gradient-mesh bg-grid">
      {/* Sidebar */}
      <aside className="w-20 glass-strong border-r border-white/10 flex flex-col items-center py-4 gap-2 animate-fade-in-left">
        {/* Navigation Buttons */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            showPreview
              ? 'btn-gradient text-white glow-blue'
              : 'btn-outline-glow text-white/70 hover:text-white hover:bg-white/5'
          }`}
          title="Prévisualisation"
        >
          <Eye className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            showHistory
              ? 'btn-gradient text-white glow-blue'
              : 'btn-outline-glow text-white/70 hover:text-white hover:bg-white/5'
          }`}
          title="Historique"
        >
          <Clock className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowFileEditor(!showFileEditor)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            showFileEditor
              ? 'btn-gradient text-white glow-blue'
              : 'btn-outline-glow text-white/70 hover:text-white hover:bg-white/5'
          }`}
          title="Fichiers"
        >
          <Code2 className="w-5 h-5" />
        </button>
        <button
          onClick={handleDeploy}
          disabled={isDeploying}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            isDeploying
              ? 'bg-white/10 text-white/50 cursor-not-allowed'
              : deployment?.status === 'deployed'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
              : deployment?.status === 'failed'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
              : 'btn-gradient text-white glow-blue'
          }`}
          title={getDeploymentStatusText()}
        >
          {getDeploymentStatusIcon()}
        </button>
        <button
          onClick={() => setShowMCPBrowser(true)}
          className="w-12 h-12 rounded-xl btn-outline-glow flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5 transition-all duration-300"
          title="Outils MCP"
        >
          <Package className="w-5 h-5 glow-icon" />
        </button>
        <button
          onClick={() => setShowMCPSettings(true)}
          className="w-12 h-12 rounded-xl btn-outline-glow flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5 transition-all duration-300"
          title="Paramètres"
        >
          <Settings className="w-5 h-5" />
        </button>
        <div className="flex-1"></div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="glass-strong border-b border-white/10 px-6 py-3 flex items-center gap-4 animate-fade-in-down">
          <h1 className="text-xl font-bold text-white">AI Builder Hub</h1>
          <span className="text-white/40 text-sm">/</span>
          <span className="text-white/60 text-sm">{projectId || 'Nouveau Projet'}</span>
          <div className="flex-1"></div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-3 py-1.5 rounded-lg btn-outline-glow text-white/70 hover:text-white hover:bg-white/5 transition-all duration-300 text-sm flex items-center gap-2"
            title="Retour"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
        </header>

        {/* Modals */}
        {showMCPSettings && <MCPSettings onClose={() => setShowMCPSettings(false)} />}
        {showMCPBrowser && <MCPBrowser onClose={() => setShowMCPBrowser(false)} />}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div className="min-w-80 max-w-[30rem] flex-1 flex flex-col border-r border-white/10 glass-card animate-fade-in-left">
          <ChatPanel />
        </div>

        {/* Right: File Editor or History Panel */}
        {showFileEditor && projectId && (
          <div className="min-w-64 max-w-[24rem] flex-1 border-r border-white/10 glass-card animate-fade-in-up delay-100">
            <FileEditor projectId={projectId} />
          </div>
        )}

        {/* History Panel */}
        {showHistory && (
          <div className="min-w-80 max-w-[30rem] flex-1 glass-card animate-fade-in-up delay-100">
            <TimelinePanel />
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
              onClick={() => setShowPreview(false)}
            />
            {/* Modal */}
            <div className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex items-center justify-center animate-fade-in-up">
              <div className="w-full h-full glass-strong rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col relative">
                {/* Close button */}
                <button
                  onClick={() => setShowPreview(false)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all duration-200 z-10"
                  aria-label="Close preview"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <PreviewPanel onClose={() => setShowPreview(false)} />
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
