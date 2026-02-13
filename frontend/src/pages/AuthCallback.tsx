import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

/**
 * /auth/callback — handles the redirect from GitHub OAuth.
 * Reads `token` or `error` from the query string.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const err = searchParams.get('error');

    if (err) {
      setError(err);
      setTimeout(() => navigate('/'), 3000);
      return;
    }

    if (token) {
      localStorage.setItem('authToken', token);
      refreshUser().then(() => navigate('/dashboard'));
    } else {
      navigate('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-t-bg">
        <div className="text-center max-w-md mx-4">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-400 mb-2 font-medium">{t('auth.oauthError', 'Authentication failed')}</p>
          <p className="text-t-text/40 text-sm mb-4">{error}</p>
          <p className="text-t-text/25 text-xs">{t('auth.redirecting', 'Redirecting...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-t-bg">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto border-2 border-t-overlay/30 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-t-text/40 text-sm">{t('auth.signingIn', 'Signing in...')}</p>
      </div>
    </div>
  );
}
