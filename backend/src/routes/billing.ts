// ============================================================
// GiLo AI – Billing Routes
// Stripe checkout, portal & webhook handling
// ============================================================

import { Router, Request, Response } from 'express';
import { billingService, PLANS } from '../services/billingService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

export const billingRouter = Router();

// ----------------------------------------------------------
// GET /api/billing/plans — List available plans
// ----------------------------------------------------------
billingRouter.get('/plans', (req: Request, res: Response) => {
  res.json({
    plans: [
      { id: 'free', name: 'Free', price: 0, currency: 'usd', interval: 'month', features: ['3 agents', '100 messages/day', '10 MB storage'] },
      { id: 'pro', name: 'Pro', price: 29, currency: 'usd', interval: 'month', features: ['Unlimited agents', '10,000 messages/day', '1 GB storage', 'Custom domain', 'Priority support'] },
    ],
  });
});

// ----------------------------------------------------------
// POST /api/billing/checkout — Create Stripe Checkout session
// ----------------------------------------------------------
billingRouter.post('/checkout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const userEmail = (req as AuthenticatedRequest).user?.email;
    const { plan } = req.body;

    if (!plan || plan !== 'pro') {
      return res.status(400).json({ error: 'Invalid plan. Available: pro' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'User email not found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const { url } = await billingService.createCheckoutSession(
      userId,
      userEmail,
      plan,
      `${frontendUrl}/billing?success=true`,
      `${frontendUrl}/billing?canceled=true`,
    );

    res.json({ url });
  } catch (error: any) {
    console.error('Checkout error:', error.message);
    res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/billing/portal — Create Stripe Customer Portal
// ----------------------------------------------------------
billingRouter.post('/portal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const { url } = await billingService.createPortalSession(userId, `${frontendUrl}/billing`);
    res.json({ url });
  } catch (error: any) {
    console.error('Portal error:', error.message);
    res.status(500).json({ error: 'Failed to create portal session', details: error.message });
  }
});

// ----------------------------------------------------------
// POST /api/billing/webhook — Stripe Webhook handler
// IMPORTANT: Must use raw body (not parsed JSON)
// ----------------------------------------------------------
billingRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // req.body should be a raw Buffer when configured correctly
    const rawBody = (req as any).rawBody || req.body;
    if (!rawBody) {
      return res.status(400).json({ error: 'Missing request body' });
    }

    const result = await billingService.handleWebhookEvent(
      Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody),
      sig,
    );

    res.json(result);
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: 'Webhook verification failed', details: error.message });
  }
});
