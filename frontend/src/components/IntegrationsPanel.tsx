// ============================================================
// GiLo AI – IntegrationsPanel
// OAuth + API key integrations management for an agent
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link2, Unlink, Plus, Key, RefreshCw, CheckCircle2,
  AlertCircle, Clock, ExternalLink, Mail, Calendar,
  FileText, Table2, MessageSquare, Shield
} from 'lucide-react';
import { API_BASE } from '../services/api';

interface IntegrationsPanelProps {
  agentId: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  configured: boolean;
  availableScopes: { id: string; label: string; description: string }[];
  defaultScopes: string[];
}

interface IntegrationData {
  id: string;
  agentId: string;
  provider: string;
  label: string | null;
  scopes: string[];
  expiresAt: string | null;
  status: string;
  metadata: {
    email?: string;
    accountName?: string;
    avatarUrl?: string;
  } | null;
  lastUsedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// Provider visual config (maps provider ID → icon + label)
const PROVIDER_VISUALS: Record<string, { icon: React.ReactNode; label: string; desc_fr: string; desc_en: string }> = {
  google: {
    icon: <svg viewBox="0 0 24 24" className="w-6 h-6"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
    label: 'Google',
    desc_fr: 'Gmail, Calendar, Drive, Sheets',
    desc_en: 'Gmail, Calendar, Drive, Sheets',
  },
  slack: {
    icon: <MessageSquare className="w-6 h-6 text-[#4A154B]" />,
    label: 'Slack',
    desc_fr: 'Messages et canaux',
    desc_en: 'Messages and channels',
  },
  notion: {
    icon: <FileText className="w-6 h-6 text-gray-800 dark:text-gray-200" />,
    label: 'Notion',
    desc_fr: 'Pages et bases de données',
    desc_en: 'Pages and databases',
  },
  stripe: {
    icon: <Shield className="w-6 h-6 text-[#635BFF]" />,
    label: 'Stripe',
    desc_fr: 'Paiements et factures',
    desc_en: 'Payments and invoices',
  },
};

// Scope → icon map for Google scopes
function getScopeIcon(scope: string) {
  if (scope.includes('gmail')) return <Mail className="w-3.5 h-3.5" />;
  if (scope.includes('calendar')) return <Calendar className="w-3.5 h-3.5" />;
  if (scope.includes('drive')) return <FileText className="w-3.5 h-3.5" />;
  if (scope.includes('spreadsheets')) return <Table2 className="w-3.5 h-3.5" />;
  return <Key className="w-3.5 h-3.5" />;
}

export default function IntegrationsPanel({ agentId }: IntegrationsPanelProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [scopeSelection, setScopeSelection] = useState<Record<string, string[]>>({});
  const [showScopes, setShowScopes] = useState<string | null>(null);

  // API key form
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [apiKeyProvider, setApiKeyProvider] = useState('');
  const [apiKeyLabel, setApiKeyLabel] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');

  const headers = useCallback(() => {
    const token = localStorage.getItem('authToken');
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [provRes, intRes] = await Promise.all([
        fetch(`${API_BASE}/api/integrations/providers`, { headers: headers() }),
        fetch(`${API_BASE}/api/integrations/${agentId}`, { headers: headers() }),
      ]);
      if (provRes.ok) {
        const data = await provRes.json();
        setProviders(data.providers || []);
      }
      if (intRes.ok) {
        const data = await intRes.json();
        setIntegrations(data.integrations || []);
      }
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId, headers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check URL for integration callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('integrationSuccess')) {
      loadData();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('integrationError')) {
      console.error('Integration error:', params.get('integrationError'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadData]);

  const connectOAuth = async (providerId: string) => {
    setConnecting(providerId);
    try {
      const scopes = scopeSelection[providerId] || [];
      const res = await fetch(`${API_BASE}/api/integrations/${agentId}/${providerId}/auth`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ scopes }),
      });
      if (res.ok) {
        const data = await res.json();
        // Redirect to provider's auth page
        window.location.href = data.authUrl;
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to start OAuth');
      }
    } catch (err) {
      console.error('Connect error:', err);
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async (integrationId: string) => {
    setDisconnecting(integrationId);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${agentId}/${integrationId}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (res.ok) {
        setIntegrations(prev => prev.filter(i => i.id !== integrationId));
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setDisconnecting(null);
    }
  };

  const addApiKey = async () => {
    if (!apiKeyProvider || !apiKeyValue) return;
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${agentId}/apikey`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ provider: apiKeyProvider, label: apiKeyLabel || apiKeyProvider, apiKey: apiKeyValue }),
      });
      if (res.ok) {
        setShowApiKeyForm(false);
        setApiKeyProvider('');
        setApiKeyLabel('');
        setApiKeyValue('');
        loadData();
      }
    } catch (err) {
      console.error('Add API key error:', err);
    }
  };

  const toggleScope = (providerId: string, scope: string) => {
    setScopeSelection(prev => {
      const current = prev[providerId] || [];
      const next = current.includes(scope)
        ? current.filter(s => s !== scope)
        : [...current, scope];
      return { ...prev, [providerId]: next };
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 className="w-3 h-3" />
            {lang === 'fr' ? 'Actif' : 'Active'}
          </span>
        );
      case 'expired':
        return (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <Clock className="w-3 h-3" />
            {lang === 'fr' ? 'Expiré' : 'Expired'}
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" />
            {lang === 'fr' ? 'Erreur' : 'Error'}
          </span>
        );
      default:
        return <span className="text-xs text-t-text/40">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-t-text/40" />
      </div>
    );
  }

  const connectedProviderIds = new Set(integrations.map(i => i.provider));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-t-text/80 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-400" />
          {t('integrations.title')}
        </h3>
        <p className="text-xs text-t-text/40 mt-1">
          {t('integrations.subtitle')}
        </p>
      </div>

      {/* Connected Integrations */}
      {integrations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-t-text/50 uppercase tracking-wider">
            {t('integrations.connected')}
          </h4>
          {integrations.map(integration => {
            const visual = PROVIDER_VISUALS[integration.provider];
            return (
              <div
                key={integration.id}
                className="flex items-center justify-between p-3 rounded-lg bg-t-overlay/5 border border-t-overlay/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-t-overlay/10 flex items-center justify-center">
                    {visual?.icon || <Link2 className="w-5 h-5 text-t-text/40" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-t-text/80">
                        {visual?.label || integration.provider}
                      </span>
                      {getStatusBadge(integration.status)}
                    </div>
                    <div className="text-xs text-t-text/40">
                      {integration.metadata?.email || integration.label || ''}
                    </div>
                    {integration.scopes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {integration.scopes
                          .filter(s => !s.includes('openid') && !s.includes('userinfo'))
                          .slice(0, 4)
                          .map(scope => (
                            <span key={scope} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300">
                              {getScopeIcon(scope)}
                              {scope.split('/').pop()?.replace('.readonly', ' ✓') || scope}
                            </span>
                          ))}
                      </div>
                    )}
                    {integration.errorMessage && (
                      <p className="text-xs text-red-400 mt-1">{integration.errorMessage}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => disconnect(integration.id)}
                  disabled={disconnecting === integration.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {disconnecting === integration.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Unlink className="w-3 h-3" />
                  )}
                  {t('integrations.disconnect')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Available Providers */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-t-text/50 uppercase tracking-wider">
          {t('integrations.available')}
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {providers.map(provider => {
            const visual = PROVIDER_VISUALS[provider.id];
            const isConnected = connectedProviderIds.has(provider.id);
            const isScopesOpen = showScopes === provider.id;

            return (
              <div
                key={provider.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isConnected
                    ? 'border-green-500/20 bg-green-500/5'
                    : 'border-t-overlay/10 bg-t-overlay/5 hover:border-t-overlay/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-t-overlay/10 flex items-center justify-center">
                      {visual?.icon || <Link2 className="w-5 h-5 text-t-text/40" />}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-t-text/80">
                        {visual?.label || provider.name}
                      </span>
                      <p className="text-xs text-t-text/40">
                        {lang === 'fr' ? (visual?.desc_fr || '') : (visual?.desc_en || '')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isConnected && provider.configured && (
                      <>
                        {provider.availableScopes.length > 0 && (
                          <button
                            onClick={() => setShowScopes(isScopesOpen ? null : provider.id)}
                            className="text-xs text-t-text/40 hover:text-t-text/60 transition-colors"
                          >
                            {lang === 'fr' ? 'Permissions' : 'Permissions'}
                          </button>
                        )}
                        <button
                          onClick={() => connectOAuth(provider.id)}
                          disabled={connecting === provider.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                          {connecting === provider.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3 h-3" />
                          )}
                          {t('integrations.connect')}
                        </button>
                      </>
                    )}
                    {!provider.configured && (
                      <span className="text-xs text-t-text/30 italic">
                        {t('integrations.notConfigured')}
                      </span>
                    )}
                    {isConnected && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('integrations.alreadyConnected')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Scope selector */}
                {isScopesOpen && !isConnected && (
                  <div className="mt-3 pt-3 border-t border-t-overlay/10">
                    <p className="text-xs text-t-text/50 mb-2">
                      {lang === 'fr' ? 'Sélectionnez les permissions :' : 'Select permissions:'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {provider.availableScopes.map(scope => {
                        const selected = (scopeSelection[provider.id] || []).includes(scope.id);
                        return (
                          <button
                            key={scope.id}
                            onClick={() => toggleScope(provider.id, scope.id)}
                            className={`flex items-center gap-2 p-2 rounded text-left text-xs transition-colors ${
                              selected
                                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                : 'bg-t-overlay/5 text-t-text/50 border border-transparent hover:border-t-overlay/20'
                            }`}
                          >
                            {getScopeIcon(scope.id)}
                            <div>
                              <div className="font-medium">{scope.label}</div>
                              <div className="text-[10px] opacity-60">{scope.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* API Key Section */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-t-text/50 uppercase tracking-wider">
          {t('integrations.apiKeyTitle')}
        </h4>
        {!showApiKeyForm ? (
          <button
            onClick={() => setShowApiKeyForm(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-dashed border-t-overlay/20 text-t-text/40 hover:text-t-text/60 hover:border-t-overlay/30 transition-colors w-full justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('integrations.addApiKey')}
          </button>
        ) : (
          <div className="p-3 rounded-lg bg-t-overlay/5 border border-t-overlay/10 space-y-3">
            <div>
              <label className="block text-xs text-t-text/50 mb-1">
                {lang === 'fr' ? 'Service' : 'Service'}
              </label>
              <input
                type="text"
                value={apiKeyProvider}
                onChange={e => setApiKeyProvider(e.target.value)}
                placeholder={lang === 'fr' ? 'ex: stripe, airtable, sendgrid...' : 'e.g. stripe, airtable, sendgrid...'}
                className="w-full px-3 py-1.5 text-xs rounded bg-t-overlay/10 border border-t-overlay/10 text-t-text focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-t-text/50 mb-1">
                {lang === 'fr' ? 'Nom (optionnel)' : 'Label (optional)'}
              </label>
              <input
                type="text"
                value={apiKeyLabel}
                onChange={e => setApiKeyLabel(e.target.value)}
                placeholder={lang === 'fr' ? 'Mon compte Stripe' : 'My Stripe account'}
                className="w-full px-3 py-1.5 text-xs rounded bg-t-overlay/10 border border-t-overlay/10 text-t-text focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-t-text/50 mb-1">
                {lang === 'fr' ? 'Clé API' : 'API Key'}
              </label>
              <input
                type="password"
                value={apiKeyValue}
                onChange={e => setApiKeyValue(e.target.value)}
                placeholder="sk_live_..."
                className="w-full px-3 py-1.5 text-xs rounded bg-t-overlay/10 border border-t-overlay/10 text-t-text focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowApiKeyForm(false)}
                className="px-3 py-1.5 text-xs rounded text-t-text/50 hover:text-t-text/70 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={addApiKey}
                disabled={!apiKeyProvider || !apiKeyValue}
                className="px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {t('common.add')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
