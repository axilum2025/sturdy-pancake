import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, Lock, Github, ArrowRight, Zap, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { API_BASE, api } from '../services/api';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  
  const { login, register } = useAuth();
  const { t } = useTranslation();

  // Load Turnstile script once
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (document.getElementById('cf-turnstile-script')) return;
    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Render/reset the widget when modal opens
  const renderTurnstile = useCallback(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileRef.current) return;
    const win = window as any;
    if (!win.turnstile) return;

    // Remove previous widget if exists
    if (turnstileWidgetId.current) {
      try { win.turnstile.remove(turnstileWidgetId.current); } catch { /* ignore */ }
      turnstileWidgetId.current = null;
    }
    setTurnstileToken(null);

    turnstileWidgetId.current = win.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(null),
      'error-callback': () => setTurnstileToken(null),
      theme: 'dark',
      size: 'flexible',
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !TURNSTILE_SITE_KEY) return;
    // Wait for script to load then render
    const interval = setInterval(() => {
      if ((window as any).turnstile) {
        clearInterval(interval);
        renderTurnstile();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isOpen, renderTurnstile]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Forgot password mode
    if (mode === 'forgot') {
      setIsLoading(true);
      try {
        await api.post('/auth/forgot-password', { email, turnstileToken: turnstileToken || undefined });
        setForgotSent(true);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Require Turnstile token if configured
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError(t('auth.captchaRequired', 'Please complete the verification'));
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password, turnstileToken || undefined);
      } else {
        await register(email, password, turnstileToken || undefined);
      }
      onClose();
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      // Reset Turnstile on failure so user can retry
      renderTurnstile();
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
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-60" />
        
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
              {mode === 'forgot'
                ? t('auth.forgotPasswordTitle', 'Reset password')
                : mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
            </h2>
            <p className="text-sm text-t-text/40">
              {mode === 'forgot'
                ? t('auth.forgotPasswordSubtitle', 'Enter your email and we\'ll send a reset link')
                : mode === 'login' 
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

          {/* Social login buttons — hide in forgot mode */}
          {mode !== 'forgot' && (
          <div className="relative space-y-3 mb-6">
            <button
              type="button"
              onClick={() => { window.location.href = `${API_BASE}/api/auth/github`; }}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl btn-outline-glow text-t-text/70 hover:text-t-text text-sm font-medium"
            >
              <Github className="w-4 h-4" />
              {t('auth.continueGithub')}
            </button>
          </div>
          )}

          {/* Divider — hide in forgot mode */}
          {mode !== 'forgot' && (
          <div className="relative flex items-center gap-4 mb-6">
            <div className="flex-1 divider-glow" />
            <span className="text-xs text-t-text/30 uppercase tracking-wider font-medium">{t('auth.or')}</span>
            <div className="flex-1 divider-glow" />
          </div>
          )}

          {/* Forgot password sent confirmation */}
          {mode === 'forgot' && forgotSent && (
            <div className="relative text-center py-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-green-400 font-medium mb-2">{t('auth.resetEmailSent', 'Check your email')}</p>
              <p className="text-t-text/40 text-sm mb-4">{t('auth.resetEmailSentDesc', 'If an account exists, a reset link has been sent.')}</p>
              <button
                onClick={() => { setMode('login'); setForgotSent(false); setError(''); }}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3 h-3" />
                {t('auth.backToLogin', 'Back to sign in')}
              </button>
            </div>
          )}

          {/* Form — hide when forgotSent */}
          {!(mode === 'forgot' && forgotSent) && (
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

            {mode !== 'forgot' && (
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
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setForgotSent(false); renderTurnstile(); }}
                  className="text-xs text-t-text/30 hover:text-blue-400 transition-colors"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            {/* Cloudflare Turnstile (managed mode) */}
            {TURNSTILE_SITE_KEY && (
              <div ref={turnstileRef} className="flex justify-center my-2" />
            )}

            <button
              type="submit"
              disabled={isLoading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
              className="w-full btn-gradient text-white font-semibold py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-t-overlay/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'forgot'
                    ? t('auth.sendResetLink', 'Send reset link')
                    : mode === 'login' ? t('auth.signInBtn') : t('auth.createBtn')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          )}

          {/* Toggle mode */}
          {mode !== 'forgot' && !forgotSent && (
          <div className="relative mt-6 text-center">
            <p className="text-sm text-t-text/30">
              {mode === 'login' ? t('auth.noAccount') + ' ' : t('auth.hasAccount') + ' '}
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                  renderTurnstile();
                }}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                {mode === 'login' ? t('auth.signUpLink') : t('auth.signInLink')}
              </button>
            </p>
          </div>
          )}

          {/* Back to login from forgot mode */}
          {mode === 'forgot' && !forgotSent && (
            <div className="relative mt-6 text-center">
              <button
                onClick={() => { setMode('login'); setError(''); renderTurnstile(); }}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3 h-3" />
                {t('auth.backToLogin', 'Back to sign in')}
              </button>
            </div>
          )}

          {/* Demo credentials */}
          <div className="relative mt-5 pt-5">
            <div className="divider-glow mb-5" />
            <button
              type="button"
              onClick={() => {
                setEmail('demo@example.com');
                setPassword('demo123');
                setMode('login');
                setError('');
              }}
              className="flex items-center justify-center gap-2 text-t-text/30 hover:text-blue-400 text-xs transition-colors mx-auto cursor-pointer"
            >
              <Zap className="w-3 h-3" />
              <span>{t('auth.demo')}</span>
            </button>
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
