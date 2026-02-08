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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-blue-400 glow-icon" />
          <span className="font-semibold gradient-text">Outils & Ressources MCP</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-2">
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'tools'
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-white/40 hover:text-white/60'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          Outils ({tools.length})
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'resources'
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-white/40 hover:text-white/60'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Ressources ({resources.length})
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'prompts'
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-white/40 hover:text-white/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Prompts ({prompts.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="text-center py-8 animate-fade-in-up">
            <div className="animate-pulse text-white/40">Chargement...</div>
          </div>
        ) : (
          <>
            {activeTab === 'tools' && (
              <div className="space-y-2">
                {tools.length === 0 ? (
                  <div className="text-center py-8 animate-fade-in-up">
                    <Wrench className="w-12 h-12 mx-auto mb-3 text-white/20" />
                    <p className="text-white/40 text-sm">Aucun outil disponible</p>
                    <p className="text-xs text-white/25 mt-1">Activez des serveurs MCP dans les paramètres</p>
                  </div>
                ) : (
                  tools.map((tool, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectTool?.(tool)}
                      className="bg-white/[0.04] rounded-xl p-3 border border-white/10 hover:border-blue-500/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-white/80">
                          {tool.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">
                          {tool.serverId.substring(0, 8)}
                        </span>
                      </div>
                      {tool.description && (
                        <p className="text-xs text-white/35">
                          {tool.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="space-y-2">
                {resources.length === 0 ? (
                  <div className="text-center py-8 animate-fade-in-up">
                    <Database className="w-12 h-12 mx-auto mb-3 text-white/20" />
                    <p className="text-white/40 text-sm">Aucune ressource disponible</p>
                    <p className="text-xs text-white/25 mt-1">Activez des serveurs MCP dans les paramètres</p>
                  </div>
                ) : (
                  resources.map((resource, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectResource?.(resource)}
                      className="bg-white/[0.04] rounded-xl p-3 border border-white/10 hover:border-blue-500/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-white/80">
                          {resource.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">
                          {resource.serverId.substring(0, 8)}
                        </span>
                      </div>
                      {resource.description && (
                        <p className="text-xs text-white/35 mb-1">
                          {resource.description}
                        </p>
                      )}
                      <p className="text-xs text-white/25 font-mono truncate">
                        {resource.uri}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'prompts' && (
              <div className="space-y-2">
                {prompts.length === 0 ? (
                  <div className="text-center py-8 animate-fade-in-up">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-white/20" />
                    <p className="text-white/40 text-sm">Aucun prompt disponible</p>
                    <p className="text-xs text-white/25 mt-1">Activez des serveurs MCP dans les paramètres</p>
                  </div>
                ) : (
                  prompts.map((prompt, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectPrompt?.(prompt)}
                      className="bg-white/[0.04] rounded-xl p-3 border border-white/10 hover:border-blue-500/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-white/80">
                          {prompt.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">
                          {prompt.serverId.substring(0, 8)}
                        </span>
                      </div>
                      {prompt.description && (
                        <p className="text-xs text-white/35">
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
  );
}
