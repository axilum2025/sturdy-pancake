import { useNavigate } from 'react-router-dom';
import {
  FileText, Scale, UserCheck, AlertTriangle, Ban,
  CreditCard, RefreshCw, Globe, Gavel, ArrowLeft,
  CheckCircle2, Shield
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';

export default function Terms() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = [
    {
      id: 'acceptance',
      icon: FileText,
      title: t('terms.acceptanceTitle'),
      content: t('terms.acceptanceContent'),
      items: [
        t('terms.acceptanceItem1'),
        t('terms.acceptanceItem2'),
        t('terms.acceptanceItem3'),
      ],
    },
    {
      id: 'description',
      icon: Globe,
      title: t('terms.descriptionTitle'),
      content: t('terms.descriptionContent'),
      items: [
        t('terms.descriptionItem1'),
        t('terms.descriptionItem2'),
        t('terms.descriptionItem3'),
        t('terms.descriptionItem4'),
        t('terms.descriptionItem5'),
      ],
    },
    {
      id: 'accounts',
      icon: UserCheck,
      title: t('terms.accountsTitle'),
      content: t('terms.accountsContent'),
      items: [
        t('terms.accountsItem1'),
        t('terms.accountsItem2'),
        t('terms.accountsItem3'),
        t('terms.accountsItem4'),
      ],
    },
    {
      id: 'tiers',
      icon: CreditCard,
      title: t('terms.tiersTitle'),
      content: t('terms.tiersContent'),
      items: [
        t('terms.tiersItem1'),
        t('terms.tiersItem2'),
        t('terms.tiersItem3'),
        t('terms.tiersItem4'),
      ],
    },
    {
      id: 'usage',
      icon: Scale,
      title: t('terms.usageTitle'),
      content: t('terms.usageContent'),
      items: [
        t('terms.usageItem1'),
        t('terms.usageItem2'),
        t('terms.usageItem3'),
        t('terms.usageItem4'),
        t('terms.usageItem5'),
      ],
    },
    {
      id: 'prohibited',
      icon: Ban,
      title: t('terms.prohibitedTitle'),
      content: t('terms.prohibitedContent'),
      items: [
        t('terms.prohibitedItem1'),
        t('terms.prohibitedItem2'),
        t('terms.prohibitedItem3'),
        t('terms.prohibitedItem4'),
        t('terms.prohibitedItem5'),
      ],
    },
    {
      id: 'ip',
      icon: Shield,
      title: t('terms.ipTitle'),
      content: t('terms.ipContent'),
      items: [
        t('terms.ipItem1'),
        t('terms.ipItem2'),
        t('terms.ipItem3'),
      ],
    },
    {
      id: 'liability',
      icon: AlertTriangle,
      title: t('terms.liabilityTitle'),
      content: t('terms.liabilityContent'),
      items: [
        t('terms.liabilityItem1'),
        t('terms.liabilityItem2'),
        t('terms.liabilityItem3'),
      ],
    },
    {
      id: 'termination',
      icon: RefreshCw,
      title: t('terms.terminationTitle'),
      content: t('terms.terminationContent'),
      items: [
        t('terms.terminationItem1'),
        t('terms.terminationItem2'),
        t('terms.terminationItem3'),
      ],
    },
    {
      id: 'governing',
      icon: Gavel,
      title: t('terms.governingTitle'),
      content: t('terms.governingContent'),
      items: [
        t('terms.governingItem1'),
        t('terms.governingItem2'),
        t('terms.governingItem3'),
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
            {t('terms.backHome')}
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
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">{t('terms.badge')}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            {t('terms.heroTitle1')}{' '}
            <span className="gradient-text">{t('terms.heroTitle2')}</span>
          </h1>
          <p className="text-lg text-t-text/60 max-w-2xl mx-auto leading-relaxed">
            {t('terms.heroSubtitle')}
          </p>
          <p className="mt-4 text-sm text-t-text/40">
            {t('terms.lastUpdated')}: 2026-02-09
          </p>
        </div>
      </section>

      {/* Quick summary cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4 mb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: FileText, label: t('terms.summaryService'), value: t('terms.summaryServiceValue') },
            { icon: Shield, label: t('terms.summaryProtection'), value: t('terms.summaryProtectionValue') },
            { icon: Gavel, label: t('terms.summaryLaw'), value: t('terms.summaryLawValue') },
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
          <h2 className="text-2xl font-bold mb-4">{t('terms.contactTitle')}</h2>
          <p className="text-t-text/60 mb-6 max-w-xl mx-auto">{t('terms.contactContent')}</p>
          <a
            href="mailto:legal@gilo-ai.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
          >
            {t('terms.contactButton')}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-t-border/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-t-text/30">© 2026 GiLo AI. {t('terms.allRightsReserved')}</p>
        </div>
      </footer>
    </div>
  );
}
