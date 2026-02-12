import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Key, Bot, Globe, Zap, Shield,
  ArrowLeft, Copy, Check, Terminal, Layers,
  Webhook, Brain, Rocket, LayoutDashboard, Wrench,
  MessageSquare, Upload, Store, Settings, ChevronRight,
  User, Sparkles, PanelLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-xl bg-gray-950 border border-gray-800 overflow-hidden my-5 shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <span className="text-xs text-gray-500 font-mono">{language}</span>
        <button onClick={copy} className="text-gray-500 hover:text-gray-300 transition-colors">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] text-green-400 font-mono leading-relaxed whitespace-pre-wrap break-words">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: boolean;
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    POST: 'bg-green-500/15 text-green-400 border-green-500/30',
    PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${colors[method] || ''}`}>
      {method}
    </span>
  );
}

export default function Documentation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('getting-started');

  const guidesSections = [
    { id: 'getting-started', icon: Rocket, label: t('docs.navGettingStarted') },
    { id: 'guide-dashboard', icon: LayoutDashboard, label: t('docs.navGuideDashboard') },
    { id: 'guide-create-agent', icon: Bot, label: t('docs.navGuideCreateAgent') },
    { id: 'guide-builder', icon: Wrench, label: t('docs.navGuideBuilder') },
    { id: 'guide-knowledge', icon: Upload, label: t('docs.navGuideKnowledge') },
    { id: 'guide-chat', icon: MessageSquare, label: t('docs.navGuideChat') },
    { id: 'guide-store', icon: Store, label: t('docs.navGuideStore') },
  ];

  const apiSections = [
    { id: 'auth', icon: Key, label: t('docs.navAuth') },
    { id: 'agents', icon: Bot, label: t('docs.navAgents') },
    { id: 'knowledge', icon: Brain, label: t('docs.navKnowledge') },
    { id: 'store', icon: Globe, label: t('docs.navStore') },
    { id: 'api-keys', icon: Shield, label: t('docs.navApiKeys') },
    { id: 'webhooks', icon: Webhook, label: t('docs.navWebhooks') },
    { id: 'public-api', icon: Zap, label: t('docs.navPublicApi') },
    { id: 'deploy', icon: Layers, label: t('docs.navDeploy') },
    { id: 'mcp', icon: Terminal, label: t('docs.navMcp') },
    { id: 'rate-limits', icon: Shield, label: t('docs.navRateLimits') },
  ];

  const authEndpoints: ApiEndpoint[] = [
    { method: 'POST', path: '/api/auth/register', description: t('docs.authRegisterDesc'), auth: false },
    { method: 'POST', path: '/api/auth/login', description: t('docs.authLoginDesc'), auth: false },
    { method: 'GET', path: '/api/auth/me', description: t('docs.authMeDesc'), auth: true },
    { method: 'GET', path: '/api/auth/export', description: t('docs.authExportDesc'), auth: true },
    { method: 'DELETE', path: '/api/auth/account', description: t('docs.authDeleteDesc'), auth: true },
  ];

  const agentEndpoints: ApiEndpoint[] = [
    { method: 'GET', path: '/api/agents', description: t('docs.agentsListDesc'), auth: true },
    { method: 'POST', path: '/api/agents', description: t('docs.agentsCreateDesc'), auth: true },
    { method: 'GET', path: '/api/agents/:id', description: t('docs.agentsGetDesc'), auth: true },
    { method: 'PATCH', path: '/api/agents/:id', description: t('docs.agentsUpdateDesc'), auth: true },
    { method: 'PATCH', path: '/api/agents/:id/config', description: t('docs.agentsConfigDesc'), auth: true },
    { method: 'POST', path: '/api/agents/:id/deploy', description: t('docs.agentsDeployDesc'), auth: true },
    { method: 'POST', path: '/api/agents/:id/chat', description: t('docs.agentsChatDesc'), auth: true },
    { method: 'DELETE', path: '/api/agents/:id', description: t('docs.agentsDeleteDesc'), auth: true },
  ];

  const knowledgeEndpoints: ApiEndpoint[] = [
    { method: 'POST', path: '/api/agents/:id/knowledge/upload', description: t('docs.knowledgeUploadDesc'), auth: true },
    { method: 'GET', path: '/api/agents/:id/knowledge', description: t('docs.knowledgeListDesc'), auth: true },
    { method: 'DELETE', path: '/api/agents/:id/knowledge/:docId', description: t('docs.knowledgeDeleteDesc'), auth: true },
    { method: 'POST', path: '/api/agents/:id/knowledge/search', description: t('docs.knowledgeSearchDesc'), auth: true },
  ];

  const storeEndpoints: ApiEndpoint[] = [
    { method: 'GET', path: '/api/store', description: t('docs.storeListDesc'), auth: false },
    { method: 'GET', path: '/api/store/:id', description: t('docs.storeGetDesc'), auth: false },
    { method: 'POST', path: '/api/store/publish', description: t('docs.storePublishDesc'), auth: true },
    { method: 'POST', path: '/api/store/:id/chat', description: t('docs.storeChatDesc'), auth: false },
    { method: 'DELETE', path: '/api/store/:id', description: t('docs.storeDeleteDesc'), auth: true },
  ];

  const publicApiEndpoints: ApiEndpoint[] = [
    { method: 'POST', path: '/api/v1/agents/:id/chat', description: t('docs.publicChatDesc'), auth: true },
  ];

  function EndpointTable({ endpoints }: { endpoints: ApiEndpoint[] }) {
    return (
      <>
        {/* Desktop table */}
        <div className="hidden md:block rounded-xl border border-t-border/20 overflow-x-auto my-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-t-surface/60 border-b border-t-border/20">
                <th className="text-left px-4 py-3 text-t-text/60 font-semibold text-xs uppercase tracking-wider">{t('docs.tableMethod')}</th>
                <th className="text-left px-4 py-3 text-t-text/60 font-semibold text-xs uppercase tracking-wider">{t('docs.tablePath')}</th>
                <th className="text-left px-4 py-3 text-t-text/60 font-semibold text-xs uppercase tracking-wider">{t('docs.tableDescription')}</th>
                <th className="text-left px-4 py-3 text-t-text/60 font-semibold text-xs uppercase tracking-wider">{t('docs.tableAuth')}</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <tr key={i} className="border-b border-t-border/10 hover:bg-t-surface/30 transition-colors">
                  <td className="px-4 py-3"><MethodBadge method={ep.method} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-t-text/80 whitespace-nowrap">{ep.path}</td>
                  <td className="px-4 py-3 text-t-text/70">{ep.description}</td>
                  <td className="px-4 py-3">
                    {ep.auth ? (
                      <span className="text-xs text-amber-500 whitespace-nowrap">🔒 JWT</span>
                    ) : (
                      <span className="text-xs text-green-500 whitespace-nowrap">🌐 {t('docs.public')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden space-y-3 my-5">
          {endpoints.map((ep, i) => (
            <div key={i} className="p-4 rounded-xl bg-t-surface/40 border border-t-border/20 space-y-2">
              <div className="flex items-center gap-3">
                <MethodBadge method={ep.method} />
                <code className="text-xs font-mono text-t-text/80 break-all">{ep.path}</code>
              </div>
              <p className="text-sm text-t-text/70 leading-relaxed">{ep.description}</p>
              <div>
                {ep.auth ? (
                  <span className="text-xs text-amber-500">🔒 JWT</span>
                ) : (
                  <span className="text-xs text-green-500">🌐 {t('docs.public')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-t-bg text-t-text">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-t-bg/80 border-b border-t-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-t-text/60 hover:text-t-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('docs.backHome')}
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-semibold">GiLo AI <span className="text-primary">Docs</span></span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="lg:hidden max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <select
          value={activeSection}
          onChange={(e) => setActiveSection(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-t-surface border border-t-border/30 text-sm font-medium"
        >
          <optgroup label={t('docs.sidebarGuide')}>
            {guidesSections.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </optgroup>
          <optgroup label={t('docs.sidebarApi')}>
            {apiSections.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:flex gap-10">
        {/* Sidebar */}
        <nav className="hidden lg:block w-60 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-t-text/50 uppercase tracking-wider mb-3 px-3">{t('docs.sidebarGuide')}</p>
            {guidesSections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeSection === s.id
                    ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                    : 'text-t-text/60 hover:text-t-text/90 hover:bg-t-surface/50'
                }`}
              >
                <s.icon className="w-4 h-4 flex-shrink-0" />
                {s.label}
              </button>
            ))}
            <div className="h-px bg-t-border/20 my-4" />
            <p className="text-xs font-semibold text-t-text/50 uppercase tracking-wider mb-3 px-3">{t('docs.sidebarApi')}</p>
            {apiSections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeSection === s.id
                    ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                    : 'text-t-text/60 hover:text-t-text/90 hover:bg-t-surface/50'
                }`}
              >
                <s.icon className="w-4 h-4 flex-shrink-0" />
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 min-w-0 max-w-3xl">

          {/* ===== GETTING STARTED (UI Guide) ===== */}
          {activeSection === 'getting-started' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.gettingStartedTitle')}</h1>
              <p className="text-t-text/70 mb-8 text-lg leading-relaxed">{t('docs.gettingStartedSubtitle')}</p>

              <div className="space-y-6">
                {/* Step 1 */}
                <div className="p-6 rounded-2xl bg-t-surface/40 border border-t-border/20">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-t-text mb-2">{t('docs.gsStep1Title')}</h3>
                      <p className="text-t-text/70 leading-relaxed mb-3">{t('docs.gsStep1Desc')}</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep1Item1')}</span></div>
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep1Item2')}</span></div>
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep1Item3')}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-6 rounded-2xl bg-t-surface/40 border border-t-border/20">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-t-text mb-2">{t('docs.gsStep2Title')}</h3>
                      <p className="text-t-text/70 leading-relaxed mb-3">{t('docs.gsStep2Desc')}</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep2Item1')}</span></div>
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep2Item2')}</span></div>
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep2Item3')}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-6 rounded-2xl bg-t-surface/40 border border-t-border/20">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-t-text mb-2">{t('docs.gsStep3Title')}</h3>
                      <p className="text-t-text/70 leading-relaxed mb-3">{t('docs.gsStep3Desc')}</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep3Item1')}</span></div>
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep3Item2')}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-6 rounded-2xl bg-t-surface/40 border border-t-border/20">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-t-text mb-2">{t('docs.gsStep4Title')}</h3>
                      <p className="text-t-text/70 leading-relaxed mb-3">{t('docs.gsStep4Desc')}</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep4Item1')}</span></div>
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep4Item2')}</span></div>
                        <div className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.gsStep4Item3')}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== GUIDE: DASHBOARD ===== */}
          {activeSection === 'guide-dashboard' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.guideDashboardTitle')}</h1>
              <p className="text-t-text/70 mb-6 text-lg leading-relaxed">{t('docs.guideDashboardDesc')}</p>

              <div className="space-y-5">
                <div className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                  <h3 className="font-semibold text-t-text mb-2 flex items-center gap-2"><PanelLeft className="w-4 h-4 text-primary" /> {t('docs.dashOverviewTitle')}</h3>
                  <p className="text-sm text-t-text/70 leading-relaxed">{t('docs.dashOverviewDesc')}</p>
                </div>
                <div className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                  <h3 className="font-semibold text-t-text mb-2 flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> {t('docs.dashAgentsTitle')}</h3>
                  <p className="text-sm text-t-text/70 leading-relaxed">{t('docs.dashAgentsDesc')}</p>
                </div>
                <div className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                  <h3 className="font-semibold text-t-text mb-2 flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> {t('docs.dashActionsTitle')}</h3>
                  <ul className="space-y-1.5 mt-2">
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.dashAction1')}</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.dashAction2')}</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.dashAction3')}</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.dashAction4')}</span></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ===== GUIDE: CREATE AGENT ===== */}
          {activeSection === 'guide-create-agent' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.guideCreateTitle')}</h1>
              <p className="text-t-text/70 mb-6 text-lg leading-relaxed">{t('docs.guideCreateDesc')}</p>

              <div className="space-y-5">
                {[1,2,3,4,5].map((n) => (
                  <div key={n} className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                    <h3 className="font-semibold text-t-text mb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{n}</span>
                      {t(`docs.guideCreate${n}Title`)}
                    </h3>
                    <p className="text-sm text-t-text/70 leading-relaxed">{t(`docs.guideCreate${n}Desc`)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== GUIDE: BUILDER ===== */}
          {activeSection === 'guide-builder' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.guideBuilderTitle')}</h1>
              <p className="text-t-text/70 mb-6 text-lg leading-relaxed">{t('docs.guideBuilderDesc')}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                {['config', 'chat', 'tools', 'preview'].map((panel) => (
                  <div key={panel} className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                    <h3 className="font-semibold text-t-text mb-2">{t(`docs.builder${panel.charAt(0).toUpperCase() + panel.slice(1)}Title`)}</h3>
                    <p className="text-sm text-t-text/70 leading-relaxed">{t(`docs.builder${panel.charAt(0).toUpperCase() + panel.slice(1)}Desc`)}</p>
                  </div>
                ))}
              </div>

              {/* Toolbar buttons guide */}
              <div className="mt-8">
                <h2 className="text-xl font-bold text-t-text mb-2">{t('docs.builderToolbarTitle')}</h2>
                <p className="text-t-text/70 mb-4 text-sm leading-relaxed">{t('docs.builderToolbarDesc')}</p>
                <div className="space-y-3">
                  {[
                    { key: 'playground', icon: '👁️' },
                    { key: 'history', icon: '🕐' },
                    { key: 'config', icon: '⚙️' },
                    { key: 'publish', icon: '🚀' },
                    { key: 'api', icon: '🔗' },
                    { key: 'store', icon: '🏪' },
                    { key: 'mcpBrowser', icon: '🔧' },
                    { key: 'mcpSettings', icon: '⚡' },
                    { key: 'back', icon: '←' },
                  ].map((btn) => (
                    <div key={btn.key} className="flex items-start gap-3 p-4 rounded-xl bg-t-surface/40 border border-t-border/20">
                      <span className="text-xl flex-shrink-0 w-7 text-center">{btn.icon}</span>
                      <div>
                        <h4 className="font-semibold text-t-text text-sm">{t(`docs.btn${btn.key.charAt(0).toUpperCase() + btn.key.slice(1)}Title`)}</h4>
                        <p className="text-sm text-t-text/70 leading-relaxed mt-0.5">{t(`docs.btn${btn.key.charAt(0).toUpperCase() + btn.key.slice(1)}Desc`)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-t-text/70 leading-relaxed">
                  <strong className="text-primary">{t('docs.builderTip')}</strong> {t('docs.builderTipDesc')}
                </p>
              </div>
            </div>
          )}

          {/* ===== GUIDE: KNOWLEDGE ===== */}
          {activeSection === 'guide-knowledge' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.guideKnowledgeTitle')}</h1>
              <p className="text-t-text/70 mb-6 text-lg leading-relaxed">{t('docs.guideKnowledgeDesc')}</p>

              <div className="space-y-5">
                {[1,2,3].map((n) => (
                  <div key={n} className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                    <h3 className="font-semibold text-t-text mb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{n}</span>
                      {t(`docs.guideKb${n}Title`)}
                    </h3>
                    <p className="text-sm text-t-text/70 leading-relaxed">{t(`docs.guideKb${n}Desc`)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-t-text">{t('docs.guideKbFormatsTitle')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['PDF', 'TXT', 'Markdown', 'CSV', 'JSON', 'DOCX', 'HTML', 'XML'].map((fmt) => (
                    <div key={fmt} className="text-center p-3 rounded-xl bg-t-surface/50 border border-t-border/20">
                      <p className="text-sm font-mono font-semibold text-t-text/80">.{fmt.toLowerCase()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== GUIDE: CHAT ===== */}
          {activeSection === 'guide-chat' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.guideChatTitle')}</h1>
              <p className="text-t-text/70 mb-6 text-lg leading-relaxed">{t('docs.guideChatDesc')}</p>

              <div className="space-y-5">
                <div className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                  <h3 className="font-semibold text-t-text mb-2">{t('docs.chatPlaygroundTitle')}</h3>
                  <p className="text-sm text-t-text/70 leading-relaxed">{t('docs.chatPlaygroundDesc')}</p>
                </div>
                <div className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                  <h3 className="font-semibold text-t-text mb-2">{t('docs.chatFeaturesTitle')}</h3>
                  <ul className="space-y-1.5 mt-2">
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.chatFeature1')}</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.chatFeature2')}</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.chatFeature3')}</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.chatFeature4')}</span></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ===== GUIDE: STORE ===== */}
          {activeSection === 'guide-store' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.guideStoreTitle')}</h1>
              <p className="text-t-text/70 mb-6 text-lg leading-relaxed">{t('docs.guideStoreDesc')}</p>

              <div className="space-y-5">
                <div className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                  <h3 className="font-semibold text-t-text mb-2">{t('docs.storeBrowseTitle')}</h3>
                  <p className="text-sm text-t-text/70 leading-relaxed">{t('docs.storeBrowseDesc')}</p>
                </div>
                <div className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                  <h3 className="font-semibold text-t-text mb-2">{t('docs.storePublishTitle')}</h3>
                  <p className="text-sm text-t-text/70 leading-relaxed mb-3">{t('docs.storePublishGuideDesc')}</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.storePublishStep1')}</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.storePublishStep2')}</span></li>
                    <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span className="text-sm text-t-text/70">{t('docs.storePublishStep3')}</span></li>
                  </ul>
                </div>
                <div className="p-5 rounded-xl bg-t-surface/40 border border-t-border/20">
                  <h3 className="font-semibold text-t-text mb-2">{t('docs.storeTestTitle')}</h3>
                  <p className="text-sm text-t-text/70 leading-relaxed">{t('docs.storeTestDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {/* ===== AUTH ===== */}
          {activeSection === 'auth' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.authTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.authDesc')}</p>

              {/* Base URL */}
              <div className="mb-6 p-5 rounded-2xl bg-primary/5 border border-primary/20">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  {t('docs.baseUrlTitle')}
                </h3>
                <p className="text-sm text-t-text/70 mb-3 leading-relaxed">{t('docs.baseUrlDesc')}</p>
                <CodeBlock language="text" code="https://gilo-prod-api.victoriousplant-cf550291.canadacentral.azurecontainerapps.io" />
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
                <p className="text-sm text-amber-400">
                  <strong>⚠️ {t('docs.authNote')}</strong>
                </p>
              </div>

              <EndpointTable endpoints={authEndpoints} />

              <h3 className="text-lg font-semibold mt-8 mb-3 text-t-text">{t('docs.authExampleTitle')}</h3>
              <CodeBlock language="bash" code={`# Login and get JWT token
