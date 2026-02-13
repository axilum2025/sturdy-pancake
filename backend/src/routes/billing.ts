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
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'usd',
        interval: 'month',
        features: [
          '2 agents included',
          'GPT-4.1 Nano',
          '200 messages/day/agent',
          '512 tokens max per response',
          '2 knowledge docs per agent',
          '50 MB storage',
          'Analytics (7 days)',
          'Chat history (7 days)',
          'Custom domain (slug.gilo.dev)',
        ],
      },
      {
        id: 'agent',
        name: 'Extra Agent',
        price: 3,
        currency: 'usd',
        interval: 'month',
        unit: 'per agent',
        features: [
          '$3/agent/month',
          'GPT-4.1 Nano + Mini',
          '500 messages/day/agent',
          '2048 tokens max per response',
          '20 knowledge docs per agent',
          'BYO LLM (your own API key)',
          'Webhooks',
          'Analytics (90 days + CSV export)',
          'Chat history (90 days)',
          'Remove "Powered by GiLo" branding',
          'Priority support',
        ],
      },
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
    const { quantity } = req.body;

    const agentCount = parseInt(quantity, 10);
    if (!agentCount || agentCount < 1 || agentCount > 50) {
      return res.status(400).json({ error: 'Invalid quantity. Must be 1-50 agent slots.' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'User email not found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const { url } = await billingService.createCheckoutSession(
      userId,
      userEmail,
      agentCount,
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
