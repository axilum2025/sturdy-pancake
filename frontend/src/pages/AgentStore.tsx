import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Grid3X3, Sparkles, TrendingUp, Star, ArrowLeft, Store, Trash2, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../services/api';

interface StoreAgentCard {
  id: string;
  name: string;
  shortDescription: string;
  icon: string;
  iconColor: string;
  category: string;
  visibility: string;
  rating: number;
  ratingCount?: number;
  usageCount: number;
  creatorName: string;
}

interface Category {
  id: string;
  label: string;
  icon: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  productivity: 'from-blue-500 to-blue-600',
  support: 'from-green-500 to-green-600',
  education: 'from-amber-500 to-amber-600',
  creative: 'from-indigo-500 to-indigo-600',
  'dev-tools': 'from-indigo-400 to-blue-600',
  marketing: 'from-green-400 to-green-600',
  data: 'from-blue-400 to-blue-600',
  entertainment: 'from-red-500 to-red-600',
  other: 'from-blue-400 to-indigo-500',
};

export default function AgentStore() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [agents, setAgents] = useState<StoreAgentCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    checkAdmin();
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [selectedCategory, searchQuery]);

  const fetchData = async () => {
    try {
      const [agentsRes, catsRes] = await Promise.all([
        fetch(`${API_BASE}/api/store`),
        fetch(`${API_BASE}/api/store/categories`),
      ]);
      const agentsData = await agentsRes.json();
      const catsData = await catsRes.json();
      setAgents(agentsData.agents || []);
      setCategories(catsData || []);
    } catch (error) {
      console.error('Error fetching store data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`${API_BASE}/api/store?${params}`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const checkAdmin = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/store/admin/check`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setIsAdmin(data.isAdmin === true);
    } catch {
      setIsAdmin(false);
    }
  };

  const handleAdminDelete = async (agentId: string) => {
    if (confirmDeleteId !== agentId) {
      setConfirmDeleteId(agentId);
      return;
    }
    const token = localStorage.getItem('authToken');
    if (!token) return;
    setDeletingId(agentId);
    try {
      const res = await fetch(`${API_BASE}/api/store/admin/${agentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== agentId));
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const trending = [...agents].sort((a, b) => b.usageCount - a.usageCount).slice(0, 6);
  const topRated = [...agents].sort((a, b) => b.rating - a.rating).slice(0, 6);

  return (
    <div className="min-h-screen bg-t-page text-t-text">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-t-overlay/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg text-t-text/50 hover:text-t-text hover:bg-t-overlay/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-blue-400 glow-icon" />
            <h1 className="hidden landscape:inline sm:inline text-xl font-bold gradient-text">Agent Store</h1>
          </div>
          <div className="flex-1" />
          {/* Search */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-text/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('store.searchPlaceholder')}
              className="w-full bg-t-overlay/[0.04] border border-t-overlay/10 rounded-xl pl-10 pr-4 py-2 text-sm text-t-text/90 placeholder-t-text/30 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'btn-gradient text-white glow-blue'
                : 'bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/60 hover:text-t-text hover:bg-t-overlay/[0.08]'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            {t('common.all')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'btn-gradient text-white glow-blue'
                  : 'bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/60 hover:text-t-text hover:bg-t-overlay/[0.08]'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-t-text/40">{t('store.loading')}</p>
          </div>
        ) : (
          <>
            {/* Trending Section */}
            {selectedCategory === 'all' && !searchQuery && (
              <section className="mb-10 animate-fade-in-up">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-400 glow-icon" />
                  <h2 className="text-lg font-semibold text-t-text/90">Trending</h2>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {trending.map((agent) => (
                    <AgentIcon
                      key={agent.id}
                      agent={agent}
                      onClick={() => navigate(`/store/${agent.id}`)}
                      isAdmin={isAdmin}
                      isConfirming={confirmDeleteId === agent.id}
                      isDeleting={deletingId === agent.id}
                      onDelete={() => handleAdminDelete(agent.id)}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Top Rated */}
            {selectedCategory === 'all' && !searchQuery && (
              <section className="mb-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-amber-400 glow-icon" />
                  <h2 className="text-lg font-semibold text-t-text/90">{t('store.topRated')}</h2>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {topRated.map((agent) => (
                    <AgentIcon
                      key={agent.id}
                      agent={agent}
                      onClick={() => navigate(`/store/${agent.id}`)}
                      isAdmin={isAdmin}
                      isConfirming={confirmDeleteId === agent.id}
                      isDeleting={deletingId === agent.id}
                      onDelete={() => handleAdminDelete(agent.id)}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All Agents / Search Results */}
            <section className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-blue-400 glow-icon" />
                <h2 className="text-lg font-semibold text-t-text/90">
                  {searchQuery
                    ? `${t('store.resultsFor')} "${searchQuery}"`
                    : selectedCategory !== 'all'
                    ? categories.find((c) => c.id === selectedCategory)?.label || t('store.agents')
                    : t('store.allAgents')}
                </h2>
                <span className="text-sm text-t-text/30">({agents.length})</span>
              </div>

              {agents.length === 0 ? (
                <div className="text-center py-16">
                  <Store className="w-16 h-16 mx-auto mb-4 text-t-text/15" />
                  <p className="text-t-text/40 text-lg">{t('store.noAgents')}</p>
                  <p className="text-t-text/25 text-sm mt-1">{t('store.tryAnother')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {agents.map((agent, idx) => (
                    <AgentIcon
                      key={agent.id}
                      agent={agent}
                      onClick={() => navigate(`/store/${agent.id}`)}
                      style={{ animationDelay: `${idx * 50}ms` }}
                      isAdmin={isAdmin}
                      isConfirming={confirmDeleteId === agent.id}
                      isDeleting={deletingId === agent.id}
                      onDelete={() => handleAdminDelete(agent.id)}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Agent Icon Component — App Store style
// ============================================================
function AgentIcon({
  agent,
  onClick,
  style,
  isAdmin,
  isConfirming,
  isDeleting,
  onDelete,
  onCancelDelete,
}: {
  agent: StoreAgentCard;
  onClick: () => void;
  style?: React.CSSProperties;
  isAdmin?: boolean;
  isConfirming?: boolean;
  isDeleting?: boolean;
  onDelete?: () => void;
  onCancelDelete?: () => void;
}) {
  const getInitial = (name: string) => name.charAt(0).toUpperCase();
  const catColor = CATEGORY_COLORS[agent.category] || CATEGORY_COLORS.other;

  return (
    <div className="relative group animate-fade-in-up" style={style}>
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-t-overlay/[0.04] transition-all duration-200 w-full"
      >
        {/* Icon */}
        <div
          className={`w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-[22%] bg-gradient-to-br ${catColor} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200`}
          style={agent.icon ? {} : { boxShadow: `0 4px 20px ${agent.iconColor}30` }}
        >
          {agent.icon ? (
            <img src={agent.icon} alt={agent.name} className="w-full h-full rounded-[22%] object-cover" />
          ) : (
            <span className="text-2xl sm:text-3xl font-bold text-t-text/90 drop-shadow-lg">
              {getInitial(agent.name)}
            </span>
          )}
        </div>
        {/* Name */}
        <span className="text-xs sm:text-sm text-t-text/70 text-center leading-tight line-clamp-2 group-hover:text-t-text/90 transition-colors max-w-[80px] sm:max-w-[90px]">
          {agent.name}
        </span>
      </button>

      {/* Admin delete badge */}
      {isAdmin && !isConfirming && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 shadow-lg z-10"
          title="Supprimer du store"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      {/* Confirm delete overlay */}
      {isAdmin && isConfirming && (
        <div className="absolute inset-0 bg-black/70 rounded-2xl flex flex-col items-center justify-center gap-2 z-10 backdrop-blur-sm">
          <p className="text-[10px] text-red-300 text-center px-2 font-medium">Supprimer ?</p>
          <div className="flex gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
              disabled={isDeleting}
              className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-[10px] font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Oui
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCancelDelete?.(); }}
              className="px-2.5 py-1 rounded-lg bg-t-overlay/20 text-t-text/70 text-[10px] font-medium hover:bg-t-overlay/30 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Non
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
