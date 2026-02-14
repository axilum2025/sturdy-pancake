import { useState, useEffect, useCallback } from 'react';
import { Trash2, Eye, EyeOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listCredentials, saveCredential, deleteCredential, CredentialEntry } from '../services/api';

interface CredentialVaultProps {
  agentId: string;
}

const COMMON_SERVICES = [
  { id: 'openai', label: 'OpenAI', fields: ['API Key'] },
  { id: 'anthropic', label: 'Anthropic', fields: ['API Key'] },
  { id: 'stripe', label: 'Stripe', fields: ['Secret Key', 'Publishable Key'] },
  { id: 'google', label: 'Google', fields: ['API Key', 'Client ID', 'Client Secret'] },
  { id: 'slack', label: 'Slack', fields: ['Bot Token', 'Webhook URL'] },
  { id: 'notion', label: 'Notion', fields: ['Integration Token'] },
  { id: 'github', label: 'GitHub', fields: ['Personal Access Token'] },
  { id: 'custom', label: 'Custom', fields: [] },
];

export default function CredentialVault({ agentId }: CredentialVaultProps) {
  const { t } = useTranslation();
  const [credentials, setCredentials] = useState<CredentialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add form state
  const [selectedService, setSelectedService] = useState('custom');
  const [customServiceName, setCustomServiceName] = useState('');
  const [credKey, setCredKey] = useState('');
  const [credValue, setCredValue] = useState('');
  const [showValue, setShowValue] = useState(false);

  const loadCredentials = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listCredentials(agentId);
      setCredentials(data.credentials);
    } catch {
      // Silent error
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const handleSave = async () => {
    const service = selectedService === 'custom' ? customServiceName.trim() : selectedService;
    if (!service || !credKey.trim() || !credValue.trim()) {
      setError(t('credentials.fillAllFields', 'Please fill all fields'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await saveCredential(agentId, service, credKey.trim(), credValue.trim());
      setSuccess(t('credentials.saved', 'Credential saved securely'));
      setTimeout(() => setSuccess(null), 3000);
      setCredKey('');
      setCredValue('');
      setCustomServiceName('');
      setShowAdd(false);
      await loadCredentials();
    } catch (e: any) {
      setError(e.message || t('credentials.saveError', 'Failed to save credential'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (credentialId: string) => {
    try {
      await deleteCredential(agentId, credentialId);
      await loadCredentials();
    } catch {
      setError(t('credentials.deleteError', 'Failed to delete credential'));
    }
  };

  const selectedServiceInfo = COMMON_SERVICES.find(s => s.id === selectedService);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-t-text/80">
            {t('credentials.title', 'Credential Vault')}
          </h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="btn-outline-glow px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
        >
          {t('credentials.add', 'Add Credential')}
        </button>
      </div>

      {/* Security Info */}
      <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/10">
        <div>
          <div>
            <p className="text-xs text-green-300/80 font-medium">
              {t('credentials.securityTitle', 'End-to-End Encrypted Storage')}
            </p>
            <p className="text-[11px] text-t-text/40 mt-1">
              {t('credentials.securityDesc', 'All credentials are encrypted with AES-256-GCM before storage. Keys are never stored in plaintext and are only decrypted server-side when needed by your agent.')}
            </p>
          </div>
        </div>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300 flex items-center gap-2">
          <Check className="w-3 h-3 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 p-4 space-y-3 animate-fade-in-up">
          {/* Service Selector */}
          <div>
            <label className="block text-xs text-t-text/50 mb-2">
              {t('credentials.service', 'Service')}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {COMMON_SERVICES.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => {
                    setSelectedService(svc.id);
                    if (svc.fields.length > 0) setCredKey(svc.fields[0]);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-all border ${
                    selectedService === svc.id
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-t-overlay/[0.02] border-t-overlay/5 text-t-text/40 hover:text-t-text/60'
                  }`}
                >
                  <span className="text-[10px] font-medium">{svc.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom service name */}
          {selectedService === 'custom' && (
            <input
              value={customServiceName}
              onChange={(e) => setCustomServiceName(e.target.value)}
              className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
              placeholder={t('credentials.serviceName', 'Service name (e.g. my_api)')}
            />
          )}

          {/* Key field selector or input */}
          {selectedServiceInfo && selectedServiceInfo.fields.length > 1 ? (
            <div>
              <label className="block text-xs text-t-text/50 mb-1">
                {t('credentials.keyType', 'Credential Type')}
              </label>
              <select
                value={credKey}
                onChange={(e) => setCredKey(e.target.value)}
                className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
              >
                {selectedServiceInfo.fields.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          ) : (
            <input
              value={credKey}
              onChange={(e) => setCredKey(e.target.value)}
              className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
              placeholder={t('credentials.keyPlaceholder', 'Key name (e.g. api_key)')}
            />
          )}

          {/* Value input */}
          <div className="relative">
            <input
              type={showValue ? 'text' : 'password'}
              value={credValue}
              onChange={(e) => setCredValue(e.target.value)}
              className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 pr-10 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
              placeholder={t('credentials.valuePlaceholder', 'sk-... or secret value')}
            />
            <button
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-t-text/30 hover:text-t-text/60"
            >
              {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-t-overlay/10 text-t-text/50 hover:bg-t-overlay/5"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !credKey.trim() || !credValue.trim()}
              className="flex-1 btn-gradient px-3 py-2 text-sm rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
              {t('credentials.saveEncrypted', 'Save Encrypted')}
            </button>
          </div>
        </div>
      )}

      {/* Credentials List */}
      {loading ? (
        <div className="text-center py-6 text-xs text-t-text/30 animate-pulse">
          {t('common.loading', 'Loading...')}
        </div>
      ) : credentials.length === 0 ? (
        <div className="text-center py-8 bg-t-overlay/[0.02] rounded-xl border border-dashed border-t-overlay/10">
          <p className="text-sm text-t-text/30">
            {t('credentials.empty', 'No credentials stored yet')}
          </p>
          <p className="text-xs text-t-text/20 mt-1">
            {t('credentials.emptyDesc', 'Add API keys and secrets for your agent\'s tools')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.map((cred) => {
            const serviceInfo = COMMON_SERVICES.find(s => s.id === cred.service);
            return (
              <div
                key={cred.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-t-overlay/[0.04] border border-t-overlay/10"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-xs font-bold text-t-text/40 flex-shrink-0">
                  {(serviceInfo?.label || cred.service).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-t-text/80 capitalize">
                      {serviceInfo?.label || cred.service}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300/70">
                      {cred.key}
                    </span>

                  </div>
                  <p className="text-xs text-t-text/35 mt-0.5 font-mono">{cred.maskedValue}</p>
                </div>
                <button
                  onClick={() => handleDelete(cred.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-t-text/30 hover:text-red-400 transition-colors flex-shrink-0"
                  title={t('credentials.delete', 'Delete credential')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Credential Table Preview */}
      {credentials.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-t-overlay/[0.02] border border-t-overlay/5">
          <h4 className="text-xs font-medium text-t-text/50 mb-2">
            {t('credentials.summary', 'Credentials Summary')}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-t-text/40 border-b border-t-overlay/10">
                  <th className="text-left py-1.5 px-2">Service</th>
                  <th className="text-left py-1.5 px-2">Key</th>
                  <th className="text-left py-1.5 px-2">Value</th>
                  <th className="text-left py-1.5 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred) => (
                  <tr key={cred.id} className="border-b border-t-overlay/5">
                    <td className="py-1.5 px-2 text-t-text/70 capitalize">{cred.service}</td>
                    <td className="py-1.5 px-2 text-t-text/50">{cred.key}</td>
                    <td className="py-1.5 px-2 text-t-text/40 font-mono">{cred.maskedValue}</td>
                    <td className="py-1.5 px-2">
                      <span className="text-green-400">
                        Encrypted
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
