import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Cpu, Wrench, Rocket, ArrowRight, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { quickCreateAgent } from '../services/api';

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { icon: Cpu, key: 'analyzing' },
  { icon: Sparkles, key: 'generating' },
  { icon: Wrench, key: 'tools' },
  { icon: Rocket, key: 'creating' },
] as const;

export default function QuickCreateModal({ isOpen, onClose }: QuickCreateModalProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState('');

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
      setDescription('');
      setError('');
      setIsGenerating(false);
      setCurrentStep(0);
    }
  }, [isOpen]);

  // Animate through steps while generating
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 10 || isGenerating) return;

    setError('');
    setIsGenerating(true);
    setCurrentStep(0);

    try {
      const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
      const agent = await quickCreateAgent(description.trim(), lang);
      // Success — navigate to studio
      onClose();
      navigate(`/studio/${agent.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || t('quickCreate.error'));
      setIsGenerating(false);
      setCurrentStep(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-blue-500/30 rounded-2xl blur-xl opacity-60 animate-pulse" />

        <div className="relative glass-strong rounded-2xl p-6 shadow-2xl border-gradient">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-t-text/30 hover:text-t-text/60 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/20">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-t-text">
              {t('quickCreate.title', 'Create with AI')}
            </h2>
            <p className="text-sm text-t-text/40 mt-1">
              {t('quickCreate.subtitle', 'Describe your agent and AI will configure everything')}
            </p>
          </div>

          {/* Generating state — animated steps */}
          {isGenerating ? (
            <div className="py-6 space-y-4">
              {STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
                      isActive
                        ? 'bg-blue-500/10 border border-blue-500/20'
                        : isDone
                          ? 'bg-green-500/5 border border-green-500/10'
                          : 'bg-t-overlay/[0.02] border border-t-overlay/5'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${
                      isActive
                        ? 'bg-blue-500/20 text-blue-400'
                        : isDone
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-t-overlay/10 text-t-text/20'
                    }`}>
                      {isDone ? (
                        <span className="text-sm">✓</span>
                      ) : isActive ? (
                        <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>
                    <span className={`text-sm font-medium transition-all duration-500 ${
                      isActive ? 'text-blue-300' : isDone ? 'text-green-400/70' : 'text-t-text/20'
                    }`}>
                      {t(`quickCreate.step.${step.key}`)}
                    </span>
                  </div>
                );
              })}
              <p className="text-center text-t-text/30 text-xs mt-4 animate-pulse">
                {t('quickCreate.patience', 'This usually takes 5-10 seconds...')}
              </p>
            </div>
          ) : (
            /* Input form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Example suggestions */}
              <div className="flex flex-wrap gap-2">
                {[
                  { emoji: '🎧', key: 'support' },
                  { emoji: '💻', key: 'code' },
                  { emoji: '📝', key: 'content' },
                  { emoji: '📊', key: 'data' },
                ].map((ex) => (
                  <button
                    key={ex.key}
                    type="button"
                    onClick={() => setDescription(t(`quickCreate.example.${ex.key}`))}
                    className="text-xs px-3 py-1.5 rounded-lg bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/40 hover:text-t-text/60 hover:border-t-overlay/20 transition-all"
                  >
                    {ex.emoji} {t(`quickCreate.exampleLabel.${ex.key}`)}
                  </button>
                ))}
              </div>

              {/* Text area */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('quickCreate.placeholder', 'A customer support agent that answers questions about our product, queries the knowledge base, and escalates complex issues to a human...')}
                  className="w-full h-32 input-futuristic text-t-text px-4 py-3 rounded-xl text-sm resize-none"
                  maxLength={1000}
                />
                <span className="absolute bottom-2 right-3 text-xs text-t-text/20">
                  {description.length}/1000
                </span>
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!description.trim() || description.trim().length < 10}
                className="w-full btn-gradient text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Bot className="w-4 h-4" />
                {t('quickCreate.generate', 'Generate my agent')}
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-t-text/20 text-xs">
                {t('quickCreate.editAfter', 'You can fine-tune everything in the Studio after creation')}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
