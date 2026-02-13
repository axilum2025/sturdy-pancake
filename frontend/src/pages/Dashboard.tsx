import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Zap, Cloud, Bot, MessageSquare, Rocket, Crown, Sparkles, Store, Trash2, BarChart3, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { listAgents, createAgent, deleteAgent, getAgentTemplates, Agent, AgentTemplate } from '../services/api';
import AuthModal from '../components/AuthModal';
import UserProfileModal from '../components/UserProfileModal';
import ProjectCard from '../components/ProjectCard';

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchProjects();
      getAgentTemplates().then(setTemplates).catch(() => {});
    }
  }, [isAuthenticated, user]);

  const fetchProjects = async () => {
    try {
      const data = await listAgents();
      setProjects(data.agents);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim() || selectedTemplate?.name;
    if (!name || isCreating) return;
    
    setIsCreating(true);
    try {
      const config = selectedTemplate?.config || undefined;
      const description = selectedTemplate?.description || t('common.loading');
      const agent = await createAgent(name, description, config);
      setProjects([agent, ...projects]);
      setShowCreateModal(false);
      setNewProjectName('');
      setSelectedTemplate(null);
      navigate(`/studio/${agent.id}`);
    } catch (error: any) {
      console.error('Error creating agent:', error);
      const message = error?.message || t('common.error') || 'Failed to create agent';
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAgent(deleteTarget.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting agent:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = (email: string) => {
    if (user?.displayName) {
      return user.displayName.slice(0, 2).toUpperCase();
    }
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro': return 'from-indigo-500 to-indigo-500';
      case 'team': return 'from-blue-500 to-indigo-500';
      default: return 'from-blue-500 to-indigo-500';
    }
  };

  const getTierGlow = (tier: string) => {
    switch (tier) {
      case 'pro': return 'glow-purple';
      case 'team': return 'glow-blue';
      default: return 'glow-blue';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-t-page flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-t-text/40">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-t-page flex items-center justify-center">
        <div className="text-center">
          <div className="mb-8 animate-fade-in-up">
            <Zap className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400 mx-auto mb-4 glow-icon" />
            <h1 className="text-2xl sm:text-4xl font-bold gradient-text mb-4">GiLo AI</h1>
            <p className="text-t-text/40 text-base sm:text-xl px-4">{t('dashboard.connectPrompt')}</p>
          </div>
          <button
            onClick={() => setShowAuth(true)}
            className="btn-gradient px-8 py-3 rounded-xl text-t-text font-semibold animate-fade-in-up delay-100"
          >
            {t('common.signIn')}
          </button>
          <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
        </div>
      </div>
    );
  }

  const paidSlots = user?.paidAgentSlots || 0;
  const agentsMax = user?.maxAgents || (2 + paidSlots);
  const agentsProgress = (projects.length / agentsMax) * 100;
  
  const totalConversations = projects.reduce((sum, a) => sum + (a.totalConversations || 0), 0);
  const totalMessages = projects.reduce((sum, a) => sum + (a.totalMessages || 0), 0);
  const deployedCount = projects.filter(a => a.status === 'deployed').length;

  return (
    <div className="min-h-screen bg-t-page">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-40" />

      {/* Header/Navbar */}
      <header className="relative z-40 border-b border-t-overlay/5 glass">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2.5">
              <span className="text-base sm:text-lg font-bold tracking-tight gradient-text">
                Dashboard
              </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate('/store')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/15 transition-all duration-200 group"
              >
                <Store className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-blue-300 hidden sm:inline">{t('dashboard.agentStore')}</span>
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 hover:border-green-500/40 hover:bg-green-500/15 transition-all duration-200 group"
              >
                <BarChart3 className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-green-300 hidden sm:inline">Analytics</span>
              </button>
              <button
                onClick={() => navigate('/billing')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/15 transition-all duration-200 group"
              >
                <CreditCard className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-indigo-300 hidden sm:inline">Billing</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-t-text/90 font-medium text-sm">{user?.email}</p>
                  <div className="flex items-center justify-end gap-2">
                    <span className={`text-xs font-medium capitalize ${
                      user?.tier === 'pro' ? 'text-indigo-400' : 'text-blue-400'
                    }`}>
                      {user?.tier} Plan
                    </span>
                    {user?.tier === 'pro' && (
                      <Crown className="w-3 h-3 text-indigo-400" />
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowProfile(true)}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${getTierColor(user?.tier || 'free')} flex items-center justify-center text-white font-bold text-xs sm:text-sm ${getTierGlow(user?.tier || 'free')} cursor-pointer hover:scale-110 hover:shadow-lg transition-all duration-200 ring-2 ring-transparent hover:ring-blue-400/30`}
                  title={t('profile.openProfile')}
                >
                  {getInitials(user?.email || 'U')}
                </button>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-t-overlay/5 border border-t-overlay/10 hover:bg-t-overlay/10 hover:border-t-overlay/20 transition-all duration-200"
                title={t('profile.logout')}
              >
                <LogOut className="w-4 h-4 text-t-text/60" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Section */}
      <div className="relative z-10 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Agents Stat */}
            <div className="glass-card rounded-2xl p-3 sm:p-5 animate-fade-in-up">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="p-1.5 sm:p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 glow-icon" />
                </div>
                <span className="text-[10px] sm:text-xs text-t-text/40">{t('dashboard.agents')}</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-t-text mb-2">
                {projects.length} <span className="text-t-text/30 text-xs sm:text-base font-normal">/ {agentsMax}</span>
              </p>
              <div className="w-full h-1.5 bg-t-overlay/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(agentsProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Conversations Stat */}
            <div className="glass-card rounded-2xl p-3 sm:p-5 animate-fade-in-up delay-100">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="p-1.5 sm:p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 glow-icon" />
                </div>
                <span className="text-[10px] sm:text-xs text-t-text/40">{t('dashboard.conversations')}</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-t-text mb-2">
                {totalConversations}
              </p>
              <p className="text-xs text-t-text/30">{t('dashboard.totalMessages', { count: totalMessages })}</p>
            </div>

            {/* Deployed Stat */}
            <div className="glass-card rounded-2xl p-3 sm:p-5 animate-fade-in-up delay-200">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="p-1.5 sm:p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 glow-icon" />
                </div>
                <span className="text-[10px] sm:text-xs text-t-text/40">{t('dashboard.deployed')}</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-t-text mb-2">
                {deployedCount} <span className="text-t-text/30 text-xs sm:text-base font-normal">/ {projects.length}</span>
              </p>
              <div className="w-full h-1.5 bg-t-overlay/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${projects.length > 0 ? (deployedCount / projects.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Tier Stat */}
            <div className="glass-card rounded-2xl p-3 sm:p-5 animate-fade-in-up delay-300">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className={`p-1.5 sm:p-2.5 rounded-xl bg-gradient-to-br ${getTierColor(user?.tier || 'free')}/10 border border-t-overlay/10`}>
                  <Crown className={`w-4 h-4 sm:w-5 sm:h-5 ${user?.tier === 'pro' ? 'text-indigo-400' : 'text-blue-400'} glow-icon`} />
                </div>
                <span className="text-[10px] sm:text-xs text-t-text/40">{t('dashboard.tier')}</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold capitalize text-t-text mb-2">
                {paidSlots > 0 ? 'Pro' : 'Free'}
              </p>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                paidSlots > 0 ? 'bg-indigo-500/20 text-indigo-300' : 
                'bg-blue-500/20 text-blue-300'
              }`}>
                {paidSlots > 0 && <Crown className="w-3 h-3" />}
                {paidSlots === 0 && <Sparkles className="w-3 h-3" />}
                {paidSlots > 0 ? `${paidSlots} PAID` : 'FREE'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <main className="relative z-10 pb-8 sm:pb-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-t-text mb-1">
                {t('dashboard.yourAgents')} <span className="gradient-text">{t('dashboard.agentsWord')}</span>
              </h2>
              <p className="text-t-text/40 text-sm">{t('dashboard.manageAgents')}</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={projects.length >= agentsMax}
              className="btn-gradient px-5 py-2.5 rounded-xl text-t-text font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              {t('dashboard.newAgent')}
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-20">
              <div className="animate-spin w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-t-text/40">{t('dashboard.loadingAgents')}</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 sm:p-12 text-center animate-fade-in-up">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-t-overlay/5 flex items-center justify-center mx-auto mb-6">
                <Cloud className="w-10 h-10 text-t-text/30" />
              </div>
              <h3 className="text-xl font-semibold text-t-text mb-2">{t('dashboard.noAgents')}</h3>
              <p className="text-t-text/40 mb-6 max-w-md mx-auto">
                {t('dashboard.noAgentsDesc')}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-gradient px-6 py-3 rounded-xl text-t-text font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('dashboard.createFirst')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {projects.map((project, index) => (
                <div key={project.id} style={{ animationDelay: `${index * 100}ms` }}>
                  <ProjectCard
                    project={project}
                    onClick={() => navigate(`/studio/${project.id}`)}
                    onDelete={(id) => setDeleteTarget(projects.find((p) => p.id === id) || null)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative glass-strong rounded-2xl w-full max-w-lg p-5 sm:p-8 border-gradient animate-fade-in-scale max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-t-text">{t('dashboard.createModal.title')}</h2>
                <p className="text-t-text/40 text-sm">{t('dashboard.createModal.subtitle')}</p>
              </div>
            </div>

            {/* Template selection */}
            {templates.length > 0 && (
              <div className="mb-5">
                <label className="block text-t-text/70 text-sm font-medium mb-2">
                  Démarrer depuis un template
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  <button
                    onClick={() => { setSelectedTemplate(null); setNewProjectName(''); }}
                    className={`p-3 rounded-xl text-left transition-all text-xs ${
                      !selectedTemplate
                        ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                        : 'bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/50 hover:border-t-overlay/20'
                    }`}
                  >
                    <span className="text-lg block mb-1">✨</span>
                    <span className="font-medium block">Agent vide</span>
                    <span className="text-t-text/30 block mt-0.5">Partir de zéro</span>
                  </button>
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => { setSelectedTemplate(tpl); setNewProjectName(tpl.name); }}
                      className={`p-3 rounded-xl text-left transition-all text-xs ${
                        selectedTemplate?.id === tpl.id
                          ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                          : 'bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/50 hover:border-t-overlay/20'
                      }`}
                    >
                      <span className="text-lg block mb-1">{tpl.icon}</span>
                      <span className="font-medium block truncate">{tpl.name}</span>
                      <span className="text-t-text/30 block mt-0.5 truncate">{tpl.description.substring(0, 50)}...</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Error banner */}
            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 animate-fade-in-up">
                <span className="text-red-400 text-sm flex-1">{createError}</span>
                <button onClick={() => setCreateError(null)} className="text-red-400/60 hover:text-red-400 text-lg leading-none">&times;</button>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-t-text/70 text-sm font-medium mb-2">{t('dashboard.createModal.nameLabel')}</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t('dashboard.createModal.namePlaceholder')}
                className="input-futuristic w-full px-4 py-3 rounded-xl text-t-text"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 rounded-xl text-t-text/70 font-medium border border-t-overlay/10 hover:bg-t-overlay/5 hover:border-t-overlay/20 transition-all duration-200"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateProject}
                disabled={(!newProjectName.trim() && !selectedTemplate) || isCreating}
                className="flex-1 btn-gradient px-4 py-3 rounded-xl text-t-text font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t('common.processing')}</span>
                  </>
                ) : (
                  t('common.create')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => !isDeleting && setDeleteTarget(null)}
          />
          <div className="relative glass-strong rounded-2xl w-full max-w-md p-5 sm:p-8 border border-red-500/20 animate-fade-in-scale">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-t-text">{t('dashboard.deleteModal.title')}</h2>
                <p className="text-t-text/40 text-sm">{deleteTarget.name}</p>
              </div>
            </div>

            <div className="mb-6 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
              <p className="text-sm text-red-300/90 mb-2 font-medium">{t('dashboard.deleteModal.warning')}</p>
              <ul className="text-xs text-t-text/50 space-y-1 ml-4 list-disc">
                <li>{t('dashboard.deleteModal.item1')}</li>
                <li>{t('dashboard.deleteModal.item2')}</li>
                <li>{t('dashboard.deleteModal.item3')}</li>
                <li>{t('dashboard.deleteModal.item4')}</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 rounded-xl text-t-text/70 font-medium border border-t-overlay/10 hover:bg-t-overlay/5 hover:border-t-overlay/20 transition-all duration-200 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAgent}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {t('dashboard.deleteModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      <UserProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}
