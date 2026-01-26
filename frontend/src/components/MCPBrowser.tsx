import { useState, useEffect } from 'react';
import { Wrench, Database, MessageSquare, X } from 'lucide-react';

interface MCPTool {
  name: string;
  description?: string;
  inputSchema: any;
  serverId: string;
}

interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  serverId: string;
}

interface MCPPrompt {
  name: string;
  description?: string;
  serverId: string;
}

interface MCPBrowserProps {
  onClose: () => void;
  onSelectTool?: (tool: MCPTool) => void;
  onSelectResource?: (resource: MCPResource) => void;
  onSelectPrompt?: (prompt: MCPPrompt) => void;
}

export default function MCPBrowser({ 
  onClose, 
  onSelectTool, 
  onSelectResource, 
  onSelectPrompt 
}: MCPBrowserProps) {
  const [activeTab, setActiveTab] = useState<'tools' | 'resources' | 'prompts'>('tools');
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [resources, setResources] = useState<MCPResource[]>([]);
  const [prompts, setPrompts] = useState<MCPPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [toolsRes, resourcesRes, promptsRes] = await Promise.all([
        fetch('/api/mcp/tools'),
        fetch('/api/mcp/resources'),
        fetch('/api/mcp/prompts'),
      ]);

      setTools(await toolsRes.json());
      setResources(await resourcesRes.json());
      setPrompts(await promptsRes.json());
    } catch (error) {
      console.error('Error fetching MCP data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Outils et Ressources MCP</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-750">
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'tools'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Outils ({tools.length})
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'resources'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Database className="w-4 h-4" />
            Ressources ({resources.length})
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'prompts'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Prompts ({prompts.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Chargement...</div>
          ) : (
            <>
              {activeTab === 'tools' && (
                <div className="space-y-3">
                  {tools.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      Aucun outil disponible. Activez des serveurs MCP dans les paramètres.
                    </p>
                  ) : (
                    tools.map((tool, idx) => (
                      <div
                        key={idx}
                        onClick={() => onSelectTool?.(tool)}
                        className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-blue-500 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {tool.name}
                          </h3>
                          <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded">
                            {tool.serverId.substring(0, 8)}
                          </span>
                        </div>
                        {tool.description && (
                          <p className="text-gray-300 text-sm">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="space-y-3">
                  {resources.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      Aucune ressource disponible. Activez des serveurs MCP dans les paramètres.
                    </p>
                  ) : (
                    resources.map((resource, idx) => (
                      <div
                        key={idx}
                        onClick={() => onSelectResource?.(resource)}
                        className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-blue-500 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {resource.name}
                          </h3>
                          <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded">
                            {resource.serverId.substring(0, 8)}
                          </span>
                        </div>
                        {resource.description && (
                          <p className="text-gray-300 text-sm mb-2">
                            {resource.description}
                          </p>
                        )}
                        <p className="text-gray-400 text-xs font-mono">
                          {resource.uri}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'prompts' && (
                <div className="space-y-3">
                  {prompts.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      Aucun prompt disponible. Activez des serveurs MCP dans les paramètres.
                    </p>
                  ) : (
                    prompts.map((prompt, idx) => (
                      <div
                        key={idx}
                        onClick={() => onSelectPrompt?.(prompt)}
                        className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-blue-500 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {prompt.name}
                          </h3>
                          <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded">
                            {prompt.serverId.substring(0, 8)}
                          </span>
                        </div>
                        {prompt.description && (
                          <p className="text-gray-300 text-sm">
                            {prompt.description}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
