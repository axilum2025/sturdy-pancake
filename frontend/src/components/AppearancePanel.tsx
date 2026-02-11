import { useState, useRef } from 'react';
import { Sun, Moon, Monitor, Palette, Image, Upload, X, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AppearanceSettings {
  theme: 'dark' | 'light' | 'auto';
  accentColor: string;
  chatBackground: string;
}

interface AppearancePanelProps {
  value: AppearanceSettings;
  onChange: (v: AppearanceSettings) => void;
}

const ACCENT_PRESETS = [
  { color: '#3b82f6', label: 'Blue' },
  { color: '#6366f1', label: 'Indigo' },
  { color: '#8b5cf6', label: 'Violet' },
  { color: '#ec4899', label: 'Pink' },
  { color: '#ef4444', label: 'Red' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#10b981', label: 'Emerald' },
  { color: '#06b6d4', label: 'Cyan' },
];

const THEME_OPTIONS = [
  { id: 'dark' as const, icon: Moon, labelKey: 'appearance.dark' },
  { id: 'light' as const, icon: Sun, labelKey: 'appearance.light' },
  { id: 'auto' as const, icon: Monitor, labelKey: 'appearance.auto' },
];

export default function AppearancePanel({ value, onChange }: AppearancePanelProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const update = (partial: Partial<AppearanceSettings>) => {
    onChange({ ...value, ...partial });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate: max 2MB, image only
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t('appearance.imageTooLarge'));
      return;
    }

    setUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        update({ chatBackground: base64 });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeBackground = () => {
    update({ chatBackground: '' });
  };

  return (
    <div className="space-y-6">
      {/* Section: Theme */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-t-text/60 mb-3">
          <Palette className="w-4 h-4" />
          {t('appearance.theme')}
        </label>
        <p className="text-xs text-t-text/35 mb-3">
          {t('appearance.themeDesc')}
        </p>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => update({ theme: opt.id })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                value.theme === opt.id
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : 'bg-t-overlay/[0.04] border-t-overlay/10 text-t-text/50 hover:text-t-text/70'
              }`}
            >
              <opt.icon className="w-4 h-4" />
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Section: Accent Color */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-t-text/60 mb-3">
          <Palette className="w-4 h-4" />
          {t('appearance.accentColor')}
        </label>
        <p className="text-xs text-t-text/35 mb-3">
          {t('appearance.accentColorDesc')}
        </p>
        <div className="flex flex-wrap gap-3">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.color}
              onClick={() => update({ accentColor: preset.color })}
              className={`w-10 h-10 rounded-xl border-2 transition-all hover:scale-110 ${
                value.accentColor === preset.color
                  ? 'border-white shadow-lg scale-110'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: preset.color }}
              title={preset.label}
            />
          ))}
          {/* Custom color input */}
          <label
            className={`w-10 h-10 rounded-xl border-2 border-dashed border-t-overlay/20 flex items-center justify-center cursor-pointer hover:border-t-overlay/40 transition-colors overflow-hidden`}
            title={t('appearance.customColor')}
          >
            <input
              type="color"
              value={value.accentColor || '#3b82f6'}
              onChange={(e) => update({ accentColor: e.target.value })}
              className="opacity-0 absolute w-0 h-0"
            />
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: value.accentColor || '#3b82f6' }}
            >
              <span className="text-white text-xs font-bold">+</span>
            </div>
          </label>
        </div>
      </div>

      {/* Section: Background Image */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-t-text/60 mb-3">
          <Image className="w-4 h-4" />
          {t('appearance.backgroundImage')}
        </label>
        <p className="text-xs text-t-text/35 mb-3">
          {t('appearance.backgroundImageDesc')}
        </p>

        {value.chatBackground ? (
          <div className="relative rounded-xl overflow-hidden border border-t-overlay/10">
            <img
              src={value.chatBackground}
              alt="Chat background"
              className="w-full h-40 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 backdrop-blur text-white text-xs font-medium hover:bg-white/30 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {t('appearance.changeImage')}
              </button>
              <button
                onClick={removeBackground}
                className="px-3 py-2 rounded-lg bg-red-500/30 backdrop-blur text-white text-xs font-medium hover:bg-red-500/50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-t-overlay/10 text-t-text/30 hover:text-t-text/50 hover:border-t-overlay/20 transition-colors"
          >
            <Upload className="w-6 h-6" />
            <span className="text-sm">
              {uploading ? t('appearance.uploading') : t('appearance.uploadImage')}
            </span>
            <span className="text-xs text-t-text/20">PNG, JPG — max 2 MB</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Preview hint */}
      <div className="bg-t-overlay/[0.04] border border-t-overlay/10 rounded-xl px-4 py-3">
        <p className="text-xs text-t-text/40">
          <Eye className="w-3.5 h-3.5 inline mr-1" />
          {t('appearance.previewHint')}
        </p>
      </div>
    </div>
  );
}
