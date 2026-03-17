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

    const worker = await createWorker('spa+eng');
    const result = await worker.recognize(file.buffer);
    await worker.terminate();

    const text = result.data.text || '';
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

  private extractCommerce(lines: string[]): string {
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
    const moneyRegex = /([0-9]{1,3}(?:[\.,][0-9]{3})*(?:[\.,][0-9]{2}))/g;
    const candidates: number[] = [];

    lines.forEach((line) => {
      const matches = line.match(moneyRegex) || [];
      matches.forEach((raw) => {
        const value = Number(raw.replace(/\./g, '').replace(',', '.'));
        if (Number.isFinite(value) && value > 0) {
          if (/total|importe|a pagar|saldo/i.test(line)) {
            candidates.push(value + 1000000); // prioritize total-like lines
          } else {
            candidates.push(value);
          }
        }
      });
    });

    if (!candidates.length) {
      return 0;
    }

    const best = Math.max(...candidates);
    return best > 1000000 ? Number((best - 1000000).toFixed(2)) : Number(best.toFixed(2));
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
