import { useState, useEffect } from 'react';
import { Settings, Plus, Power, PowerOff, Trash2, Check, X, Download, Globe, Terminal, Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../services/api';

interface MCPServer {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  description?: string;
  url?: string;
}

interface MCPTemplate {
  id: string;
  name: string;
  description: string;
  transport: 'stdio' | 'http';
  command: string;
  args: string[];
  env?: Record<string, string>;
  icon?: string;
  category?: string;
  popular?: boolean;
}

interface MCPSettingsProps {
  onClose: () => void;
}

export default function MCPSettings({ onClose }: MCPSettingsProps) {
  const { t } = useTranslation();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [templates, setTemplates] = useState<MCPTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [installingTpl, setInstallingTpl] = useState<string | null>(null);
  const [tplEnvOverrides, setTplEnvOverrides] = useState<Record<string, string>>({});
  const [envEditingTpl, setEnvEditingTpl] = useState<string | null>(null);
  const [newServer, setNewServer] = useState({
    name: '',
    transport: 'stdio' as 'stdio' | 'http',
    command: '',
    args: '',
    url: '',
    description: '',
    env: '',
  });

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  useEffect(() => {
    fetchServers();
    fetchTemplates();
  }, []);

  const fetchServers = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/api/mcp/servers`, { headers: getAuthHeaders() });
      if (!response.ok) {
        if (response.status === 401) { setError(t('common.unauthorized')); return; }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setServers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching MCP servers:', err);
      setServers([]);
      setError(t('mcp.fetchError') || 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/mcp/templates`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setTemplates(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
  };

  const toggleServer = async (serverId: string, enabled: boolean) => {
    try {
      const endpoint = enabled 
        ? `${API_BASE}/api/mcp/servers/${serverId}/connect`
        : `${API_BASE}/api/mcp/servers/${serverId}/disconnect`;
      
      await fetch(endpoint, { method: 'POST', headers: getAuthHeaders() });
      
      await fetch(`${API_BASE}/api/mcp/servers/${serverId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled }),
      });
      
      fetchServers();
    } catch (error) {
      console.error('Error toggling server:', error);
    }
  };

  const deleteServer = async (serverId: string) => {
    if (!confirm(t('mcp.confirmDelete'))) return;
    
    try {
      await fetch(`${API_BASE}/api/mcp/servers/${serverId}`, { method: 'DELETE', headers: getAuthHeaders() });
      fetchServers();
    } catch (error) {
      console.error('Error deleting server:', error);
    }
  };

  const addServer = async () => {
    try {
      const args = newServer.args.split(' ').filter(arg => arg.trim());

      // Parse env key=value pairs
      const env: Record<string, string> = {};
      if (newServer.env.trim()) {
        for (const line of newServer.env.split('\n')) {
          const eqIdx = line.indexOf('=');
          if (eqIdx > 0) {
            env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
          }
        }
      }

      await fetch(`${API_BASE}/api/mcp/servers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newServer.name,
          transport: newServer.transport,
          command: newServer.transport === 'stdio' ? newServer.command : 'http',
          args: newServer.transport === 'stdio' ? args : [],
          url: newServer.transport === 'http' ? newServer.url : undefined,
          env: Object.keys(env).length > 0 ? env : undefined,
          description: newServer.description,
          enabled: false,
        }),
      });

      setShowAddForm(false);
      setNewServer({ name: '', transport: 'stdio', command: '', args: '', url: '', description: '', env: '' });
      fetchServers();
    } catch (error) {
      console.error('Error adding server:', error);
    }
  };

  const installTemplate = async (tplId: string) => {
    try {
      setInstallingTpl(tplId);
      await fetch(`${API_BASE}/api/mcp/templates/${tplId}/install`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ env: tplEnvOverrides }),
      });
      setTplEnvOverrides({});
      setEnvEditingTpl(null);
      fetchServers();
    } catch (err) {
      console.error('Error installing template:', err);
    } finally {
      setInstallingTpl(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-t-overlay/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400 glow-icon" />
          <span className="font-semibold gradient-text">{t('mcp.configTitle')}</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-t-text/50 hover:text-t-text hover:bg-t-overlay/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <p className="text-xs text-t-text/35 mb-3">
            {t('mcp.configDesc')}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowAddForm(!showAddForm); setShowTemplates(false); }}
              className="btn-gradient px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('mcp.addServer')}
            </button>
            <button
              onClick={() => { setShowTemplates(!showTemplates); setShowAddForm(false); }}
              className="btn-outline-glow px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Catalogue
            </button>
          </div>
        </div>

        {/* Templates Catalogue */}
        {showTemplates && (
          <div className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 p-4 space-y-3 animate-fade-in-up">
            <h4 className="text-sm font-medium text-t-text/70 flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-400" />
              Serveurs MCP populaires
            </h4>
            <p className="text-xs text-t-text/35">Installation en un clic — configurez les clés API après l'installation.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {templates.map((tpl) => {
                const alreadyInstalled = servers.some(s => s.name === tpl.name);
                const hasEnvKeys = tpl.env && Object.keys(tpl.env).length > 0;
                const isEditingEnv = envEditingTpl === tpl.id;
                return (
                  <div key={tpl.id} className="rounded-lg bg-t-overlay/[0.02] border border-t-overlay/5 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-t-text/80">{tpl.name}</span>
                          {tpl.popular && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Popular</span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-t-overlay/10 text-t-text/30 capitalize">{tpl.category}</span>
                        </div>
                        <p className="text-xs text-t-text/35 mt-0.5">{tpl.description}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {hasEnvKeys && !alreadyInstalled && (
                          <button
                            onClick={() => {
                              if (isEditingEnv) { setEnvEditingTpl(null); }
                              else { setEnvEditingTpl(tpl.id); setTplEnvOverrides({ ...tpl.env }); }
                            }}
                            className="p-1.5 rounded hover:bg-t-overlay/10 text-t-text/40 hover:text-blue-400 transition-colors"
                            title="Configure API keys"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => installTemplate(tpl.id)}
                          disabled={!!installingTpl || alreadyInstalled}
                          className={`px-2.5 py-1 rounded text-xs transition-colors ${
                            alreadyInstalled
                              ? 'bg-green-500/20 text-green-300 cursor-default'
                              : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                          } disabled:opacity-50`}
                        >
                          {alreadyInstalled ? '✓ Installé' : installingTpl === tpl.id ? '...' : 'Installer'}
                        </button>
                      </div>
                    </div>
                    {/* Env keys editing */}
                    {isEditingEnv && hasEnvKeys && (
                      <div className="mt-2 space-y-1.5 border-t border-t-overlay/10 pt-2">
                        {Object.entries(tpl.env!).map(([key]) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-t-text/40 w-44 truncate">{key}</span>
                            <input
                              type="text"
                              value={tplEnvOverrides[key] || ''}
                              onChange={(e) => setTplEnvOverrides({ ...tplEnvOverrides, [key]: e.target.value })}
                              placeholder="(optional)"
                              className="flex-1 bg-t-overlay/[0.04] text-t-text/90 px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10 font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowTemplates(false)} className="w-full px-3 py-2 text-sm rounded-lg border border-t-overlay/10 text-t-text/50 hover:bg-t-overlay/5">
              {t('common.cancel')}
            </button>
          </div>
        )}

        {/* Add Server Form */}
        {showAddForm && (
          <div className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 p-4 space-y-3 animate-fade-in-up">
            <h4 className="text-sm font-medium text-t-text/70">{t('mcp.newServer')}</h4>

            {/* Transport selector */}
            <div className="flex gap-2">
              {[
                { id: 'stdio' as const, label: 'Stdio (CLI)', icon: Terminal },
                { id: 'http' as const, label: 'HTTP (URL)', icon: Globe },
              ].map(tp => (
                <button
                  key={tp.id}
                  onClick={() => setNewServer({ ...newServer, transport: tp.id })}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    newServer.transport === tp.id
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-t-overlay/[0.04] border-t-overlay/10 text-t-text/40 hover:text-t-text/60'
                  }`}
                >
                  <tp.icon className="w-3.5 h-3.5" />
                  {tp.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder={t('mcp.namePlaceholder')}
              value={newServer.name}
              onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
              className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
              autoFocus
            />

            {newServer.transport === 'stdio' ? (
              <>
                <input
                  type="text"
                  placeholder={t('mcp.commandPlaceholder')}
                  value={newServer.command}
                  onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                  className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                />
                <input
                  type="text"
                  placeholder={t('mcp.argsPlaceholder')}
                  value={newServer.args}
                  onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                  className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                />
              </>
            ) : (
              <input
                type="text"
                placeholder="https://mcp-server.example.com/rpc"
                value={newServer.url}
                onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
              />
            )}

            {/* Environment variables */}
            <div>
              <label className="text-[11px] text-t-text/40 mb-1 block flex items-center gap-1">
                <Key className="w-3 h-3" /> Variables d'environnement (KEY=value, une par ligne)
              </label>
              <textarea
                placeholder="GITHUB_TOKEN=ghp_xxx&#10;API_KEY=sk-xxx"
                value={newServer.env}
                onChange={(e) => setNewServer({ ...newServer, env: e.target.value })}
                className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                rows={2}
              />
            </div>

            <textarea
              placeholder={t('mcp.descPlaceholder')}
              value={newServer.description}
              onChange={(e) => setNewServer({ ...newServer, description: e.target.value })}
              className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-t-overlay/10 text-t-text/50 hover:bg-t-overlay/5"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={addServer}
                disabled={!newServer.name || (newServer.transport === 'stdio' ? !newServer.command : !newServer.url)}
                className="flex-1 btn-gradient px-3 py-2 text-sm rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {t('common.add')}
              </button>
            </div>
          </div>
        )}

        {/* Servers List */}
        {loading ? (
          <div className="text-center py-8 animate-fade-in-up">
            <div className="animate-pulse text-t-text/40">{t('common.loading')}</div>
          </div>
        ) : error ? (
          <div className="text-center py-8 animate-fade-in-up">
            <Settings className="w-12 h-12 mx-auto mb-3 text-red-400/40" />
            <p className="text-red-400/70 text-sm">{error}</p>
            <button onClick={fetchServers} className="mt-3 text-xs text-blue-400 hover:underline">{t('common.retry') || 'Retry'}</button>
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-8 animate-fade-in-up">
            <Settings className="w-12 h-12 mx-auto mb-3 text-t-text/20" />
            <p className="text-t-text/40 text-sm">{t('mcp.noServers')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {servers.map((server) => (
              <div
                key={server.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  server.enabled
                    ? 'bg-t-overlay/[0.04] border-t-overlay/10'
                    : 'bg-t-overlay/[0.02] border-t-overlay/5 opacity-60'
                }`}
              >
                <button
                  onClick={() => toggleServer(server.id, !server.enabled)}
                  className="flex-shrink-0"
                  title={server.enabled ? t('mcp.disable') : t('mcp.enable')}
                >
                  {server.enabled ? (
                    <Power className="w-5 h-5 text-green-400" />
                  ) : (
                    <PowerOff className="w-5 h-5 text-t-text/30" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-t-text/80">{server.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                      server.transport === 'http'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-t-overlay/10 text-t-text/40'
                    }`}>{server.transport || 'stdio'}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                        server.enabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-t-overlay/10 text-t-text/40'
                      }`}
                    >
                      {server.enabled ? t('mcp.active') : t('mcp.inactive')}
                    </span>
                  </div>
                  {server.description && (
                    <p className="text-xs text-t-text/35 mt-0.5 truncate">{server.description}</p>
                  )}
                  <p className="text-xs text-t-text/25 font-mono mt-0.5 truncate">
                    {server.transport === 'http' && server.url
                      ? server.url
                      : `${server.command} ${server.args.join(' ')}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteServer(server.id)}
                  className="p-1 rounded hover:bg-t-overlay/10 text-t-text/30 hover:text-red-400 transition-colors flex-shrink-0"
                  title={t('common.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer hint */}
        <div className="mt-4 p-3 rounded-xl bg-t-overlay/[0.02] border border-t-overlay/5">
          <p className="text-xs text-t-text/30 mb-1.5">📚 <strong className="text-t-text/40">Model Context Protocol</strong></p>
          <p className="text-xs text-t-text/25">
            MCP connecte vos agents IA à des outils, fichiers, bases de données et services externes via un protocole standardisé.
            Utilisez le Catalogue ci-dessus pour installer rapidement des serveurs populaires.
          </p>
        </div>
      </div>
    </div>
  );
}
