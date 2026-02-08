import { useState } from 'react';
import {
  Rocket, X, Globe, Lock, Tag, Sparkles, Plus, Trash2, Check, Loader2
} from 'lucide-react';

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
  const [step, setStep] = useState(1); // 1: Info, 2: Features, 3: Access
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(agentName);
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [iconColor, setIconColor] = useState(ICON_COLORS[0]);
  const [features, setFeatures] = useState<string[]>(['']);
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

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
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      const body = {
        agentId,
        name,
        description,
        shortDescription,
        iconColor,
        features: features.filter((f) => f.trim()),
        category,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        visibility,
      };

      const res = await fetch('/api/store/publish', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la publication');
      }

      const listing = await res.json();
      onPublished(listing.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPublishing(false);
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
      <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-xl sm:max-h-[90vh] z-50 glass-strong rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-400 glow-icon" />
            <span className="font-semibold gradient-text">Publier sur le Store</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-3 border-b border-white/5 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  step === s
                    ? 'bg-blue-500 text-white'
                    : step > s
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/10 text-white/30'
                }`}
              >
                {step > s ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-px ${step > s ? 'bg-green-500/30' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Nom de l'agent</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/[0.04] text-white/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10"
                  placeholder="Mon Agent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Description courte</label>
                <input
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full bg-white/[0.04] text-white/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10"
                  placeholder="Une phrase pour décrire l'agent"
                  maxLength={100}
                />
                <p className="text-xs text-white/25 mt-1">{shortDescription.length}/100</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Description complète</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/[0.04] text-white/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10 resize-none"
                  rows={4}
                  placeholder="Décrivez en détail ce que fait votre agent, pour qui il est utile..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Catégorie</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${
                        category === cat.id
                          ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                          : 'bg-white/[0.04] border border-white/10 text-white/50 hover:border-white/20'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Couleur de l'icône</label>
                <div className="flex gap-2 flex-wrap">
                  {ICON_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setIconColor(color)}
                      className={`w-9 h-9 rounded-xl transition-all ${
                        iconColor === color ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 2: Features & Tags */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  Fonctionnalités clés
                </label>
                <div className="space-y-2">
                  {features.map((f, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        value={f}
                        onChange={(e) => updateFeature(idx, e.target.value)}
                        className="flex-1 bg-white/[0.04] text-white/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10"
                        placeholder={`Feature ${idx + 1}`}
                      />
                      {features.length > 1 && (
                        <button
                          onClick={() => removeFeature(idx)}
                          className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
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
                    className="mt-2 flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Ajouter une fonctionnalité
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Tags (séparés par des virgules)
                </label>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full bg-white/[0.04] text-white/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10"
                  placeholder="support, ai, chatbot"
                />
              </div>
            </>
          )}

          {/* Step 3: Access */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-3">Visibilité</label>
                <div className="space-y-3">
                  <button
                    onClick={() => setVisibility('public')}
                    className={`w-full p-4 rounded-xl text-left transition-all flex items-start gap-3 ${
                      visibility === 'public'
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-white/[0.04] border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Globe className={`w-5 h-5 mt-0.5 ${visibility === 'public' ? 'text-green-400' : 'text-white/30'}`} />
                    <div>
                      <p className={`text-sm font-medium ${visibility === 'public' ? 'text-green-300' : 'text-white/70'}`}>
                        Public
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Visible par tous dans le Store. Les utilisateurs peuvent utiliser et remixer votre agent.
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setVisibility('private')}
                    className={`w-full p-4 rounded-xl text-left transition-all flex items-start gap-3 ${
                      visibility === 'private'
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : 'bg-white/[0.04] border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Lock className={`w-5 h-5 mt-0.5 ${visibility === 'private' ? 'text-amber-400' : 'text-white/30'}`} />
                    <div>
                      <p className={`text-sm font-medium ${visibility === 'private' ? 'text-amber-300' : 'text-white/70'}`}>
                        Privé
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Accessible uniquement via un token. Vous contrôlez qui peut utiliser votre agent.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-4">
                <p className="text-xs text-white/40 mb-3">Aperçu dans le Store :</p>
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-16 h-16 rounded-[22%] flex items-center justify-center"
                    style={{ backgroundColor: iconColor, boxShadow: `0 4px 20px ${iconColor}30` }}
                  >
                    <span className="text-2xl font-bold text-white/90">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-white/70 text-center">{name}</span>
                  <span className="text-xs text-white/30">{shortDescription}</span>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              Retour
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
              Suivant
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
                  Publication...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Publier
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