curl -X POST /api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com", "password": "yourpassword"}'

# Response: { "token": "eyJhbG...", "user": { ... } }

# Use the token in all subsequent requests
curl -X GET /api/agents \\
  -H "Authorization: Bearer eyJhbG..."`} />
            </div>
          )}

          {/* ===== AGENTS ===== */}
          {activeSection === 'agents' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.agentsTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.agentsDesc')}</p>
              <EndpointTable endpoints={agentEndpoints} />

              <h3 className="text-lg font-semibold mt-8 mb-3 text-t-text">{t('docs.agentsConfigTitle')}</h3>
              <CodeBlock language="json" code={`{
  "model": "openai/gpt-4.1",
  "systemPrompt": "You are a helpful assistant specialized in...",
  "welcomeMessage": "Hello! How can I help you?",
  "temperature": 0.7,
  "maxTokens": 2048,
  "topP": 1,
  "tools": [
    {
      "id": "tool-1",
      "name": "web_search",
      "type": "mcp",
      "description": "Search the web",
      "enabled": true
    }
  ],
  "knowledgeBase": ["doc-id-1", "doc-id-2"]
}`} />
            </div>
          )}

          {/* ===== KNOWLEDGE ===== */}
          {activeSection === 'knowledge' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.knowledgeTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.knowledgeDesc')}</p>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6">
                <p className="text-sm text-blue-400">{t('docs.knowledgeNote')}</p>
              </div>

              <EndpointTable endpoints={knowledgeEndpoints} />

              <h3 className="text-lg font-semibold mt-8 mb-3 text-t-text">{t('docs.knowledgeFormatsTitle')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['PDF', 'TXT', 'Markdown', 'CSV', 'JSON', 'DOCX', 'HTML', 'XML'].map((fmt) => (
                  <div key={fmt} className="text-center p-3 rounded-xl bg-t-surface/50 border border-t-border/20">
                    <p className="text-sm font-mono font-semibold">.{fmt.toLowerCase()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== STORE ===== */}
          {activeSection === 'store' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.storeTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.storeDesc')}</p>
              <EndpointTable endpoints={storeEndpoints} />
            </div>
          )}

          {/* ===== API KEYS ===== */}
          {activeSection === 'api-keys' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.apiKeysTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.apiKeysDesc')}</p>

              <div className="space-y-3">
                {[
                  { method: 'POST' as const, path: '/api/agents/:id/api-keys', description: t('docs.apiKeysCreateDesc') },
                  { method: 'GET' as const, path: '/api/agents/:id/api-keys', description: t('docs.apiKeysListDesc') },
                  { method: 'DELETE' as const, path: '/api/agents/:id/api-keys/:keyId', description: t('docs.apiKeysRevokeDesc') },
                ].map((ep, i) => (
                  <div key={i} className="p-4 rounded-xl bg-t-surface/40 border border-t-border/20">
                    <div className="flex items-center gap-3 mb-2">
                      <MethodBadge method={ep.method} />
                      <code className="text-xs font-mono text-t-text/80 break-all">{ep.path}</code>
                    </div>
                    <p className="text-sm text-t-text/70 leading-relaxed">{ep.description}</p>
                  </div>
                ))}
              </div>

              <CodeBlock language="bash" code={`# Create an API key
