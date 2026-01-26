import { useState, useEffect } from 'react';
import { Settings, Plus, Power, PowerOff, Trash2, Check, X } from 'lucide-react';

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
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    command: '',
    args: '',
    description: '',
  });

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/mcp/servers');
      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleServer = async (serverId: string, enabled: boolean) => {
    try {
      const endpoint = enabled 
        ? `/api/mcp/servers/${serverId}/connect`
        : `/api/mcp/servers/${serverId}/disconnect`;
      
      await fetch(endpoint, { method: 'POST' });
      
      await fetch(`/api/mcp/servers/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      
      fetchServers();
    } catch (error) {
      console.error('Error toggling server:', error);
    }
  };

  const deleteServer = async (serverId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce serveur ?')) return;
    
    try {
      await fetch(`/api/mcp/servers/${serverId}`, { method: 'DELETE' });
      fetchServers();
    } catch (error) {
      console.error('Error deleting server:', error);
    }
  };

  const addServer = async () => {
    try {
      const args = newServer.args.split(' ').filter(arg => arg.trim());
      
      await fetch('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Configuration MCP</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <p className="text-gray-300 mb-4">
              Le Model Context Protocol (MCP) permet de connecter votre AI à des outils, ressources et systèmes externes.
            </p>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter un serveur MCP
            </button>
          </div>

          {/* Add Server Form */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h3 className="text-lg font-semibold text-white mb-4">Nouveau serveur MCP</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nom (ex: Filesystem)"
                  value={newServer.name}
                  onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                  className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Commande (ex: npx)"
                  value={newServer.command}
                  onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                  className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Arguments (ex: -y @modelcontextprotocol/server-filesystem /tmp)"
                  value={newServer.args}
                  onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                  className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  placeholder="Description (optionnel)"
                  value={newServer.description}
                  onChange={(e) => setNewServer({ ...newServer, description: e.target.value })}
                  className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={addServer}
                    disabled={!newServer.name || !newServer.command}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Ajouter
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Servers List */}
          {loading ? (
            <div className="text-center text-gray-400 py-8">Chargement...</div>
          ) : servers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              Aucun serveur MCP configuré
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          {server.name}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            server.enabled
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          {server.enabled ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      {server.description && (
                        <p className="text-gray-300 text-sm mb-2">
                          {server.description}
                        </p>
                      )}
                      <div className="text-gray-400 text-sm font-mono">
                        {server.command} {server.args.join(' ')}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => toggleServer(server.id, !server.enabled)}
                        className={`p-2 rounded transition-colors ${
                          server.enabled
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                        title={server.enabled ? 'Désactiver' : 'Activer'}
                      >
                        {server.enabled ? (
                          <PowerOff className="w-4 h-4" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteServer(server.id)}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 bg-gray-750">
          <div className="text-sm text-gray-400">
            <p className="mb-2">📚 <strong>Serveurs MCP populaires :</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>@modelcontextprotocol/server-filesystem - Accès fichiers</li>
              <li>@modelcontextprotocol/server-github - Intégration GitHub</li>
              <li>@modelcontextprotocol/server-memory - Stockage en mémoire</li>
              <li>@modelcontextprotocol/server-postgres - Base de données</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
