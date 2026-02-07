import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Package, Code2, Rocket, Loader2, CheckCircle, XCircle, ArrowLeft, MessageSquare, FileCode, Layers } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'mcp' | 'settings'>('chat');
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
    <div className="h-screen flex flex-col bg-gradient-mesh bg-grid">
      {/* Header */}
      <header className="glass-strong border-b border-white/10 px-6 py-4 flex items-center justify-between animate-fade-in-down">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-outline-glow px-3 py-2 rounded-lg flex items-center gap-2 text-white/80 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Retour</span>
          </button>
          <div className="h-6 w-px bg-white/10"></div>
          <h1 className="text-xl font-bold gradient-text">
            AI App Builder
          </h1>
          <span className="text-white/60 text-sm">/</span>
          <span className="text-white/80 text-sm font-medium">{projectId || 'Nouveau Projet'}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFileEditor(!showFileEditor)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
              showFileEditor 
                ? 'btn-gradient text-white glow-blue' 
                : 'btn-outline-glow text-white/70 hover:text-white'
            }`}
            title="Éditeur de fichiers"
          >
            <Code2 className="w-4 h-4" />
            <span className="hidden sm:inline">Fichiers</span>
          </button>
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
              isDeploying
                ? 'bg-white/10 text-white/50 cursor-not-allowed'
                : deployment?.status === 'deployed'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                : deployment?.status === 'failed'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'btn-gradient text-white glow-blue'
            }`}
            title="Déployer le projet"
          >
            {getDeploymentStatusIcon()}
            <span className="hidden sm:inline">{getDeploymentStatusText()}</span>
          </button>
          <button
            onClick={() => setShowMCPBrowser(true)}
            className="btn-outline-glow px-4 py-2 rounded-lg flex items-center gap-2 text-white/70 hover:text-white"
            title="Outils et Ressources MCP"
          >
            <Package className="w-4 h-4 glow-icon" />
            <span className="hidden sm:inline">MCP</span>
          </button>
          <button
            onClick={() => setShowMCPSettings(true)}
            className="btn-outline-glow px-4 py-2 rounded-lg flex items-center gap-2 text-white/70 hover:text-white"
            title="Paramètres MCP"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Paramètres</span>
          </button>
        </div>
        {deploymentError && (
          <div className="absolute top-20 right-6 glass-card bg-red-500/20 border-red-500/30 text-red-300 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-up">
            {deploymentError}
          </div>
        )}
      </header>

      {/* Modals */}
      {showMCPSettings && <MCPSettings onClose={() => setShowMCPSettings(false)} />}
      {showMCPBrowser && <MCPBrowser onClose={() => setShowMCPBrowser(false)} />}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat + Timeline */}
        <div className="w-96 flex flex-col border-r border-white/10 glass-card animate-fade-in-left">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-300 ${
                activeTab === 'chat'
                  ? 'text-white border-b-2 border-blue-500 bg-white/5'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <MessageSquare className={`w-4 h-4 ${activeTab === 'chat' ? 'glow-icon' : ''}`} />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-300 ${
                activeTab === 'files'
                  ? 'text-white border-b-2 border-purple-500 bg-white/5'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <FileCode className={`w-4 h-4 ${activeTab === 'files' ? 'glow-icon' : ''}`} />
              Fichiers
            </button>
            <button
              onClick={() => setActiveTab('mcp')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-300 ${
                activeTab === 'mcp'
                  ? 'text-white border-b-2 border-cyan-500 bg-white/5'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeTab === 'mcp' ? 'glow-icon' : ''}`} />
              MCP
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-hidden">
                  <ChatPanel />
                </div>
                <div className="h-64 border-t border-white/10">
                  <TimelinePanel />
                </div>
              </div>
            )}
            {activeTab === 'files' && projectId && (
              <div className="h-full">
                <FileEditor projectId={projectId} />
              </div>
            )}
            {activeTab === 'mcp' && (
              <div className="h-full flex items-center justify-center text-white/50">
                <div className="text-center">
                  <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Outils MCP</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: File Editor (when showFileEditor is true) */}
        {showFileEditor && projectId && (
          <div className="w-80 border-r border-white/10 glass-card animate-fade-in-up delay-100">
            <FileEditor projectId={projectId} />
          </div>
        )}

        {/* Right: Preview */}
        <div className="flex-1 glass-card animate-fade-in-right delay-200">
          <PreviewPanel />
        </div>
      </div>
    </div>
  );
}
