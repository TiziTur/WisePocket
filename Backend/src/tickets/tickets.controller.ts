/**
 * tickets.controller.ts
 *
 * OCR pipeline — complete rewrite.
 *
 * Strategy:
 *  1. Accept any image format (JPEG/PNG/WEBP/BMP/TIFF/AVIF/GIF/HEIC/HEIF/PDF).
 *  2. Preprocess with sharp: rotate → grayscale → normalise contrast →
 *     adaptive sharpen → upscale to ≥2000 px wide → clean JPEG for OCR.
 *     HEIC/HEIF are first decoded with heic-convert (pure JS, no libheif).
 *  3. Try OCR.space engine 2 (ML) first; if it fails or returns empty text
 *     fall back to engine 1 (Tesseract-based), then to local Tesseract.js.
 *  4. Parse the raw text with specialised extractors for:
 *     - Commerce / store name
 *     - Grand total amount  (handles ARS large numbers, EU/US decimal formats)
 *     - Date               (all common receipt date formats)
 *     - Currency           (symbol, code and contextual heuristics)
 *     - Category           (taxonomy of ~120 keywords)
 */

import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { createWorker } from 'tesseract.js';
import { memoryStorage } from 'multer';
import * as sharp from 'sharp';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const heicConvert = require('heic-convert');

// ─── File-type guards ──────────────────────────────────────────────────────────

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/bmp', 'image/tiff', 'image/tif',
  'image/heic', 'image/heif', 'image/avif', 'application/pdf',
]);

const ALLOWED_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.bmp', '.tiff', '.tif', '.heic', '.heif', '.avif', '.pdf',
]);

function isAllowedFile(file: Express.Multer.File): boolean {
  const mime = (file.mimetype || '').toLowerCase();
  if (ALLOWED_MIMES.has(mime)) return true;
  const ext = (file.originalname || '').toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return ALLOWED_EXTS.has(ext);
}

// ─── Image pre-processing ──────────────────────────────────────────────────────

/**
 * Convert any supported image to a receipt-optimised greyscale JPEG.
 *
 * Pipeline:
 *   HEIC/HEIF → heic-convert (quality 1.0, lossless intermediate)
 *   ↓
 *   sharp.rotate()         — fix EXIF orientation
 *   .grayscale()           — remove colour noise; receipts are b/w anyway
 *   .normalise()           — stretch histogram to full 0-255 range
 *   .clahe()               — local contrast enhancement (helps faded ink)
 *   .sharpen()             — crisp text edges
 *   .resize(≥2000px)       — Tesseract accuracy degrades below ~1500 px wide
 *   .jpeg({ quality:97 })  — high-quality output, avoid re-encode artefacts
 */
