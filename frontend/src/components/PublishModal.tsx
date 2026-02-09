import { useState, useRef } from 'react';
import {
  Rocket, X, Globe, Lock, Tag, Sparkles, Plus, Trash2, Check, Loader2, Upload, Image,
  Copy, RefreshCw, Shield, Key
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';

interface PublishModalProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
  onPublished: (storeId: string) => void;
}

const CATEGORIES = [
  { id: 'productivity', label: 'Productivité', icon: '⚡' },
  { id: 'support', label: 'Support Client', icon: '🎧' },
  { id: 'education', label: 'Éducation', icon: '📚' },
  { id: 'creative', label: 'Créatif', icon: '🎨' },
  { id: 'dev-tools', label: 'Dev Tools', icon: '💻' },
  { id: 'marketing', label: 'Marketing', icon: '📈' },
  { id: 'data', label: 'Data & Analytics', icon: '📊' },
  { id: 'entertainment', label: 'Divertissement', icon: '🎮' },
  { id: 'other', label: 'Autre', icon: '📦' },
];

const ICON_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#6366f1', '#14b8a6', '#f97316',
];

export default function PublishModal({ agentId, agentName, onClose, onPublished }: PublishModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1); // 1: Info, 2: Features, 3: Access
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [storeListingId, setStoreListingId] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [name, setName] = useState(agentName);
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [iconColor, setIconColor] = useState(ICON_COLORS[0]);
  const [customIcon, setCustomIcon] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[]>(['']);
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 512 * 1024) return; // max 512KB
    const reader = new FileReader();
    reader.onload = () => {
      setCustomIcon(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeCustomIcon = () => {
    setCustomIcon(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFeature = () => setFeatures([...features, '']);
  const removeFeature = (idx: number) => setFeatures(features.filter((_, i) => i !== idx));
  const updateFeature = (idx: number, val: string) => {
    const updated = [...features];
    updated[idx] = val;
    setFeatures(updated);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);

    try {
      const body = {
        agentId,
        name,
        description,
        shortDescription,
        icon: customIcon || '',
        iconColor,
        features: features.filter((f) => f.trim()),
        category,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        visibility,
      };

      const response = await api.post('/store/publish', body);
      const listing = response.data;
      if (visibility === 'private' && listing.accessToken) {
        setAccessToken(listing.accessToken);
        setStoreListingId(listing.id);
        setStep(4);
      } else {
        onPublished(listing.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || t('publish.publishError'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyToken = () => {
    if (!accessToken) return;
    navigator.clipboard.writeText(accessToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleRegenerateToken = async () => {
    if (!storeListingId || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const res = await api.post(`/store/${storeListingId}/regenerate-token`);
      setAccessToken(res.data.accessToken);
      setTokenCopied(false);
    } catch (err: any) {
      console.error('Error regenerating token:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const canAdvance = () => {
    if (step === 1) return name.trim() && shortDescription.trim() && description.trim();
    if (step === 2) return features.some((f) => f.trim());
    return true;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-xl sm:max-h-[90vh] z-50 glass-strong rounded-2xl border border-t-overlay/10 shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-t-overlay/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-400 glow-icon" />
            <span className="font-semibold gradient-text">{t('publish.title')}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-t-text/50 hover:text-t-text hover:bg-t-overlay/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-3 border-b border-t-overlay/5 flex items-center gap-2">
          {(step <= 3 ? [1, 2, 3] : [1, 2, 3, 4]).map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  step === s
                    ? s === 4 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                    : step > s
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-t-overlay/10 text-t-text/30'
                }`}
              >
                {step > s ? <Check className="w-3.5 h-3.5" /> : s === 4 ? <Key className="w-3.5 h-3.5" /> : s}
              </div>
              {s < (step <= 3 ? 3 : 4) && <div className={`flex-1 h-px ${step > s ? 'bg-green-500/30' : 'bg-t-overlay/10'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-t-text/60 mb-2">{t('publish.agentName')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-t-overlay/[0.04] text-t-text/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                  placeholder="Mon Agent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-t-text/60 mb-2">{t('publish.shortDesc')}</label>
                <input
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full bg-t-overlay/[0.04] text-t-text/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                  placeholder={t('publish.shortDescPlaceholder')}
                  maxLength={100}
                />
                <p className="text-xs text-t-text/25 mt-1">{shortDescription.length}/100</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-t-text/60 mb-2">{t('publish.fullDesc')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-t-overlay/[0.04] text-t-text/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10 resize-none"
                  rows={4}
                  placeholder={t('publish.fullDescPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-t-text/60 mb-2">{t('publish.category')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${
                        category === cat.id
                          ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                          : 'bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/50 hover:border-t-overlay/20'
                      }`}
                    >
                      {cat.icon} {t(`categories.${cat.id}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-t-text/60 mb-2">{t('publish.iconColor')}</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {ICON_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => { setIconColor(color); removeCustomIcon(); }}
                      className={`w-9 h-9 rounded-xl transition-all ${
                        iconColor === color && !customIcon ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Custom icon upload */}
              <div>
                <label className="block text-sm font-medium text-t-text/60 mb-2">
                  <Image className="w-4 h-4 inline mr-1" />
                  {t('publish.customIcon')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleIconUpload}
                  className="hidden"
                />
                {customIcon ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={customIcon}
                      alt="Custom icon"
                      className="w-14 h-14 rounded-[22%] object-cover border border-t-overlay/10 shadow-lg"
                    />
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {t('publish.changeIcon')}
                      </button>
                      <button
                        onClick={removeCustomIcon}
                        className="text-xs text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-t-overlay/20 hover:border-blue-500/40 bg-t-overlay/[0.02] hover:bg-t-overlay/[0.04] transition-all text-sm text-t-text/40 hover:text-t-text/60 w-full"
                  >
                    <Upload className="w-4 h-4" />
                    {t('publish.uploadIcon')}
                    <span className="ml-auto text-xs text-t-text/25">PNG, JPG, SVG · max 512KB</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Step 2: Features & Tags */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-t-text/60 mb-2">
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  {t('publish.keyFeatures')}
                </label>
                <div className="space-y-2">
                  {features.map((f, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        value={f}
                        onChange={(e) => updateFeature(idx, e.target.value)}
                        className="flex-1 bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                        placeholder={t('publish.featurePlaceholder', { num: idx + 1 })}
                      />
                      {features.length > 1 && (
                        <button
                          onClick={() => removeFeature(idx)}
                          className="p-2 rounded-lg text-t-text/30 hover:text-red-400 hover:bg-t-overlay/5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {features.length < 8 && (
                  <button
                    onClick={addFeature}
                    className="mt-2 flex items-center gap-1 text-xs text-t-text/40 hover:text-t-text/60 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {t('publish.addFeature')}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-t-text/60 mb-2">
                  <Tag className="w-4 h-4 inline mr-1" />
                  {t('publish.tags')}
                </label>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full bg-t-overlay/[0.04] text-t-text/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                  placeholder={t('publish.tagsPlaceholder')}
                />
              </div>
            </>
          )}

          {/* Step 3: Access */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-t-text/60 mb-3">{t('publish.visibility')}</label>
                <div className="space-y-3">
                  <button
                    onClick={() => setVisibility('public')}
                    className={`w-full p-4 rounded-xl text-left transition-all flex items-start gap-3 ${
                      visibility === 'public'
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-t-overlay/[0.04] border border-t-overlay/10 hover:border-t-overlay/20'
                    }`}
                  >
                    <Globe className={`w-5 h-5 mt-0.5 ${visibility === 'public' ? 'text-green-400' : 'text-t-text/30'}`} />
                    <div>
                      <p className={`text-sm font-medium ${visibility === 'public' ? 'text-green-300' : 'text-t-text/70'}`}>
                        Public
                      </p>
                      <p className="text-xs text-t-text/40 mt-0.5">
                        {t('publish.publicDesc')}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setVisibility('private')}
                    className={`w-full p-4 rounded-xl text-left transition-all flex items-start gap-3 ${
                      visibility === 'private'
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : 'bg-t-overlay/[0.04] border border-t-overlay/10 hover:border-t-overlay/20'
                    }`}
                  >
                    <Lock className={`w-5 h-5 mt-0.5 ${visibility === 'private' ? 'text-amber-400' : 'text-t-text/30'}`} />
                    <div>
                      <p className={`text-sm font-medium ${visibility === 'private' ? 'text-amber-300' : 'text-t-text/70'}`}>
                        {t('common.private')}
                      </p>
                      <p className="text-xs text-t-text/40 mt-0.5">
                        {t('publish.privateDesc')}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-t-overlay/[0.02] rounded-2xl border border-t-overlay/5 p-4">
                <p className="text-xs text-t-text/40 mb-3">{t('publish.preview')}</p>
                <div className="flex flex-col items-center gap-2">
                  {customIcon ? (
                    <img
                      src={customIcon}
                      alt={name}
                      className="w-16 h-16 rounded-[22%] object-cover shadow-lg"
                      style={{ boxShadow: `0 4px 20px ${iconColor}30` }}
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-[22%] flex items-center justify-center"
                      style={{ backgroundColor: iconColor, boxShadow: `0 4px 20px ${iconColor}30` }}
                    >
                      <span className="text-2xl font-bold text-t-text/90">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-sm text-t-text/70 text-center">{name}</span>
                  <span className="text-xs text-t-text/30">{shortDescription}</span>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </>
          )}

          {/* Step 4: Token Display (Telegram style) */}
          {step === 4 && accessToken && (
            <>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-t-text mb-1">{t('publish.tokenTitle')}</h3>
                <p className="text-sm text-t-text/50">{t('publish.tokenSubtitle')}</p>
              </div>

              {/* Token box — Telegram style */}
              <div className="bg-t-overlay/[0.06] border border-amber-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">{t('publish.accessToken')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black/30 rounded-xl px-4 py-3 text-sm font-mono text-green-300 break-all select-all border border-t-overlay/10">
                    {accessToken}
                  </code>
                  <button
                    onClick={handleCopyToken}
                    className={`p-3 rounded-xl transition-all flex-shrink-0 ${
                      tokenCopied
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-t-overlay/10 text-t-text/50 hover:text-t-text hover:bg-t-overlay/20'
                    }`}
                    title={t('common.copy')}
                  >
                    {tokenCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                <p className="text-xs text-red-300/80 leading-relaxed">
                  {t('publish.tokenWarning')}
                </p>
              </div>

              {/* Regenerate */}
              <button
                onClick={handleRegenerateToken}
                disabled={isRegenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border border-t-overlay/10 bg-t-overlay/[0.04] text-t-text/60 hover:text-t-text hover:bg-t-overlay/[0.08] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                {t('publish.regenerateToken')}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-t-overlay/10 flex items-center justify-between flex-shrink-0">
          {step === 4 ? (
            <>
              <div />
              <button
                onClick={() => onPublished(storeListingId!)}
                className="btn-gradient px-6 py-2 rounded-xl text-sm font-medium flex items-center gap-2 glow-blue"
              >
                <Check className="w-4 h-4" />
                {t('publish.done')}
              </button>
            </>
          ) : (
            <>
              {step > 1 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 rounded-xl text-sm text-t-text/50 hover:text-t-text/70 hover:bg-t-overlay/5 transition-colors"
                >
                  {t('common.back')}
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canAdvance()}
                  className="btn-gradient px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-30"
                >
                  {t('common.next')}
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="btn-gradient px-6 py-2 rounded-xl text-sm font-medium flex items-center gap-2 glow-blue disabled:opacity-50"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('publish.publishing')}
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      {t('publish.publishBtn')}
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
