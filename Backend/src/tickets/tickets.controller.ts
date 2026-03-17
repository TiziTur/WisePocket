import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { createWorker } from 'tesseract.js';
import { memoryStorage } from 'multer';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('ticket', { storage: memoryStorage() }))
  async uploadTicket(@UploadedFile() file?: Express.Multer.File) {
    return this.processTicketFile(file);
  }

  // Compatibility endpoint used by dashboard OCR form.
  @Post('ocr')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  async ocrTicket(@UploadedFile() file?: Express.Multer.File) {
    return this.processTicketFile(file);
  }

  private async processTicketFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debes enviar un archivo de imagen en el campo ticket o image.');
    }

    const text = await this.performOcr(file);
    const lines = text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    const commerce = this.extractCommerce(lines);
    const amount = this.extractAmount(lines);
    const detectedDate = this.extractDate(lines);
    const currency = this.detectCurrency(text);
    const category = this.suggestCategory(`${commerce} ${text}`);

    return {
      commerce,
      date: this.normalizeDate(detectedDate),
      amount,
      category,
      currency,
      rawText: text,
    };
  }

  private async performOcr(file: Express.Multer.File): Promise<string> {
    const provider = String(process.env.OCR_PROVIDER || 'ocrspace').toLowerCase();

    if (provider === 'ocrspace' && process.env.OCR_SPACE_API_KEY) {
      try {
        return await this.performOcrWithOcrSpace(file);
      } catch (error) {
        // Fallback to local OCR when external service is unavailable.
        console.warn('OCR.space failed, using local OCR fallback:', error);
      }
    }

    const worker = await createWorker('spa+eng');
    const result = await worker.recognize(file.buffer);
    await worker.terminate();
    return String(result?.data?.text || '');
  }

  private async performOcrWithOcrSpace(file: Express.Multer.File): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'image/jpeg' });

    formData.append('file', blob, file.originalname || 'ticket.jpg');
    formData.append('language', 'spa');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');
    formData.append('scale', 'true');

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        apikey: String(process.env.OCR_SPACE_API_KEY),
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`OCR.space HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string[];
      ParsedResults?: Array<{ ParsedText?: string }>;
    };

    if (data.IsErroredOnProcessing) {
      throw new Error((data.ErrorMessage || ['OCR.space processing error']).join(' | '));
    }

    const parsed = data.ParsedResults?.[0]?.ParsedText || '';
    if (!parsed.trim()) {
      throw new Error('OCR.space returned empty text');
    }

    return parsed;
  }

  private extractCommerce(lines: string[]): string {
    const knownBrands = ['zara', 'carrefour', 'mercadona', 'dia', 'lidl', 'ikea', 'netflix', 'spotify'];
    const brandHit = lines.find((line) => knownBrands.some((brand) => line.toLowerCase().includes(brand)));
    if (brandHit) {
      return brandHit.replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const headerLine = lines.slice(0, 8).find((line) => {
      const clean = line.replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean.length < 2 || clean.length > 40) return false;
      if (/\d/.test(clean)) return false;
      if (/ticket|factura|compra|caja|hora|fecha/i.test(clean)) return false;
      return /[A-Za-z]/.test(clean);
    });
    if (headerLine) {
      return headerLine;
    }

    const preferred = lines.find((line) => {
      const clean = line.replace(/[^A-Za-z0-9 ]/g, '').trim();
      if (clean.length < 3) return false;
      if (/ticket|factura|subtotal|total|caja|empleado|descripcion|cant|forma de pago/i.test(clean)) {
        return false;
      }
      return /[A-Za-z]/.test(clean);
    });

    return preferred || 'Comercio sin identificar';
  }

  private extractAmount(lines: string[]): number {
    const totalKeywords = /\btotal\b|importe|a pagar|saldo/i;
    const ignoredKeywords = /subtotal|iva|impuesto|descuento/i;
    const addressNoise = /calle|c\.|av\.?|avenida|local|loca|telefono|tel\.?|cp\b|codigo postal/i;

    // First pass: amount that appears in lines with TOTAL/A PAGAR.
    const prioritized: number[] = [];
    lines.forEach((line) => {
      const clean = line.toLowerCase();
      if (!totalKeywords.test(clean)) return;
      if (ignoredKeywords.test(clean)) return;

      const lineAmounts = this.extractMoneyCandidates(line, true);
      if (lineAmounts.length) {
        prioritized.push(lineAmounts[lineAmounts.length - 1]);
      }
    });
    if (prioritized.length) {
      return Number(prioritized[prioritized.length - 1].toFixed(2));
    }

    // Fallback: any money-like amount, avoiding obvious address/phone lines.
    const fallback: number[] = [];
    lines.forEach((line) => {
      if (addressNoise.test(line.toLowerCase())) return;
      const lineAmounts = this.extractMoneyCandidates(line, true);
      lineAmounts.forEach((value) => {
        if (value > 0 && value < 1_000_000) {
          fallback.push(value);
        }
      });
    });

    if (!fallback.length) {
      return 0;
    }

    return Number(fallback[fallback.length - 1].toFixed(2));
  }

  private extractMoneyCandidates(line: string, requireDecimals: boolean): number[] {
    const regex = requireDecimals
      ? /(?:€|eur|usd|ars|mxn|gbp|\$|£)?\s*([0-9]{1,3}(?:[\.,][0-9]{3})*[\.,][0-9]{2})\s*(?:€|eur|usd|ars|mxn|gbp)?/gi
      : /(?:€|eur|usd|ars|mxn|gbp|\$|£)?\s*([0-9]{1,6}(?:[\.,][0-9]{2})?)\s*(?:€|eur|usd|ars|mxn|gbp)?/gi;

    const values: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      const raw = String(match[1] || '').trim();
      const parsed = this.parseLocalizedAmount(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        values.push(parsed);
      }
    }

    return values;
  }

  private parseLocalizedAmount(raw: string): number {
    const value = raw.replace(/\s/g, '');
    const lastComma = value.lastIndexOf(',');
    const lastDot = value.lastIndexOf('.');

    // No separators: plain integer amount.
    if (lastComma === -1 && lastDot === -1) {
      return Number(value);
    }

    // Separator nearest to the end is treated as decimal separator.
    const decimalIndex = Math.max(lastComma, lastDot);
    const decimalSep = value[decimalIndex];
    const intPart = value.slice(0, decimalIndex).replace(/[\.,]/g, '');
    const decPart = value.slice(decimalIndex + 1).replace(/[\.,]/g, '');

    // Keep exactly two decimals when possible; otherwise treat as integer with grouping.
    if (decPart.length === 2) {
      return Number(`${intPart}.${decPart}`);
    }

    // OCR noise like 220,221 should become 220221, not a decimal amount.
    return Number((intPart + decPart) || '0');
  }

  private extractDate(lines: string[]): string | undefined {
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
    for (const line of lines) {
      const match = line.match(dateRegex);
      if (match?.[1]) {
        return match[1];
      }
    }
    return undefined;
  }

  private detectCurrency(text: string): 'EUR' | 'USD' | 'ARS' | 'GBP' | 'MXN' {
    const lower = text.toLowerCase();
    if (text.includes('€') || /\beur\b/.test(lower)) return 'EUR';
    if (text.includes('£') || /\bgbp\b/.test(lower)) return 'GBP';
    if (text.includes('us$') || /\busd\b/.test(lower) || text.includes('$')) return 'USD';
    if (/ars|peso|pesos/.test(lower)) return 'ARS';
    if (/mxn/.test(lower)) return 'MXN';
    return 'EUR';
  }

  private normalizeDate(value?: string): string {
    if (!value) {
      return new Date().toISOString().slice(0, 10);
    }

    const parts = value.split(/[\/\-]/).map((p) => p.trim());
    if (parts.length !== 3) {
      return new Date().toISOString().slice(0, 10);
    }

    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${year}-${month}-${day}`;
  }

  private suggestCategory(commerce: string): string {
    const value = commerce.toLowerCase();
    if (value.includes('super') || value.includes('market')) {
      return 'Alimentación';
    }
    if (value.includes('farm')) {
      return 'Salud';
    }
    if (value.includes('ropa') || value.includes('inditex') || value.includes('zara')) {
      return 'Ocio';
    }
    if (value.includes('gym') || value.includes('netflix') || value.includes('spotify')) {
      return 'Suscripciones';
    }
    if (value.includes('estacion') || value.includes('ypf') || value.includes('shell')) {
      return 'Transporte';
    }
    return 'Otro';
  }
}
