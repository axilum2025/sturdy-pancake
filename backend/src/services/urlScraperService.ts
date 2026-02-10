// ============================================================
// GiLo AI – URL Scraper Service
// Fetches a URL, extracts readable text, and feeds it into the
// knowledge pipeline (chunk → embed → store).
// ============================================================

import * as cheerio from 'cheerio';

export interface ScrapeResult {
  text: string;
  title: string;
  url: string;
  byteLength: number;
}

/** Elements whose text is not useful for knowledge indexing. */
const SKIP_SELECTORS = [
  'script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer',
  'header', '[role="navigation"]', '[role="banner"]', '[aria-hidden="true"]',
].join(', ');

/** Max body size we are willing to download (5 MB). */
const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

/** Timeout for the HTTP fetch (15 s). */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Scrape a single URL and return its readable text content.
 *
 * Strategy:
 * 1.  Fetch the page HTML.
 * 2.  Strip scripts, styles, nav, footer, etc.
 * 3.  Extract text from `<article>`, `<main>`, or `<body>`.
 * 4.  Collapse whitespace and return clean text.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  // ── Validate URL ──────────────────────────────────────────
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are supported');
  }

  // ── Fetch ─────────────────────────────────────────────────
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GiLo-AI-Bot/1.0 (Knowledge Indexer)',
        Accept: 'text/html,application/xhtml+xml,text/plain',
      },
      redirect: 'follow',
    });
  } catch (err: any) {
    throw new Error(
      err.name === 'AbortError'
        ? `Timeout: the page did not respond within ${FETCH_TIMEOUT_MS / 1000}s`
        : `Fetch failed: ${err.message}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
  const isPlainText = contentType.includes('text/plain');

  // ── Read body (with size guard) ───────────────────────────
  const buffer = await readLimitedBody(response, MAX_DOWNLOAD_BYTES);
  const rawText = buffer.toString('utf-8');

  if (isPlainText) {
    return {
      text: rawText.trim(),
      title: parsed.hostname + parsed.pathname,
      url,
      byteLength: buffer.length,
    };
  }

  if (!isHtml) {
    throw new Error(`Unsupported content-type: ${contentType}. Expected text/html or text/plain.`);
  }

  // ── Parse HTML ────────────────────────────────────────────
  const $ = cheerio.load(rawText);

  // Remove unwanted elements
  $(SKIP_SELECTORS).remove();

  // Prefer <article> or <main>, otherwise fall back to <body>
  let root = $('article').first();
  if (root.length === 0) root = $('main').first();
  if (root.length === 0) root = $('body').first();

  const title = $('title').text().trim() || parsed.hostname;

  // Extract text, preserving paragraph breaks
  const text = extractText(root, $);

  if (!text || text.length < 50) {
    throw new Error('Page yielded too little text content (< 50 chars).');
  }

  return { text, title, url, byteLength: buffer.length };
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Recursively extract text from a Cheerio element, inserting
 * newlines between block-level elements so chunking works well.
 */
function extractText(root: ReturnType<cheerio.CheerioAPI>, $: cheerio.CheerioAPI): string {
  const BLOCK_TAGS = new Set([
    'p', 'div', 'section', 'article', 'li', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'blockquote', 'pre', 'td', 'th', 'tr',
    'dt', 'dd', 'figcaption',
  ]);

  const parts: string[] = [];

  root.find('*').each((_, el) => {
    const $el = $(el);
    // Only look at leaf text nodes via their parent
    if ($el.children().length === 0) {
      const raw = $el.text().trim();
      if (raw.length === 0) return;
      const tag = el.type === 'tag' ? el.tagName?.toLowerCase() : '';
      if (BLOCK_TAGS.has(tag)) {
        parts.push('\n' + raw);
      } else {
        parts.push(' ' + raw);
      }
    }
  });

  return parts
    .join('')
    .replace(/\n{3,}/g, '\n\n')           // collapse 3+ newlines
    .replace(/[ \t]{2,}/g, ' ')            // collapse whitespace
    .trim();
}

/**
 * Read up to `limit` bytes from a fetch Response.
 * Throws if the page exceeds the limit.
 */
async function readLimitedBody(response: Response, limit: number): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response has no readable body');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    if (totalBytes > limit) {
      reader.cancel();
      throw new Error(`Page exceeds maximum size of ${(limit / 1024 / 1024).toFixed(0)} MB`);
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}
