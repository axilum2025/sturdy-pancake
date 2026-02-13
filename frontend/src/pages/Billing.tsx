import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard, Crown, Check, ArrowLeft, ExternalLink, Loader2,
  Zap, AlertCircle, CheckCircle2, Plus, Minus, Key
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export default function Billing() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [agentQuantity, setAgentQuantity] = useState(1);

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';

  const paidSlots = user?.paidAgentSlots || 0;
  const maxAgents = user?.maxAgents || (2 + paidSlots);
  const hasPaidSlots = paidSlots > 0;
  const subscription = user?.subscription;
  const isSubscribed = hasPaidSlots && subscription?.status === 'active';

  useEffect(() => {
    if (isSuccess) {
      setSuccessMessage(t('billing.subscriptionActivated'));
      refreshUser?.();
    }
    if (isCanceled) {
      setError(t('billing.paymentCanceled'));
    }
  }, []);

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await api.post('/billing/checkout', { quantity: agentQuantity });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('billing.checkoutError'));
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await api.post('/billing/portal');
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('billing.portalError'));
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-t-page">
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-40" />

      {/* Header */}
      <header className="relative z-40 border-b border-t-overlay/5 glass">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-xl bg-t-overlay/5 border border-t-overlay/10 hover:bg-t-overlay/10 transition-all"
              >
                <ArrowLeft className="w-4 h-4 text-t-text/60" />
              </button>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                <span className="text-base font-bold tracking-tight gradient-text">
                  {t('billing.title')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-blue-500/15 border-blue-500/30 text-blue-400">
                {maxAgents} {t('billing.agentsTotal', 'agents')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banners */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 animate-fade-in-up">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-300">{successMessage}</p>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-400/60 hover:text-green-400">&times;</button>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-fade-in-up">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">&times;</button>
          </div>
        )}

        {/* Active subscription info */}
        {isSubscribed && (
          <div className="mb-8 glass-card rounded-2xl p-6 border border-indigo-500/20 animate-fade-in-up">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-t-text">
                    {paidSlots} {t('billing.paidSlots', 'agents payants')} ({maxAgents} {t('billing.agentsTotal', 'au total')})
                  </h2>
                </div>
                <p className="text-sm text-t-text/50">
                  {t('billing.subscriptionActive')}
                  {subscription?.currentPeriodEnd && (
                    <> — {t('billing.nextBilling')} <span className="text-t-text/70 font-medium">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </span></>
                  )}
                </p>
                <p className="text-sm text-t-text/40 mt-1">
                  {t('billing.monthlyTotal', 'Total mensuel')}: <span className="text-t-text/70 font-semibold">${paidSlots * 3}/mois</span>
                </p>
              </div>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-t-overlay/[0.06] border border-t-overlay/15 hover:bg-t-overlay/10 transition-all text-sm font-medium text-t-text/70"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {t('billing.manageSubscription')}
              </button>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-t-text mb-2">
            {t('billing.payPerAgent', 'Payez par agent')}
          </h1>
          <p className="text-sm text-t-text/40 max-w-lg mx-auto">
            {t('billing.payPerAgentDesc', '2 agents gratuits inclus. Ajoutez des agents supplémentaires à $3/mois chacun.')}
          </p>
        </div>

        {/* Plans grid: Free + Per-Agent */}
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free Plan */}
          <div className="glass-card rounded-2xl p-6 sm:p-8 border border-t-overlay/10 animate-fade-in-up">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-blue-500/10 border border-blue-500/20">
                <Zap className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-t-text">Free</h3>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-t-text">$0</span>
              </div>
              <p className="text-xs text-t-text/40 mt-1">{t('billing.forever', 'Pour toujours')}</p>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                t('billing.free2Agents', '2 agents inclus'),
                'GPT-4.1 Nano',
                t('billing.free200Msg', '200 messages/jour/agent'),
                t('billing.freeMaxTokens', '512 tokens max / réponse'),
                t('billing.freeKnowledge', '2 documents knowledge base'),
                t('billing.free50Mb', '50 MB stockage'),
                t('billing.freeAnalytics', 'Analytics (7 jours)'),
                t('billing.freeHistory', 'Historique chat (7 jours)'),
                t('billing.freeCustomDomain', 'Domaine personnalisé (slug.gilo.dev)'),
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 p-1 rounded-md bg-blue-500/10">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="text-sm text-t-text/70">{f}</span>
                </li>
              ))}
            </ul>
            <div className="w-full py-3 rounded-xl text-sm font-medium text-center bg-blue-500/10 border border-blue-500/20 text-blue-300">
              <Check className="w-4 h-4 inline mr-1.5" />
              {t('billing.included', 'Inclus')}
            </div>
          </div>

          {/* Per-Agent Plan */}
          <div className="relative glass-card rounded-2xl p-6 sm:p-8 border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
                {t('billing.flexible', 'Flexible')}
              </span>
            </div>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                <Crown className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-t-text">{t('billing.extraAgents', 'Agents supplémentaires')}</h3>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-t-text">$3</span>
                <span className="text-sm text-t-text/40">/{t('billing.perAgentMonth', 'agent/mois')}</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {[
                t('billing.paidNanoMini', 'GPT-4.1 Nano + Mini'),
                t('billing.paid500Msg', '500 messages/jour/agent'),
                t('billing.paidMaxTokens', '2048 tokens max / réponse'),
                t('billing.paidKnowledge', '20 documents knowledge base'),
                t('billing.paidByoLlm', 'BYO LLM (votre propre clé API)'),
                t('billing.paidWebhooks', 'Webhooks'),
                t('billing.paidAnalytics', 'Analytics (90 jours + export CSV)'),
                t('billing.paidHistory', 'Historique chat (90 jours)'),
                t('billing.paidBranding', 'Retirer "Powered by GiLo"'),
                t('billing.paidPriority', 'Support prioritaire'),
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 p-1 rounded-md bg-indigo-500/10">
                    <Check className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-sm text-t-text/70">{f}</span>
                </li>
              ))}
            </ul>

            {/* Quantity Selector */}
            <div className="mb-6 p-4 rounded-xl bg-t-overlay/[0.04] border border-t-overlay/10">
              <label className="block text-xs text-t-text/50 mb-2">{t('billing.howMany', 'Combien d\'agents supplémentaires ?')}</label>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setAgentQuantity(Math.max(1, agentQuantity - 1))}
                  className="p-2 rounded-lg bg-t-overlay/10 hover:bg-t-overlay/20 transition-all text-t-text/60"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <span className="text-3xl font-bold text-t-text">{agentQuantity}</span>
                  <p className="text-xs text-t-text/40">{t('billing.extraAgentsLabel', 'agents en plus')}</p>
                </div>
                <button
                  onClick={() => setAgentQuantity(Math.min(48, agentQuantity + 1))}
                  className="p-2 rounded-lg bg-t-overlay/10 hover:bg-t-overlay/20 transition-all text-t-text/60"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-t-text/50">{t('billing.totalAgents', 'Total agents')}: <span className="text-t-text/80 font-medium">{2 + agentQuantity}</span></span>
                <span className="text-indigo-400 font-semibold">${agentQuantity * 3}/{t('billing.month', 'mois')}</span>
              </div>
            </div>

            <button
              onClick={isSubscribed ? handlePortal : handleCheckout}
              disabled={checkoutLoading || portalLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold btn-gradient glow-blue flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {(checkoutLoading || portalLoading) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  {isSubscribed
                    ? t('billing.manageAgents', 'Gérer mes agents (portail)')
                    : t('billing.getStarted', 'Commencer — $' + (agentQuantity * 3) + '/mois')
                  }
                </>
              )}
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-lg font-bold text-t-text text-center mb-6">{t('billing.comparison')}</h2>
          <div className="glass-card rounded-2xl overflow-hidden border border-t-overlay/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-t-overlay/10">
                  <th className="text-left px-6 py-4 text-t-text/50 font-medium">{t('billing.feature')}</th>
                  <th className="text-center px-4 py-4 text-blue-400 font-semibold">{t('billing.freeAgents', 'Agents gratuits')}</th>
                  <th className="text-center px-4 py-4 text-indigo-400 font-semibold">
                    {t('billing.paidAgentsLabel', 'Agents payants')}
                    <Crown className="w-3 h-3 inline ml-1" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [t('billing.compModel', 'Modèle IA'), 'GPT-4.1 Nano', 'Nano + Mini'],
                  [t('billing.compMessages', 'Messages/jour'), '200', '500'],
                  [t('billing.compMaxTokens', 'Tokens max / réponse'), '512', '2048'],
                  [t('billing.compKnowledge', 'Knowledge base (docs)'), '2', '20'],
                  [t('billing.compByoLlm', 'BYO LLM'), '—', <Check key="byo" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compWebhooks', 'Webhooks'), '—', <Check key="wh2" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compAnalytics', 'Analytics'), t('billing.comp7d', '7 jours'), t('billing.comp90d', '90 jours + CSV')],
                  [t('billing.compHistory', 'Historique chat'), t('billing.comp7d', '7 jours'), t('billing.comp90dPlain', '90 jours')],
                  [t('billing.compBranding', '"Powered by GiLo"'), t('billing.compRequired', 'Obligatoire'), t('billing.compRemovable', 'Retirable')],
                  [t('billing.compCustomDomain', 'Custom domain'), <Check key="cd1" className="w-4 h-4 text-green-400 inline" />, <Check key="cd2" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compWidget', 'Widget embed'), <Check key="w1" className="w-4 h-4 text-green-400 inline" />, <Check key="w2" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compStore', 'Store'), <Check key="s1" className="w-4 h-4 text-green-400 inline" />, <Check key="s2" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compApi', 'API publique'), <Check key="a1" className="w-4 h-4 text-green-400 inline" />, <Check key="a2" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compSupport', 'Support prioritaire'), '—', <Check key="sp" className="w-4 h-4 text-green-400 inline" />],
                ].map(([feature, free, paid], i) => (
                  <tr key={i} className={`border-b border-t-overlay/5 ${i % 2 === 0 ? 'bg-t-overlay/[0.02]' : ''}`}>
                    <td className="px-6 py-3 text-t-text/70">{feature}</td>
                    <td className="px-4 py-3 text-center text-t-text/50">{free}</td>
                    <td className="px-4 py-3 text-center text-t-text/70 font-medium">{paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* BYO LLM highlight */}
        <div className="mt-12 max-w-3xl mx-auto glass-card rounded-2xl p-6 border border-amber-500/20 animate-fade-in-up">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Key className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-t-text mb-1">BYO LLM — {t('billing.byoTitle', 'Apportez votre propre clé API')}</h3>
              <p className="text-sm text-t-text/50 leading-relaxed">
                {t('billing.byoDesc', 'Connectez votre propre clé OpenAI, Anthropic, Mistral ou tout fournisseur compatible. Coût GiLo = $0 sur le LLM. Vous payez directement votre fournisseur et gardez un contrôle total.')}
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-lg font-bold text-t-text text-center mb-6">{t('billing.faq')}</h2>
          <div className="space-y-3">
            {[
              {
                q: t('billing.faq1q', 'Comment fonctionne la facturation ?'),
                a: t('billing.faq1a', 'Vous avez 2 agents gratuits. Chaque agent supplémentaire coûte $3/mois. La facturation s\'adapte automatiquement au nombre d\'agents.'),
              },
              {
                q: t('billing.faq2q', 'Puis-je annuler à tout moment ?'),
                a: t('billing.faq2a', 'Oui, vous pouvez annuler ou réduire le nombre d\'agents à tout moment depuis le portail de gestion.'),
              },
              {
                q: t('billing.faqByoQ', 'Qu\'est-ce que BYO LLM ?'),
                a: t('billing.faqByoA', 'BYO LLM (Bring Your Own LLM) vous permet d\'utiliser votre propre clé API. GiLo ne fait que proxyer les requêtes — coût pour nous = $0, contrôle total pour vous.'),
              },
              {
                q: t('billing.faq4q', 'Quels moyens de paiement acceptez-vous ?'),
                a: t('billing.faq4a', 'Nous acceptons toutes les cartes bancaires via Stripe (Visa, Mastercard, etc.).'),
              },
            ].map((item, i) => (
              <details key={i} className="glass-card rounded-xl border border-t-overlay/10 group">
                <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-t-text/80 hover:text-t-text transition-colors list-none flex items-center justify-between">
                  {item.q}
                  <span className="text-t-text/30 group-open:rotate-45 transition-transform text-lg">+</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-t-text/50 leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center animate-fade-in-up">
          <p className="text-sm text-t-text/30 mb-4">
            {t('billing.contactUs')} <a href="mailto:noreply@gilo.dev" className="text-blue-400 hover:underline">noreply@gilo.dev</a>
          </p>
        </div>
      </div>
    </div>
  );
}
