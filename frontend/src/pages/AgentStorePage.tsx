import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Star, Users, Sparkles, Lock, Globe,
  Copy, Check, Tag, Clock, Cpu, Thermometer, Shield, RefreshCw
} from 'lucide-react';

interface StoreAgentDetail {
  id: string;
  agentId: string;
  userId: string;
  creatorName: string;
  name: string;
  description: string;
  shortDescription: string;
  icon: string;
  iconColor: string;
  features: string[];
  category: string;
  tags: string[];
  configSnapshot: {
    model: string;
    systemPrompt: string;
    welcomeMessage: string;
    temperature: number;
    maxTokens: number;
    tools: { name: string; type: string }[];
  };
  visibility: 'public' | 'private';
  accessToken?: string;
  accessPrice?: number;
  usageCount: number;
  remixCount: number;
  rating: number;
  ratingCount: number;
  version: string;
  publishedAt: string;
  updatedAt: string;
  requiresToken?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  productivity: '⚡ Productivité',
  support: '🎧 Support Client',
  education: '📚 Éducation',
  creative: '🎨 Créatif',
  'dev-tools': '💻 Dev Tools',
  marketing: '📈 Marketing',
  data: '📊 Data & Analytics',
  entertainment: '🎮 Divertissement',
  other: '📦 Autre',
};

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

export default function AgentStorePage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<StoreAgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  const fetchAgent = async (token?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['x-access-token'] = token;
      const res = await fetch(`/api/store/${agentId}`, { headers });
      const data = await res.json();
      setAgent(data);
      if (token && !data.requiresToken) {
        setTokenValid(true);
      }
    } catch (error) {
      console.error('Error fetching agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateToken = async () => {
    try {
      const res = await fetch(`/api/store/${agentId}/validate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput }),
      });
      const data = await res.json();
      setTokenValid(data.valid);
      if (data.valid) {
        fetchAgent(tokenInput);
      }
    } catch (error) {
      setTokenValid(false);
    }
  };

  const handleUseAgent = () => {
    if (agent?.requiresToken && !tokenValid) return;
    const params = tokenValid && tokenInput ? `?token=${tokenInput}` : '';
    navigate(`/store/${agentId}/chat${params}`);
  };

  const handleCopyId = () => {
    if (!agent) return;
    navigator.clipboard.writeText(agent.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white/40">
        Agent introuvable
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[agent.category] || CATEGORY_COLORS.other;
  const isPrivateLocked = agent.requiresToken && !tokenValid;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate('/store')}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-white/40 text-sm">Agent Store</span>
          <span className="text-white/20">/</span>
          <span className="text-white/70 text-sm truncate">{agent.name}</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero Section */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8 animate-fade-in-up">
          {/* Big Icon */}
          <div
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-[26%] bg-gradient-to-br ${catColor} flex items-center justify-center shadow-2xl flex-shrink-0`}
            style={{ boxShadow: `0 8px 40px ${agent.iconColor}40` }}
          >
            {agent.icon ? (
              <img src={agent.icon} alt={agent.name} className="w-full h-full rounded-[26%] object-cover" />
            ) : (
              <span className="text-5xl sm:text-6xl font-bold text-white/90 drop-shadow-lg">
                {agent.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold">{agent.name}</h1>
              {agent.visibility === 'private' ? (
                <Lock className="w-5 h-5 text-amber-400" />
              ) : (
                <Globe className="w-5 h-5 text-green-400" />
              )}
            </div>
            <p className="text-white/50 text-sm mb-3">par {agent.creatorName}</p>
            <p className="text-white/70 text-base mb-4">{agent.shortDescription}</p>

            {/* Stats row */}
            <div className="flex items-center gap-5 justify-center sm:justify-start text-sm">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-white/80 font-medium">{agent.rating.toFixed(1)}</span>
                {agent.ratingCount > 0 && (
                  <span className="text-white/30">({agent.ratingCount})</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-white/80">{formatCount(agent.usageCount)} utilisations</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-purple-400" />
                <span className="text-white/80">{agent.remixCount} remixes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          {isPrivateLocked ? (
            <div className="flex-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => { setTokenInput(e.target.value); setTokenValid(null); }}
                    placeholder="Entrez le token d'accès..."
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
                <button
                  onClick={handleValidateToken}
                  className="btn-gradient px-6 py-3 rounded-xl font-medium"
                >
                  Valider
                </button>
              </div>
              {tokenValid === false && (
                <p className="text-red-400 text-xs mt-2">Token invalide. Vérifiez votre token d'accès.</p>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={handleUseAgent}
                className="flex-1 btn-gradient px-6 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 glow-blue"
              >
                <MessageSquare className="w-5 h-5" />
                Utiliser cet Agent
              </button>
              {agent.visibility === 'public' && (
                <button
                  onClick={() => {/* TODO: remix */}}
                  className="px-6 py-3 rounded-xl font-medium border border-white/10 bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Remixer
                </button>
              )}
            </>
          )}
        </div>

        {/* Description */}
        <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <h2 className="text-lg font-semibold text-white/90 mb-3">Description</h2>
          <p className="text-white/60 text-sm leading-relaxed">{agent.description}</p>
        </div>

        {/* Features */}
        {agent.features && agent.features.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <h2 className="text-lg font-semibold text-white/90 mb-3">Fonctionnalités</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agent.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-white/70">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Details */}
        {!isPrivateLocked && agent.configSnapshot && (
          <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <h2 className="text-lg font-semibold text-white/90 mb-3">Détails techniques</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/[0.03] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs text-white/40">Modèle</span>
                </div>
                <p className="text-sm text-white/80 font-medium">{agent.configSnapshot.model.split('/').pop()}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs text-white/40">Température</span>
                </div>
                <p className="text-sm text-white/80 font-medium">{agent.configSnapshot.temperature}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Tag className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-white/40">Catégorie</span>
                </div>
                <p className="text-sm text-white/80 font-medium">{CATEGORY_LABELS[agent.category] || agent.category}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-white/40">Publié</span>
                </div>
                <p className="text-sm text-white/80 font-medium">{formatDate(agent.publishedAt)}</p>
              </div>
            </div>

            {/* Tools */}
            {agent.configSnapshot.tools.length > 0 && (
              <div className="mt-4">
                <span className="text-xs text-white/40">Outils connectés :</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {agent.configSnapshot.tools.map((t, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/60">
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {agent.tags && agent.tags.length > 0 && (
          <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="flex flex-wrap gap-2">
              {agent.tags.map((tag, i) => (
                <span
                  key={i}
                  className="text-xs px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-white/50"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Agent ID */}
        <div className="flex items-center gap-2 text-xs text-white/20 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          <span>ID: {agent.id}</span>
          <button onClick={handleCopyId} className="hover:text-white/50 transition-colors">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
          <span className="ml-2">v{agent.version}</span>
        </div>
      </div>
    </div>
  );
}
