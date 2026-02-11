import { useState, useEffect } from 'react';
import { Settings, Save, X, Cpu, MessageSquare, Wrench, Plus, Trash2, ToggleLeft, ToggleRight, Thermometer, Zap, BookOpen, Globe, Code, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE, getToolCatalogue, addBuiltinTool, removeToolFromAgent, CatalogueTool, CatalogueCategory } from '../services/api';
import KnowledgePanel from './KnowledgePanel';

interface AgentConfigProps {
  agentId: string;
  onClose?: () => void;
}

interface AgentTool {
  id: string;
  name: string;
  type: 'builtin' | 'http' | 'mcp';
  description?: string;
  enabled: boolean;
  parameters?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

interface AgentConfigData {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  welcomeMessage: string;
  language: 'fr' | 'en';
  tools: AgentTool[];
}

const AVAILABLE_MODELS = [
  { id: 'openai/gpt-4.1', labelKey: 'models.gpt41', descKey: 'models.gpt41Desc' },
  { id: 'openai/gpt-4.1-mini', labelKey: 'models.gpt41Mini', descKey: 'models.gpt41MiniDesc' },
  { id: 'openai/gpt-4.1-nano', labelKey: 'models.gpt41Nano', descKey: 'models.gpt41NanoDesc' },
];

export default function AgentConfig({ agentId, onClose }: AgentConfigProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AgentConfigData>({
    model: 'openai/gpt-4.1',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'Tu es un assistant IA utile et concis.',
    welcomeMessage: 'Bonjour ! Comment puis-je vous aider ?',
    language: 'fr',
    tools: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'model' | 'tools' | 'knowledge'>('prompt');
  const [showAddTool, setShowAddTool] = useState(false);
  const [catalogue, setCatalogue] = useState<CatalogueTool[]>([]);
  const [catalogueCategories, setCatalogueCategories] = useState<CatalogueCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDesc, setNewToolDesc] = useState('');
  const [newToolUrl, setNewToolUrl] = useState('');
  const [newToolMethod, setNewToolMethod] = useState('GET');
  const [addMode, setAddMode] = useState<'catalogue' | 'http' | 'custom'>('catalogue');

  useEffect(() => {
    loadConfig();
  }, [agentId]);

  const loadConfig = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/agents/${agentId}`, { headers });
      if (res.ok) {
        const agent = await res.json();
        if (agent.config && typeof agent.config === 'object') {
          setConfig({
            model: agent.config.model || 'openai/gpt-4.1',
            temperature: typeof agent.config.temperature === 'number' ? agent.config.temperature : 0.7,
            maxTokens: typeof agent.config.maxTokens === 'number' ? agent.config.maxTokens : 2048,
            systemPrompt: agent.config.systemPrompt || '',
            welcomeMessage: agent.config.welcomeMessage || '',
            language: agent.config.language || 'fr',
            tools: Array.isArray(agent.config.tools) ? agent.config.tools : [],
          });
        }
      }
    } catch (error) {
      console.error('Error loading agent config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE}/api/agents/${agentId}/config`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(config),
      });
    } catch (error) {
      console.error('Error saving agent config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadCatalogue = async () => {
    setCatalogueLoading(true);
    try {
      const data = await getToolCatalogue(selectedCategory || undefined);
      setCatalogue(data.tools);
      setCatalogueCategories(data.categories);
    } catch (e) {
      console.error('Error loading catalogue:', e);
    } finally {
      setCatalogueLoading(false);
    }
  };

  const addFromCatalogue = async (toolId: string) => {
    try {
      const data = await addBuiltinTool(agentId, toolId);
      setConfig({ ...config, tools: [...config.tools, data.tool as unknown as AgentTool] });
    } catch (e: any) {
      console.error('Error adding tool:', e.message);
    }
  };

  const addHttpTool = () => {
    if (!newToolName.trim() || !newToolUrl.trim()) return;
    const tool: AgentTool = {
      id: `http-${Date.now()}`,
      name: newToolName.replace(/\s+/g, '_').toLowerCase(),
      type: 'http',
      description: newToolDesc || `${newToolMethod} ${newToolUrl}`,
      enabled: true,
      parameters: {
        type: 'object',
        properties: {},
      },
      config: {
        url: newToolUrl,
        method: newToolMethod,
        headers: { 'Content-Type': 'application/json' },
        auth: { type: 'none' },
      },
    };
    setConfig({ ...config, tools: [...config.tools, tool] });
    setNewToolName('');
    setNewToolDesc('');
    setNewToolUrl('');
    setNewToolMethod('GET');
    setShowAddTool(false);
  };

  const addTool = () => {
    if (!newToolName.trim()) return;
    const tool: AgentTool = {
      id: `custom-${Date.now()}`,
      name: newToolName.replace(/\s+/g, '_').toLowerCase(),
      type: 'builtin',
      description: newToolDesc || undefined,
      enabled: true,
      parameters: { type: 'object', properties: {} },
    };
    setConfig({ ...config, tools: [...config.tools, tool] });
    setNewToolName('');
    setNewToolDesc('');
    setShowAddTool(false);
  };

  const removeTool = async (toolId: string) => {
    try {
      await removeToolFromAgent(agentId, toolId);
    } catch {
      // fallback: still remove locally
    }
    setConfig({ ...config, tools: config.tools.filter((t) => t.id !== toolId) });
  };

  const toggleTool = (toolId: string) => {
    setConfig({
      ...config,
      tools: config.tools.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t)),
    });
  };

  const tabs = [
    { id: 'prompt' as const, label: t('agentConfig.instructions'), icon: MessageSquare },
    { id: 'model' as const, label: t('agentConfig.model'), icon: Cpu },
    { id: 'tools' as const, label: t('agentConfig.tools'), icon: Wrench },
    { id: 'knowledge' as const, label: 'Knowledge', icon: BookOpen },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-t-text/40">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-t-overlay/10">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400 glow-icon" />
          <span className="font-semibold gradient-text">{t('agentConfig.title')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-gradient px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-t-text/50 hover:text-t-text hover:bg-t-overlay/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-t-overlay/10 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-t-text/40 hover:text-t-text/60'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'prompt' && (
          <>
            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium text-t-text/60 mb-2">
                {t('agentConfig.systemPrompt')}
              </label>
              <p className="text-xs text-t-text/35 mb-2">
                {t('agentConfig.systemPromptDesc')}
              </p>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className="w-full bg-t-overlay/[0.04] text-t-text/90 px-4 py-3 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                rows={8}
                placeholder={t('agentConfig.systemPromptPlaceholder')}
              />
            </div>

            {/* Welcome Message */}
            <div>
              <label className="block text-sm font-medium text-t-text/60 mb-2">
                {t('agentConfig.welcomeMessage')}
              </label>
              <input
                value={config.welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                className="w-full bg-t-overlay/[0.04] text-t-text/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                placeholder={t('agentConfig.welcomePlaceholder')}
              />
            </div>

            {/* Agent Language */}
            <div>
              <label className="block text-sm font-medium text-t-text/60 mb-2">
                <Globe className="w-3.5 h-3.5 inline mr-1.5" />
                {t('agentConfig.language')}
              </label>
              <p className="text-xs text-t-text/35 mb-2">
                {t('agentConfig.languageDesc')}
              </p>
              <div className="flex gap-2">
                {[
                  { id: 'fr' as const, label: '🇫🇷 Français' },
                  { id: 'en' as const, label: '🇬🇧 English' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setConfig({ ...config, language: lang.id })}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                      config.language === lang.id
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                        : 'bg-t-overlay/[0.04] border-t-overlay/10 text-t-text/50 hover:text-t-text/70'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'model' && (
          <>
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-t-text/60 mb-3">
                {t('agentConfig.aiModel')}
              </label>
              <div className="space-y-2">
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setConfig({ ...config, model: m.id })}
                    className={`w-full p-3 rounded-xl text-left transition-all ${
                      config.model === m.id
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-t-overlay/[0.04] border border-t-overlay/10 hover:border-t-overlay/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className={`w-4 h-4 ${config.model === m.id ? 'text-blue-400' : 'text-t-text/40'}`} />
                        <span className={`text-sm font-medium ${config.model === m.id ? 'text-blue-300' : 'text-t-text/70'}`}>{t(m.labelKey)}</span>
                      </div>
                      {config.model === m.id && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                    </div>
                    <p className="text-xs text-t-text/35 mt-1 pl-6">{t(m.descKey)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-t-text/60">
                  <Thermometer className="w-3.5 h-3.5" />
                  Température
                </label>
                <span className="text-sm font-mono text-blue-400">{config.temperature.toFixed(1)}</span>
              </div>
              <p className="text-xs text-t-text/35 mb-2">
                {t('agentConfig.temperatureDesc')}
              </p>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-t-text/25 mt-1">
                <span>{t('agentConfig.precise')}</span>
                <span>{t('agentConfig.creative')}</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-t-text/60">
                  <Zap className="w-3.5 h-3.5" />
                  {t('agentConfig.maxTokens')}
                </label>
                <span className="text-sm font-mono text-blue-400">{config.maxTokens}</span>
              </div>
              <input
                type="range"
                min="256"
                max="8192"
                step="256"
                value={config.maxTokens}
                onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-t-text/25 mt-1">
                <span>256</span>
                <span>8192</span>
              </div>
            </div>
          </>
        )}

        {activeTab === 'tools' && (
          <>
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-t-text/60">{t('agentConfig.connectedTools')}</label>
                <button
                  onClick={() => { setShowAddTool(true); setAddMode('catalogue'); loadCatalogue(); }}
                  className="btn-outline-glow px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {t('common.add')}
                </button>
              </div>
              <p className="text-xs text-t-text/35 mb-3">
                Tools allow your agent to execute real actions — call APIs, compute values, access external data.
              </p>

              {config.tools.length === 0 ? (
                <div className="text-center py-8 bg-t-overlay/[0.02] rounded-xl border border-dashed border-t-overlay/10">
                  <Wrench className="w-10 h-10 mx-auto mb-2 text-t-text/15" />
                  <p className="text-sm text-t-text/30">{t('agentConfig.noTools')}</p>
                  <p className="text-xs text-t-text/20 mt-1">Add tools from the catalogue or create custom HTTP actions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {config.tools.map((tool) => (
                    <div
                      key={tool.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        tool.enabled
                          ? 'bg-t-overlay/[0.04] border-t-overlay/10'
                          : 'bg-t-overlay/[0.02] border-t-overlay/5 opacity-50'
                      }`}
                    >
                      <button onClick={() => toggleTool(tool.id)} className="flex-shrink-0">
                        {tool.enabled ? (
                          <ToggleRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-t-text/30" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-t-text/80">{tool.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                            tool.type === 'builtin' ? 'bg-blue-500/20 text-blue-300' :
                            tool.type === 'http' ? 'bg-green-500/20 text-green-300' :
                            'bg-indigo-500/20 text-indigo-300'
                          }`}>{tool.type}</span>
                        </div>
                        {tool.description && (
                          <p className="text-xs text-t-text/35 mt-0.5 truncate">{tool.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeTool(tool.id)}
                        className="p-1 rounded hover:bg-t-overlay/10 text-t-text/30 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Tool Panel */}
            {showAddTool && (
              <div className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 p-4 space-y-3 animate-fade-in-up">
                {/* Mode tabs */}
                <div className="flex gap-1 bg-t-overlay/[0.04] rounded-lg p-1">
                  {[
                    { id: 'catalogue' as const, label: 'Catalogue', icon: Package },
                    { id: 'http' as const, label: 'HTTP Action', icon: Globe },
                    { id: 'custom' as const, label: 'Custom', icon: Code },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setAddMode(m.id); if (m.id === 'catalogue') loadCatalogue(); }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                        addMode === m.id ? 'bg-blue-500/20 text-blue-300' : 'text-t-text/40 hover:text-t-text/60'
                      }`}
                    >
                      <m.icon className="w-3 h-3" />
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Catalogue mode */}
                {addMode === 'catalogue' && (
                  <div className="space-y-2">
                    {/* Category filter */}
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => { setSelectedCategory(''); loadCatalogue(); }}
                        className={`px-2 py-1 rounded text-[10px] font-medium ${
                          !selectedCategory ? 'bg-blue-500/20 text-blue-300' : 'bg-t-overlay/10 text-t-text/40'
                        }`}
                      >All</button>
                      {catalogueCategories.map(c => (
                        <button
                          key={c.name}
                          onClick={() => { setSelectedCategory(c.name); }}
                          className={`px-2 py-1 rounded text-[10px] font-medium capitalize ${
                            selectedCategory === c.name ? 'bg-blue-500/20 text-blue-300' : 'bg-t-overlay/10 text-t-text/40'
                          }`}
                        >{c.name} ({c.count})</button>
                      ))}
                    </div>
                    {catalogueLoading ? (
                      <div className="text-center py-4 text-xs text-t-text/30">Loading...</div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {catalogue
                          .filter(t => !selectedCategory || t.category === selectedCategory)
                          .filter(t => !config.tools.some(ct => ct.id === t.id))
                          .map(tool => (
                            <div
                              key={tool.id}
                              className="flex items-center gap-3 p-2 rounded-lg bg-t-overlay/[0.02] border border-t-overlay/5 hover:border-blue-500/20 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-t-text/70">{tool.name}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                                    tool.type === 'builtin' ? 'bg-blue-500/20 text-blue-300' :
                                    tool.type === 'http' ? 'bg-green-500/20 text-green-300' :
                                    'bg-indigo-500/20 text-indigo-300'
                                  }`}>{tool.type}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-t-overlay/10 text-t-text/30 capitalize">{tool.category}</span>
                                </div>
                                <p className="text-xs text-t-text/35 mt-0.5 truncate">{tool.description}</p>
                              </div>
                              <button
                                onClick={() => addFromCatalogue(tool.id)}
                                className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs hover:bg-blue-500/30 transition-colors flex-shrink-0"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* HTTP Action mode */}
                {addMode === 'http' && (
                  <div className="space-y-3">
                    <input
                      value={newToolName}
                      onChange={(e) => setNewToolName(e.target.value)}
                      className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                      placeholder="Tool name (e.g. get_weather)"
                      autoFocus
                    />
                    <input
                      value={newToolDesc}
                      onChange={(e) => setNewToolDesc(e.target.value)}
                      className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                      placeholder="Description (what the tool does)"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newToolMethod}
                        onChange={(e) => setNewToolMethod(e.target.value)}
                        className="bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10 w-28"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                      <input
                        value={newToolUrl}
                        onChange={(e) => setNewToolUrl(e.target.value)}
                        className="flex-1 bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                        placeholder="https://api.example.com/endpoint"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddTool(false)} className="flex-1 px-3 py-2 text-sm rounded-lg border border-t-overlay/10 text-t-text/50 hover:bg-t-overlay/5">
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={addHttpTool}
                        disabled={!newToolName.trim() || !newToolUrl.trim()}
                        className="flex-1 btn-gradient px-3 py-2 text-sm rounded-lg disabled:opacity-50"
                      >
                        Add HTTP Action
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom mode */}
                {addMode === 'custom' && (
                  <div className="space-y-3">
                    <input
                      value={newToolName}
                      onChange={(e) => setNewToolName(e.target.value)}
                      className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                      placeholder={t('agentConfig.toolName')}
                      autoFocus
                    />
                    <input
                      value={newToolDesc}
                      onChange={(e) => setNewToolDesc(e.target.value)}
                      className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                      placeholder={t('agentConfig.toolDesc')}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddTool(false)} className="flex-1 px-3 py-2 text-sm rounded-lg border border-t-overlay/10 text-t-text/50 hover:bg-t-overlay/5">
                        {t('common.cancel')}
                      </button>
                      <button onClick={addTool} disabled={!newToolName.trim()} className="flex-1 btn-gradient px-3 py-2 text-sm rounded-lg disabled:opacity-50">
                        {t('common.add')}
                      </button>
                    </div>
                  </div>
                )}

                {addMode === 'catalogue' && (
                  <button onClick={() => setShowAddTool(false)} className="w-full px-3 py-2 text-sm rounded-lg border border-t-overlay/10 text-t-text/50 hover:bg-t-overlay/5">
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'knowledge' && (
          <KnowledgePanel agentId={agentId} />
        )}
      </div>
    </div>
  );
}
