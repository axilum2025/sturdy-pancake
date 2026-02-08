import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, Shield, Globe, Code2, Cpu, Layers, 
  ArrowRight, Star, ChevronRight, Bot, Rocket, 
  Terminal, Cloud
} from 'lucide-react';
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
  const scrollRef = useScrollAnimation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const features = [
    {
      icon: Bot,
      title: 'Agent Studio',
      description: 'Créez des agents IA conversationnels en décrivant leur comportement en langage naturel.',
      color: 'from-blue-500/20 to-blue-600/20',
      iconColor: 'text-blue-400',
    },
    {
      icon: Layers,
      title: 'Catalogue de Modèles',
      description: 'Choisissez parmi GPT-4, Claude, Mistral et d\'autres LLMs pour propulser vos agents.',
      color: 'from-indigo-500/20 to-indigo-600/20',
      iconColor: 'text-indigo-400',
    },
    {
      icon: Terminal,
      title: 'Outils & Intégrations',
      description: 'Connectez vos agents à des APIs, bases de données et services externes via MCP.',
      color: 'from-violet-500/20 to-violet-600/20',
      iconColor: 'text-violet-400',
    },
    {
      icon: Globe,
      title: 'Playground Interactif',
      description: 'Testez et itérez sur vos agents en temps réel avant de les déployer.',
      color: 'from-blue-500/20 to-blue-600/20',
      iconColor: 'text-blue-400',
    },
    {
      icon: Cloud,
      title: 'Déploiement en 1 clic',
      description: 'Déployez vos agents en tant qu\'API, widget chat ou bot avec monitoring intégré.',
      color: 'from-indigo-500/20 to-indigo-600/20',
      iconColor: 'text-indigo-400',
    },
    {
      icon: Shield,
      title: 'Sécurisé & Fiable',
      description: 'Authentification, rate limiting et logs complets pour chaque agent déployé.',
      color: 'from-emerald-500/20 to-emerald-600/20',
      iconColor: 'text-emerald-400',
    },
  ];

  const stats = [
    { value: '10K+', label: 'Agents créés', icon: Rocket },
    { value: '99.9%', label: 'Uptime', icon: Zap },
    { value: '50ms', label: 'Temps de réponse', icon: Cpu },
    { value: '24/7', label: 'Agents actifs', icon: Bot },
  ];

  const testimonials = [
    {
      quote: "J'ai créé un agent de support client en 30 minutes. Il répond mieux que notre ancien chatbot.",
      author: 'Marie L.',
      role: 'Fondatrice, TechStart',
      avatar: 'ML',
    },
    {
      quote: "On a déployé 5 agents internes en une semaine. L'intégration MCP avec nos APIs est magique.",
      author: 'Thomas R.',
      role: 'CTO, DataFlow',
      avatar: 'TR',
    },
    {
      quote: "Le playground permet de tester et itérer en temps réel. Mes agents s'améliorent à chaque session.",
      author: 'Sophie K.',
      role: 'Product Manager',
      avatar: 'SK',
    },
  ];

  return (
    <div ref={scrollRef} className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
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
              <a href="#features" className="text-sm text-white/40 hover:text-white/80 transition-colors">Features</a>
              <a href="#stats" className="text-sm text-white/40 hover:text-white/80 transition-colors">Performance</a>
              <a href="#testimonials" className="text-sm text-white/40 hover:text-white/80 transition-colors">Témoignages</a>
            </div>

            <button
              onClick={() => setShowAuth(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-20 pb-32 sm:pt-32 sm:pb-40">
        {/* Decorative orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/60 mb-8 animate-fade-in-up">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span>La plateforme de création d'agents IA</span>
            <ChevronRight className="w-3 h-3" />
          </div>

          {/* Main heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 animate-fade-in-up delay-100">
            Créez vos{' '}
            <br className="hidden sm:block" />
            <span className="gradient-text">agents IA</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/40 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-200">
            Décrivez le comportement de votre agent en langage naturel. GiLo AI le configure, 
            le connecte à vos outils et le déploie en quelques minutes.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
            <button
              onClick={() => setShowAuth(true)}
              className="btn-gradient px-8 py-3.5 rounded-xl text-white font-semibold text-sm flex items-center gap-2 animate-pulse-glow"
            >
              Commencer gratuitement
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#features"
              className="px-8 py-3.5 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200"
            >
              Découvrir les features
            </a>
          </div>

          {/* Hero visual - Code preview mockup */}
          <div className="mt-20 animate-fade-in-up delay-500">
            <div className="relative max-w-3xl mx-auto">
              {/* Glow behind */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 rounded-3xl blur-2xl" />
              
              <div className="relative glass-strong rounded-2xl overflow-hidden border-gradient">
                {/* Window bar */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-white/20 font-mono">GiLo AI — Terminal</span>
                  </div>
                </div>
                
                {/* Code content */}
                <div className="p-6 font-mono text-sm text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">❯</span>
                    <span className="text-white/60">Décris ton agent...</span>
                  </div>
                  <div className="text-white/80 pl-5">
                    <span className="text-blue-400">"</span>
                    <span>Un agent de support client qui répond aux questions, </span>
                    <br />
                    <span className="pl-1">consulte la base de connaissances et escalade si besoin</span>
                    <span className="text-blue-400">"</span>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-purple-400">⚡</span>
                    <span className="text-white/40">Configuration de l'agent...</span>
                    <span className="text-green-400">✓</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">⚡</span>
                    <span className="text-white/40">Connexion aux outils (3 MCP)...</span>
                    <span className="text-green-400">✓</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">⚡</span>
                    <span className="text-white/40">Déploiement de l'agent...</span>
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
                key={stat.label} 
                className="animate-on-scroll text-center"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/5 mb-3">
                  <stat.icon className="w-5 h-5 text-white/30" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold gradient-text mb-1">{stat.value}</div>
                <div className="text-sm text-white/30">{stat.label}</div>
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/50 mb-4">
                <Code2 className="w-3 h-3" />
                Features
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Tout pour créer vos agents
              </h2>
              <p className="text-white/40 max-w-xl mx-auto">
                Une plateforme complète pour concevoir, tester et déployer des agents IA 
                connectés à vos outils et données.
              </p>
            </div>
          </div>

          {/* Feature cards grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="animate-on-scroll glass-card rounded-2xl p-6 group"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} border border-white/5 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white/90">{feature.title}</h3>
                <p className="text-sm text-white/35 leading-relaxed">{feature.description}</p>
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/50 mb-4">
                <Layers className="w-3 h-3" />
                Comment ça marche
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                3 étapes simples
              </h2>
              <p className="text-white/40 max-w-xl mx-auto">
                De l'idée à un agent IA déployé en quelques minutes.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Décrivez',
                description: 'Décrivez le rôle, le ton et les capacités de votre agent en langage naturel.',
                icon: Globe,
              },
              {
                step: '02',
                title: 'Configurez',
                description: 'Connectez des outils (APIs, bases de données, MCP) et ajustez les instructions système.',
                icon: Cpu,
              },
              {
                step: '03',
                title: 'Déployez',
                description: 'Testez dans le playground puis déployez en API, widget ou bot en un clic.',
                icon: Rocket,
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="animate-on-scroll relative text-center"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="text-5xl font-black text-white/[0.03] mb-4">{item.step}</div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4">
                  <item.icon className="w-5 h-5 text-white/50" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-white/35 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section id="testimonials" className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="animate-on-scroll">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/50 mb-4">
                <Star className="w-3 h-3" />
                Témoignages
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ils créent des agents avec nous
              </h2>
              <p className="text-white/40 max-w-xl mx-auto">
                Découvrez ce que nos utilisateurs pensent de GiLo AI.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div
                key={t.author}
                className="animate-on-scroll glass-card rounded-2xl p-6"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-500/70 fill-yellow-500/70" />
                  ))}
                </div>
                <p className="text-sm text-white/50 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/70">{t.author}</div>
                    <div className="text-xs text-white/30">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="animate-on-scroll">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6">
              Prêt à créer{' '}
              <span className="gradient-text">votre agent</span> ?
            </h2>
            <p className="text-lg text-white/40 mb-10 max-w-xl mx-auto">
              Rejoignez des milliers de créateurs qui utilisent GiLo AI pour déployer des agents intelligents.
            </p>
            <button
              onClick={() => setShowAuth(true)}
              className="btn-gradient px-10 py-4 rounded-xl text-white font-semibold flex items-center gap-2 mx-auto animate-pulse-glow"
            >
              Commencer maintenant
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
              <a href="#" className="text-xs text-white/25 hover:text-white/50 transition-colors">Confidentialité</a>
              <a href="#" className="text-xs text-white/25 hover:text-white/50 transition-colors">Conditions</a>
              <a href="#" className="text-xs text-white/25 hover:text-white/50 transition-colors">Documentation</a>
              <a href="#" className="text-xs text-white/25 hover:text-white/50 transition-colors">GitHub</a>
            </div>

            <p className="text-xs text-white/15">
              © 2026 GiLo AI. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => navigate('/dashboard')}
      />
    </div>
  );
}
