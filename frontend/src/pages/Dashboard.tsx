import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Zap, Cloud, Bot, MessageSquare, Rocket, Crown, Sparkles, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { listAgents, createAgent, Agent } from '../services/api';
import AuthModal from '../components/AuthModal';
import ProjectCard from '../components/ProjectCard';

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchProjects();
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
    if (!newProjectName.trim()) return;
    
    try {
      const agent = await createAgent(newProjectName, 'Créé avec GiLo AI');
      setProjects([agent, ...projects]);
      setShowCreateModal(false);
      setNewProjectName('');
      navigate(`/builder/${agent.id}`);
    } catch (error) {
      console.error('Error creating agent:', error);
    }
  };

  const getInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro': return 'from-indigo-500 to-violet-500';
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white/40">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-8 animate-fade-in-up">
            <Zap className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400 mx-auto mb-4 glow-icon" />
            <h1 className="text-2xl sm:text-4xl font-bold gradient-text mb-4">GiLo AI</h1>
            <p className="text-white/40 text-base sm:text-xl px-4">Connectez-vous pour accéder à vos agents</p>
          </div>
          <button
            onClick={() => setShowAuth(true)}
            className="btn-gradient px-8 py-3 rounded-xl text-white font-semibold animate-fade-in-up delay-100"
          >
            Se connecter
          </button>
          <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
        </div>
      </div>
    );
  }

  const agentsMax = user?.tier === 'pro' ? 20 : 5;
  const agentsProgress = (projects.length / agentsMax) * 100;
  
  const totalConversations = projects.reduce((sum, a) => sum + (a.totalConversations || 0), 0);
  const totalMessages = projects.reduce((sum, a) => sum + (a.totalMessages || 0), 0);
  const deployedCount = projects.filter(a => a.status === 'deployed').length;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-40" />

      {/* Header/Navbar */}
      <header className="relative z-40 border-b border-white/5 glass">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2.5">
              <span className="text-base sm:text-lg font-bold tracking-tight gradient-text">
                GiLo AI
              </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate('/store')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/15 transition-all duration-200 group"
              >
                <Store className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-blue-300 hidden sm:inline">Agent Store</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-white/90 font-medium text-sm">{user?.email}</p>
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
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${getTierColor(user?.tier || 'free')} flex items-center justify-center text-white font-bold text-xs sm:text-sm ${getTierGlow(user?.tier || 'free')}`}>
                  {getInitials(user?.email || 'U')}
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
              >
                <LogOut className="w-4 h-4 text-white/60" />
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
                <span className="text-[10px] sm:text-xs text-white/40">Agents</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-white mb-2">
                {projects.length} <span className="text-white/30 text-xs sm:text-base font-normal">/ {agentsMax}</span>
              </p>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
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
                <span className="text-[10px] sm:text-xs text-white/40">Conversations</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-white mb-2">
                {totalConversations}
              </p>
              <p className="text-xs text-white/30">{totalMessages} messages au total</p>
            </div>

            {/* Deployed Stat */}
            <div className="glass-card rounded-2xl p-3 sm:p-5 animate-fade-in-up delay-200">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="p-1.5 sm:p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 glow-icon" />
                </div>
                <span className="text-[10px] sm:text-xs text-white/40">Déployés</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-white mb-2">
                {deployedCount} <span className="text-white/30 text-xs sm:text-base font-normal">/ {projects.length}</span>
              </p>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${projects.length > 0 ? (deployedCount / projects.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Tier Stat */}
            <div className="glass-card rounded-2xl p-3 sm:p-5 animate-fade-in-up delay-300">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className={`p-1.5 sm:p-2.5 rounded-xl bg-gradient-to-br ${getTierColor(user?.tier || 'free')}/10 border border-white/10`}>
                  <Crown className={`w-4 h-4 sm:w-5 sm:h-5 ${user?.tier === 'pro' ? 'text-indigo-400' : 'text-blue-400'} glow-icon`} />
                </div>
                <span className="text-[10px] sm:text-xs text-white/40">Tier</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold capitalize text-white mb-2">
                {user?.tier}
              </p>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                user?.tier === 'pro' ? 'bg-indigo-500/20 text-indigo-300' : 
                'bg-blue-500/20 text-blue-300'
              }`}>
                {user?.tier === 'pro' && <Crown className="w-3 h-3" />}
                {user?.tier === 'team' && <Zap className="w-3 h-3" />}
                {user?.tier === 'free' && <Sparkles className="w-3 h-3" />}
                {user?.tier?.toUpperCase()}
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
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                Vos <span className="gradient-text">Agents</span>
              </h2>
              <p className="text-white/40 text-sm">Gérez et déployez vos agents IA</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={projects.length >= agentsMax}
              className="btn-gradient px-5 py-2.5 rounded-xl text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Nouvel Agent
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-20">
              <div className="animate-spin w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-white/40">Chargement des agents...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 sm:p-12 text-center animate-fade-in-up">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center mx-auto mb-6">
                <Cloud className="w-10 h-10 text-white/30" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Aucun agent</h3>
              <p className="text-white/40 mb-6 max-w-md mx-auto">
                Commencez par créer votre premier agent IA avec GiLo
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-gradient px-6 py-3 rounded-xl text-white font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Créer mon premier agent
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {projects.map((project, index) => (
                <div key={project.id} style={{ animationDelay: `${index * 100}ms` }}>
                  <ProjectCard
                    project={project}
                    onClick={() => navigate(`/builder/${project.id}`)}
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
          <div className="relative glass-strong rounded-2xl w-full max-w-lg p-5 sm:p-8 border-gradient animate-fade-in-scale">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Nouvel Agent</h2>
                <p className="text-white/40 text-sm">Créez un nouvel agent IA</p>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-white/70 text-sm font-medium mb-2">Nom de l'agent</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Agent de support client"
                className="input-futuristic w-full px-4 py-3 rounded-xl text-white"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 rounded-xl text-white/70 font-medium border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all duration-200"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="flex-1 btn-gradient px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
