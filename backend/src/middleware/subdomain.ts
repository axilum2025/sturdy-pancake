// ============================================================
// GiLo AI – Subdomain Middleware
// Routes requests from {slug}.gilo.dev to the correct agent
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { agentModel } from '../models/agent';

/**
 * Base domain for the application.
 * Set via GILO_DOMAIN env var (e.g. "gilo.dev").
 * In development, this is not used — subdomain routing is skipped.
 */
const BASE_DOMAIN = process.env.GILO_DOMAIN || '';

/**
 * Middleware that detects subdomain-based agent access.
 * 
 * For a request to `my-agent.gilo.dev`:
 *   - Extracts "my-agent" as the slug
 *   - Looks up the agent by slug
 *   - Attaches `req.agentBySubdomain` with the agent data
 * 
 * Skipped when:
 *   - No GILO_DOMAIN is configured
 *   - Host matches the base domain (no subdomain)
 *   - Host is localhost / IP / dev environment
 *   - Request path starts with /api (API routes use normal routing)
 */
export function subdomainMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip if no base domain configured
  if (!BASE_DOMAIN) {
    return next();
  }

  // Skip API routes — they use normal path-based routing
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }

  const host = (req.hostname || req.headers.host || '').split(':')[0].toLowerCase();

  // Skip if it's the base domain itself (no subdomain)
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) {
    return next();
  }

  // Skip localhost / IPs / dev environments
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost') || host.includes('codespaces')) {
    return next();
  }

  // Extract subdomain: "my-agent.gilo.dev" → "my-agent"
  const suffix = `.${BASE_DOMAIN}`;
  if (!host.endsWith(suffix)) {
    return next();
  }

  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes('.')) {
    // Empty slug or nested subdomain (e.g. a.b.gilo.dev) — skip
    return next();
  }

  // Look up agent by slug
  agentModel.findBySlug(slug)
    .then((agent) => {
      if (!agent) {
        return res.status(404).json({
          error: 'Agent not found',
          message: `No agent exists at ${slug}.${BASE_DOMAIN}`,
        });
      }

      if (agent.status !== 'deployed') {
        return res.status(503).json({
          error: 'Agent not deployed',
          message: 'This agent is not currently available.',
        });
      }

      // Attach agent to request for downstream handlers
      (req as any).agentBySubdomain = agent;
      (req as any).agentSlug = slug;
      next();
    })
    .catch((err) => {
      console.error('Subdomain lookup error:', err);
      next(); // Fall through on error
    });
}
