import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Rocket, ArrowLeft, Eye, Clock, Sliders, Store, Code2, Wrench, Key, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ChatPanel from '../components/ChatPanel';
import Playground from '../components/Playground';
import TimelinePanel from '../components/TimelinePanel';
import MCPSettings from '../components/MCPSettings';
import MCPBrowser from '../components/MCPBrowser';
import AgentConfig from '../components/AgentConfig';
import PublishModal from '../components/PublishModal';
import ApiIntegrationModal from '../components/ApiIntegrationModal';
import CredentialVault from '../components/CredentialVault';
import { useSessionStore } from '../store/sessionStore';
import { useStudioStore } from '../store/studioStore';
import { getAgent } from '../services/api';

export default function Studio() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentSession, createSession } = useSessionStore();
  const { setProjectId } = useStudioStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showMCPSettings, setShowMCPSettings] = useState(false);
  const [showMCPBrowser, setShowMCPBrowser] = useState(false);
  const [showFileEditor, setShowFileEditor] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showApiIntegration, setShowApiIntegration] = useState(false);
  const [publishedStoreId, setPublishedStoreId] = useState<string | null>(null);
  const [agentSlug, setAgentSlug] = useState<string | undefined>();
  const [showCredentials, setShowCredentials] = useState(false);

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

      // Fetch agent slug for subdomain URL
      if (id !== 'new-project') {
        getAgent(id).then(a => setAgentSlug(a.slug)).catch(() => {});
      }
    };

    initSession();
  }, [projectId, currentSession, createSession, setProjectId]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-mesh bg-grid">
        <div className="text-t-text text-xl animate-pulse-glow">{t('builder.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-gradient-mesh bg-grid overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-16 lg:w-20 glass-strong border-r border-t-overlay/10 flex-col items-center py-4 gap-2 animate-fade-in-left flex-shrink-0">
        {/* Navigation Buttons */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            showPreview
              ? 'btn-gradient text-white glow-blue'
              : 'btn-outline-glow text-t-text/70 hover:text-t-text hover:bg-t-overlay/5'
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
              : 'btn-outline-glow text-t-text/70 hover:text-t-text hover:bg-t-overlay/5'
          }`}
          title={t('builder.logs')}
        >
          <Clock className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowFileEditor(!showFileEditor)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            showFileEditor
              ? 'btn-gradient text-white glow-blue'
              : 'btn-outline-glow text-t-text/70 hover:text-t-text hover:bg-t-overlay/5'
          }`}
          title={t('builder.config')}
        >
          <Sliders className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowPublish(true)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            publishedStoreId
              ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
              : 'btn-gradient text-white glow-blue'
          }`}
          title={publishedStoreId ? t('builder.publishedStore') : t('builder.publishStore')}
        >
          <Rocket className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowApiIntegration(true)}
          className="w-12 h-12 rounded-xl btn-outline-glow flex items-center justify-center text-t-text/70 hover:text-t-text hover:bg-t-overlay/5 transition-all duration-300"
          title={t('apiIntegration.sidebarTitle')}
        >
          <Code2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate('/store')}
          className="w-12 h-12 rounded-xl btn-outline-glow flex items-center justify-center text-t-text/70 hover:text-t-text hover:bg-t-overlay/5 transition-all duration-300"
          title={t('builder.agentStore')}
        >
          <Store className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowCredentials(!showCredentials)}
          className={`w-12 h-12 rounded-xl btn-outline-glow flex items-center justify-center transition-all duration-300 ${showCredentials ? 'text-t-text bg-t-overlay/10' : 'text-t-text/70 hover:text-t-text hover:bg-t-overlay/5'}`}
          title={t('credentials.title', 'Clés & Credentials')}
        >
          <Key className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowMCPBrowser(!showMCPBrowser)}
          className={`w-12 h-12 rounded-xl btn-outline-glow flex items-center justify-center transition-all duration-300 ${showMCPBrowser ? 'text-primary bg-primary/10' : 'text-t-text/70 hover:text-t-text hover:bg-t-overlay/5'}`}
          title={t('builder.tools')}
        >
          <Wrench className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowMCPSettings(!showMCPSettings)}
          className={`w-12 h-12 rounded-xl btn-outline-glow flex items-center justify-center transition-all duration-300 ${showMCPSettings ? 'text-primary bg-primary/10' : 'text-t-text/70 hover:text-t-text hover:bg-t-overlay/5'}`}
          title={t('builder.settings')}
        >
          <Settings className="w-5 h-5" />
        </button>
        <div className="flex-1"></div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="glass-strong border-b-0 md:border-b md:border-t-overlay/10 px-3 md:px-6 py-2 md:py-3 flex items-center gap-2 md:gap-4 animate-fade-in-down flex-shrink-0">
          <h1 className="text-base md:text-xl font-bold gradient-text truncate">{t('builder.title')}</h1>
          <span className="text-t-text/40 text-sm hidden sm:inline">/</span>
          <span className="text-t-text/60 text-sm hidden sm:inline">{projectId || t('builder.newAgent')}</span>
          <div className="flex-1"></div>

          {/* Mobile action buttons (visible only on small screens) */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => setShowFileEditor(!showFileEditor)}
              className={`p-2 rounded-lg transition-colors ${showFileEditor ? 'bg-blue-500/20 text-blue-400' : 'text-t-text/60 hover:text-t-text hover:bg-t-overlay/10'}`}
              title={t('builder.config')}
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-blue-500/20 text-blue-400' : 'text-t-text/60 hover:text-t-text hover:bg-t-overlay/10'}`}
              title={t('builder.logs')}
            >
              <Clock className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`p-2 rounded-lg transition-colors ${showPreview ? 'bg-blue-500/20 text-blue-400' : 'text-t-text/60 hover:text-t-text hover:bg-t-overlay/10'}`}
              title="Playground"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCredentials(!showCredentials)}
              className={`p-2 rounded-lg transition-colors ${showCredentials ? 'bg-t-overlay/15 text-t-text' : 'text-t-text/60 hover:text-t-text hover:bg-t-overlay/10'}`}
              title={t('credentials.title', 'Clés & Credentials')}
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowMCPBrowser(!showMCPBrowser)}
              className={`p-2 rounded-lg transition-colors ${showMCPBrowser ? 'bg-primary/20 text-primary' : 'text-t-text/60 hover:text-t-text hover:bg-t-overlay/10'}`}
              title={t('builder.tools')}
            >
              <Wrench className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowMCPSettings(!showMCPSettings)}
              className={`p-2 rounded-lg transition-colors ${showMCPSettings ? 'bg-primary/20 text-primary' : 'text-t-text/60 hover:text-t-text hover:bg-t-overlay/10'}`}
              title={t('builder.settings')}
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowPublish(true)}
              className={`p-2 rounded-lg transition-colors ${publishedStoreId ? 'text-green-400' : 'text-t-text/60 hover:text-t-text hover:bg-t-overlay/10'}`}
              title={t('builder.publishStore')}
            >
              <Rocket className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowApiIntegration(true)}
              className="p-2 rounded-lg transition-colors text-t-text/60 hover:text-t-text hover:bg-t-overlay/10"
              title={t('apiIntegration.sidebarTitle')}
            >
              <Code2 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="px-3 py-1.5 rounded-lg btn-outline-glow text-t-text/70 hover:text-t-text hover:bg-t-overlay/5 transition-all duration-300 text-sm flex items-center gap-2"
            title={t('common.back')}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.back')}</span>
          </button>
        </header>

        {/* MCP Settings Slidebar */}
        {showMCPSettings && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 animate-fade-in"
              onClick={() => setShowMCPSettings(false)}
            />
            <div className="fixed top-0 right-0 h-full w-full md:w-[55%] lg:w-[50%] z-40 glass-strong border-l-0 md:border-l md:border-t-overlay/10 shadow-2xl flex flex-col animate-slide-in-right">
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
            <div className="fixed top-0 right-0 h-full w-full md:w-[55%] lg:w-[50%] z-40 glass-strong border-l-0 md:border-l md:border-t-overlay/10 shadow-2xl flex flex-col animate-slide-in-right">
              <MCPBrowser agentId={projectId} onClose={() => setShowMCPBrowser(false)} />
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
            <div className="fixed top-0 right-0 h-full w-full md:w-[55%] lg:w-[50%] z-40 glass-strong border-l-0 md:border-l md:border-t-overlay/10 shadow-2xl flex flex-col animate-slide-in-right">
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
            <div className="fixed top-0 right-0 h-full w-full md:w-[55%] lg:w-[50%] z-40 glass-strong border-l-0 md:border-l md:border-t-overlay/10 shadow-2xl flex flex-col animate-slide-in-right">
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
              <div className="w-full h-full glass-strong rounded-2xl border border-t-overlay/10 shadow-2xl overflow-hidden flex flex-col relative">
                <Playground agentId={projectId} onClose={() => setShowPreview(false)} />
              </div>
            </div>
          </>
        )}

        {/* Publish Modal */}
        {showPublish && projectId && (
          <PublishModal
            agentId={projectId}
            agentName={projectId}
            onClose={() => setShowPublish(false)}
            onPublished={(storeId) => {
              setPublishedStoreId(storeId);
              setShowPublish(false);
            }}
          />
        )}

        {/* Credentials Slidebar */}
        {showCredentials && projectId && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 animate-fade-in"
              onClick={() => setShowCredentials(false)}
            />
            <div className="fixed top-0 right-0 h-full w-full md:w-[55%] lg:w-[45%] z-40 glass-strong border-l-0 md:border-l md:border-t-overlay/10 shadow-2xl flex flex-col animate-slide-in-right">
              <div className="flex items-center justify-between px-5 py-4 border-b border-t-overlay/10 flex-shrink-0">
                <h2 className="text-base font-semibold text-t-text flex items-center gap-2">
                  <Key className="w-5 h-5 text-t-text/50" />
                  {t('credentials.title', 'Clés & Credentials')}
                </h2>
                <button
                  onClick={() => setShowCredentials(false)}
                  className="p-1.5 rounded-lg hover:bg-t-overlay/10 text-t-text/50 hover:text-t-text transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <CredentialVault agentId={projectId} />
              </div>
            </div>
          </>
        )}

        {/* API Integration Modal */}
        {showApiIntegration && projectId && (
          <ApiIntegrationModal
            agentId={projectId}
            agentName={projectId}
            agentSlug={agentSlug}
            onClose={() => setShowApiIntegration(false)}
          />
        )}
        </div>
      </div>
    </div>
  );
}
