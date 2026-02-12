import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Star, Users, Sparkles, Lock, Globe,
  Copy, Check, Tag, Clock, Cpu, Thermometer, Shield, RefreshCw, CheckCircle, Loader2,
  Share2, X, Link2, Download, Trash2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../services/api';

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

export default function AgentStorePage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [agent, setAgent] = useState<StoreAgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [remixSuccess, setRemixSuccess] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  // Check admin status
  useEffect(() => {
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
    checkAdmin();
  }, []);

  const fetchAgent = async (token?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['x-access-token'] = token;
      const res = await fetch(`${API_BASE}/api/store/${agentId}`, { headers });
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
      const res = await fetch(`${API_BASE}/api/store/${agentId}/validate-token`, {
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

  const handleRemix = async () => {
    if (!agent || remixing) return;
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/dashboard');
      return;
    }
    setRemixing(true);
    try {
      const res = await fetch(`${API_BASE}/api/store/${agent.id}/remix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Remix failed');
      const data = await res.json();
      setRemixSuccess(true);
      setTimeout(() => {
        navigate(`/studio/${data.agent.id}`);
      }, 1500);
    } catch (error) {
      console.error('Error remixing agent:', error);
    } finally {
      setRemixing(false);
    }
  };

  const handleCopyId = () => {
    if (!agent) return;
    navigator.clipboard.writeText(agent.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const agentUrl = typeof window !== 'undefined' ? `${window.location.origin}/store/${agentId}` : '';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(agentUrl)}`;

  const handleShareCopyLink = () => {
    navigator.clipboard.writeText(agentUrl);
    setShareLinkCopied(true);
    setTimeout(() => setShareLinkCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const a = document.createElement('a');
    a.href = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&format=png&data=${encodeURIComponent(agentUrl)}`;
    a.download = `${agent?.name || 'agent'}-qr.png`;
    a.click();
  };

  const handleAdminDelete = async () => {
    if (!agent || deleting) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/store/admin/${agent.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      navigate('/store');
    } catch (error) {
      console.error('Error deleting agent from store:', error);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-t-page flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-t-page flex items-center justify-center text-t-text/40">
        Agent introuvable
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[agent.category] || CATEGORY_COLORS.other;
  const isPrivateLocked = agent.requiresToken && !tokenValid;

  // Translate category labels dynamically
  const getCategoryLabel = (cat: string) => {
    const icons: Record<string, string> = {
      productivity: '⚡', support: '🎧', education: '📚', creative: '🎨',
      'dev-tools': '💻', marketing: '📈', data: '📊', entertainment: '🎮', other: '📦',
    };
    return `${icons[cat] || '📦'} ${t(`categories.${cat}`, cat)}`;
  };

  return (
    <div className="min-h-screen bg-t-page text-t-text">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-t-overlay/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate('/store')}
            className="p-2 rounded-lg text-t-text/50 hover:text-t-text hover:bg-t-overlay/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-t-text/40 text-sm">Agent Store</span>
          <span className="text-t-text/20">/</span>
          <span className="text-t-text/70 text-sm truncate">{agent.name}</span>
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
              <span className="text-5xl sm:text-6xl font-bold text-t-text/90 drop-shadow-lg">
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
            <p className="text-t-text/50 text-sm mb-3">{t('store.by', { name: agent.creatorName })}</p>
            <p className="text-t-text/70 text-base mb-4">{agent.shortDescription}</p>

            {/* Stats row */}
            <div className="flex items-center gap-5 justify-center sm:justify-start text-sm">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-t-text/80 font-medium">{(agent.rating ?? 0).toFixed(1)}</span>
                {(agent.ratingCount ?? 0) > 0 && (
                  <span className="text-t-text/30">({agent.ratingCount})</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-t-text/80">{t('store.uses', { count: agent.usageCount ?? 0 })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <span className="text-t-text/80">{t('store.remixes', { count: agent.remixCount ?? 0 })}</span>
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
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-text/30" />
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => { setTokenInput(e.target.value); setTokenValid(null); }}
                    placeholder={t('store.enterToken')}
                    className="w-full bg-t-overlay/[0.04] border border-t-overlay/10 rounded-xl pl-10 pr-4 py-3 text-sm text-t-text/90 placeholder-t-text/30 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
                <button
                  onClick={handleValidateToken}
                  className="btn-gradient px-6 py-3 rounded-xl font-medium"
                >
                  {t('store.validate')}
                </button>
              </div>
              {tokenValid === false && (
                <p className="text-red-400 text-xs mt-2">{t('store.invalidToken')}</p>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={handleUseAgent}
                className="flex-1 btn-gradient px-6 py-3 rounded-xl font-semibold text-t-text flex items-center justify-center gap-2 glow-blue"
              >
                <MessageSquare className="w-5 h-5" />
                {t('store.useAgent')}
              </button>
              {isAuthenticated && (
                <button
                  onClick={handleRemix}
                  disabled={remixing}
                  className="px-6 py-3 rounded-xl font-medium border border-t-overlay/10 bg-t-overlay/[0.04] text-t-text/70 hover:text-t-text hover:bg-t-overlay/[0.08] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {remixing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {t('store.remix')}
                </button>
              )}
              <button
                onClick={() => setShowShareModal(true)}
                className="px-6 py-3 rounded-xl font-medium border border-t-overlay/10 bg-t-overlay/[0.04] text-t-text/70 hover:text-t-text hover:bg-t-overlay/[0.08] transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                {t('store.share')}
              </button>
            </>
          )}
        </div>

        {/* Description */}
        <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <h2 className="text-lg font-semibold text-t-text/90 mb-3">{t('store.description')}</h2>
          <p className="text-t-text/60 text-sm leading-relaxed">{agent.description}</p>
        </div>

        {/* Features */}
        {agent.features && agent.features.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <h2 className="text-lg font-semibold text-t-text/90 mb-3">{t('store.features')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agent.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-t-text/70">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Details */}
        {!isPrivateLocked && agent.configSnapshot && (
          <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <h2 className="text-lg font-semibold text-t-text/90 mb-3">{t('store.technicalDetails')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-t-overlay/[0.03] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-t-text/40">{t('store.modelLabel')}</span>
                </div>
                <p className="text-sm text-t-text/80 font-medium">{agent.configSnapshot.model.split('/').pop()}</p>
              </div>
              <div className="bg-t-overlay/[0.03] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Thermometer className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-t-text/40">{t('store.temperatureLabel')}</span>
                </div>
                <p className="text-sm text-t-text/80 font-medium">{agent.configSnapshot.temperature}</p>
              </div>
              <div className="bg-t-overlay/[0.03] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-t-text/40">{t('store.categoryLabel')}</span>
                </div>
                <p className="text-sm text-t-text/80 font-medium">{getCategoryLabel(agent.category)}</p>
              </div>
              <div className="bg-t-overlay/[0.03] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-t-text/40">{t('store.publishedLabel')}</span>
                </div>
                <p className="text-sm text-t-text/80 font-medium">{formatDate(agent.publishedAt)}</p>
              </div>
            </div>

            {/* Tools */}
            {agent.configSnapshot.tools.length > 0 && (
              <div className="mt-4">
                <span className="text-xs text-t-text/40">{t('store.connectedTools')}</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {agent.configSnapshot.tools.map((t, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-lg bg-t-overlay/[0.06] border border-t-overlay/10 text-t-text/60">
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
                  className="text-xs px-3 py-1 rounded-full bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/50"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Remix Success Toast */}
        {remixSuccess && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-green-500/90 text-white shadow-lg shadow-green-500/25 backdrop-blur-sm">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{t('store.remixSuccess')}</span>
            </div>
          </div>
        )}

        {/* Agent ID */}
        <div className="flex items-center gap-2 text-xs text-t-text/20 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          <span>ID: {agent.id}</span>
          <button onClick={handleCopyId} className="hover:text-t-text/50 transition-colors">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
          <span className="ml-2">v{agent.version}</span>
        </div>

        {/* Admin Delete Section */}
        {isAdmin && (
          <div className="mt-8 pt-6 border-t border-red-500/20 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-red-400" />
              <span className="text-sm text-red-400 font-medium">Zone Admin</span>
            </div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer du Store
              </button>
            ) : (
              <div className="mt-3 p-4 rounded-xl border border-red-500/30 bg-red-500/5">
                <p className="text-sm text-red-300 mb-3">
                  Confirmer la suppression de <strong>{agent.name}</strong> du store ? Cette action est irréversible.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleAdminDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Confirmer la suppression
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 rounded-lg border border-t-overlay/10 text-t-text/60 hover:text-t-text hover:bg-t-overlay/[0.08] transition-colors text-sm"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowShareModal(false)}>
          <div className="relative w-full max-w-md mx-4 glass-card rounded-2xl p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            {/* Close */}
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-t-text/40 hover:text-t-text hover:bg-t-overlay/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title */}
            <h3 className="text-lg font-semibold text-t-text/90 mb-5 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-400" />
              {t('store.shareAgent')}
            </h3>

            {/* Agent link */}
            <div className="mb-5">
              <label className="text-xs text-t-text/40 mb-1.5 block">{t('store.shareLink')}</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-t-overlay/[0.04] border border-t-overlay/10 rounded-xl px-3 py-2.5 text-sm text-t-text/70 truncate select-all">
                  {agentUrl}
                </div>
                <button
                  onClick={handleShareCopyLink}
                  className="px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1.5"
                >
                  {shareLinkCopied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
                  <span className="text-xs font-medium">{shareLinkCopied ? t('store.shareLinkCopied') : t('common.copy')}</span>
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="mb-5 flex flex-col items-center">
              <label className="text-xs text-t-text/40 mb-2 self-start">{t('store.shareQR')}</label>
              <div className="bg-white rounded-xl p-3 shadow-lg">
                <img
                  src={qrUrl}
                  alt="QR Code"
                  width={180}
                  height={180}
                  className="block"
                />
              </div>
              <button
                onClick={handleDownloadQR}
                className="mt-2 flex items-center gap-1.5 text-xs text-t-text/50 hover:text-t-text/80 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {t('store.downloadQR')}
              </button>
            </div>

            {/* Social share buttons */}
            <div>
              <label className="text-xs text-t-text/40 mb-2 block">{t('store.shareOn')}</label>
              <div className="flex gap-2">
                {/* Twitter/X */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${agent.name}" on GiLo AI!`)}&url=${encodeURIComponent(agentUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/60 hover:text-t-text hover:bg-t-overlay/[0.08] transition-colors text-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                  X
                </a>
                {/* LinkedIn */}
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(agentUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/60 hover:text-t-text hover:bg-t-overlay/[0.08] transition-colors text-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                  LinkedIn
                </a>
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${agent.name} - ${agentUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/60 hover:text-t-text hover:bg-t-overlay/[0.08] transition-colors text-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
