import React, { useState } from 'react';
import { X, Mail, Lock, Github, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, register } = useAuth();
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      onClose();
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 animate-fade-in-scale">
        {/* Glow effect behind modal */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-60" />
        
        <div className="relative glass-strong rounded-2xl p-8 shadow-2xl border-gradient overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-t-text/40 hover:text-t-text/80 transition-colors duration-200 p-1 rounded-lg hover:bg-t-overlay/5"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Logo / Branding */}
          <div className="relative text-center mb-8">
            <h2 className="text-2xl font-bold text-t-text mb-1">
              {mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
            </h2>
            <p className="text-sm text-t-text/40">
              {mode === 'login' 
                ? t('auth.signInSubtitle') 
                : t('auth.createSubtitle')}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="relative mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in-up">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Social login buttons */}
          <div className="relative space-y-3 mb-6">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl btn-outline-glow text-t-text/70 hover:text-t-text text-sm font-medium"
            >
              <Github className="w-4 h-4" />
              {t('auth.continueGithub')}
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl btn-outline-glow text-t-text/70 hover:text-t-text text-sm font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {t('auth.continueGoogle')}
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center gap-4 mb-6">
            <div className="flex-1 divider-glow" />
            <span className="text-xs text-t-text/30 uppercase tracking-wider font-medium">{t('auth.or')}</span>
            <div className="flex-1 divider-glow" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative space-y-4">
            <div>
              <label className="block text-sm font-medium text-t-text/50 mb-2">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-t-text/25" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full input-futuristic text-t-text px-10 py-3 rounded-xl text-sm"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-t-text/50 mb-2">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-t-text/25" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full input-futuristic text-t-text px-10 py-3 rounded-xl text-sm"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" className="text-xs text-t-text/30 hover:text-blue-400 transition-colors">
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-gradient text-white font-semibold py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-t-overlay/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? t('auth.signInBtn') : t('auth.createBtn')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="relative mt-6 text-center">
            <p className="text-sm text-t-text/30">
              {mode === 'login' ? t('auth.noAccount') + ' ' : t('auth.hasAccount') + ' '}
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                {mode === 'login' ? t('auth.signUpLink') : t('auth.signInLink')}
              </button>
            </p>
          </div>

          {/* Demo credentials */}
          <div className="relative mt-5 pt-5">
            <div className="divider-glow mb-5" />
            <div className="flex items-center justify-center gap-2 text-t-text/20 text-xs">
              <Zap className="w-3 h-3" />
              <span>{t('auth.demo')}</span>
            </div>
          </div>

          {/* Powered by */}
          <div className="relative mt-4 text-center">
            <p className="text-[10px] text-t-text/15 uppercase tracking-widest font-medium">
              {t('auth.poweredBy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
