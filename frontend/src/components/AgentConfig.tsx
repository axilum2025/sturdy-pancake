import { useState, useEffect } from 'react';
import { Settings, Save, X, Sliders, Cpu, MessageSquare, Wrench, Plus, Trash2, ToggleLeft, ToggleRight, Thermometer, Zap } from 'lucide-react';
import { useBuilderStore } from '../store/builderStore';

interface AgentConfigProps {
  agentId: string;
  onClose?: () => void;
}

interface AgentTool {
  id: string;
  name: string;
  type: 'mcp' | 'api' | 'function';
  description?: string;
  enabled: boolean;
}

interface AgentConfigData {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  welcomeMessage: string;
  tools: AgentTool[];
}

const AVAILABLE_MODELS = [
  { id: 'openai/gpt-4.1', label: 'GPT-4.1', desc: 'Le plus puissant — raisonnement avancé' },
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', desc: 'Rapide et économique' },
  { id: 'openai/gpt-4.1-nano', label: 'GPT-4.1 Nano', desc: 'Ultra rapide, idéal pour le chat simple' },
];

export default function AgentConfig({ agentId, onClose }: AgentConfigProps) {
  const [config, setConfig] = useState<AgentConfigData>({
    model: 'openai/gpt-4.1',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'Tu es un assistant IA utile et concis.',
    welcomeMessage: 'Bonjour ! Comment puis-je vous aider ?',
    tools: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'model' | 'tools'>('prompt');
  const [showAddTool, setShowAddTool] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDesc, setNewToolDesc] = useState('');

  useEffect(() => {
    loadConfig();
  }, [agentId]);

  const loadConfig = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/agents/${agentId}`, { headers });
      if (res.ok) {
        const agent = await res.json();
        setConfig(agent.config);
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
      const userId = localStorage.getItem('userId');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userId) headers['x-user-id'] = userId;

      await fetch(`/api/agents/${agentId}/config`, {
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

  const addTool = () => {
    if (!newToolName.trim()) return;
    const tool: AgentTool = {
      id: `tool-${Date.now()}`,
      name: newToolName,
      type: 'api',
      description: newToolDesc || undefined,
      enabled: true,
    };
    setConfig({ ...config, tools: [...config.tools, tool] });
    setNewToolName('');
    setNewToolDesc('');
    setShowAddTool(false);
  };

  const removeTool = (toolId: string) => {
    setConfig({ ...config, tools: config.tools.filter((t) => t.id !== toolId) });
  };

  const toggleTool = (toolId: string) => {
    setConfig({
      ...config,
      tools: config.tools.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t)),
    });
  };

  const tabs = [
    { id: 'prompt' as const, label: 'Instructions', icon: MessageSquare },
    { id: 'model' as const, label: 'Modèle', icon: Cpu },
    { id: 'tools' as const, label: 'Outils', icon: Wrench },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-white/40">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400 glow-icon" />
          <span className="font-semibold gradient-text">Configuration</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-gradient px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-white/40 hover:text-white/60'
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
              <label className="block text-sm font-medium text-white/60 mb-2">
                Instructions système
              </label>
              <p className="text-xs text-white/35 mb-2">
                Décrivez le rôle, le ton et les règles de votre agent.
              </p>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className="w-full bg-white/[0.04] text-white/90 px-4 py-3 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10"
                rows={8}
                placeholder="Tu es un assistant qui..."
              />
            </div>

            {/* Welcome Message */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Message d'accueil
              </label>
              <input
                value={config.welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                className="w-full bg-white/[0.04] text-white/90 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10"
                placeholder="Bonjour ! Comment puis-je vous aider ?"
              />
            </div>
          </>
        )}

        {activeTab === 'model' && (
          <>
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">
                Modèle IA
              </label>
              <div className="space-y-2">
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setConfig({ ...config, model: m.id })}
                    className={`w-full p-3 rounded-xl text-left transition-all ${
                      config.model === m.id
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-white/[0.04] border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className={`w-4 h-4 ${config.model === m.id ? 'text-blue-400' : 'text-white/40'}`} />
                        <span className={`text-sm font-medium ${config.model === m.id ? 'text-blue-300' : 'text-white/70'}`}>{m.label}</span>
                      </div>
                      {config.model === m.id && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                    </div>
                    <p className="text-xs text-white/35 mt-1 pl-6">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                  <Thermometer className="w-3.5 h-3.5" />
                  Température
                </label>
                <span className="text-sm font-mono text-blue-400">{config.temperature.toFixed(1)}</span>
              </div>
              <p className="text-xs text-white/35 mb-2">
                Basse = plus déterministe, Haute = plus créatif
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
              <div className="flex justify-between text-[10px] text-white/25 mt-1">
                <span>Précis</span>
                <span>Créatif</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                  <Zap className="w-3.5 h-3.5" />
                  Tokens max (réponse)
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
              <div className="flex justify-between text-[10px] text-white/25 mt-1">
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
                <label className="text-sm font-medium text-white/60">Outils connectés</label>
                <button
                  onClick={() => setShowAddTool(true)}
                  className="btn-outline-glow px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Ajouter
                </button>
              </div>
              <p className="text-xs text-white/35 mb-3">
                Les outils permettent à votre agent d'interagir avec des services externes.
              </p>

              {config.tools.length === 0 ? (
                <div className="text-center py-8 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                  <Wrench className="w-10 h-10 mx-auto mb-2 text-white/15" />
                  <p className="text-sm text-white/30">Aucun outil connecté</p>
                  <p className="text-xs text-white/20 mt-1">Ajoutez des APIs, MCP servers ou fonctions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {config.tools.map((tool) => (
                    <div
                      key={tool.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        tool.enabled
                          ? 'bg-white/[0.04] border-white/10'
                          : 'bg-white/[0.02] border-white/5 opacity-50'
                      }`}
                    >
                      <button onClick={() => toggleTool(tool.id)} className="flex-shrink-0">
                        {tool.enabled ? (
                          <ToggleRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-white/30" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white/80">{tool.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 uppercase">{tool.type}</span>
                        </div>
                        {tool.description && (
                          <p className="text-xs text-white/35 mt-0.5 truncate">{tool.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeTool(tool.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Tool Modal */}
            {showAddTool && (
              <div className="bg-white/[0.04] rounded-xl border border-white/10 p-4 space-y-3 animate-fade-in-up">
                <h4 className="text-sm font-medium text-white/70">Nouvel outil</h4>
                <input
                  value={newToolName}
                  onChange={(e) => setNewToolName(e.target.value)}
                  className="w-full bg-white/[0.04] text-white/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10"
                  placeholder="Nom de l'outil"
                  autoFocus
                />
                <input
                  value={newToolDesc}
                  onChange={(e) => setNewToolDesc(e.target.value)}
                  className="w-full bg-white/[0.04] text-white/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-white/10"
                  placeholder="Description (optionnel)"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowAddTool(false)} className="flex-1 px-3 py-2 text-sm rounded-lg border border-white/10 text-white/50 hover:bg-white/5">
                    Annuler
                  </button>
                  <button onClick={addTool} disabled={!newToolName.trim()} className="flex-1 btn-gradient px-3 py-2 text-sm rounded-lg disabled:opacity-50">
                    Ajouter
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
