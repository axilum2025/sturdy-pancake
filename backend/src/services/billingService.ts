// ============================================================
// GiLo AI – Stripe Billing Service
// Manages checkout sessions, customer portal & webhook events
// ============================================================

import Stripe from 'stripe';
import { userModel, UserTier } from '../models/user';

// ----------------------------------------------------------
// Init Stripe client (lazy – only when keys are configured)
// ----------------------------------------------------------
let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// ----------------------------------------------------------
// Price IDs (configured via env — created in Stripe Dashboard)
// ----------------------------------------------------------
export const PLANS = {
  free: { name: 'Free', price: 0, priceId: '' },
  extra: {
    name: 'Extra Agent',
    price: 5.99,
    priceId: process.env.STRIPE_AGENT_PRICE_ID || '',
  },
  byo: {
    name: 'BYO LLM Agent',
    price: 3.99,
    priceId: process.env.STRIPE_BYO_PRICE_ID || '',
  },
} as const;

// ----------------------------------------------------------
// Create Stripe Checkout Session (per-agent pricing)
// ----------------------------------------------------------
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  quantity: number,
  planType: 'extra' | 'byo',
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripe();

  const plan = planType === 'byo' ? PLANS.byo : PLANS.extra;
  if (!plan.priceId) throw new Error(`Stripe price ID not configured for ${planType} plan`);

  // Fetch or create Stripe customer
  const user = await userModel.findById(userId);
  let customerId = user?.subscription?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: plan.priceId,
        quantity,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, quantity: String(quantity), planType },
    subscription_data: {
      metadata: { userId, quantity: String(quantity), planType },
    },
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { url: session.url };
}

// ----------------------------------------------------------
// Create Customer Portal session (manage/cancel subscription)
// ----------------------------------------------------------
export async function createPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripe();

  const user = await userModel.findById(userId);
  const customerId = user?.subscription?.stripeCustomerId;
  if (!customerId) throw new Error('No Stripe customer found for this user');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

// ----------------------------------------------------------
// Handle Stripe Webhook Events
// ----------------------------------------------------------
export async function handleWebhookEvent(
  rawBody: Buffer,
  signature: string,
): Promise<{ received: boolean }> {
  const stripe = getStripe();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

  const event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);

  switch (event.type) {
    // Subscription created or updated — extract quantity for paid agent slots
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      const status = sub.status;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const periodEnd = (sub as any).current_period_end
        ? new Date((sub as any).current_period_end * 1000).toISOString()
        : undefined;

      // Extract quantity and planType from subscription metadata
      const quantity = (sub as any).items?.data?.[0]?.quantity || parseInt(sub.metadata?.quantity || '0', 10);
      const planType = sub.metadata?.planType || 'extra';

      if (status === 'active' || status === 'trialing') {
        const updateData: any = {
          tier: quantity > 0 ? (planType === 'byo' ? 'byo' : 'pro') : 'free',
          subscription: {
            status: status as any,
            stripeCustomerId: customerId,
            subscriptionId: sub.id,
            currentPeriodEnd: periodEnd,
          },
        };
        if (planType === 'byo') {
          updateData.byoAgentSlots = quantity;
        } else {
          updateData.paidAgentSlots = quantity;
        }
        await userModel.update(userId, updateData);
      } else if (status === 'past_due') {
        await userModel.update(userId, {
          subscription: {
            status: 'past_due',
            stripeCustomerId: customerId,
            subscriptionId: sub.id,
            currentPeriodEnd: periodEnd,
          },
        });
      }
      break;
    }

    // Subscription deleted/canceled — reset to free
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      const planType = sub.metadata?.planType || 'extra';
      const updateData: any = {
        subscription: {
          status: 'canceled',
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          subscriptionId: sub.id,
        },
      };
      if (planType === 'byo') {
        updateData.byoAgentSlots = 0;
      } else {
        updateData.paidAgentSlots = 0;
      }
      // Set tier to free only if both slot types are 0
      const user = await userModel.findById(userId);
      const remainingExtra = planType === 'extra' ? 0 : (user?.paidAgentSlots || 0);
      const remainingByo = planType === 'byo' ? 0 : (user?.byoAgentSlots || 0);
      if (remainingExtra === 0 && remainingByo === 0) {
        updateData.tier = 'free';
      }
      await userModel.update(userId, updateData);
      break;
    }

    // Checkout session completed — only store Stripe customer/subscription IDs
    // The actual paidAgentSlots sync is handled by customer.subscription.created/updated
    // which is the source of truth for quantity.
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) break;

      const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id;
      const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id;

      // Only set stripeCustomerId/subscriptionId — don't set paidAgentSlots here
      // to avoid race condition with subscription.created event
      const user = await userModel.findById(userId);
      if (user && !user.subscription?.stripeCustomerId) {
        await userModel.update(userId, {
          subscription: {
            status: 'active',
            stripeCustomerId: customerId || undefined,
            subscriptionId: subId || undefined,
          },
        });
      }
      break;
    }

    default:
      // Unhandled event type – ignore
      break;
  }

  return { received: true };
}

export const billingService = {
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  PLANS,
};
