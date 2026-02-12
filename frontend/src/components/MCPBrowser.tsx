import { useState, useEffect } from 'react';
import { Wrench, Database, MessageSquare, X, Plus, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../services/api';

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
  agentId?: string;
  onSelectTool?: (tool: MCPTool) => void;
  onSelectResource?: (resource: MCPResource) => void;
  onSelectPrompt?: (prompt: MCPPrompt) => void;
}

export default function MCPBrowser({ 
  onClose,
  agentId,
  onSelectTool: _onSelectTool, 
  onSelectResource, 
  onSelectPrompt 
}: MCPBrowserProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'tools' | 'resources' | 'prompts'>('tools');
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [resources, setResources] = useState<MCPResource[]>([]);
  const [prompts, setPrompts] = useState<MCPPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingTool, setAddingTool] = useState<string | null>(null);
  const [addedTools, setAddedTools] = useState<Set<string>>(new Set());
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [testArgs, setTestArgs] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setError(null);
      const authHeaders = getAuthHeaders();
      const [toolsRes, resourcesRes, promptsRes] = await Promise.all([
        fetch(`${API_BASE}/api/mcp/tools`, { headers: authHeaders }),
        fetch(`${API_BASE}/api/mcp/resources`, { headers: authHeaders }),
        fetch(`${API_BASE}/api/mcp/prompts`, { headers: authHeaders }),
      ]);

      if (!toolsRes.ok || !resourcesRes.ok || !promptsRes.ok) {
        if (toolsRes.status === 401) { setError(t('common.unauthorized')); return; }
        throw new Error('Failed to fetch MCP data');
      }

      const [toolsData, resourcesData, promptsData] = await Promise.all([
        toolsRes.json(),
        resourcesRes.json(),
        promptsRes.json(),
      ]);
      setTools(Array.isArray(toolsData) ? toolsData : []);
      setResources(Array.isArray(resourcesData) ? resourcesData : []);
      setPrompts(Array.isArray(promptsData) ? promptsData : []);
    } catch (err) {
      console.error('Error fetching MCP data:', err);
      setTools([]);
      setResources([]);
      setPrompts([]);
      setError(t('mcp.fetchError') || 'Failed to load MCP data');
    } finally {
      setLoading(false);
    }
  };

  const addToolToAgent = async (tool: MCPTool) => {
    if (!agentId) return;
    try {
      setAddingTool(tool.name);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/agents/${agentId}/tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: tool.name,
          type: 'mcp',
          description: tool.description || `MCP tool: ${tool.name}`,
          enabled: true,
          parameters: tool.inputSchema || { type: 'object', properties: {} },
          config: {
            serverId: tool.serverId,
            toolName: tool.name,
          },
        }),
      });
      if (response.ok) {
        setAddedTools(prev => new Set(prev).add(tool.name));
      }
    } catch (err) {
      console.error('Error adding MCP tool to agent:', err);
    } finally {
      setAddingTool(null);
    }
  };

  const testMcpTool = async (tool: MCPTool) => {
    try {
      setTesting(true);
      setTestResult(null);
      const token = localStorage.getItem('authToken');
      const args: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(testArgs)) {
        try { args[k] = JSON.parse(v); } catch { args[k] = v; }
      }
      const response = await fetch(`${API_BASE}/api/mcp/tools/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          serverId: tool.serverId,
          toolName: tool.name,
          args,
        }),
      });
      const data = await response.json();
      setTestResult(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-t-overlay/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-blue-400 glow-icon" />
          <span className="font-semibold gradient-text">{t('mcp.browserTitle')}</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-t-text/50 hover:text-t-text hover:bg-t-overlay/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-t-overlay/10 px-2">
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'tools'
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-t-text/40 hover:text-t-text/60'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          {t('mcp.tabTools')} ({tools.length})
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'resources'
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-t-text/40 hover:text-t-text/60'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          {t('mcp.tabResources')} ({resources.length})
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'prompts'
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-t-text/40 hover:text-t-text/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {t('mcp.tabPrompts')} ({prompts.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="text-center py-8 animate-fade-in-up">
            <div className="animate-pulse text-t-text/40">{t('common.loading')}</div>
          </div>
        ) : error ? (
          <div className="text-center py-8 animate-fade-in-up">
            <Wrench className="w-12 h-12 mx-auto mb-3 text-red-400/40" />
            <p className="text-red-400/70 text-sm">{error}</p>
            <button onClick={fetchData} className="mt-3 text-xs text-blue-400 hover:underline">{t('common.retry') || 'Retry'}</button>
          </div>
        ) : (
          <>
            {activeTab === 'tools' && (
              <div className="space-y-2">
                {tools.length === 0 ? (
                  <div className="text-center py-8 animate-fade-in-up">
                    <Wrench className="w-12 h-12 mx-auto mb-3 text-t-text/20" />
                    <p className="text-t-text/40 text-sm">{t('mcp.noTools')}</p>
                    <p className="text-xs text-t-text/25 mt-1">{t('mcp.enableServersHint')}</p>
                  </div>
                ) : (
                  tools.map((tool, idx) => {
                    const isExpanded = expandedTool === `${tool.serverId}:${tool.name}`;
                    const isAdded = addedTools.has(tool.name);
                    const props = tool.inputSchema?.properties || {};
                    const paramNames = Object.keys(props);
                    return (
                      <div
                        key={idx}
                        className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 transition-colors"
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-1">
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => {
                                setExpandedTool(isExpanded ? null : `${tool.serverId}:${tool.name}`);
                                setTestResult(null);
                                setTestArgs({});
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-t-text/80">
                                  {tool.name}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                                  MCP
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-t-overlay/10 text-t-text/40">
                                  {tool.serverId.substring(0, 8)}
                                </span>
                              </div>
                              {tool.description && (
                                <p className="text-xs text-t-text/35 mt-0.5">
                                  {tool.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              {agentId && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); addToolToAgent(tool); }}
                                  disabled={!!addingTool || isAdded}
                                  className={`px-2 py-1 rounded text-xs transition-colors ${
                                    isAdded
                                      ? 'bg-green-500/20 text-green-300 cursor-default'
                                      : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                                  } disabled:opacity-50`}
                                  title="Ajouter à l'agent"
                                >
                                  {isAdded ? '✓' : <Plus className="w-3 h-3" />}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setExpandedTool(isExpanded ? null : `${tool.serverId}:${tool.name}`);
                                  setTestResult(null);
                                  setTestArgs({});
                                }}
                                className="p-1 rounded hover:bg-t-overlay/10 text-t-text/40 transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded: test tool */}
                        {isExpanded && (
                          <div className="border-t border-t-overlay/10 p-3 space-y-2">
                            {paramNames.length > 0 ? (
                              <>
                                <p className="text-[11px] text-t-text/40 font-medium">Paramètres :</p>
                                {paramNames.map(pName => (
                                  <div key={pName} className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono text-t-text/50 w-32 truncate" title={pName}>
                                      {pName}
                                      {tool.inputSchema?.required?.includes(pName) && <span className="text-red-400">*</span>}
                                    </span>
                                    <input
                                      type="text"
                                      value={testArgs[pName] || ''}
                                      onChange={(e) => setTestArgs({ ...testArgs, [pName]: e.target.value })}
                                      placeholder={props[pName]?.description || props[pName]?.type || 'value'}
                                      className="flex-1 bg-t-overlay/[0.04] text-t-text/90 px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10 font-mono"
                                    />
                                  </div>
                                ))}
                              </>
                            ) : (
                              <p className="text-[11px] text-t-text/35">Aucun paramètre requis</p>
                            )}
                            <button
                              onClick={() => testMcpTool(tool)}
                              disabled={testing}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                            >
                              <Play className="w-3 h-3" />
                              {testing ? 'Exécution...' : 'Tester'}
                            </button>
                            {testResult && (
                              <pre className="text-[11px] font-mono bg-t-overlay/[0.06] rounded-lg p-2 text-t-text/60 max-h-40 overflow-auto whitespace-pre-wrap break-all border border-t-overlay/10">
                                {testResult}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="space-y-2">
                {resources.length === 0 ? (
                  <div className="text-center py-8 animate-fade-in-up">
                    <Database className="w-12 h-12 mx-auto mb-3 text-t-text/20" />
                    <p className="text-t-text/40 text-sm">{t('mcp.noResources')}</p>
                    <p className="text-xs text-t-text/25 mt-1">{t('mcp.enableServersHint')}</p>
                  </div>
                ) : (
                  resources.map((resource, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectResource?.(resource)}
                      className="bg-t-overlay/[0.04] rounded-xl p-3 border border-t-overlay/10 hover:border-blue-500/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-t-text/80">
                          {resource.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-t-overlay/10 text-t-text/40">
                          {resource.serverId.substring(0, 8)}
                        </span>
                      </div>
                      {resource.description && (
                        <p className="text-xs text-t-text/35 mb-1">
                          {resource.description}
                        </p>
                      )}
                      <p className="text-xs text-t-text/25 font-mono truncate">
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
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-t-text/20" />
                    <p className="text-t-text/40 text-sm">{t('mcp.noPrompts')}</p>
                    <p className="text-xs text-t-text/25 mt-1">{t('mcp.enableServersHint')}</p>
                  </div>
                ) : (
                  prompts.map((prompt, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectPrompt?.(prompt)}
                      className="bg-t-overlay/[0.04] rounded-xl p-3 border border-t-overlay/10 hover:border-blue-500/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-t-text/80">
                          {prompt.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-t-overlay/10 text-t-text/40">
                          {prompt.serverId.substring(0, 8)}
                        </span>
                      </div>
                      {prompt.description && (
                        <p className="text-xs text-t-text/35">
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
