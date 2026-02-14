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

  const [checkoutLoading, setCheckoutLoading] = useState<'extra' | 'byo' | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [extraQuantity, setExtraQuantity] = useState(1);
  const [byoQuantity, setByoQuantity] = useState(1);

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';

  const paidSlots = user?.paidAgentSlots || 0;
  const byoSlots = (user as any)?.byoAgentSlots || 0;
  const maxAgents = user?.maxAgents || (1 + paidSlots + byoSlots);
  const hasAnyPaid = paidSlots > 0 || byoSlots > 0;
  const subscription = user?.subscription;
  const isSubscribed = hasAnyPaid && subscription?.status === 'active';

  useEffect(() => {
    if (isSuccess) {
      setSuccessMessage(t('billing.subscriptionActivated'));
      refreshUser?.();
    }
    if (isCanceled) {
      setError(t('billing.paymentCanceled'));
    }
  }, []);

  const handleCheckout = async (planType: 'extra' | 'byo') => {
    setCheckoutLoading(planType);
    setError(null);
    try {
      const quantity = planType === 'extra' ? extraQuantity : byoQuantity;
      const res = await api.post('/billing/checkout', { quantity, planType });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('billing.checkoutError'));
      setCheckoutLoading(null);
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

  const monthlyTotal = (paidSlots * 5.99) + (byoSlots * 3.99);

  return (
    <div className="min-h-screen bg-t-page">
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-40" />

      {/* Header */}
      <header className="relative z-40 border-b border-t-overlay/5 glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                    {paidSlots > 0 && <>{paidSlots} Extra</>}
                    {paidSlots > 0 && byoSlots > 0 && ' + '}
                    {byoSlots > 0 && <>{byoSlots} BYO</>}
                    {' '}({maxAgents} {t('billing.agentsTotal', 'au total')})
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
                  {t('billing.monthlyTotal', 'Total mensuel')}: <span className="text-t-text/70 font-semibold">${monthlyTotal.toFixed(2)}/{t('billing.month', 'mois')}</span>
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
            {t('billing.payPerAgent')}
          </h1>
          <p className="text-sm text-t-text/40 max-w-lg mx-auto">
            {t('billing.payPerAgentDesc')}
          </p>
        </div>

        {/* Plans grid: Free + Extra + BYO LLM */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free Plan */}
          <div className="glass-card rounded-2xl p-6 sm:p-8 border border-t-overlay/10 animate-fade-in-up flex flex-col">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-blue-500/10 border border-blue-500/20">
                <Zap className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-t-text">Free</h3>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-t-text">$0</span>
              </div>
              <p className="text-xs text-t-text/40 mt-1">{t('billing.forever')}</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                t('billing.free1Agent'),
                'GPT-4.1 Nano',
                t('billing.free200Msg'),
                t('billing.freeMaxTokens'),
                t('billing.freeKnowledge'),
                t('billing.free50Mb'),
                t('billing.freeAnalytics'),
                t('billing.freeHistory'),
                t('billing.freeCustomDomain'),
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
              {t('billing.included')}
            </div>
          </div>

          {/* Extra Plan */}
          <div className="relative glass-card rounded-2xl p-6 sm:p-8 border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/5 animate-fade-in-up flex flex-col" style={{ animationDelay: '100ms' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
                {t('billing.flexible')}
              </span>
            </div>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                <Crown className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-t-text">{t('billing.extraAgents')}</h3>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-t-text">$5.99</span>
                <span className="text-sm text-t-text/40">/{t('billing.perAgentMonth')}</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6 flex-1">
              {[
                t('billing.extraNanoMini'),
                t('billing.extra500Msg'),
                t('billing.extraMaxTokens'),
                t('billing.extraKnowledge'),
                t('billing.extraWebhooks'),
                t('billing.extraAnalytics'),
                t('billing.extraHistory'),
                t('billing.extraBranding'),
                t('billing.extraPriority'),
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
              <label className="block text-xs text-t-text/50 mb-2">{t('billing.howMany')}</label>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setExtraQuantity(Math.max(1, extraQuantity - 1))}
                  className="p-2 rounded-lg bg-t-overlay/10 hover:bg-t-overlay/20 transition-all text-t-text/60"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <span className="text-3xl font-bold text-t-text">{extraQuantity}</span>
                  <p className="text-xs text-t-text/40">{t('billing.extraAgentsLabel')}</p>
                </div>
                <button
                  onClick={() => setExtraQuantity(Math.min(48, extraQuantity + 1))}
                  className="p-2 rounded-lg bg-t-overlay/10 hover:bg-t-overlay/20 transition-all text-t-text/60"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-right">
                <span className="text-indigo-400 font-semibold">${(extraQuantity * 5.99).toFixed(2)}/{t('billing.month')}</span>
              </div>
            </div>

            <button
              onClick={paidSlots > 0 ? handlePortal : () => handleCheckout('extra')}
              disabled={checkoutLoading !== null || portalLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold btn-gradient glow-blue flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {(checkoutLoading === 'extra' || (paidSlots > 0 && portalLoading)) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  {paidSlots > 0
                    ? t('billing.manageAgents')
                    : t('billing.getStartedExtra')
                  }
                </>
              )}
            </button>
          </div>

          {/* BYO LLM Plan */}
          <div className="relative glass-card rounded-2xl p-6 sm:p-8 border-2 border-amber-500/30 shadow-lg shadow-amber-500/5 animate-fade-in-up flex flex-col" style={{ animationDelay: '200ms' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white shadow-lg shadow-amber-500/30">
                BYO LLM
              </span>
            </div>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                <Key className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-t-text">BYO LLM</h3>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-t-text">$3.99</span>
                <span className="text-sm text-t-text/40">/{t('billing.perAgentMonth')}</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6 flex-1">
              {[
                t('billing.byoOwnKey'),
                t('billing.byoNanoMini'),
                t('billing.byoUnlimited'),
                t('billing.byoMaxTokens'),
                t('billing.byoKnowledge'),
                t('billing.byoWebhooks'),
                t('billing.byoAnalytics'),
                t('billing.byoHistory'),
                t('billing.byoBranding'),
                t('billing.byoPriority'),
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 p-1 rounded-md bg-amber-500/10">
                    <Check className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-sm text-t-text/70">{f}</span>
                </li>
              ))}
            </ul>

            {/* Quantity Selector */}
            <div className="mb-6 p-4 rounded-xl bg-t-overlay/[0.04] border border-t-overlay/10">
              <label className="block text-xs text-t-text/50 mb-2">{t('billing.howManyByo')}</label>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setByoQuantity(Math.max(1, byoQuantity - 1))}
                  className="p-2 rounded-lg bg-t-overlay/10 hover:bg-t-overlay/20 transition-all text-t-text/60"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <span className="text-3xl font-bold text-t-text">{byoQuantity}</span>
                  <p className="text-xs text-t-text/40">{t('billing.byoAgentsLabel')}</p>
                </div>
                <button
                  onClick={() => setByoQuantity(Math.min(48, byoQuantity + 1))}
                  className="p-2 rounded-lg bg-t-overlay/10 hover:bg-t-overlay/20 transition-all text-t-text/60"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-right">
                <span className="text-amber-400 font-semibold">${(byoQuantity * 3.99).toFixed(2)}/{t('billing.month')}</span>
              </div>
            </div>

            <button
              onClick={byoSlots > 0 ? handlePortal : () => handleCheckout('byo')}
              disabled={checkoutLoading !== null || portalLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {(checkoutLoading === 'byo' || (byoSlots > 0 && portalLoading)) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  {byoSlots > 0
                    ? t('billing.manageAgents')
                    : t('billing.getStartedByo')
                  }
                </>
              )}
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mt-16 max-w-5xl mx-auto">
          <h2 className="text-lg font-bold text-t-text text-center mb-6">{t('billing.comparison')}</h2>
          <div className="glass-card rounded-2xl overflow-hidden border border-t-overlay/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-t-overlay/10">
                  <th className="text-left px-6 py-4 text-t-text/50 font-medium">{t('billing.feature')}</th>
                  <th className="text-center px-4 py-4 text-blue-400 font-semibold">Free</th>
                  <th className="text-center px-4 py-4 text-indigo-400 font-semibold">
                    Extra <Crown className="w-3 h-3 inline ml-1" />
                  </th>
                  <th className="text-center px-4 py-4 text-amber-400 font-semibold">
                    BYO LLM <Key className="w-3 h-3 inline ml-1" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [t('billing.compPrice'), '$0', '$5.99/' + t('billing.month'), '$3.99/' + t('billing.month')],
                  [t('billing.compModel'), 'GPT-4.1 Nano', 'Nano + Mini', t('billing.compOwnKey')],
                  [t('billing.compMessages'), '200', '500', t('billing.unlimited')],
                  [t('billing.compMaxTokens'), '512', '2048', t('billing.unlimited')],
                  [t('billing.compKnowledge'), '2', '10', '20'],
                  [t('billing.compWebhooks'), '—', <Check key="wh2" className="w-4 h-4 text-green-400 inline" />, <Check key="wh3" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compAnalytics'), t('billing.comp7d'), t('billing.comp90d'), t('billing.comp90d')],
                  [t('billing.compHistory'), t('billing.comp7d'), t('billing.comp90dPlain'), t('billing.comp90dPlain')],
                  [t('billing.compBranding'), t('billing.compRequired'), t('billing.compRequired'), t('billing.compRemovable')],
                  [t('billing.compCustomDomain'), <Check key="cd1" className="w-4 h-4 text-green-400 inline" />, <Check key="cd2" className="w-4 h-4 text-green-400 inline" />, <Check key="cd3" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compWidget'), <Check key="w1" className="w-4 h-4 text-green-400 inline" />, <Check key="w2" className="w-4 h-4 text-green-400 inline" />, <Check key="w3" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compStore'), <Check key="s1" className="w-4 h-4 text-green-400 inline" />, <Check key="s2" className="w-4 h-4 text-green-400 inline" />, <Check key="s3" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compApi'), <Check key="a1" className="w-4 h-4 text-green-400 inline" />, <Check key="a2" className="w-4 h-4 text-green-400 inline" />, <Check key="a3" className="w-4 h-4 text-green-400 inline" />],
                  [t('billing.compSupport'), '—', <Check key="sp2" className="w-4 h-4 text-green-400 inline" />, <Check key="sp3" className="w-4 h-4 text-green-400 inline" />],
                ].map(([feature, free, extra, byo], i) => (
                  <tr key={i} className={`border-b border-t-overlay/5 ${i % 2 === 0 ? 'bg-t-overlay/[0.02]' : ''}`}>
                    <td className="px-6 py-3 text-t-text/70">{feature}</td>
                    <td className="px-4 py-3 text-center text-t-text/50">{free}</td>
                    <td className="px-4 py-3 text-center text-t-text/70 font-medium">{extra}</td>
                    <td className="px-4 py-3 text-center text-t-text/70 font-medium">{byo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* BYO LLM highlight */}
        <div className="mt-12 max-w-5xl mx-auto glass-card rounded-2xl p-6 border border-amber-500/20 animate-fade-in-up">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Key className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-t-text mb-1">BYO LLM — {t('billing.byoTitle')}</h3>
              <p className="text-sm text-t-text/50 leading-relaxed">
                {t('billing.byoDesc')}
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
                q: t('billing.faq1q'),
                a: t('billing.faq1a'),
              },
              {
                q: t('billing.faq2q'),
                a: t('billing.faq2a'),
              },
              {
                q: t('billing.faqByoQ'),
                a: t('billing.faqByoA'),
              },
              {
                q: t('billing.faq4q'),
                a: t('billing.faq4a'),
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
