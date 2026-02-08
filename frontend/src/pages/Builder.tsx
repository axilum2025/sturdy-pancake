import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Package, Rocket, Loader2, CheckCircle, XCircle, ArrowLeft, Eye, Clock, Sliders } from 'lucide-react';
import ChatPanel from '../components/ChatPanel';
import Playground from '../components/Playground';
import TimelinePanel from '../components/TimelinePanel';
import MCPSettings from '../components/MCPSettings';
import MCPBrowser from '../components/MCPBrowser';
import AgentConfig from '../components/AgentConfig';
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
  const [showFileEditor, setShowFileEditor] = useState(false);
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
    <div className="h-screen w-full flex bg-gradient-mesh bg-grid overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-16 lg:w-20 glass-strong border-r border-white/10 flex-col items-center py-4 gap-2 animate-fade-in-left flex-shrink-0">
        {/* Navigation Buttons */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            showPreview
              ? 'btn-gradient text-white glow-blue'
              : 'btn-outline-glow text-white/70 hover:text-white hover:bg-white/5'
          }`}
          title="Playground"
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
          title="Logs"
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
          title="Configuration"
        >
          <Sliders className="w-5 h-5" />
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
          title="Outils"
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="glass-strong border-b-0 md:border-b md:border-white/10 px-3 md:px-6 py-2 md:py-3 flex items-center gap-2 md:gap-4 animate-fade-in-down flex-shrink-0">
          <h1 className="text-base md:text-xl font-bold text-white truncate">Agent Studio</h1>
          <span className="text-white/40 text-sm hidden sm:inline">/</span>
          <span className="text-white/60 text-sm hidden sm:inline">{projectId || 'Nouvel Agent'}</span>
          <div className="flex-1"></div>

          {/* Mobile action buttons (visible only on small screens) */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => setShowFileEditor(!showFileEditor)}
              className={`p-2 rounded-lg transition-colors ${showFileEditor ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              title="Configuration"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              title="Logs"
            >
              <Clock className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`p-2 rounded-lg transition-colors ${showPreview ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              title="Playground"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className={`p-2 rounded-lg transition-colors ${isDeploying ? 'text-white/30' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              title={getDeploymentStatusText()}
            >
              {getDeploymentStatusIcon()}
            </button>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="px-3 py-1.5 rounded-lg btn-outline-glow text-white/70 hover:text-white hover:bg-white/5 transition-all duration-300 text-sm flex items-center gap-2"
            title="Retour"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Retour</span>
          </button>
        </header>

        {/* MCP Settings Slidebar */}
        {showMCPSettings && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 animate-fade-in"
              onClick={() => setShowMCPSettings(false)}
            />
            <div className="fixed top-0 right-0 h-full w-full md:w-[55%] lg:w-[50%] z-40 glass-strong border-l-0 md:border-l md:border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
              <MCPSettings onClose={() => setShowMCPSettings(false)} />
            </div>
          </>
        )}

        {/* MCP Browser Slidebar */}
        {showMCPBrowser && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 animate-fade-in"
              onClick={() => setShowMCPBrowser(false)}
            />
            <div className="fixed top-0 right-0 h-full w-full md:w-[55%] lg:w-[50%] z-40 glass-strong border-l-0 md:border-l md:border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
              <MCPBrowser onClose={() => setShowMCPBrowser(false)} />
            </div>
          </>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Chat – always full width */}
        <div className="flex flex-col flex-1 md:glass-card animate-fade-in-left min-w-0">
          <ChatPanel />
        </div>

        {/* Agent Config Slidebar */}
        {showFileEditor && projectId && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 animate-fade-in"
              onClick={() => setShowFileEditor(false)}
            />
            <div className="fixed top-0 right-0 h-full w-full md:w-[55%] lg:w-[50%] z-40 glass-strong border-l-0 md:border-l md:border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
              <AgentConfig agentId={projectId} onClose={() => setShowFileEditor(false)} />
            </div>
          </>
        )}

        {/* History Slidebar */}
        {showHistory && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 animate-fade-in"
              onClick={() => setShowHistory(false)}
            />
            <div className="fixed top-0 right-0 h-full w-full md:w-[55%] lg:w-[50%] z-40 glass-strong border-l-0 md:border-l md:border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
              <TimelinePanel onClose={() => setShowHistory(false)} />
            </div>
          </>
        )}

        {/* Playground Modal */}
        {showPreview && projectId && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
              onClick={() => setShowPreview(false)}
            />
            {/* Modal */}
            <div className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex items-center justify-center animate-fade-in-up">
              <div className="w-full h-full glass-strong rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col relative">
                <Playground agentId={projectId} onClose={() => setShowPreview(false)} />
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
