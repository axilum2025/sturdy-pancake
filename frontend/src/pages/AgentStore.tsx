import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Grid3X3, Sparkles, TrendingUp, Star, ArrowLeft, Store } from 'lucide-react';

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
  support: 'from-green-500 to-emerald-600',
  education: 'from-amber-500 to-orange-600',
  creative: 'from-pink-500 to-rose-600',
  'dev-tools': 'from-purple-500 to-violet-600',
  marketing: 'from-emerald-500 to-teal-600',
  data: 'from-cyan-500 to-blue-600',
  entertainment: 'from-red-500 to-pink-600',
  other: 'from-gray-500 to-gray-600',
};

export default function AgentStore() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<StoreAgentCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [selectedCategory, searchQuery]);

  const fetchData = async () => {
    try {
      const [agentsRes, catsRes] = await Promise.all([
        fetch('/api/store'),
        fetch('/api/store/categories'),
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
      const res = await fetch(`/api/store?${params}`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const trending = [...agents].sort((a, b) => b.usageCount - a.usageCount).slice(0, 6);
  const topRated = [...agents].sort((a, b) => b.rating - a.rating).slice(0, 6);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-blue-400 glow-icon" />
            <h1 className="text-xl font-bold gradient-text">Agent Store</h1>
          </div>
          <div className="flex-1" />
          {/* Search */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un agent..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
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
                : 'bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'btn-gradient text-white glow-blue'
                  : 'bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]'
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
            <p className="text-white/40">Chargement du Store...</p>
          </div>
        ) : (
          <>
            {/* Trending Section */}
            {selectedCategory === 'all' && !searchQuery && (
              <section className="mb-10 animate-fade-in-up">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-orange-400 glow-icon" />
                  <h2 className="text-lg font-semibold text-white/90">Trending</h2>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {trending.map((agent) => (
                    <AgentIcon key={agent.id} agent={agent} onClick={() => navigate(`/store/${agent.id}`)} />
                  ))}
                </div>
              </section>
            )}

            {/* Top Rated */}
            {selectedCategory === 'all' && !searchQuery && (
              <section className="mb-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-yellow-400 glow-icon" />
                  <h2 className="text-lg font-semibold text-white/90">Les mieux notés</h2>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {topRated.map((agent) => (
                    <AgentIcon key={agent.id} agent={agent} onClick={() => navigate(`/store/${agent.id}`)} />
                  ))}
                </div>
              </section>
            )}

            {/* All Agents / Search Results */}
            <section className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-blue-400 glow-icon" />
                <h2 className="text-lg font-semibold text-white/90">
                  {searchQuery
                    ? `Résultats pour "${searchQuery}"`
                    : selectedCategory !== 'all'
                    ? categories.find((c) => c.id === selectedCategory)?.label || 'Agents'
                    : 'Tous les agents'}
                </h2>
                <span className="text-sm text-white/30">({agents.length})</span>
              </div>

              {agents.length === 0 ? (
                <div className="text-center py-16">
                  <Store className="w-16 h-16 mx-auto mb-4 text-white/15" />
                  <p className="text-white/40 text-lg">Aucun agent trouvé</p>
                  <p className="text-white/25 text-sm mt-1">Essayez une autre recherche ou catégorie</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {agents.map((agent, idx) => (
                    <AgentIcon
                      key={agent.id}
                      agent={agent}
                      onClick={() => navigate(`/store/${agent.id}`)}
                      style={{ animationDelay: `${idx * 50}ms` }}
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
}: {
  agent: StoreAgentCard;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  const getInitial = (name: string) => name.charAt(0).toUpperCase();
  const catColor = CATEGORY_COLORS[agent.category] || CATEGORY_COLORS.other;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-white/[0.04] transition-all duration-200 group animate-fade-in-up"
      style={style}
    >
      {/* Icon */}
      <div
        className={`w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-[22%] bg-gradient-to-br ${catColor} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200`}
        style={agent.icon ? {} : { boxShadow: `0 4px 20px ${agent.iconColor}30` }}
      >
        {agent.icon ? (
          <img src={agent.icon} alt={agent.name} className="w-full h-full rounded-[22%] object-cover" />
        ) : (
          <span className="text-2xl sm:text-3xl font-bold text-white/90 drop-shadow-lg">
            {getInitial(agent.name)}
          </span>
        )}
      </div>
      {/* Name */}
      <span className="text-xs sm:text-sm text-white/70 text-center leading-tight line-clamp-2 group-hover:text-white/90 transition-colors max-w-[80px] sm:max-w-[90px]">
        {agent.name}
      </span>
    </button>
  );
}
