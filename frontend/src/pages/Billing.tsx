import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard, Crown, Check, ArrowLeft, ExternalLink, Loader2,
  Zap, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
}

const PLAN_ICONS: Record<string, typeof Zap> = {
  free: Zap,
  pro: Crown,
};

export default function Billing() {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    fetchPlans();
    if (isSuccess) {
      setSuccessMessage('Votre abonnement a été activé avec succès !');
      refreshUser?.();
    }
    if (isCanceled) {
      setError('Le paiement a été annulé.');
    }
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await api.get('/billing/plans');
      setPlans(res.data.plans || []);
    } catch (err: any) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await api.post('/billing/checkout', { plan: planId });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création de la session de paiement.');
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
      setError(err.response?.data?.error || 'Erreur lors de l\'ouverture du portail.');
      setPortalLoading(false);
    }
  };

  const currentTier = user?.tier || 'free';
  const subscription = user?.subscription;
  const isSubscribed = currentTier === 'pro' && subscription?.status === 'active';

  return (
    <div className="min-h-screen bg-t-page">
      {/* Background */}
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
                  Abonnement & Facturation
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium capitalize px-2.5 py-1 rounded-full border ${
                currentTier === 'pro'
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                  : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
              }`}>
                {currentTier === 'pro' && <Crown className="w-3 h-3 inline mr-1" />}
                {currentTier} plan
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success / Error banners */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 animate-fade-in-up">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-300">{successMessage}</p>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-400/60 hover:text-green-400">
              &times;
            </button>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-fade-in-up">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
              &times;
            </button>
          </div>
        )}

        {/* Current subscription info (for Pro users) */}
        {isSubscribed && (
          <div className="mb-8 glass-card rounded-2xl p-6 border border-indigo-500/20 animate-fade-in-up">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-t-text">Abonnement Pro actif</h2>
                </div>
                <p className="text-sm text-t-text/50">
                  Votre abonnement est actif.
                  {subscription?.currentPeriodEnd && (
                    <> Prochaine facturation : <span className="text-t-text/70 font-medium">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </span></>
                  )}
                </p>
              </div>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-t-overlay/[0.06] border border-t-overlay/15 hover:bg-t-overlay/10 hover:border-t-overlay/25 transition-all text-sm font-medium text-t-text/70"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Gérer l'abonnement
              </button>
            </div>
          </div>
        )}

        {/* Plans section title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-t-text mb-2">
            {isSubscribed ? 'Votre plan' : 'Choisissez votre plan'}
          </h1>
          <p className="text-sm text-t-text/40 max-w-lg mx-auto">
            {isSubscribed
              ? 'Vous bénéficiez de toutes les fonctionnalités Pro. Gérez votre abonnement via le portail Stripe.'
              : 'Commencez gratuitement, passez au Pro quand vous êtes prêt. Aucun engagement, annulez à tout moment.'
            }
          </p>
        </div>

        {/* Plans grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan, planIdx) => {
              const isPro = plan.id === 'pro';
              const isCurrent = plan.id === currentTier;
              const PlanIcon = PLAN_ICONS[plan.id] || Zap;

              return (
                <div
                  key={plan.id}
                  className={`relative glass-card rounded-2xl p-6 sm:p-8 transition-all duration-300 animate-fade-in-up ${
                    isPro
                      ? 'border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/5'
                      : 'border border-t-overlay/10'
                  } ${isCurrent ? 'ring-2 ring-blue-500/30' : ''}`}
                  style={{ animationDelay: `${planIdx * 100}ms` }}
                >
                  {/* Popular badge */}
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
                        Populaire
                      </span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="text-center mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                      isPro
                        ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30'
                        : 'bg-blue-500/10 border border-blue-500/20'
                    }`}>
                      <PlanIcon className={`w-7 h-7 ${isPro ? 'text-indigo-400' : 'text-blue-400'}`} />
                    </div>
                    <h3 className="text-xl font-bold text-t-text">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-t-text">${plan.price}</span>
                      {plan.price > 0 && (
                        <span className="text-sm text-t-text/40">/ mois</span>
                      )}
                    </div>
                    {plan.price === 0 && (
                      <p className="text-xs text-t-text/40 mt-1">Pour toujours</p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => {
                      return (
                        <li key={i} className="flex items-start gap-3">
                          <div className={`mt-0.5 p-1 rounded-md ${
                            isPro ? 'bg-indigo-500/10' : 'bg-blue-500/10'
                          }`}>
                            <Check className={`w-3.5 h-3.5 ${isPro ? 'text-indigo-400' : 'text-blue-400'}`} />
                          </div>
                          <span className="text-sm text-t-text/70">{feature}</span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Action button */}
                  <div className="mt-auto">
                    {isCurrent ? (
                      <div className={`w-full py-3 rounded-xl text-sm font-medium text-center border ${
                        isPro
                          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                          : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                      }`}>
                        <Check className="w-4 h-4 inline mr-1.5" />
                        Plan actuel
                      </div>
                    ) : isPro ? (
                      <button
                        onClick={() => handleCheckout('pro')}
                        disabled={checkoutLoading}
                        className="w-full py-3 rounded-xl text-sm font-semibold btn-gradient glow-blue flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {checkoutLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Crown className="w-4 h-4" />
                            Passer au Pro
                          </>
                        )}
                      </button>
                    ) : isSubscribed ? (
                      <button
                        onClick={handlePortal}
                        disabled={portalLoading}
                        className="w-full py-3 rounded-xl text-sm font-medium bg-t-overlay/[0.06] border border-t-overlay/10 text-t-text/60 hover:bg-t-overlay/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {portalLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Downgrader'
                        )}
                      </button>
                    ) : (
                      <div className="w-full py-3 rounded-xl text-sm font-medium text-center bg-t-overlay/[0.04] border border-t-overlay/10 text-t-text/40">
                        Plan actuel
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Comparison Table */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-lg font-bold text-t-text text-center mb-6">Comparaison détaillée</h2>
          <div className="glass-card rounded-2xl overflow-hidden border border-t-overlay/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-t-overlay/10">
                  <th className="text-left px-6 py-4 text-t-text/50 font-medium">Fonctionnalité</th>
                  <th className="text-center px-4 py-4 text-blue-400 font-semibold">Free</th>
                  <th className="text-center px-4 py-4 text-indigo-400 font-semibold">
                    Pro
                    <Crown className="w-3 h-3 inline ml-1" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Agents', '5', 'Illimité'],
                  ['Messages / jour', '100', '10 000'],
                  ['Stockage', '10 Mo', '1 Go'],
                  ['Knowledge Base (RAG)', '1 doc', 'Illimité'],
                  ['MCP Servers', '2', 'Illimité'],
                  ['Webhook Events', '2', 'Illimité'],
                  ['API Keys', '1', 'Illimité'],
                  ['Domaine personnalisé', '—', <Check key="cd" className="w-4 h-4 text-green-400 inline" />],
                  ['Widget embeddable', <Check key="w1" className="w-4 h-4 text-green-400 inline" />, <Check key="w2" className="w-4 h-4 text-green-400 inline" />],
                  ['Store Publishing', <Check key="s1" className="w-4 h-4 text-green-400 inline" />, <Check key="s2" className="w-4 h-4 text-green-400 inline" />],
                  ['Analytics avancés', '—', <Check key="a" className="w-4 h-4 text-green-400 inline" />],
                  ['Support prioritaire', '—', <Check key="sp" className="w-4 h-4 text-green-400 inline" />],
                ].map(([feature, free, pro], i) => (
                  <tr key={i} className={`border-b border-t-overlay/5 ${i % 2 === 0 ? 'bg-t-overlay/[0.02]' : ''}`}>
                    <td className="px-6 py-3 text-t-text/70">{feature}</td>
                    <td className="px-4 py-3 text-center text-t-text/50">{free}</td>
                    <td className="px-4 py-3 text-center text-t-text/70 font-medium">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-lg font-bold text-t-text text-center mb-6">Questions fréquentes</h2>
          <div className="space-y-3">
            {[
              {
                q: 'Puis-je annuler à tout moment ?',
                a: 'Oui, vous pouvez annuler votre abonnement Pro à tout moment depuis le portail de gestion. Vous conserverez l\'accès Pro jusqu\'à la fin de la période de facturation en cours.',
              },
              {
                q: 'Que se passe-t-il si je dépasse les limites du plan Free ?',
                a: 'Vous recevrez une notification et vos agents continueront de fonctionner. Nous vous inviterons à passer au plan Pro pour débloquer des limites plus élevées.',
              },
              {
                q: 'Le paiement est-il sécurisé ?',
                a: 'Oui, tous les paiements sont traités par Stripe, le leader mondial du paiement en ligne. Vos données bancaires ne transitent jamais par nos serveurs.',
              },
              {
                q: 'Y a-t-il une période d\'essai ?',
                a: 'Le plan Free vous permet de tester toutes les fonctionnalités de base sans limite de temps. Passez au Pro uniquement quand vous en avez besoin.',
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

        {/* Footer CTA */}
        {!isSubscribed && (
          <div className="mt-16 text-center animate-fade-in-up">
            <p className="text-sm text-t-text/30 mb-4">
              Des questions ? Contactez-nous à <a href="mailto:support@gilo.dev" className="text-blue-400 hover:underline">support@gilo.dev</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
