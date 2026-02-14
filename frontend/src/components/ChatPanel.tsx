import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Loader2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  RotateCw,
  AlertCircle,
  Command,
  Search,
  Settings,
  Star,
  HelpCircle,
  Wrench,
  Key,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Shield,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { copilotChatStream, getCopilotStatus, CopilotMessage, saveFile, getConversations, getConversationMessages, getAgent, listCredentials, saveCredential, deleteCredential, CredentialEntry } from '../services/api';
import { useStudioStore } from '../store/studioStore';

// ============================================================
// Types
// ============================================================

interface AgentTask {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
  filePath?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isGreeting?: boolean;
  tasks?: AgentTask[];
}

// ============================================================
// Helpers: extract code blocks from markdown
// ============================================================

interface ExtractedFile {
  filename: string;
  language: string;
  code: string;
}

const FILENAME_RE =
  /(?:^|\n)(?:(?:#+\s*)?(?:\*\*)?(?:Fichier|File|Créer|Create|→|📄|`)?[:\s]*)?`?([a-zA-Z0-9_\-/.]+\.[a-zA-Z]{1,8})`?\s*(?:\*\*)?$/;

function extractCodeBlocks(markdown: string): ExtractedFile[] {
  const blocks: ExtractedFile[] = [];
  const codeBlockRe = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRe.exec(markdown)) !== null) {
    const lang = match[1] || 'txt';
    const code = match[2].trimEnd();

    const before = markdown.slice(Math.max(0, match.index - 200), match.index);
    const lines = before.split('\n').reverse();

    let filename = '';
    for (const line of lines) {
      const m = line.match(FILENAME_RE);
      if (m) {
        filename = m[1];
        break;
      }
    }

    if (!filename) {
      const firstLine = code.split('\n')[0] ?? '';
      const commentFile = firstLine.match(
        /(?:\/\/|#|{\/\*|<!--)\s*([a-zA-Z0-9_\-/.]+\.\w{1,8})/,
      );
      if (commentFile) filename = commentFile[1];
    }

    if (!filename) {
      const ext: Record<string, string> = {
        tsx: 'tsx', jsx: 'jsx', ts: 'ts', js: 'js',
        css: 'css', html: 'html', json: 'json', py: 'py',
      };
      const idx = blocks.length + 1;
      filename = `src/generated-${idx}.${ext[lang] || lang}`;
    }

    if (!filename.includes('/')) filename = `src/${filename}`;

    blocks.push({ filename, language: lang, code });
  }

  return blocks;
}

// ============================================================
// Sub-components: Agent task UI
// ============================================================

function AgentTaskIcon({ status }: { status: AgentTask['status'] }) {
  switch (status) {
    case 'pending':
      return <Circle className="w-3.5 h-3.5 text-t-text/30" />;
    case 'running':
      return <RotateCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    case 'done':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  }
}

function AgentTaskItem({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pl-1 py-0.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group hover:bg-t-overlay/5 rounded px-1 py-0.5 transition-colors"
      >
        <AgentTaskIcon status={task.status} />
        <span
          className={`text-xs flex-1 ${
            task.status === 'done'
              ? 'text-t-text/50'
              : task.status === 'running'
              ? 'text-blue-300'
              : task.status === 'error'
              ? 'text-red-300'
              : 'text-t-text/60'
          }`}
        >
          {task.label}
        </span>
        {task.detail &&
          (expanded ? (
            <ChevronDown className="w-3 h-3 text-t-text/30" />
          ) : (
            <ChevronRight className="w-3 h-3 text-t-text/30" />
          ))}
      </button>
      {expanded && task.detail && (
        <div className="mt-1 ml-5 text-[11px] text-t-text/40 bg-black/20 rounded px-2 py-1 font-mono whitespace-pre-wrap break-all">
          {task.detail}
        </div>
      )}
    </div>
  );
}

function AgentTaskList({
  tasks,
  collapsed,
  onToggle,
}: {
  tasks: AgentTask[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const done = tasks.filter((tk) => tk.status === 'done').length;
  const total = tasks.length;
  const allDone = done === total && total > 0;
  const runningTask = tasks.find((tk) => tk.status === 'running');

  return (
    <div className="mt-2 rounded-lg bg-t-overlay/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-t-overlay/5 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-t-text/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-t-text/40" />
        )}
        {!allDone && runningTask ? (
          <span className="text-xs font-medium text-blue-300 flex items-center gap-1.5">
            <RotateCw className="w-3 h-3 animate-spin" />
            {runningTask.label}
          </span>
        ) : (
          <span className="text-xs font-medium text-t-text/70">
            {allDone ? t('chat.tasksDone') : t('chat.tasksRunning')}
          </span>
        )}
        <span className="ml-auto text-[10px] text-t-text/30 tabular-nums">
          {done}/{total}
        </span>
        <div className="w-12 h-1 rounded-full bg-t-overlay/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              allDone ? 'bg-green-400' : 'bg-blue-400'
            }`}
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 space-y-0.5">
          {tasks.map((tk) => (
            <AgentTaskItem key={tk.id} task={tk} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Credential Modal (appears when GiLo AI requests keys or user opens it)
// ============================================================

const COMMON_SERVICES = [
  { id: 'openai', label: 'OpenAI', fields: ['API Key'] },
  { id: 'anthropic', label: 'Anthropic', fields: ['API Key'] },
  { id: 'stripe', label: 'Stripe', fields: ['Secret Key', 'Publishable Key'] },
  { id: 'google', label: 'Google', fields: ['API Key', 'Client ID', 'Client Secret'] },
  { id: 'slack', label: 'Slack', fields: ['Bot Token', 'Webhook URL'] },
  { id: 'notion', label: 'Notion', fields: ['Integration Token'] },
  { id: 'github', label: 'GitHub', fields: ['Personal Access Token'] },
  { id: 'custom', label: 'Custom', fields: [] },
];

function CredentialModal({
  agentId,
  onClose,
  requestedKeys,
}: {
  agentId: string;
  onClose: () => void;
  requestedKeys?: string[];
}) {
  const { t } = useTranslation();
  const [credentials, setCredentials] = useState<CredentialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedService, setSelectedService] = useState('custom');
  const [customServiceName, setCustomServiceName] = useState('');
  const [credKey, setCredKey] = useState('');
  const [credValue, setCredValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(!!requestedKeys?.length);

  const loadCreds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listCredentials(agentId);
      setCredentials(data.credentials);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { loadCreds(); }, [loadCreds]);

  // Pre-fill from requested keys
  useEffect(() => {
    if (requestedKeys?.length) {
      const key = requestedKeys[0];
      // Try to match service
      const svc = COMMON_SERVICES.find(s =>
        key.toLowerCase().includes(s.id) || s.label.toLowerCase().includes(key.toLowerCase().split(' ')[0])
      );
      if (svc) {
        setSelectedService(svc.id);
        setCredKey(svc.fields[0] || key);
      } else {
        setSelectedService('custom');
        setCredKey(key);
      }
    }
  }, [requestedKeys]);

  const handleSave = async () => {
    const service = selectedService === 'custom' ? customServiceName.trim() : selectedService;
    if (!service || !credKey.trim() || !credValue.trim()) {
      setError(t('credentials.fillAllFields', 'Remplissez tous les champs'));
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await saveCredential(agentId, service, credKey.trim(), credValue.trim());
      setSuccess(t('credentials.saved', 'Credential sauvegardé'));
      setTimeout(() => setSuccess(null), 3000);
      setCredKey('');
      setCredValue('');
      setCustomServiceName('');
      setShowAdd(false);
      await loadCreds();
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCredential(agentId, id);
      await loadCreds();
    } catch { setError('Erreur suppression'); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] md:max-h-[80vh] z-50 flex flex-col glass-strong rounded-2xl border border-t-overlay/10 shadow-2xl animate-fade-in-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-t-overlay/10">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-t-text">{t('credentials.title', 'Clés & Credentials')}</h2>
            <Lock className="w-3 h-3 text-green-400" />
            <span className="text-[9px] text-green-400/60 font-mono">AES-256</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-t-overlay/10 text-t-text/50 hover:text-t-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Requested keys banner */}
        {requestedKeys && requestedKeys.length > 0 && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300">
              <Key className="w-3 h-3 inline mr-1" />
              GiLo AI a besoin de : <strong>{requestedKeys.join(', ')}</strong>
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Error/Success */}
          {error && (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">{error}</div>
          )}
          {success && (
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300">{success}</div>
          )}

          {/* Add form */}
          {showAdd ? (
            <div className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 p-4 space-y-3">
              {/* Service grid */}
              <div>
                <label className="block text-xs text-t-text/50 mb-2">{t('credentials.service', 'Service')}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {COMMON_SERVICES.map(svc => (
                    <button
                      key={svc.id}
                      onClick={() => {
                        setSelectedService(svc.id);
                        if (svc.fields.length > 0) setCredKey(svc.fields[0]);
                      }}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-all border ${
                        selectedService === svc.id
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                          : 'bg-t-overlay/[0.02] border-t-overlay/5 text-t-text/40 hover:text-t-text/60'
                      }`}
                    >
                      <span className="text-[10px] font-medium">{svc.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedService === 'custom' && (
                <input
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                  placeholder="Nom du service"
                />
              )}

              <input
                value={credKey}
                onChange={(e) => setCredKey(e.target.value)}
                className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                placeholder="Nom de la clé (ex: api_key)"
              />

              <div className="relative">
                <input
                  type={showValue ? 'text' : 'password'}
                  value={credValue}
                  onChange={(e) => setCredValue(e.target.value)}
                  className="w-full bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 pr-10 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
                  placeholder="sk-... ou valeur secrète"
                />
                <button
                  onClick={() => setShowValue(!showValue)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-t-text/30 hover:text-t-text/60"
                >
                  {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 px-3 py-2 text-sm rounded-lg border border-t-overlay/10 text-t-text/50 hover:bg-t-overlay/5">
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !credKey.trim() || !credValue.trim()}
                  className="flex-1 btn-gradient px-3 py-2 text-sm rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <RotateCw className="w-3 h-3 animate-spin" />}
                  <Lock className="w-3 h-3" />
                  {t('credentials.saveEncrypted', 'Sauvegarder')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full btn-outline-glow px-3 py-2 rounded-lg text-xs flex items-center justify-center gap-2"
            >
              <Plus className="w-3 h-3" />
              {t('credentials.add', 'Ajouter une clé')}
            </button>
          )}

          {/* Existing credentials */}
          {loading ? (
            <div className="text-center py-4 text-xs text-t-text/30 animate-pulse">Chargement...</div>
          ) : credentials.length === 0 && !showAdd ? (
            <div className="text-center py-6 bg-t-overlay/[0.02] rounded-xl border border-dashed border-t-overlay/10">
              <Key className="w-8 h-8 mx-auto mb-2 text-t-text/15" />
              <p className="text-sm text-t-text/30">{t('credentials.empty', 'Aucune clé stockée')}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {credentials.map((cred) => (
                <div key={cred.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-t-overlay/[0.04] border border-t-overlay/10">
                  <Key className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-t-text/80 capitalize">{cred.service}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300/70">{cred.key}</span>
                    </div>
                    <p className="text-[10px] text-t-text/35 font-mono mt-0.5">{cred.maskedValue}</p>
                  </div>
                  <button onClick={() => handleDelete(cred.id)} className="p-1 rounded text-t-text/20 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Slash commands definition
// ============================================================

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: typeof Command;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/review', label: 'Review', description: 'Analyse la config et suggère des améliorations', icon: Search },
  { command: '/optimize', label: 'Optimize', description: 'Optimise le system prompt automatiquement', icon: Star },
  { command: '/suggest-tools', label: 'Suggest Tools', description: 'Suggère des outils pertinents', icon: Wrench },
  { command: '/status', label: 'Status', description: 'Résumé complet de l\'état de l\'agent', icon: Settings },
  { command: '/help', label: 'Help', description: 'Liste toutes les commandes disponibles', icon: HelpCircle },
];

// ============================================================
// Config score component
// ============================================================

function ConfigScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const bgColor = score >= 80 ? 'bg-green-400/10' : score >= 50 ? 'bg-amber-400/10' : 'bg-red-400/10';
  const borderColor = score >= 80 ? 'border-green-400/20' : score >= 50 ? 'border-amber-400/20' : 'border-red-400/20';

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${color} ${bgColor} border ${borderColor}`}>
      <div className="w-8 h-1 rounded-full bg-black/20 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            score >= 80 ? 'bg-green-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span>{score}%</span>
    </div>
  );
}

// ============================================================
// Slash command autocomplete component
// ============================================================

function SlashCommandMenu({
  filter,
  onSelect,
  visible,
}: {
  filter: string;
  onSelect: (cmd: string) => void;
  visible: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filtered = SLASH_COMMANDS.filter(
    (c) =>
      c.command.toLowerCase().includes(filter.toLowerCase()) ||
      c.label.toLowerCase().includes(filter.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 bg-t-bg/95 backdrop-blur-xl border border-t-overlay/20 rounded-lg shadow-xl overflow-hidden z-50">
      <div className="px-2 py-1.5 border-b border-t-overlay/10">
        <span className="text-[10px] text-t-text/40 uppercase tracking-wider font-medium">Commandes</span>
      </div>
      {filtered.map((cmd, i) => {
        const Icon = cmd.icon;
        return (
          <button
            key={cmd.command}
            onClick={() => onSelect(cmd.command)}
            onMouseEnter={() => setSelectedIndex(i)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors ${
              i === selectedIndex ? 'bg-blue-500/10 text-blue-300' : 'text-t-text/70 hover:bg-t-overlay/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium">{cmd.command}</span>
              <span className="text-[10px] text-t-text/40 ml-2">{cmd.description}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export default function ChatPanel() {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [copilotAvailable, setCopilotAvailable] = useState<boolean | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});
  const [configApplied, setConfigApplied] = useState(false);
  const [configScore, setConfigScore] = useState<number | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [requestedCredKeys, setRequestedCredKeys] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const autoGreetedRef = useRef(false);
  const { projectId, triggerFileRefresh, triggerConfigRefresh, addTimelineEvent, updateTimelineEvent } = useStudioStore();

  // Load last conversation history on mount
  useEffect(() => {
    if (!projectId || projectId === 'new-project') return;
    (async () => {
      try {
        const { conversations } = await getConversations(projectId, 1);
        if (conversations.length === 0) return;
        const latestConv = conversations[0];
        conversationIdRef.current = latestConv.id;
        const { messages: histMsgs } = await getConversationMessages(projectId, latestConv.id);
        if (histMsgs.length === 0) return;
        const restored: ChatMessage[] = histMsgs.map((m) => ({
          id: `hist-${m.id}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
        }));
        setMessages(restored);
      } catch {
        // No history available — that's fine
      }
    })();
  }, [projectId]);

  // Auto-greet: if the agent is brand-new (default config) and no history, insert a welcome message
  useEffect(() => {
    if (!projectId || autoGreetedRef.current) return;
    // Wait until messages have been loaded (next tick)
    const timer = setTimeout(async () => {
      if (messages.length > 0 || autoGreetedRef.current) return;
      try {
        const agent = await getAgent(projectId);
        const defaultPrompt = 'Tu es un assistant IA utile et concis';
        const isNew = !agent.config?.systemPrompt || agent.config.systemPrompt.startsWith(defaultPrompt);
        if (isNew) {
          autoGreetedRef.current = true;
          const welcome: ChatMessage = {
            id: `greet-${Date.now()}`,
            role: 'assistant',
            content: t('chat.autoGreet'),
            timestamp: new Date(),
            isGreeting: true,
          };
          setMessages([welcome]);
        }
      } catch {
        // Agent fetch failed — skip greeting
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [projectId, messages.length]);

  useEffect(() => {
    getCopilotStatus()
      .then((status) => setCopilotAvailable(status.available))
      .catch(() => setCopilotAvailable(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateId = () =>
    `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const mkTaskId = () =>
    `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // ---- helpers ----

  const updateTasks = useCallback(
    (msgId: string, updater: (tasks: AgentTask[]) => AgentTask[]) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, tasks: updater(m.tasks || []) } : m,
        ),
      );
    },
    [],
  );

  const saveExtractedFiles = useCallback(
    async (content: string, msgId: string) => {
      if (!projectId) return;
      const files = extractCodeBlocks(content);
      if (files.length === 0) return;

      const fileTasks: AgentTask[] = files.map((f) => ({
        id: mkTaskId(),
        label: `Créer ${f.filename}`,
        status: 'pending' as const,
        filePath: f.filename,
        detail: `${f.language} · ${f.code.split('\n').length} lignes`,
      }));

      updateTasks(msgId, (prev) => [...prev, ...fileTasks]);

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const tid = fileTasks[i].id;

        updateTasks(msgId, (tasks) =>
          tasks.map((t) => (t.id === tid ? { ...t, status: 'running' } : t)),
        );

        // Timeline: file creation started
        addTimelineEvent({
          id: `tl-${tid}`,
          type: 'file-create',
          message: `Créer ${f.filename}`,
          timestamp: new Date(),
          status: 'running',
          detail: `${f.language} · ${f.code.split('\n').length} lignes`,
        });

        try {
          await saveFile(projectId, f.filename, f.code);
          updateTasks(msgId, (tasks) =>
            tasks.map((t) => (t.id === tid ? { ...t, status: 'done' } : t)),
          );
          // Timeline: file created
          updateTimelineEvent(`tl-${tid}`, { status: 'completed' });
        } catch (err: any) {
          updateTasks(msgId, (tasks) =>
            tasks.map((t) =>
              t.id === tid
                ? { ...t, status: 'error', detail: err.message }
                : t,
            ),
          );
          // Timeline: file error
          updateTimelineEvent(`tl-${tid}`, { status: 'error', detail: err.message });
        }
      }

      triggerFileRefresh();
    },
    [projectId, updateTasks, triggerFileRefresh, addTimelineEvent, updateTimelineEvent],
  );

  // Step label mapping (step id → i18n key)
  // language_detect is intentionally excluded — detection runs in backend only, no UI step
  const stepLabels: Record<string, string> = {
    load_context: 'chat.steps.loadContext',
    thinking: 'chat.steps.thinking',
    build_prompt: 'chat.steps.buildPrompt',
    call_llm: 'chat.steps.callLlm',
    save_conversation: 'chat.steps.saveConversation',
    extract_config: 'chat.steps.extractConfig',
    apply_config: 'chat.steps.applyConfig',
    save_credentials: 'chat.steps.saveCredentials',
  };

  // Hidden steps that should not appear in the task list
  const hiddenSteps = new Set(['language_detect']);

  // ---- SSE reader ----

  const readCopilotStream = useCallback(
    async (response: Response, assistantMsgId: string) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let suppressingConfig = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const payload = trimmed.slice(6);
            if (payload === '[DONE]') break;

            try {
              const chunk = JSON.parse(payload);
              if (chunk.type === 'content' && chunk.content) {
                fullContent += chunk.content;
                // Suppress the <!--GILO_APPLY_CONFIG:...--> and <!--GILO_SAVE_CREDENTIALS:...--> blocks from display
                if (suppressingConfig) continue;
                if (/<!--\s*GILO_APPLY_CONFIG\s*:/.test(fullContent) || /<!--\s*GILO_SAVE_CREDENTIALS\s*:/.test(fullContent)) {
                  suppressingConfig = true;
                  const cleanContent = fullContent
                    .replace(/<!--\s*GILO_APPLY_CONFIG\s*:[\s\S]*$/g, '')
                    .replace(/<!--\s*GILO_SAVE_CREDENTIALS\s*:[\s\S]*$/g, '')
                    .trim();
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: cleanContent }
                        : m,
                    ),
                  );
                  continue;
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + chunk.content }
                      : m,
                  ),
                );
              } else if (chunk.type === 'tool_calls' && chunk.tools) {
                // Show tool calls in the assistant message
                const toolInfo = chunk.tools
                  .map((tc: any) => `🔧 Calling **${tc.name}**...`)
                  .join('\n');
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + toolInfo + '\n\n' }
                      : m,
                  ),
                );
              } else if (chunk.type === 'tool_result') {
                const statusIcon = chunk.success ? '✅' : '❌';
                const resultPreview = chunk.result?.slice(0, 200) || '';
                const toolResult = `${statusIcon} **${chunk.name}** (${chunk.durationMs || 0}ms)\n\`\`\`\n${resultPreview}\n\`\`\`\n\n`;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + toolResult }
                      : m,
                  ),
                );
              } else if (chunk.type === 'citations' && chunk.citations) {
                // Store citations for display
                const citationText = chunk.citations
                  .map((c: any) => `📄 ${c.filename} (chunk ${c.chunkIndex})`)
                  .join('\n');
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + citationText + '\n\n' }
                      : m,
                  ),
                );
              } else if (chunk.type === 'conversation' && chunk.conversationId) {
                conversationIdRef.current = chunk.conversationId;
              } else if (chunk.type === 'config_score' && chunk.score !== undefined) {
                setConfigScore(chunk.score);
              } else if (chunk.type === 'config_applied' && chunk.fields) {
                triggerConfigRefresh();
                setConfigApplied(true);
                setTimeout(() => setConfigApplied(false), 4000);
                // Bump config score after successful apply
                setConfigScore((prev) => prev !== null ? Math.min(100, prev + 20) : 60);
              } else if (chunk.type === 'credentials_saved' && chunk.count) {
                // Credentials saved securely on the backend
                setConfigApplied(true);
                setTimeout(() => setConfigApplied(false), 4000);
              } else if (chunk.type === 'credential_request' && chunk.keys) {
                // GiLo AI is requesting the user to provide API keys
                setRequestedCredKeys(chunk.keys as string[]);
                setShowCredentialModal(true);
              } else if (chunk.type === 'step' && chunk.step) {
                // Granular progress steps from the backend
                const stepId = chunk.step as string;
                // Skip hidden steps (e.g. language_detect)
                if (hiddenSteps.has(stepId)) continue;
                const stepStatus = chunk.status as 'running' | 'done' | 'error';
                const stepDetail = chunk.detail as string | undefined;
                const label = stepLabels[stepId] ? t(stepLabels[stepId]) : stepId;
                const taskKey = `step-${stepId}`;

                updateTasks(assistantMsgId, (tasks) => {
                  const existing = tasks.find((tk) => tk.id === taskKey);
                  if (existing) {
                    // Update the existing step's status
                    return tasks.map((tk) =>
                      tk.id === taskKey
                        ? { ...tk, status: stepStatus, detail: stepDetail || tk.detail }
                        : tk,
                    );
                  } else {
                    // Add new step task
                    return [
                      ...tasks,
                      { id: taskKey, label, status: stepStatus, detail: stepDetail },
                    ];
                  }
                });
              } else if (chunk.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content:
                            m.content + `\n\n⚠️ Erreur: ${chunk.error}`,
                          isStreaming: false,
                        }
                      : m,
                  ),
                );
              }
            } catch {
              // ignore malformed JSON
            }
          }
        }
      } finally {
        // Strip <!--GILO_APPLY_CONFIG:...--> and <!--GILO_SAVE_CREDENTIALS:...--> from displayed content and mark done
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: m.content
                    .replace(/<!--\s*GILO_APPLY_CONFIG\s*:[\s\S]*?-->/g, '')
                    .replace(/<!--\s*GILO_SAVE_CREDENTIALS\s*:[\s\S]*?-->/g, '')
                    // Also strip incomplete blocks (truncated before -->)
                    .replace(/<!--\s*GILO_APPLY_CONFIG\s*:[\s\S]*$/g, '')
                    .replace(/<!--\s*GILO_SAVE_CREDENTIALS\s*:[\s\S]*$/g, '')
                    .trim(),
                  isStreaming: false,
                }
              : m,
          ),
        );
      }
    },
    [triggerConfigRefresh, updateTasks, t, stepLabels],
  );

  // ---- Send ----

  const handleSend = async () => {
    if (!message.trim()) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    const assistantMsgId = generateId();
    const analyseTaskId = 'step-analysing';
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      tasks: [
        { id: analyseTaskId, label: t('chat.steps.analysing'), status: 'running' },
      ],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setMessage('');
    setIsTyping(true);

    // Timeline: user message
    addTimelineEvent({
      id: `tl-${userMsg.id}`,
      type: 'planning',
      message: message.length > 80 ? message.slice(0, 80) + '…' : message,
      timestamp: new Date(),
      status: 'completed',
    });
    // Timeline: analyse
    addTimelineEvent({
      id: `tl-${analyseTaskId}`,
      type: 'planning',
      message: t('chat.steps.analysing'),
      timestamp: new Date(),
      status: 'running',
    });

    const conversationHistory: CopilotMessage[] = messages
      .filter((m) => !m.isStreaming)
      .map((m) => ({ role: m.role, content: m.content }));
    conversationHistory.push({ role: 'user', content: message });

    try {
      abortControllerRef.current = new AbortController();

      // Mark analysing done, steps will be added dynamically by SSE step events
      updateTasks(assistantMsgId, (tasks) =>
        tasks.map((tk) => (tk.id === analyseTaskId ? { ...tk, status: 'done' } : tk)),
      );

      // Timeline: analyse done
      updateTimelineEvent(`tl-${analyseTaskId}`, { status: 'completed' });

      const response = await copilotChatStream({
        messages: conversationHistory,
        stream: true,
        conversationId: conversationIdRef.current,
        uiLanguage: i18n.language?.split('-')[0] || 'fr',
        projectContext: projectId
          ? { projectId, techStack: ['React', 'Tailwind', 'Vite'] }
          : undefined,
      });

      await readCopilotStream(response, assistantMsgId);

      updateTasks(assistantMsgId, (tasks) =>
        tasks.map((tk) =>
          tk.status === 'running' ? { ...tk, status: 'done' } : tk,
        ),
      );

      // Get final content & extract files
      const finalContent = await new Promise<string>((resolve) => {
        setMessages((prev) => {
          const m = prev.find((x) => x.id === assistantMsgId);
          resolve(m?.content || '');
          return prev;
        });
      });

      if (finalContent) {
        await saveExtractedFiles(finalContent, assistantMsgId);
      }
    } catch (error: any) {
      console.error('Copilot error:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `❌ ${t('chat.connectionError')}: ${error.message}`,
                isStreaming: false,
              }
            : m,
        ),
      );
      updateTasks(assistantMsgId, (tasks) =>
        tasks.map((t) =>
          t.status === 'running' ? { ...t, status: 'error' } : t,
        ),
      );

      // Timeline: error
      addTimelineEvent({
        id: `tl-err-${Date.now()}`,
        type: 'error',
        message: `Erreur: ${error.message}`,
        timestamp: new Date(),
        status: 'error',
      });
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsTyping(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  };

  const handleCopy = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const quickActions = [
    {
      label: t('chat.quickSupport'),
      prompt: t('chat.quickSupportPrompt'),
    },
    {
      label: t('chat.quickAnalyse'),
      prompt: t('chat.quickAnalysePrompt'),
    },
    {
      label: t('chat.quickDev'),
      prompt: t('chat.quickDevPrompt'),
    },
    {
      label: t('chat.quickRag'),
      prompt: t('chat.quickRagPrompt'),
    },
  ];

  return (
    <div className="h-full flex flex-col relative">
      {/* Config applied toast */}
      {configApplied && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in-up flex items-center gap-2">
          <span>✅</span> Configuration appliquée avec succès !
        </div>
      )}
      {/* Header */}
      <div className="px-4 py-3 border-b border-transparent flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold gradient-text">GiLo AI</h2>
          {configScore !== null && <ConfigScoreBadge score={configScore} />}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              copilotAvailable === true
                ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                : copilotAvailable === false
                ? 'bg-red-400'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-xs text-t-text/40">
            {copilotAvailable === true
              ? t('chat.copilotConnected')
              : copilotAvailable === false
              ? t('chat.copilotOffline')
              : t('chat.copilotChecking')}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4 min-h-0">
        {/* Welcome section: show when no real messages (only greeting or empty) */}
        {(messages.length === 0 || (messages.length === 1 && messages[0].isGreeting)) && (
          <div className="text-center mt-8 animate-fade-in-up">
            <p className="text-t-text/60 mb-1">
              {t('chat.welcome')}{' '}
              <strong className="gradient-text">GiLo AI</strong>
            </p>
            <p className="text-sm text-t-text/40 mb-4">
              {t('chat.describeAgent')}
            </p>
            {/* Show the greeting message inline */}
            {messages.length === 1 && messages[0].isGreeting && (
              <div className="max-w-md mx-auto mb-4 text-left">
                <div className="chat-markdown text-t-text text-sm prose prose-invert prose-sm max-w-none prose-a:text-blue-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {messages[0].content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => setMessage(action.prompt)}
                  className="glass-card bg-t-overlay/5 hover:bg-t-overlay/10 border border-t-overlay/10 hover:border-t-overlay/20 rounded-lg px-3 py-2 text-xs text-t-text/70 hover:text-t-text transition-all duration-200 text-left"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Regular messages (skip greeting if it's displayed above) */}
        {messages.filter((m) => !(m.isGreeting && messages.length === 1)).length > 0 &&
          !(messages.length === 1 && messages[0].isGreeting) &&
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex animate-fade-in-up ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* Bubble */}
              <div
                className={`min-w-0 group ${
                  msg.role === 'user' ? 'max-w-[85%]' : 'w-full relative'
                }`}
              >
                <div
                  className={`rounded-lg overflow-hidden ${
                    msg.role === 'user'
                      ? 'p-3 glass-card bg-blue-500/10 border-blue-500/20'
                      : 'py-1'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="chat-markdown text-t-text text-sm prose prose-invert prose-sm max-w-none overflow-hidden prose-p:text-t-text prose-strong:text-t-text prose-li:text-t-text prose-headings:text-t-text prose-pre:bg-black/40 prose-pre:border prose-pre:border-t-overlay/10 prose-pre:rounded-lg prose-pre:max-w-full prose-pre:text-xs prose-code:text-indigo-300 prose-code:break-words prose-a:text-blue-400 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:scrollbar-none [&_pre_code]:whitespace-pre [&_pre_code]:block [&_pre_code]:p-3 [&_hr]:hidden [&_::-webkit-scrollbar]:hidden">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || (msg.isStreaming ? '...' : '')}
                      </ReactMarkdown>
                      {msg.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-1" />
                      )}
                    </div>
                  ) : (
                    <p className="text-t-text text-sm">{msg.content}</p>
                  )}
                </div>

                {/* Agent tasks */}
                {msg.tasks && msg.tasks.length > 0 && (
                  <AgentTaskList
                    tasks={msg.tasks}
                    collapsed={!!collapsedTasks[msg.id]}
                    onToggle={() =>
                      setCollapsedTasks((prev) => ({
                        ...prev,
                        [msg.id]: !prev[msg.id],
                      }))
                    }
                  />
                )}

                {/* Copy button */}
                {msg.role === 'assistant' &&
                  !msg.isStreaming &&
                  msg.content && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="absolute -right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-t-overlay/10 hover:bg-t-overlay/20 border border-t-overlay/10"
                      title={t('common.copy')}
                    >
                      {copiedMessageId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-t-text/50" />
                      )}
                    </button>
                  )}
              </div>
            </div>
          ))}

        {/* Smart suggestion chips - show after conversation when not typing */}
        {!isTyping && messages.length > 1 && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.isStreaming && (
          <div className="flex flex-wrap gap-1.5 animate-fade-in-up mt-1">
            {configApplied && (
              <>
                <button
                  onClick={() => setMessage('/review')}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                >
                  {t('chat.suggestReview')}
                </button>
                <button
                  onClick={() => setMessage(t('chat.suggestTestPrompt'))}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                >
                  {t('chat.suggestTest')}
                </button>
              </>
            )}
            <button
              onClick={() => setMessage('/suggest-tools')}
              className="text-[10px] px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
            >
              {t('chat.suggestTools')}
            </button>
            <button
              onClick={() => setMessage('/status')}
              className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              {t('chat.suggestStatus')}
            </button>
          </div>
        )}

        {isTyping && messages[messages.length - 1]?.content === '' && (
          <div className="flex animate-fade-in-up justify-start">
            <div className="glass-card bg-indigo-500/10 border-indigo-500/20 px-4 py-3 rounded-lg">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input – Gemini-style on mobile */}
      <div className="flex-shrink-0 md:p-4 md:border-t md:border-t-overlay/10 p-0 border-t-0">
        {isTyping && (
          <button
            onClick={handleStop}
            className="w-full mb-2 py-1.5 rounded-lg text-xs text-t-text/60 hover:text-t-text bg-t-overlay/5 hover:bg-t-overlay/10 border border-t-overlay/10 transition-all mx-auto md:mx-0 px-3 md:px-0"
          >
            ■ {t('chat.stopGeneration')}
          </button>
        )}
        <div className="relative md:rounded-lg rounded-t-2xl rounded-b-none bg-t-overlay/[0.04] md:bg-transparent border-t border-t-overlay/[0.04] md:border-t-0 px-3 pt-2 landscape-panel pb-[env(safe-area-inset-bottom,8px)] md:p-0">
          {/* Slash command autocomplete */}
          <SlashCommandMenu
            filter={slashFilter}
            visible={showSlashMenu}
            onSelect={(cmd) => {
              setMessage(cmd + ' ');
              setShowSlashMenu(false);
              setSlashFilter('');
            }}
          />
          <textarea
            value={message}
            onChange={(e) => {
              const val = e.target.value;
              setMessage(val);
              // Detect slash command typing
              if (val.startsWith('/') && !val.includes(' ')) {
                setShowSlashMenu(true);
                setSlashFilter(val);
              } else {
                setShowSlashMenu(false);
                setSlashFilter('');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setShowSlashMenu(false);
                handleSend();
              } else if (e.key === 'Escape') {
                setShowSlashMenu(false);
              } else if (e.key === 'Tab' && showSlashMenu) {
                e.preventDefault();
                // Auto-complete first matching command
                const filtered = SLASH_COMMANDS.filter(
                  (c) => c.command.toLowerCase().includes(slashFilter.toLowerCase()),
                );
                if (filtered.length > 0) {
                  setMessage(filtered[0].command + ' ');
                  setShowSlashMenu(false);
                  setSlashFilter('');
                }
              }
            }}
            placeholder={t('chat.placeholder')}
            rows={4}
            className="w-full text-t-text px-12 py-3 resize-none md:input-futuristic md:rounded-lg rounded-xl bg-transparent !border-none outline-none focus:outline-none focus:ring-0 focus:border-none transition-all placeholder:text-t-text/25 landscape-input"
          />
          {/* Key button to open credential modal */}
          <button
            onClick={() => setShowCredentialModal(true)}
            className="absolute left-5 md:left-3 bottom-[calc(env(safe-area-inset-bottom,12px)+10px)] md:bottom-auto md:top-1/2 md:-translate-y-1/2 p-2 rounded-lg text-t-text/40 hover:text-amber-400 flex items-center justify-center hover:bg-t-overlay/10 transition-colors"
            title={t('credentials.title', 'Clés & Credentials')}
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={!message.trim() || isTyping}
            className="absolute right-5 md:right-3 bottom-[calc(env(safe-area-inset-bottom,12px)+10px)] md:bottom-auto md:top-1/2 md:-translate-y-1/2 p-2 rounded-lg text-t-text flex items-center justify-center disabled:opacity-50 hover:bg-t-overlay/10 transition-colors"
          >
            {isTyping ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Credential modal overlay */}
      {showCredentialModal && projectId && (
        <CredentialModal
          agentId={projectId}
          onClose={() => {
            setShowCredentialModal(false);
            setRequestedCredKeys([]);
          }}
          requestedKeys={requestedCredKeys.length > 0 ? requestedCredKeys : undefined}
        />
      )}
    </div>
  );
}
