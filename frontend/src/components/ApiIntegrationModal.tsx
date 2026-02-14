import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Key, Trash2, Terminal, RefreshCw, AlertTriangle, Shield, Globe, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createApiKey, listApiKeys, revokeApiKey, ApiKeyResponse } from '../services/api';

interface ApiIntegrationModalProps {
  agentId: string;
  agentName: string;
  agentSlug?: string;
  onClose: () => void;
}

type CodeLang = 'curl' | 'python' | 'javascript' | 'nodejs';

export default function ApiIntegrationModal({ agentId, agentName, agentSlug, onClose }: ApiIntegrationModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<CodeLang>('curl');
  const [apiKeys, setApiKeys] = useState<ApiKeyResponse[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = window.location.origin;
  const endpoint = `${baseUrl}/api/v1/agents/${agentId}/chat`;
  const giloDomain = import.meta.env.VITE_GILO_DOMAIN || 'gilo.dev';
  const subdomainUrl = agentSlug && giloDomain ? `https://${agentSlug}.${giloDomain}` : null;

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listApiKeys(agentId);
      setApiKeys(result.apiKeys.filter(k => !k.revoked));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      setCreating(true);
      setError(null);
      const result = await createApiKey(agentId, newKeyName.trim());
      setCreatedKey(result.key);
      setNewKeyName('');
      await loadKeys();
    } catch {
      setError(t('apiIntegration.errorCreatingKey'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await revokeApiKey(agentId, keyId);
      await loadKeys();
    } catch {
      setError(t('apiIntegration.errorRevokingKey'));
    }
  };

  const copyToClipboard = async (text: string, type: 'snippet' | 'key') => {
    await navigator.clipboard.writeText(text);
    if (type === 'snippet') {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const getCodeSnippet = (lang: CodeLang): string => {
    const keyPlaceholder = createdKey || 'gilo_YOUR_API_KEY';

    switch (lang) {
      case 'curl':
        return `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${keyPlaceholder}" \\
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Hello!"
      }
    ],
    "stream": false
  }'`;

      case 'python':
        return `import requests

API_KEY = "${keyPlaceholder}"
ENDPOINT = "${endpoint}"

response = requests.post(
    ENDPOINT,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    },
    json={
        "messages": [
            {"role": "user", "content": "Hello!"}
        ],
        "stream": False
    }
)

data = response.json()
print(data["response"])`;

      case 'javascript':
        return `const API_KEY = "${keyPlaceholder}";
const ENDPOINT = "${endpoint}";

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${API_KEY}\`
  },
  body: JSON.stringify({
    messages: [
      { role: "user", content: "Hello!" }
    ],
    stream: false
  })
});

const data = await response.json();
console.log(data.response);`;

      case 'nodejs':
        return `const axios = require("axios");

const API_KEY = "${keyPlaceholder}";
const ENDPOINT = "${endpoint}";

async function chat(message) {
  const { data } = await axios.post(
    ENDPOINT,
    {
      messages: [
        { role: "user", content: message }
      ],
      stream: false
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${API_KEY}\`
      }
    }
  );
  return data.response;
}

chat("Hello!").then(console.log);`;
    }
  };

  const tabs: { id: CodeLang; label: string; icon: string }[] = [
    { id: 'curl', label: 'cURL', icon: '🔧' },
    { id: 'python', label: 'Python', icon: '🐍' },
    { id: 'javascript', label: 'JavaScript', icon: '🌐' },
    { id: 'nodejs', label: 'Node.js', icon: '💚' },
  ];

  const snippet = getCodeSnippet(activeTab);

  const widgetSnippet = `<script
  src="${baseUrl}/widget.js"
  data-agent-id="${agentId}"
  data-api-key="${createdKey || apiKeys[0]?.keyPrefix ? apiKeys[0]?.keyPrefix + '...' : 'YOUR_API_KEY'}"
  data-theme="dark"
  data-accent="#3b82f6"
  data-title="${agentName}"
  data-lang="fr">
</script>`;

  const [copiedWidget, setCopiedWidget] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 md:inset-8 lg:inset-y-12 lg:inset-x-[15%] z-50 flex items-center justify-center animate-fade-in-up">
        <div className="w-full h-full glass-strong md:rounded-2xl border border-t-overlay/10 shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-t-overlay/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-t-text">{t('apiIntegration.title')}</h2>
                <p className="text-xs text-t-text/50">{agentName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-t-overlay/10 text-t-text/60 hover:text-t-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 md:space-y-6">
            {/* Endpoint */}
            <div>
              <label className="text-sm font-medium text-t-text/70 mb-2 block">{t('apiIntegration.endpoint')}</label>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-t-overlay/5 border border-t-overlay/10">
                <Terminal className="w-4 h-4 text-green-400 flex-shrink-0" />
                <code className="text-sm text-green-400 font-mono flex-1 break-all">{endpoint}</code>
                <button
                  onClick={() => copyToClipboard(endpoint, 'snippet')}
                  className="p-1.5 rounded-lg hover:bg-t-overlay/10 text-t-text/50 hover:text-t-text transition-colors flex-shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              {/* Subdomain URL */}
              {subdomainUrl && (
                <div className="mt-2">
                  <label className="text-xs font-medium text-t-text/50 mb-1 block">{t('apiIntegration.subdomainUrl')}</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15">
                    <Globe className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <code className="text-sm text-indigo-400 font-mono flex-1 break-all">{subdomainUrl}</code>
                    <button
                      onClick={() => copyToClipboard(subdomainUrl, 'snippet')}
                      className="p-1.5 rounded-lg hover:bg-t-overlay/10 text-t-text/50 hover:text-t-text transition-colors flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-t-text/40 mt-1">{t('apiIntegration.subdomainHelp')}</p>
                </div>
              )}
            </div>

            {/* API Keys Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-amber-400" />
                <label className="text-sm font-medium text-t-text/70">{t('apiIntegration.apiKeys')}</label>
              </div>

              {/* Created key banner */}
              {createdKey && (
                <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-300">{t('apiIntegration.keyCopyWarning')}</p>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30">
                    <code className="text-xs text-amber-300 font-mono flex-1 break-all">{createdKey}</code>
                    <button
                      onClick={() => copyToClipboard(createdKey, 'key')}
                      className="p-1.5 rounded-lg hover:bg-t-overlay/10 text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0"
                    >
                      {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Create new key */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
                <input
                  type="text"
                  placeholder={t('apiIntegration.keyNamePlaceholder')}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                  className="flex-1 bg-t-overlay/5 border border-t-overlay/10 rounded-lg px-3 py-2 text-sm text-t-text placeholder-t-text/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                />
                <button
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || creating}
                  className="btn-gradient px-4 py-2 rounded-lg text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {t('apiIntegration.createKey')}
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-400 mb-2">{error}</p>
              )}

              {/* Existing keys */}
              {loading ? (
                <div className="text-sm text-t-text/40 animate-pulse">{t('common.loading')}</div>
              ) : apiKeys.length > 0 ? (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-t-overlay/5 border border-t-overlay/10"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Shield className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-t-text truncate">{key.name}</p>
                          <div className="flex items-center gap-3 text-xs text-t-text/40">
                            <span className="font-mono">{key.keyPrefix}...</span>
                            <span>{key.requestCount} {t('apiIntegration.requests')}</span>
                            {key.lastUsedAt && (
                              <span>{t('apiIntegration.lastUsed')} {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-t-text/40 hover:text-red-400 transition-colors flex-shrink-0"
                        title={t('apiIntegration.revokeKey')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-t-text/40">{t('apiIntegration.noKeys')}</p>
              )}
            </div>

            {/* Code Snippets */}
            <div>
              <div className="mb-3">
                <label className="text-sm font-medium text-t-text/70">{t('apiIntegration.codeExamples')}</label>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 mb-3 p-1 rounded-xl bg-t-overlay/5 border border-t-overlay/10 overflow-x-auto w-full md:w-fit">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 md:gap-2 whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                        : 'text-t-text/60 hover:text-t-text hover:bg-t-overlay/10'
                    }`}
                  >
                    <span className="hidden md:inline">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Code Block */}
              <div className="relative rounded-xl bg-[#0d1117] border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
                  <span className="text-xs text-gray-400 font-mono">{activeTab === 'nodejs' ? 'javascript' : activeTab}</span>
                  <button
                    onClick={() => copyToClipboard(snippet, 'snippet')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors text-xs"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400">{t('apiIntegration.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {t('common.copy')}
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 md:p-4 overflow-x-auto text-xs md:text-sm font-mono text-gray-200 leading-relaxed max-h-[40vh] md:max-h-[50vh] overflow-y-auto">
                  <code>{snippet}</code>
                </pre>
              </div>
            </div>

            {/* Widget Embed */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <label className="text-sm font-medium text-t-text/70">{t('apiIntegration.widgetEmbed', 'Widget Embed')}</label>
              </div>
              <p className="text-xs text-t-text/50 mb-3">
                {t('apiIntegration.widgetHelp', 'Add a chat bubble to any website by pasting this snippet before the closing </body> tag.')}
              </p>
              <div className="relative rounded-xl bg-[#0d1117] border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
                  <span className="text-xs text-gray-400 font-mono">html</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(widgetSnippet);
                      setCopiedWidget(true);
                      setTimeout(() => setCopiedWidget(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors text-xs"
                  >
                    {copiedWidget ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400">{t('apiIntegration.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {t('common.copy')}
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 md:p-4 overflow-x-auto text-xs md:text-sm font-mono text-gray-200 leading-relaxed">
                  <code>{widgetSnippet}</code>
                </pre>
              </div>
            </div>

            {/* Help Text */}
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <p className="text-xs text-t-text/50 leading-relaxed">
                {t('apiIntegration.helpText')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
