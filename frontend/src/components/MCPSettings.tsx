import { useState, useEffect } from 'react';
import { Settings, Plus, Power, PowerOff, Trash2, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../services/api';

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  description?: string;
}

interface MCPSettingsProps {
  onClose: () => void;
}

export default function MCPSettings({ onClose }: MCPSettingsProps) {
  const { t } = useTranslation();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    command: '',
    args: '',
    description: '',
  });

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  useEffect(() => {
    fetchServers();
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
      
      await fetch(`${API_BASE}/api/mcp/servers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newServer.name,
          command: newServer.command,
          args,
          description: newServer.description,
          enabled: false,
        }),
      });
      
      setShowAddForm(false);
      setNewServer({ name: '', command: '', args: '', description: '' });
      fetchServers();
    } catch (error) {
      console.error('Error adding server:', error);
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
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-gradient px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('mcp.addServer')}
          </button>
        </div>

        {/* Add Server Form */}
        {showAddForm && (
          <div className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 p-4 space-y-3 animate-fade-in-up">
            <h4 className="text-sm font-medium text-t-text/70">{t('mcp.newServer')}</h4>
            <input
              type="text"
              placeholder={t('mcp.namePlaceholder')}
              value={newServer.name}
              onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
              className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
              autoFocus
            />
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
                disabled={!newServer.name || !newServer.command}
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
                    {server.command} {server.args.join(' ')}
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
          <p className="text-xs text-t-text/30 mb-1.5">📚 <strong className="text-t-text/40">{t('mcp.popularServers')}</strong></p>
          <ul className="text-xs text-t-text/25 space-y-0.5 ml-4 list-disc list-inside">
            <li>@modelcontextprotocol/server-filesystem — Accès fichiers</li>
            <li>@modelcontextprotocol/server-github — Intégration GitHub</li>
            <li>@modelcontextprotocol/server-memory — Stockage en mémoire</li>
            <li>@modelcontextprotocol/server-postgres — Base de données</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
