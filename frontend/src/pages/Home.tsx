import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Zap, Shield, Globe, Code2, Cpu, Layers, 
  ArrowRight, ChevronRight, Bot, Rocket, 
  Terminal, Cloud, QrCode, Link2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../contexts/AuthContext';

// Hook for scroll-triggered animations
function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const elements = ref.current?.querySelectorAll('.animate-on-scroll');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return ref;
}

export default function Home() {
  const [showAuth, setShowAuth] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useScrollAnimation();
  const { t } = useTranslation();

  // Redirect destination after login (from ProtectedRoute or default /dashboard)
  const redirectTo = (location.state as any)?.from?.pathname || '/dashboard';

  // Auto-open auth modal when redirected from a protected route
  useEffect(() => {
    if ((location.state as any)?.from) {
      setShowAuth(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(redirectTo);
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  const features = [
    {
      icon: Bot,
      titleKey: 'home.featureStudio',
      descKey: 'home.featureStudioDesc',
      color: 'from-blue-500/20 to-blue-600/20',
      iconColor: 'text-blue-400',
    },
    {
      icon: Layers,
      titleKey: 'home.featureModels',
      descKey: 'home.featureModelsDesc',
      color: 'from-indigo-500/20 to-indigo-600/20',
      iconColor: 'text-indigo-400',
    },
    {
      icon: Terminal,
      titleKey: 'home.featureTools',
      descKey: 'home.featureToolsDesc',
      color: 'from-indigo-500/20 to-indigo-600/20',
      iconColor: 'text-indigo-400',
    },
    {
      icon: Globe,
      titleKey: 'home.featurePlayground',
      descKey: 'home.featurePlaygroundDesc',
      color: 'from-blue-500/20 to-blue-600/20',
      iconColor: 'text-blue-400',
    },
    {
      icon: Cloud,
      titleKey: 'home.featureDeploy',
      descKey: 'home.featureDeployDesc',
      color: 'from-indigo-500/20 to-indigo-600/20',
      iconColor: 'text-indigo-400',
    },
    {
      icon: Shield,
      titleKey: 'home.featureSecurity',
      descKey: 'home.featureSecurityDesc',
      color: 'from-green-500/20 to-green-600/20',
      iconColor: 'text-green-400',
    },
  ];

  const stats = [
    { value: '10K+', labelKey: 'home.statsAgents', icon: Rocket },
    { value: '99.9%', labelKey: 'home.statsUptime', icon: Zap },
    { value: '50ms', labelKey: 'home.statsResponse', icon: Cpu },
    { value: '24/7', labelKey: 'home.statsActive', icon: Bot },
  ];

  const deployMethods = [
    {
      icon: Code2,
      titleKey: 'home.deployMethod1Title',
      descKey: 'home.deployMethod1Desc',
      codeExample: 'POST https://api.gilo.dev/api/v1/chat\n{ "messages": [{ "role": "user", "content": "Hello!" }] }',
      color: 'from-blue-500/20 to-indigo-500/20',
      borderColor: 'border-blue-500/20',
      iconColor: 'text-blue-400',
    },
    {
      icon: Link2,
      titleKey: 'home.deployMethod2Title',
      descKey: 'home.deployMethod2Desc',
      codeExample: 'https://mon-agent.gilo.dev',
      color: 'from-emerald-500/20 to-green-500/20',
      borderColor: 'border-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      icon: QrCode,
      titleKey: 'home.deployMethod3Title',
      descKey: 'home.deployMethod3Desc',
      codeExample: null,
      color: 'from-violet-500/20 to-purple-500/20',
      borderColor: 'border-violet-500/20',
      iconColor: 'text-violet-400',
    },
  ];

  return (
    <div ref={scrollRef} className="min-h-screen bg-t-page text-t-text overflow-x-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-40" />

      {/* ===== NAVBAR ===== */}
      <nav className="relative z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight gradient-text">
                GiLo AI
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-t-text/40 hover:text-t-text/80 transition-colors">{t('nav.features')}</a>
              <a href="#stats" className="text-sm text-t-text/40 hover:text-t-text/80 transition-colors">{t('nav.performance')}</a>
              <a href="#testimonials" className="text-sm text-t-text/40 hover:text-t-text/80 transition-colors">{t('nav.deploy')}</a>
            </div>

            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <LanguageSwitcher />
              <button
                onClick={() => setShowAuth(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-t-overlay/5 border border-t-overlay/10 hover:bg-t-overlay/10 hover:border-t-overlay/20 transition-all duration-200"
              >
                {t('common.signIn')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-20 pb-32 sm:pt-32 sm:pb-40">
        {/* Decorative orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-t-overlay/5 border border-t-overlay/10 text-xs font-medium text-t-text/60 mb-8 animate-fade-in-up">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>{t('home.badge')}</span>
            <ChevronRight className="w-3 h-3" />
          </div>

          {/* Main heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 animate-fade-in-up delay-100">
            {t('home.heroTitle1')}{' '}
            <br className="hidden sm:block" />
            <span className="gradient-text">{t('home.heroTitle2')}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-t-text/40 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-200">
            {t('home.heroSubtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
            <button
              onClick={() => setShowAuth(true)}
              className="btn-gradient px-8 py-3.5 rounded-xl text-t-text font-semibold text-sm flex items-center gap-2 animate-pulse-glow"
            >
              {t('home.ctaStart')}
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#features"
              className="px-8 py-3.5 rounded-xl text-sm font-medium text-t-text/50 hover:text-t-text/80 border border-t-overlay/10 hover:border-t-overlay/20 hover:bg-t-overlay/5 transition-all duration-200"
            >
              {t('home.ctaDiscover')}
            </a>
          </div>

          {/* Hero visual - Code preview mockup */}
          <div className="mt-20 animate-fade-in-up delay-500">
            <div className="relative max-w-3xl mx-auto">
              {/* Glow behind */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 rounded-3xl blur-2xl" />
              
              <div className="relative glass-strong rounded-2xl overflow-hidden border-gradient">
                {/* Window bar */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-t-text/20 font-mono">{t('home.terminal')}</span>
                  </div>
                </div>
                
                {/* Code content */}
                <div className="p-6 font-mono text-sm text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">❯</span>
                    <span className="text-t-text/60">{t('home.terminalPrompt')}</span>
                  </div>
                  <div className="text-t-text/80 pl-5">
                    <span className="text-blue-400">"</span>
                    <span>{t('home.terminalDesc1')} </span>
                    <br />
                    <span className="pl-1">{t('home.terminalDesc2')}</span>
                    <span className="text-blue-400">"</span>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-indigo-400">⚡</span>
                    <span className="text-t-text/40">{t('home.terminalStep1')}</span>
                    <span className="text-green-400">✓</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400">⚡</span>
                    <span className="text-t-text/40">{t('home.terminalStep2')}</span>
                    <span className="text-green-400">✓</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400">⚡</span>
                    <span className="text-t-text/40">{t('home.terminalStep3')}</span>
                    <span className="text-green-400">✓</span>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-blue-400">→</span>
                    <span className="text-blue-400/80">https://api.gilo.ai/agents/support-client</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS SECTION ===== */}
      <section id="stats" className="relative py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div 
                key={stat.labelKey} 
                className="animate-on-scroll text-center"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-t-overlay/5 border border-t-overlay/5 mb-3">
                  <stat.icon className="w-5 h-5 text-t-text/30" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold gradient-text mb-1">{stat.value}</div>
                <div className="text-sm text-t-text/30">{t(stat.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="text-center mb-16">
            <div className="animate-on-scroll">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-t-overlay/5 border border-t-overlay/10 text-xs font-medium text-t-text/50 mb-4">
                <Code2 className="w-3 h-3" />
                {t('nav.features')}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                {t('home.featuresTitle')}
              </h2>
              <p className="text-t-text/40 max-w-xl mx-auto">
                {t('home.featuresSubtitle')}
              </p>
            </div>
          </div>

          {/* Feature cards grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={feature.titleKey}
                className="animate-on-scroll glass-card rounded-2xl p-6 group"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} border border-t-overlay/5 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-t-text/90">{t(feature.titleKey)}</h3>
                <p className="text-sm text-t-text/35 leading-relaxed">{t(feature.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="animate-on-scroll">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-t-overlay/5 border border-t-overlay/10 text-xs font-medium text-t-text/50 mb-4">
                <Layers className="w-3 h-3" />
                {t('home.howLabel')}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                {t('home.howTitle')}
              </h2>
              <p className="text-t-text/40 max-w-xl mx-auto">
                {t('home.howSubtitle')}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                titleKey: 'home.howStep1Title',
                descKey: 'home.howStep1Desc',
                icon: Globe,
              },
              {
                step: '02',
                titleKey: 'home.howStep2Title',
                descKey: 'home.howStep2Desc',
                icon: Cpu,
              },
              {
                step: '03',
                titleKey: 'home.howStep3Title',
                descKey: 'home.howStep3Desc',
                icon: Rocket,
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="animate-on-scroll relative text-center"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="text-5xl font-black text-t-text/[0.03] mb-4">{item.step}</div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-t-overlay/5 border border-t-overlay/10 mb-4">
                  <item.icon className="w-5 h-5 text-t-text/50" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{t(item.titleKey)}</h3>
                <p className="text-sm text-t-text/35 leading-relaxed">{t(item.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DEPLOY METHODS ===== */}
      <section id="testimonials" className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="animate-on-scroll">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-t-overlay/5 border border-t-overlay/10 text-xs font-medium text-t-text/50 mb-4">
                <Rocket className="w-3 h-3" />
                {t('home.deployLabel')}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                {t('home.deployTitle')}
              </h2>
              <p className="text-t-text/40 max-w-xl mx-auto">
                {t('home.deploySubtitle')}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {deployMethods.map((method, i) => {
              const Icon = method.icon;
              return (
                <div
                  key={method.titleKey}
                  className="animate-on-scroll glass-card rounded-2xl p-6 flex flex-col"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${method.color} border ${method.borderColor} flex items-center justify-center mb-5`}>
                    <Icon className={`w-6 h-6 ${method.iconColor}`} />
                  </div>
                  {/* Title */}
                  <h3 className="text-lg font-semibold text-t-text/90 mb-2">{t(method.titleKey)}</h3>
                  {/* Description */}
                  <p className="text-sm text-t-text/45 leading-relaxed mb-5 flex-1">{t(method.descKey)}</p>
                  {/* Code example or QR illustration */}
                  {method.codeExample ? (
                    <div className="rounded-lg bg-t-overlay/5 border border-t-overlay/10 p-3 font-mono text-[11px] text-t-text/50 leading-relaxed overflow-x-auto whitespace-pre">
                      {method.codeExample}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-t-overlay/5 border border-t-overlay/10 p-4 flex items-center justify-center">
                      <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: 25 }).map((_, j) => (
                          <div
                            key={j}
                            className={`w-3 h-3 rounded-sm ${
                              [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24].includes(j)
                                ? 'bg-violet-400/40'
                                : 'bg-t-overlay/10'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="ml-3 text-xs text-t-text/30">{t('home.deployMethod3Hint')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="animate-on-scroll">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6">
              {t('home.ctaTitle1')}{' '}
              <span className="gradient-text">{t('home.ctaTitle2')}</span> ?
            </h2>
            <p className="text-lg text-t-text/40 mb-10 max-w-xl mx-auto">
              {t('home.ctaSubtitle')}
            </p>
            <button
              onClick={() => setShowAuth(true)}
              className="btn-gradient px-10 py-4 rounded-xl text-t-text font-semibold flex items-center gap-2 mx-auto animate-pulse-glow"
            >
              {t('home.ctaButton')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="relative py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold gradient-text">GiLo AI</span>
            </div>
            
            <div className="flex items-center gap-6">
              <a href="/privacy" className="text-xs text-t-text/25 hover:text-t-text/50 transition-colors">{t('home.footerPrivacy')}</a>
              <a href="/terms" className="text-xs text-t-text/25 hover:text-t-text/50 transition-colors">{t('home.footerTerms')}</a>
              <a href="/docs" className="text-xs text-t-text/25 hover:text-t-text/50 transition-colors">{t('home.footerDocs')}</a>
            </div>

            <p className="text-xs text-t-text/15">
              {t('home.footerCopyright')}
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => navigate(redirectTo)}
      />
    </div>
  );
}
