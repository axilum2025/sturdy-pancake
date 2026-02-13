import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';

/**
 * /auth/reset-password?token=xxx — lets the user set a new password.
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(t('auth.passwordMismatch', 'Passwords do not match'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordTooShort', 'Password must be at least 6 characters'));
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-t-bg">
        <div className="text-center max-w-md mx-4">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-400 font-medium mb-2">{t('auth.invalidResetLink', 'Invalid reset link')}</p>
          <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm">
            {t('auth.backToHome', 'Back to home')}
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-t-bg">
        <div className="text-center max-w-md mx-4">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
          <p className="text-green-400 font-medium mb-2">{t('auth.passwordResetSuccess', 'Password reset successfully!')}</p>
          <p className="text-t-text/40 text-sm">{t('auth.redirectingToLogin', 'Redirecting to sign in...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-t-bg">
      <div className="relative w-full max-w-md mx-4">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-60" />
        <div className="relative glass-strong rounded-2xl p-8 shadow-2xl border-gradient">
          <h2 className="text-2xl font-bold text-t-text mb-2 text-center">
            {t('auth.resetPasswordTitle', 'Reset your password')}
          </h2>
          <p className="text-sm text-t-text/40 text-center mb-6">
            {t('auth.resetPasswordSubtitle', 'Enter your new password below')}
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-t-text/50 mb-2">
                {t('auth.newPassword', 'New password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-t-text/25" />
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
            <div>
              <label className="block text-sm font-medium text-t-text/50 mb-2">
                {t('auth.confirmPassword', 'Confirm password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-t-text/25" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full input-futuristic text-t-text px-10 py-3 rounded-xl text-sm"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-gradient text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-t-overlay/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {t('auth.resetPasswordBtn', 'Reset Password')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
