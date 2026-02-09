// ============================================================
// GiLo AI – Document Parser Service
// Parses PDF, DOCX, TXT, MD, CSV files into text content
// ============================================================

import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';

export interface ParsedDocument {
  text: string;
  pages?: number;
  metadata?: Record<string, unknown>;
}

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]);

/**
 * Check if a MIME type is supported for parsing
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType);
}

/**
 * Parse a document buffer into text
 */
export async function parseDocument(buffer: Buffer, mimeType: string, filename: string): Promise<ParsedDocument> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePdf(buffer);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return parseDocx(buffer);

    case 'text/plain':
    case 'text/markdown':
      return { text: buffer.toString('utf-8') };

    case 'text/csv':
      return parseCsv(buffer);

    case 'application/json':
      return parseJson(buffer);

    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const info = await parser.getInfo().catch(() => null);
  await parser.destroy();
  return {
    text: result.text,
    pages: result.pages.length,
    metadata: info ? { info: info.info } : {},
  };
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    metadata: { warnings: result.messages },
  };
}

function parseCsv(buffer: Buffer): ParsedDocument {
  const records = csvParse(buffer.toString('utf-8'), {
    columns: true,
    skipEmptyLines: true,
  }) as Record<string, string>[];

  // Convert CSV rows to readable text
  const lines = records.map((row, i) => {
    const pairs = Object.entries(row).map(([k, v]) => `${k}: ${v}`);
    return `Row ${i + 1}: ${pairs.join(', ')}`;
  });

  return { text: lines.join('\n') };
}

function parseJson(buffer: Buffer): ParsedDocument {
  const data = JSON.parse(buffer.toString('utf-8'));
  // Pretty-print for chunking
  return { text: JSON.stringify(data, null, 2) };
}
