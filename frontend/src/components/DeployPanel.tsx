import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Key, Plus, Trash2, Copy, Check, Globe, Code2, Webhook,
  Terminal, Shield, Activity, Eye, EyeOff,
} from 'lucide-react';
import {
  Agent, ApiKeyInfo, WebhookInfo,
  getAgent, deployAgent,
  createApiKey, listApiKeys, revokeApiKey,
  createWebhook, listWebhooks, updateWebhook, deleteWebhook,
  API_BASE,
} from '../services/api';

interface DeployPanelProps {
  agentId: string;
  onClose: () => void;
}

export default function DeployPanel({ agentId, onClose }: DeployPanelProps) {
  useTranslation();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tab, setTab] = useState<'overview' | 'keys' | 'integration' | 'webhooks'>('overview');
  const [loading, setLoading] = useState(true);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);

  // Code snippets state
  const [codeTab, setCodeTab] = useState<'curl' | 'python' | 'node' | 'widget'>('curl');
  const [copied, setCopied] = useState<string | null>(null);

  const backendUrl = API_BASE || window.location.origin;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [agentData, keysData, webhooksData] = await Promise.all([
        getAgent(agentId),
        listApiKeys(agentId).catch(() => ({ apiKeys: [], total: 0 })),
        listWebhooks(agentId).catch(() => ({ webhooks: [], total: 0, availableEvents: [] })),
      ]);
      setAgent(agentData);
      setApiKeys(keysData.apiKeys);
      setWebhooks(webhooksData.webhooks);
      setAvailableEvents(webhooksData.availableEvents || [
        'on_conversation_start', 'on_message', 'on_escalation', 'on_error',
      ]);
    } catch (err) {
      console.error('Failed to load deploy data:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeploy = async () => {
    try {
      const result = await deployAgent(agentId);
      setAgent(result.agent);
    } catch (err: any) {
      console.error('Deploy failed:', err);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const result = await createApiKey(agentId, newKeyName.trim());
      setApiKeys(prev => [...prev, result.apiKey]);
      setCreatedKey(result.key);
      setShowCreatedKey(true);
      setNewKeyName('');
    } catch (err: any) {
      console.error('Create API key failed:', err);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await revokeApiKey(agentId, keyId);
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
    } catch (err: any) {
      console.error('Revoke key failed:', err);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim() || newWebhookEvents.length === 0) return;
    try {
      const result = await createWebhook(agentId, newWebhookUrl.trim(), newWebhookEvents);
      setWebhooks(prev => [...prev, result.webhook]);
      setWebhookSecret(result.secret);
      setNewWebhookUrl('');
      setNewWebhookEvents([]);
    } catch (err: any) {
      console.error('Create webhook failed:', err);
    }
  };

  const handleToggleWebhook = async (webhookId: string, active: boolean) => {
    try {
      await updateWebhook(agentId, webhookId, { active });
      setWebhooks(prev => prev.map(w => w.id === webhookId ? { ...w, active } : w));
    } catch (err: any) {
      console.error('Toggle webhook failed:', err);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      await deleteWebhook(agentId, webhookId);
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
    } catch (err: any) {
      console.error('Delete webhook failed:', err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // ---- Code snippets ----
  const endpoint = `${backendUrl}/api/v1/agents/${agentId}/chat`;

  const codeSnippets: Record<string, string> = {
    curl: `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'`,
    python: `import requests

API_KEY = "YOUR_API_KEY"
ENDPOINT = "${endpoint}"

response = requests.post(
    ENDPOINT,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    },
    json={
        "messages": [{"role": "user", "content": "Hello!"}],
        "stream": False,
    },
)

data = response.json()
print(data["message"]["content"])`,
    node: `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY",
  },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hello!" }],
    stream: false,
  }),
});

const data = await response.json();
console.log(data.message.content);`,
    widget: `<!-- Add this to your HTML -->
<script
  src="${backendUrl}/widget.js"
  data-agent-id="${agentId}"
  data-api-key="YOUR_API_KEY"
  data-color="#3b82f6"
  data-position="right"
  data-title="${agent?.name || 'Chat'}"
  data-welcome="${agent?.config?.welcomeMessage || 'Hello! How can I help?'}"
></script>`,
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-t-text/60 animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-t-overlay/10">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-t-text">Déploiement</h2>
          {agent && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              agent.status === 'deployed'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {agent.status}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-t-overlay/10 text-t-text/60 hover:text-t-text">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-t-overlay/10 px-4">
        {[
          { id: 'overview' as const, icon: Activity, label: 'Aperçu' },
          { id: 'keys' as const, icon: Key, label: 'API Keys' },
          { id: 'integration' as const, icon: Code2, label: 'Intégration' },
          { id: 'webhooks' as const, icon: Webhook, label: 'Webhooks' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-t-text/60 hover:text-t-text hover:border-t-overlay/20'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ---- OVERVIEW TAB ---- */}
        {tab === 'overview' && agent && (
          <>
            {/* Deploy button */}
            {agent.status !== 'deployed' && (
              <div className="glass-card p-6 text-center space-y-4">
                <p className="text-t-text/70">
                  Déployez votre agent pour obtenir un endpoint API public.
                </p>
                <button onClick={handleDeploy} className="btn-gradient px-6 py-2.5 rounded-xl text-white font-medium">
                  Déployer l'agent
                </button>
              </div>
            )}

            {/* Status */}
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-t-text/80 uppercase tracking-wide">Statut</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-t-text/50">État</div>
                  <div className={`text-sm font-semibold ${
                    agent.status === 'deployed' ? 'text-green-400' : 'text-yellow-400'
                  }`}>{agent.status === 'deployed' ? '● En ligne' : '○ Hors ligne'}</div>
                </div>
                <div>
                  <div className="text-xs text-t-text/50">Modèle</div>
                  <div className="text-sm text-t-text">{agent.config.model}</div>
                </div>
                <div>
                  <div className="text-xs text-t-text/50">Conversations</div>
                  <div className="text-sm text-t-text font-semibold">{agent.totalConversations}</div>
                </div>
                <div>
                  <div className="text-xs text-t-text/50">Messages</div>
                  <div className="text-sm text-t-text font-semibold">{agent.totalMessages}</div>
                </div>
              </div>
            </div>

            {/* Endpoint */}
            {agent.status === 'deployed' && (
              <div className="glass-card p-4 space-y-2">
                <h3 className="text-sm font-semibold text-t-text/80 uppercase tracking-wide">Endpoint API</h3>
                <div className="flex items-center gap-2 bg-t-overlay/5 rounded-lg px-3 py-2">
                  <code className="text-xs text-blue-400 flex-1 break-all">{endpoint}</code>
                  <button
                    onClick={() => copyToClipboard(endpoint, 'endpoint')}
                    className="p-1.5 rounded hover:bg-t-overlay/10"
                  >
                    {copied === 'endpoint' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-t-text/50" />}
                  </button>
                </div>
                <p className="text-xs text-t-text/40">
                  Authentification : <code className="text-blue-300">Authorization: Bearer YOUR_API_KEY</code>
                </p>
              </div>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{apiKeys.length}</div>
                <div className="text-xs text-t-text/50 mt-1">API Keys actives</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{webhooks.length}</div>
                <div className="text-xs text-t-text/50 mt-1">Webhooks configurés</div>
              </div>
            </div>
          </>
        )}

        {/* ---- API KEYS TAB ---- */}
        {tab === 'keys' && (
          <>
            {/* Create new key */}
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-t-text/80 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nouvelle clé API
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Nom de la clé (ex: Production, Test...)"
                  className="flex-1 bg-t-overlay/5 border border-t-overlay/10 rounded-lg px-3 py-2 text-sm text-t-text placeholder:text-t-text/30 focus:outline-none focus:border-blue-500/50"
                  onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
                />
                <button
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim()}
                  className="btn-gradient px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                >
                  Créer
                </button>
              </div>
            </div>

            {/* Show newly created key */}
            {createdKey && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">Clé créée ! Copiez-la maintenant.</span>
                </div>
                <div className="flex items-center gap-2 bg-t-overlay/10 rounded-lg px-3 py-2">
                  <code className="text-xs text-green-300 flex-1 break-all">
                    {showCreatedKey ? createdKey : '•'.repeat(40)}
                  </code>
                  <button
                    onClick={() => setShowCreatedKey(!showCreatedKey)}
                    className="p-1 rounded hover:bg-t-overlay/10"
                  >
                    {showCreatedKey ? <EyeOff className="w-4 h-4 text-t-text/50" /> : <Eye className="w-4 h-4 text-t-text/50" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(createdKey, 'newkey')}
                    className="p-1 rounded hover:bg-t-overlay/10"
                  >
                    {copied === 'newkey' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-t-text/50" />}
                  </button>
                </div>
                <p className="text-xs text-t-text/40">
                  ⚠️ Cette clé ne sera plus affichée. Stockez-la en lieu sûr.
                </p>
              </div>
            )}

            {/* Key list */}
            <div className="space-y-2">
              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-t-text/40 text-sm">
                  Aucune clé API. Créez-en une pour commencer.
                </div>
              ) : (
                apiKeys.map(key => (
                  <div key={key.id} className="glass-card p-4 flex items-center gap-3">
                    <Key className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-t-text truncate">{key.name}</div>
                      <div className="text-xs text-t-text/40 mt-0.5">
                        <code>{key.keyPrefix}...</code>
                        {' • '}
                        {key.requestCount} requêtes
                        {key.lastUsedAt && <> • Dernier usage : {new Date(key.lastUsedAt).toLocaleDateString('fr')}</>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Révoquer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ---- INTEGRATION TAB ---- */}
        {tab === 'integration' && (
          <>
            {/* Code tabs */}
            <div className="glass-card overflow-hidden">
              <div className="flex border-b border-t-overlay/10">
                {[
                  { id: 'curl' as const, label: 'cURL' },
                  { id: 'python' as const, label: 'Python' },
                  { id: 'node' as const, label: 'Node.js' },
                  { id: 'widget' as const, label: 'Widget' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setCodeTab(id)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                      codeTab === id
                        ? 'bg-t-overlay/10 text-blue-400 border-b-2 border-blue-400'
                        : 'text-t-text/50 hover:text-t-text'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="p-4 relative">
                <pre className="text-xs text-t-text/80 overflow-x-auto whitespace-pre leading-relaxed">
                  {codeSnippets[codeTab]}
                </pre>
                <button
                  onClick={() => copyToClipboard(codeSnippets[codeTab], `code-${codeTab}`)}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-t-overlay/10 hover:bg-t-overlay/20 transition-colors"
                >
                  {copied === `code-${codeTab}`
                    ? <Check className="w-4 h-4 text-green-400" />
                    : <Copy className="w-4 h-4 text-t-text/50" />
                  }
                </button>
              </div>
            </div>

            {/* API Reference */}
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-t-text/80 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Référence API
              </h3>
              <div className="space-y-2 text-xs">
                <div className="bg-t-overlay/5 rounded-lg p-3">
                  <div className="font-mono text-blue-400 mb-1">POST /api/v1/agents/:id/chat</div>
                  <div className="text-t-text/60">Envoie un message à l'agent et reçoit une réponse (streaming SSE ou JSON).</div>
                </div>
                <div className="bg-t-overlay/5 rounded-lg p-3">
                  <div className="font-mono text-t-text/70 mb-1">Request body</div>
                  <pre className="text-t-text/50 ml-2">{`{
  "messages": [{"role": "user", "content": "..."}],
  "stream": true | false  // default: true (SSE)
}`}</pre>
                </div>
                <div className="bg-t-overlay/5 rounded-lg p-3">
                  <div className="font-mono text-t-text/70 mb-1">Headers requis</div>
                  <pre className="text-t-text/50 ml-2">{`Authorization: Bearer <api_key>
Content-Type: application/json`}</pre>
                </div>
                <div className="bg-t-overlay/5 rounded-lg p-3">
                  <div className="font-mono text-t-text/70 mb-1">Rate limits</div>
                  <pre className="text-t-text/50 ml-2">{`Free: 60 req/min, 1000 req/jour
Pro:  300 req/min, 10000 req/jour

Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset`}</pre>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ---- WEBHOOKS TAB ---- */}
        {tab === 'webhooks' && (
          <>
            {/* Create webhook */}
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-t-text/80 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nouveau webhook
              </h3>
              <input
                type="url"
                value={newWebhookUrl}
                onChange={e => setNewWebhookUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="w-full bg-t-overlay/5 border border-t-overlay/10 rounded-lg px-3 py-2 text-sm text-t-text placeholder:text-t-text/30 focus:outline-none focus:border-blue-500/50"
              />
              <div className="flex flex-wrap gap-2">
                {availableEvents.map(event => (
                  <button
                    key={event}
                    onClick={() => setNewWebhookEvents(prev =>
                      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
                    )}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      newWebhookEvents.includes(event)
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-t-overlay/5 text-t-text/50 border border-t-overlay/10 hover:border-t-overlay/20'
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCreateWebhook}
                disabled={!newWebhookUrl.trim() || newWebhookEvents.length === 0}
                className="btn-gradient px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              >
                Créer le webhook
              </button>
            </div>

            {/* Show webhook secret */}
            {webhookSecret && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">Secret du webhook (une seule fois) :</span>
                </div>
                <div className="flex items-center gap-2 bg-t-overlay/10 rounded-lg px-3 py-2">
                  <code className="text-xs text-green-300 flex-1 break-all">{webhookSecret}</code>
                  <button
                    onClick={() => copyToClipboard(webhookSecret, 'webhook-secret')}
                    className="p-1 rounded hover:bg-t-overlay/10"
                  >
                    {copied === 'webhook-secret' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-t-text/50" />}
                  </button>
                </div>
                <p className="text-xs text-t-text/40">
                  Utilisez ce secret pour vérifier la signature HMAC-SHA256 des payloads (header <code>X-GiLo-Signature</code>).
                </p>
              </div>
            )}

            {/* Webhook list */}
            <div className="space-y-2">
              {webhooks.length === 0 ? (
                <div className="text-center py-8 text-t-text/40 text-sm">
                  Aucun webhook configuré.
                </div>
              ) : (
                webhooks.map(webhook => (
                  <div key={webhook.id} className="glass-card p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <Webhook className="w-4 h-4 text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-t-text truncate font-mono">{webhook.url}</div>
                      </div>
                      <button
                        onClick={() => handleToggleWebhook(webhook.id, !webhook.active)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          webhook.active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-t-overlay/10 text-t-text/40'
                        }`}
                      >
                        {webhook.active ? 'Actif' : 'Inactif'}
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 ml-7">
                      {webhook.events.map(evt => (
                        <span key={evt} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded-full">
                          {evt}
                        </span>
                      ))}
                    </div>
                    {webhook.failureCount > 0 && (
                      <div className="ml-7 text-xs text-red-400/70">
                        ⚠ {webhook.failureCount} échec(s) récent(s)
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