async function normalizeImageBuffer(
  file: Express.Multer.File,
): Promise<{ buffer: Buffer; mimetype: string; filename: string }> {
  const mime = (file.mimetype || '').toLowerCase();
  const ext  = (file.originalname || '').toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';

  if (mime === 'application/pdf' || ext === '.pdf') {
    return { buffer: file.buffer, mimetype: 'application/pdf', filename: file.originalname || 'ticket.pdf' };
  }

  let src = file.buffer;

  // HEIC/HEIF — pure-JS decode (works on Railway with no libheif installed)
  const isHeic = mime === 'image/heic' || mime === 'image/heif' || ext === '.heic' || ext === '.heif';
  if (isHeic) {
    const ab = await heicConvert({ buffer: src, format: 'JPEG', quality: 1.0 });
    src = Buffer.from(ab);
  }

  // Read current dimensions so we only upscale, never downscale
  const meta = await sharp(src).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  // We want the longest side to be at least 2000 px
  const minPx = 2000;
  let resizeWidth: number | null = null;
  let resizeHeight: number | null = null;
  if (w > 0 && h > 0 && Math.max(w, h) < minPx) {
    if (w >= h) resizeWidth  = minPx;
    else        resizeHeight = minPx;
  }

  let pipeline = sharp(src)
    .rotate()       // EXIF auto-rotate
    .grayscale()    // greyscale — major OCR quality boost
    .normalise();   // global contrast stretch

  // CLAHE: local contrast (tileWidth/tileHeight are in pixels of the output)
  // Only available in sharp ≥ 0.30; wrap in try/catch for safety.
  try {
    pipeline = (pipeline as any).clahe({ width: 3, height: 3 });
  } catch {
    // clahe not available in this sharp version — skip
  }

  pipeline = pipeline.sharpen({ sigma: 1.5, m1: 2, m2: 3.5 });

  if (resizeWidth || resizeHeight) {
    pipeline = pipeline.resize(resizeWidth, resizeHeight, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3',
    });
  }

  const buffer = await pipeline.jpeg({ quality: 97, mozjpeg: false }).toBuffer();
  return { buffer, mimetype: 'image/jpeg', filename: 'ticket.jpg' };
}

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {

  @Post('upload')
  @UseInterceptors(FileInterceptor('ticket', { storage: memoryStorage() }))
  async uploadTicket(@UploadedFile() file?: Express.Multer.File) {
    return this.processTicketFile(file);
  }

  @Post('ocr')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  async ocrTicket(@UploadedFile() file?: Express.Multer.File) {
    return this.processTicketFile(file);
  }

  // ─── Main processing flow ──────────────────────────────────────────────────

  private async processTicketFile(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Debes enviar un archivo de imagen en el campo "ticket" o "image".');
    if (!isAllowedFile(file)) {
      const ext = (file.originalname || '').toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
      throw new BadRequestException(
        `Formato no soportado: ${file.mimetype || ext}. ` +
        'Formatos aceptados: JPG, PNG, WEBP, HEIC, HEIF, AVIF, BMP, TIFF, GIF, PDF.',
      );
    }

    const rawText = await this.performOcr(file);

    // Normalise OCR artefacts: collapse multiple spaces/tabs; keep newlines.
    const cleaned = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')   // collapse horizontal whitespace
      .trim();

    const lines = cleaned
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const commerce = this.extractCommerce(lines);
    const amount   = this.extractAmount(lines);
    const date     = this.extractDate(lines);
    const currency = this.detectCurrency(cleaned);
    const category = this.suggestCategory(cleaned, commerce);

    return {
      commerce,
      date:     this.normalizeDate(date),
      amount,
      category,
      currency,
      rawText:  cleaned,
    };
  }

  // ─── OCR engine orchestration ──────────────────────────────────────────────

  private async performOcr(file: Express.Multer.File): Promise<string> {
    const norm = await normalizeImageBuffer(file);

    const hasKey     = Boolean(process.env.OCR_SPACE_API_KEY);
    const provider   = String(process.env.OCR_PROVIDER || 'ocrspace').toLowerCase();
    const useRemote  = hasKey && provider === 'ocrspace';

    if (useRemote) {
      // Try engine 2 (ML, better on modern printed text) first,
      // then engine 1 (Tesseract-based, more reliable on structured tables).
      for (const engine of ['2', '1']) {
        try {
          const text = await this.callOcrSpace(norm, engine);
          if (text.trim().length > 20) return text;  // accept if non-trivial
        } catch (err) {
          console.warn(`OCR.space engine ${engine} failed:`, err);
        }
      }
      console.warn('Both OCR.space engines failed — falling back to local Tesseract');
    }

    if (norm.mimetype === 'application/pdf') {
      throw new BadRequestException(
        'El procesamiento de PDF requiere OCR_SPACE_API_KEY configurado en el servidor.',
      );
    }

    return this.runTesseract(norm.buffer);
  }

  /**
   * OCR.space REST call.
   * Parameters tuned for receipt images:
   *  - scale=true          : OCR.space upscales small images server-side
   *  - isTable=true        : tries to preserve column/tabular structure
   *  - detectOrientation   : handles rotated photos
   *  - filetype=JPG        : explicit hint so server doesn't sniff unnecessarily
   */
  private async callOcrSpace(
    norm: { buffer: Buffer; mimetype: string; filename: string },
    engine: string,
  ): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(norm.buffer)], { type: norm.mimetype }), norm.filename);
    form.append('language',          'spa');
    form.append('isOverlayRequired', 'false');
    form.append('OCREngine',         engine);
    form.append('scale',             'true');
    form.append('isTable',           'true');
    form.append('detectOrientation', 'true');
    form.append('filetype',          'JPG');

    const res = await fetch('https://api.ocr.space/parse/image', {
      method:  'POST',
      headers: { apikey: String(process.env.OCR_SPACE_API_KEY) },
      body:    form,
    });

    if (!res.ok) throw new Error(`OCR.space HTTP ${res.status}`);

    const json = (await res.json()) as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string[];
      ParsedResults?: Array<{ ParsedText?: string }>;
    };

    if (json.IsErroredOnProcessing) {
      throw new Error((json.ErrorMessage ?? ['OCR.space error']).join(' | '));
    }

    const text = json.ParsedResults?.[0]?.ParsedText ?? '';
    if (!text.trim()) throw new Error('OCR.space returned empty text');
    return text;
  }

  /**
   * Local Tesseract.js fallback.
   * PSM 6 (uniform block of text) performs best on receipt-style single-column layouts.
   * We run two passes: first Spanish, then English+Spanish if the first yields little text.
   */
  private async runTesseract(buffer: Buffer): Promise<string> {
    const run = async (lang: string): Promise<string> => {
      const w = await createWorker(lang, 1, { logger: () => undefined } as any);
      try {
        // PSM 6 = assume a single uniform block of text
        await w.setParameters({ tessedit_pageseg_mode: '6' as any });
        const { data } = await w.recognize(buffer);
        return data.text ?? '';
      } finally {
        await w.terminate();
      }
    };

    // Primary: Spanish only
    const spa = await run('spa');
    if (spa.trim().length > 30) return spa;

    // Fallback: bilingual (handles receipts that mix Spanish and English)
    const bilingual = await run('spa+eng');
    return bilingual.length >= spa.length ? bilingual : spa;
  }

  // ─── Commerce extraction ───────────────────────────────────────────────────

  /**
   * Identify the store/merchant name.
   *
   * Strategy (in priority order):
   *  1. Exact or partial match against a curated brand dictionary
   *  2. First "header-like" line in the top 12 lines
   *     (all-caps or title-case, reasonable length, no digits, not a label)
   *  3. Longest alphabetic line in the top 10 lines
   */
  private extractCommerce(lines: string[]): string {
    // ── Brand dictionary ─────────────────────────────────────────────────────
    const BRANDS: string[] = [
      // Argentina — supermarkets / hypermarkets
      'coto', 'coto digital', 'jumbo', 'disco', 'vea',
      'carrefour', 'carrefour express', 'carrefour maxi',
      'changomas', 'walmart', 'makro', 'maxiconsumo',
      'dia', 'dia%', 'el super', 'super vea', 'super express',
      'la anonima', 'anonima', 'cooperativa obrera',
      'toledo', 'lider', 'quilmes market',
      // Argentina — pharma
      'farmacity', 'dr ahorro', 'farmahorro', 'farmacias del pueblo',
      'farmacia', 'drogueria',
      // Argentina — fuel / convenience
      'ypf', 'ypf serviclub', 'shell', 'axion', 'axion energy',
      'petrobras', 'puma energy', 'gulf',
      // Argentina — fast food / café
      'mcdonalds', "mcdonald's", 'burger king', 'subway', 'mostaza',
      'wendys', "wendy's", 'starbucks', 'freddo', 'freddos',
      'rappi', 'pedidosya', 'glovo',
      // Argentina — electronics
      'garbarino', 'fravega', 'frávega', 'musimundo', 'megatone',
      'ribeiro', 'compumundo',
      // Argentina — fashion
      'zara', 'falabella', 'paris', 'ripley', 'h&m',
      'adidas', 'nike', 'puma', 'lacoste',
      // Argentina — banks / payments
      'rapipago', 'pago facil', 'pagofacil', 'bco', 'banco',
      'naranja', 'naranja x',
      // Spain / Europe
      'mercadona', 'lidl', 'alcampo', 'carrefour', 'eroski',
      'consum', 'ahorramas', 'dia', 'el corte ingles',
      'ikea', 'primark', 'decathlon', 'mediamarkt',
      // International
      'amazon', 'netflix', 'spotify', 'apple', 'google',
      'uber', 'uber eats', 'cabify', 'bolt',
    ];

    const low = (s: string) => s.toLowerCase();

    // 1. Brand match (first 15 lines)
    for (const line of lines.slice(0, 15)) {
      const ll = low(line);
      for (const brand of BRANDS) {
        if (ll.includes(brand)) {
          // Clean up the line — remove noise chars but keep letters/numbers/spaces
          return line.replace(/[^\w\sÀ-ÿ&.%-]/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }

    // Words that identify label/metadata lines (not store names)
    const META = /ticket|factura|comprobante|compra|caja|hora|fecha|iva|subtotal|total|importe|tel[eé]f|cuit|cai|afip|n[rº°]|item|cant|precio|cuil|rut|ruc|rg\.|ing\.|domicilio|direcci[oó]n|local\b|sucursal|calle|avenida|av\.|boulevard|pasaje/i;

    // 2. Header-like line in top 12 — prefers all-caps or title-case, no digits
    const headerLine = lines.slice(0, 12).find(line => {
      const c = line.replace(/[^\wÀ-ÿ\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (c.length < 3 || c.length > 60) return false;
      if (/\d/.test(c)) return false;
      if (META.test(c)) return false;
      return /[A-Za-zÀ-ÿ]{3}/.test(c);
    });
    if (headerLine) return headerLine.trim();

    // 3. Longest word-only line in top 10
    let best = '';
    for (const line of lines.slice(0, 10)) {
      const c = line.replace(/[^\wÀ-ÿ\s]/g, '').replace(/\s+/g, ' ').trim();
      if (c.length > best.length && /[A-Za-zÀ-ÿ]{3}/.test(c) && !META.test(c)) {
        best = c;
      }
    }
    if (best.length >= 3) return best;

    return 'Comercio sin identificar';
  }

  // ─── Amount extraction ─────────────────────────────────────────────────────

  /**
   * Extract the grand-total amount.
   *
   * Pass 1 — scan lines that contain a TOTAL / A-PAGAR keyword:
   *   collect all money candidates, keep the largest per line, then return
   *   the overall maximum (handles "Total bruto" < "Total a pagar" ordering).
   *
   * Pass 2 — if no TOTAL line found, return the largest plausible amount
   *   in the whole document (last resort, avoids phone/zip numbers).
   */
  private extractAmount(lines: string[]): number {
    const RE_TOTAL    = /\btotal\b|importe\s+total|a\s+pagar|saldo\s+a\s+pagar|monto\s+total|total\s+compra|total\s+a\s+pagar|gran\s+total|neto\s+a\s+pagar|efectivo|cambio\s+a|vuelto/i;
    const RE_IGNORE   = /subtotal|sub-total|iva\b|impuesto|descuento|bonif|perc|base\s+imponible|propina|recargo/i;
    const RE_NOISE    = /\b\d{4,6}[-\s]\d{3,4}[-\s]\d{3,4}\b|@|www\.|\.com|tel[eé]f|celular|cp\b|c\.p\.|c\.?p\.?\s*\d|cod\.\s*postal/i;

    const totals: number[] = [];

    for (const line of lines) {
      const ll = line.toLowerCase();
      if (!RE_TOTAL.test(ll)) continue;
      if (RE_IGNORE.test(ll)) continue;
      const candidates = this.parseAmountsFromLine(line);
      if (candidates.length) totals.push(Math.max(...candidates));
    }

    if (totals.length) return round2(Math.max(...totals));

    // Fallback: largest amount anywhere (skip lines that look like addresses/phones)
    const all: number[] = [];
    for (const line of lines) {
      if (RE_NOISE.test(line)) continue;
      const candidates = this.parseAmountsFromLine(line);
      candidates.forEach(v => { if (v > 0 && v < 1e9) all.push(v); });
    }

    return all.length ? round2(Math.max(...all)) : 0;
  }

  /**
   * Extract every plausible monetary value from one line.
   *
   * Handles:
   *   - European format : 1.234,56  →  1234.56
   *   - US format       : 1,234.56  →  1234.56
   *   - Integer ARS     : 12345     →  12345
   *   - With symbols    : $ 1.234,56  /  1.234,56 $  /  ARS 12345
   *
   * Deliberately conservative: requires at least one digit before separator.
   */
  private parseAmountsFromLine(line: string): number[] {
    // Remove currency symbols/codes for cleaner parsing, but remember position
    const stripped = line.replace(/(?:[$€£¥]|ARS|USD|EUR|GBP|MXN)\s*/gi, '');

    // Match numbers: 1.234,56  |  1,234.56  |  12345,67  |  12345  |  1234.5
    const RE = /\b(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)\b/g;

    const results: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = RE.exec(stripped)) !== null) {
      const raw = m[1];
      const val = parseLocalizedNumber(raw);
      if (Number.isFinite(val) && val > 0) results.push(val);
    }
    return results;
  }

  // ─── Date extraction ───────────────────────────────────────────────────────

  /**
   * Find the first plausible receipt date in the text.
   *
   * Supported formats:
   *   DD/MM/YYYY   DD-MM-YYYY   DD.MM.YYYY
   *   DD/MM/YY     DD-MM-YY
   *   YYYY-MM-DD   YYYY/MM/DD
   *   D/M/YY       D/M/YYYY
   *   "20 de Marzo de 2025"  /  "20 MAR 2025"  (Spanish month names)
   */
  private extractDate(lines: string[]): string | undefined {
    const MONTH_MAP: Record<string, string> = {
      enero:'01', febrero:'02', marzo:'03', abril:'04',
      mayo:'05', junio:'06', julio:'07', agosto:'08',
      septiembre:'09', setiembre:'09', octubre:'10', noviembre:'11', diciembre:'12',
      jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
      jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
      ene:'01', ago:'08',
    };

    for (const line of lines) {
      // ISO: YYYY-MM-DD or YYYY/MM/DD
      let m = line.match(/\b(20\d{2})[-\/](0?[1-9]|1[0-2])[-\/](0?[1-9]|[12]\d|3[01])\b/);
      if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;

      // DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY
      m = line.match(/\b(0?[1-9]|[12]\d|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](20\d{2})\b/);
      if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;

      // DD/MM/YY  DD-MM-YY
      m = line.match(/\b(0?[1-9]|[12]\d|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](\d{2})\b/);
      if (m) return `20${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;

      // "20 de Marzo de 2025"  or  "20 Marzo 2025"  or  "20 MAR 2025"
      m = line.match(/\b(\d{1,2})\s+(?:de\s+)?([A-Za-z]{3,12})\s+(?:de\s+)?(20\d{2})\b/i);
      if (m) {
        const mon = MONTH_MAP[m[2].toLowerCase().slice(0, 3)];
        if (mon) return `${m[3]}-${mon}-${m[1].padStart(2,'0')}`;
      }

      // "Marzo 20, 2025" (rare but seen on POS)
      m = line.match(/\b([A-Za-z]{3,12})\s+(\d{1,2}),?\s+(20\d{2})\b/i);
      if (m) {
        const mon = MONTH_MAP[m[1].toLowerCase().slice(0, 3)];
        if (mon) return `${m[3]}-${mon}-${m[2].padStart(2,'0')}`;
      }
    }
    return undefined;
  }

  // ─── Currency detection ────────────────────────────────────────────────────

  private detectCurrency(text: string): 'EUR' | 'USD' | 'ARS' | 'GBP' | 'MXN' {
    const t = text;
    const l = text.toLowerCase();

    // Explicit codes — highest confidence
    if (/\bars\b/.test(l) || /peso[s]?\s+argentino[s]?/i.test(t))   return 'ARS';
    if (/\bmxn\b/.test(l) || /peso[s]?\s+mexicano[s]?/i.test(t))    return 'MXN';
    if (t.includes('€') || /\beur\b/.test(l))                        return 'EUR';
    if (t.includes('£') || /\bgbp\b/.test(l))                        return 'GBP';
    if (/us\$/.test(l)   || /\busd\b/.test(l) || /d[oó]lar/i.test(t)) return 'USD';

    // Argentine receipt fingerprints (CUIT, AFIP, IVA alicuota, etc.)
    if (/cuit|cai\b|afip|iva\s*\d{1,2}\s*%|monotributo|consumidor\s+final|responsable\s+inscripto|ing\.\s*brutos/i.test(l)) {
      return 'ARS';
    }

    // Spanish receipt fingerprints
    if (/n\.?\s*i\.?\s*f\.?\b|c\.?\s*i\.?\s*f\.?\b|iva\b.*\d+,\d{2}/.test(l)) return 'EUR';

    // $ in context: if the app is primarily used in Argentina default to ARS
    if (t.includes('$')) return 'ARS';

    // No signal — default to EUR
    return 'EUR';
  }

  // ─── Date normalisation ────────────────────────────────────────────────────

  /** Return YYYY-MM-DD. Already normalised by extractDate; just validate range. */
  private normalizeDate(iso?: string): string {
    const today = new Date().toISOString().slice(0, 10);
    if (!iso) return today;

    // Quick sanity check: must look like YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return today;

    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return today;

    // Reject implausible years (before 2000 or more than 1 year in the future)
    const year = d.getFullYear();
    const nowYear = new Date().getFullYear();
    if (year < 2000 || year > nowYear + 1) return today;

    return iso;
  }

  // ─── Category suggestion ───────────────────────────────────────────────────

  /**
   * Assign a category from the commerce name + full raw text.
   * Returns the first matching category in priority order.
   */
  private suggestCategory(text: string, commerce: string): string {
    const haystack = (commerce + ' ' + text).toLowerCase();

    const match = (re: RegExp) => re.test(haystack);

    // ── Supermercado / Alimentación ──────────────────────────────────────────
    if (match(/coto|jumbo|disco|carrefour|changomas|la\s+anonima|anonima|cooperativa\s+obrera|super\s+vea|vea\b|supermercado|autoservicio|almac[eé]n|verduleria|fruteria|panaderia|panader[ií]a|fiambreria|carniceria|despensa|dietética|walmart|makro|maxiconsumo/)) return 'Supermercado';
    if (match(/yerba|mate\b|aceite|arroz|harina|az[uú]car|fideos|sal\b|pan\b|leche|manteca|queso|carne|pollo|cerdo|fruta|verdura|bebida|gaseosa|agua\s+mineral|mermelada|galleta|bizcocho|alf[ae]jor|chocolate|caf[eé]\b|t[eé]\b|vino\b|cerveza|yogur/)) return 'Alimentación';

    // ── Restaurantes / Delivery ──────────────────────────────────────────────
    if (match(/restaurant|resto\b|pizzer[ií]a|hamburgues|sushi|parrilla|tenedor\s+libre|cafeter[ií]a|bar\b|bar\s+y\s+rest|delivery|rappi|pedidosya|glovo|uber\s+eats|mcdonalds|mcdonald|burger\s+king|subway|mostaza|wendys|freddo|starbucks|tostados|lomit[oó]|milanesas/)) return 'Restaurantes';

    // ── Salud / Farmacia ─────────────────────────────────────────────────────
    if (match(/farmac[iy]|drogu[eé]ria|salud|cl[ií]nica|hospital|m[eé]dico|laboratorio|medicamento|remedio|aspirina|ibuprofeno|paracetamol|antibi[oó]tico|vitamina|suplemento|ortopedia|[oó]ptica|dental/)) return 'Salud';

    // ── Transporte / Combustible ─────────────────────────────────────────────
    if (match(/ypf|shell|axion|petrobras|puma\s+energy|gulf\b|nafta|combustible|gasoil|diesel|gasolina|estaci[oó]n\s+de\s+servicio|servicio\s+de\s+carga|peaje|autopista|subte|colectivo|tren\b|taxi|uber\b|cabify|remis|rent\s*a\s*car|concesionaria/)) return 'Transporte';

    // ── Servicios / Utilities ────────────────────────────────────────────────
    if (match(/edesur|edenor|metrogas|aysa|fibertel|claro\b|personal\b|movistar|telecom|internet|tel[eé]fono|celular|factura\s+de\s+luz|factura\s+de\s+gas|agua\b.*factura|servicio/)) return 'Servicios';

    // ── Indumentaria / Moda ──────────────────────────────────────────────────
    if (match(/zara|h&m|falabella|paris\b|ripley|adidas|nike\b|puma\b|lacoste|ropa|calzado|zapatilla|camisa|pantalon|vestido|jean|buzo|remera|campera|saco\b|zapato|bota\b|sandalia|indumentaria|vestimenta|moda\b|outlet|primark/)) return 'Indumentaria';

    // ── Electrónica / Tecnología ─────────────────────────────────────────────
    if (match(/garbarino|fravega|musimundo|megatone|ribeiro|compumundo|apple\s*store|samsung|lg\b|sony\b|notebook|laptop|celular|smartphone|tablet|tv\b|televisi[oó]n|computadora|impresora|auricular|electrodom[eé]stico/)) return 'Electrónica';

    // ── Ocio / Entretenimiento / Suscripciones ───────────────────────────────
    if (match(/netflix|spotify|amazon\s+prime|disney|hbo|flow\b|paramount|cine\b|teatro\b|concierto|evento|entradas|gym\b|gimnasio|fitness|crossfit|suscripci[oó]n|membres[ií]a/)) return 'Ocio';

    // ── Educación ────────────────────────────────────────────────────────────
    if (match(/universidad|facultad|escuela|colegio|libreria\b|librerias|papeleria|cuaderno|manual\b|libro\b|capacitaci[oó]n|curso\b|posgrado|maestr[ií]a|udemy|coursera/)) return 'Educación';

    // ── Hogar ────────────────────────────────────────────────────────────────
    if (match(/ikea|easy\b|sodimac|homedepo|ferreteri[ae]|pintura\b|pl[oó]mero|electricista|limpieza|detergente|lavandina|escoba|limpiador|hogar\b|mueble|silla\b|mesa\b|colchon/)) return 'Hogar';

    return 'Otro';
  }
}

// ─── Pure utility functions (module-level, no class state needed) ─────────────

/**
 * Parse a localised number string (European or US format) to a JS number.
 *
 * Logic:
 *   - If the last separator is followed by exactly 2 digits → decimal
 *   - Otherwise all separators are thousands separators
 *
 * Examples:
 *   "1.234,56" → 1234.56   (EU decimal)
 *   "1,234.56" → 1234.56   (US decimal)
 *   "1.234"    → 1234      (EU thousands, no decimal)
 *   "12345"    → 12345     (plain integer)
 *   "1234,5"   → 1234.5    (1 decimal place — OCR artefact, accept anyway)
 */
function parseLocalizedNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, '');
  if (!s) return NaN;

  const lastDot   = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const decIdx    = Math.max(lastDot, lastComma);

  if (decIdx === -1) return Number(s);

  const after = s.slice(decIdx + 1);

  // Exactly 2 (or 1) digits after the last separator → treat as decimal
  if (after.length <= 2 && /^\d+$/.test(after)) {
    const intStr = s.slice(0, decIdx).replace(/[.,]/g, '');
    return Number(`${intStr}.${after}`);
  }

  // 3 digits after separator → thousands grouping (e.g. "1.234" = 1234)
  if (after.length === 3 && /^\d{3}$/.test(after)) {
    return Number(s.replace(/[.,]/g, ''));
  }

  // Fallback: strip all separators
  return Number(s.replace(/[.,]/g, ''));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
