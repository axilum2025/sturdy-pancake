import { useNavigate } from 'react-router-dom';
import { 
  Shield, Lock, UserCheck, Eye, Trash2, Download, 
  Server, Key, Database, ArrowLeft, CheckCircle2, FileText
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';

export default function Privacy() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = [
    {
      id: 'isolation',
      icon: UserCheck,
      title: t('privacy.isolationTitle'),
      content: t('privacy.isolationContent'),
      items: [
        t('privacy.isolationItem1'),
        t('privacy.isolationItem2'),
        t('privacy.isolationItem3'),
        t('privacy.isolationItem4'),
        t('privacy.isolationItem5'),
      ],
    },
    {
      id: 'auth',
      icon: Key,
      title: t('privacy.authTitle'),
      content: t('privacy.authContent'),
      items: [
        t('privacy.authItem1'),
        t('privacy.authItem2'),
        t('privacy.authItem3'),
        t('privacy.authItem4'),
      ],
    },
    {
      id: 'data',
      icon: Database,
      title: t('privacy.dataTitle'),
      content: t('privacy.dataContent'),
      items: [
        t('privacy.dataItem1'),
        t('privacy.dataItem2'),
        t('privacy.dataItem3'),
        t('privacy.dataItem4'),
      ],
    },
    {
      id: 'encryption',
      icon: Lock,
      title: t('privacy.encryptionTitle'),
      content: t('privacy.encryptionContent'),
      items: [
        t('privacy.encryptionItem1'),
        t('privacy.encryptionItem2'),
        t('privacy.encryptionItem3'),
      ],
    },
    {
      id: 'gdpr',
      icon: FileText,
      title: t('privacy.gdprTitle'),
      content: t('privacy.gdprContent'),
      items: [
        t('privacy.gdprItem1'),
        t('privacy.gdprItem2'),
        t('privacy.gdprItem3'),
        t('privacy.gdprItem4'),
        t('privacy.gdprItem5'),
      ],
    },
    {
      id: 'rights',
      icon: Download,
      title: t('privacy.rightsTitle'),
      content: t('privacy.rightsContent'),
      items: [
        t('privacy.rightsItem1'),
        t('privacy.rightsItem2'),
        t('privacy.rightsItem3'),
        t('privacy.rightsItem4'),
      ],
    },
    {
      id: 'deletion',
      icon: Trash2,
      title: t('privacy.deletionTitle'),
      content: t('privacy.deletionContent'),
      items: [
        t('privacy.deletionItem1'),
        t('privacy.deletionItem2'),
        t('privacy.deletionItem3'),
      ],
    },
    {
      id: 'infra',
      icon: Server,
      title: t('privacy.infraTitle'),
      content: t('privacy.infraContent'),
      items: [
        t('privacy.infraItem1'),
        t('privacy.infraItem2'),
        t('privacy.infraItem3'),
        t('privacy.infraItem4'),
      ],
    },
    {
      id: 'logs',
      icon: Eye,
      title: t('privacy.logsTitle'),
      content: t('privacy.logsContent'),
      items: [
        t('privacy.logsItem1'),
        t('privacy.logsItem2'),
        t('privacy.logsItem3'),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-t-bg text-t-text">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-t-bg/80 border-b border-t-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-t-text/60 hover:text-t-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('privacy.backHome')}
          </button>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">{t('privacy.badge')}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            {t('privacy.heroTitle1')}{' '}
            <span className="gradient-text">{t('privacy.heroTitle2')}</span>
          </h1>
          <p className="text-lg text-t-text/60 max-w-2xl mx-auto leading-relaxed">
            {t('privacy.heroSubtitle')}
          </p>
          <p className="mt-4 text-sm text-t-text/40">
            {t('privacy.lastUpdated')}: 2026-02-09
          </p>
        </div>
      </section>

      {/* Quick summary cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4 mb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Lock, label: t('privacy.summaryEncryption'), value: t('privacy.summaryEncryptionValue') },
            { icon: UserCheck, label: t('privacy.summaryIsolation'), value: t('privacy.summaryIsolationValue') },
            { icon: FileText, label: t('privacy.summaryCompliance'), value: t('privacy.summaryComplianceValue') },
          ].map((card, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-5 rounded-2xl bg-t-surface/50 border border-t-border/30 backdrop-blur-sm"
            >
              <div className="p-2.5 rounded-xl bg-primary/10">
                <card.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-t-text/50 uppercase tracking-wider">{card.label}</p>
                <p className="text-sm font-semibold mt-0.5">{card.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main sections */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <div className="space-y-10">
          {sections.map((section, idx) => (
            <article
              key={section.id}
              id={section.id}
              className="group p-8 rounded-3xl bg-t-surface/30 border border-t-border/20 hover:border-primary/20 transition-all duration-300"
            >
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 p-3 rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <section.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                    <span className="text-primary/40 mr-2">{String(idx + 1).padStart(2, '0')}.</span>
                    {section.title}
                  </h2>
                  <p className="text-t-text/60 leading-relaxed mb-5">{section.content}</p>
                  <ul className="space-y-2.5">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-t-text/70">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Contact section */}
      <section className="border-t border-t-border/20 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">{t('privacy.contactTitle')}</h2>
          <p className="text-t-text/60 mb-6 max-w-xl mx-auto">{t('privacy.contactContent')}</p>
          <a
            href="mailto:noreply@gilo.dev"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
          >
            {t('privacy.contactButton')}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-t-border/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-t-text/30">© 2026 GiLo AI. {t('privacy.allRightsReserved')}</p>
        </div>
      </footer>
    </div>
  );
}