curl -X POST /api/agents/AGENT_ID/api-keys \\
  -H "Authorization: Bearer YOUR_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Production Key"}'

# Response: { "id": "...", "key": "gilo_abc123...", "name": "Production Key" }
# ⚠️ The full key is only shown once!`} />
            </div>
          )}

          {/* ===== WEBHOOKS ===== */}
          {activeSection === 'webhooks' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.webhooksTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.webhooksDesc')}</p>

              <div className="space-y-3">
                {[
                  { method: 'POST' as const, path: '/api/agents/:id/webhooks', description: t('docs.webhooksCreateDesc') },
                  { method: 'GET' as const, path: '/api/agents/:id/webhooks', description: t('docs.webhooksListDesc') },
                  { method: 'DELETE' as const, path: '/api/agents/:id/webhooks/:whId', description: t('docs.webhooksDeleteDesc') },
                ].map((ep, i) => (
                  <div key={i} className="p-4 rounded-xl bg-t-surface/40 border border-t-border/20">
                    <div className="flex items-center gap-3 mb-2">
                      <MethodBadge method={ep.method} />
                      <code className="text-xs font-mono text-t-text/80 break-all">{ep.path}</code>
                    </div>
                    <p className="text-sm text-t-text/70 leading-relaxed">{ep.description}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-semibold mt-8 mb-3 text-t-text">{t('docs.webhooksEventsTitle')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {['conversation.started', 'conversation.ended', 'message.received', 'message.sent', 'agent.deployed', 'agent.error'].map((evt) => (
                  <div key={evt} className="p-3 rounded-xl bg-t-surface/50 border border-t-border/20">
                    <code className="text-xs font-mono text-amber-400">{evt}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== PUBLIC API ===== */}
          {activeSection === 'public-api' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.publicApiTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.publicApiDesc')}</p>

              <EndpointTable endpoints={publicApiEndpoints} />

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 my-6">
                <p className="text-sm text-amber-400">{t('docs.publicApiNote')}</p>
              </div>

              <CodeBlock language="bash" code={`# Chat with an agent using API key
curl -X POST /api/v1/agents/AGENT_ID/chat \\
  -H "X-API-Key: gilo_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`} />
            </div>
          )}

          {/* ===== DEPLOY ===== */}
          {activeSection === 'deploy' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.deployTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.deployDesc')}</p>

              <div className="space-y-3">
                {[
                  { method: 'POST' as const, path: '/api/deploy/:projectId', description: t('docs.deployStartDesc') },
                  { method: 'GET' as const, path: '/api/deploy/:deploymentId', description: t('docs.deployStatusDesc') },
                  { method: 'GET' as const, path: '/api/deploy/project/:projectId', description: t('docs.deployListDesc') },
                  { method: 'DELETE' as const, path: '/api/deploy/:deploymentId', description: t('docs.deployDeleteDesc') },
                ].map((ep, i) => (
                  <div key={i} className="p-4 rounded-xl bg-t-surface/40 border border-t-border/20">
                    <div className="flex items-center gap-3 mb-2">
                      <MethodBadge method={ep.method} />
                      <code className="text-xs font-mono text-t-text/80 break-all">{ep.path}</code>
                    </div>
                    <p className="text-sm text-t-text/70 leading-relaxed">{ep.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== MCP ===== */}
          {activeSection === 'mcp' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.mcpTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.mcpDesc')}</p>

              <div className="space-y-3 mb-8">
                {[
                  { method: 'GET' as const, path: '/api/mcp/servers', description: t('docs.mcpListDesc') },
                  { method: 'POST' as const, path: '/api/mcp/servers', description: t('docs.mcpAddDesc') },
                  { method: 'POST' as const, path: '/api/mcp/servers/:id/connect', description: t('docs.mcpConnectDesc') },
                  { method: 'GET' as const, path: '/api/mcp/tools', description: t('docs.mcpToolsDesc') },
                  { method: 'POST' as const, path: '/api/mcp/tools/execute', description: t('docs.mcpExecDesc') },
                  { method: 'GET' as const, path: '/api/mcp/resources', description: t('docs.mcpResDesc') },
                  { method: 'GET' as const, path: '/api/mcp/prompts', description: t('docs.mcpPromptsDesc') },
                ].map((ep, i) => (
                  <div key={i} className="p-4 rounded-xl bg-t-surface/40 border border-t-border/20">
                    <div className="flex items-center gap-3 mb-2">
                      <MethodBadge method={ep.method} />
                      <code className="text-xs font-mono text-t-text/80 break-all">{ep.path}</code>
                    </div>
                    <p className="text-sm text-t-text/70 leading-relaxed">{ep.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== RATE LIMITS ===== */}
          {activeSection === 'rate-limits' && (
            <div>
              <h1 className="text-3xl font-bold mb-3 text-t-text">{t('docs.rateLimitsTitle')}</h1>
              <p className="text-t-text/70 mb-6 leading-relaxed">{t('docs.rateLimitsDesc')}</p>

              <div className="rounded-xl border border-t-border/20 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-t-surface/50 border-b border-t-border/20">
                      <th className="text-left px-4 py-3 text-t-text/50 font-medium text-xs uppercase">{t('docs.tierColumn')}</th>
                      <th className="text-left px-4 py-3 text-t-text/50 font-medium text-xs uppercase">{t('docs.projectsColumn')}</th>
                      <th className="text-left px-4 py-3 text-t-text/50 font-medium text-xs uppercase">{t('docs.storageColumn')}</th>
                      <th className="text-left px-4 py-3 text-t-text/50 font-medium text-xs uppercase">{t('docs.deploysColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-t-border/10">
                      <td className="px-4 py-3 font-semibold">Free</td>
                      <td className="px-4 py-3 text-t-text/60">3</td>
                      <td className="px-4 py-3 text-t-text/60">100 MB</td>
                      <td className="px-4 py-3 text-t-text/60">5 / {t('docs.month')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-primary">Pro</td>
                      <td className="px-4 py-3 text-t-text/60">10</td>
                      <td className="px-4 py-3 text-t-text/60">5 GB</td>
                      <td className="px-4 py-3 text-t-text/60">20 / {t('docs.month')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400">{t('docs.rateLimitsNote')}</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-t-border/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-t-text/30">© 2026 GiLo AI · v5.0.0</p>
        </div>
      </footer>
    </div>
  );
}
