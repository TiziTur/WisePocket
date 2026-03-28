import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

type CounterBucket = {
  count: number;
  firstSeenAt: number;
};

@Injectable()
export class AuthSecurityService {
  private loginAttempts = new Map<string, CounterBucket>();

  generateToken() {
    return randomBytes(32).toString('hex');
  }

  hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  normalizeEmail(email: string) {
    return String(email || '').trim().toLowerCase();
  }

  assertLoginRateLimit(email: string) {
    const key = this.normalizeEmail(email);
    const now = Date.now();
    const maxAttempts = 8;
    const windowMs = 15 * 60 * 1000;

    const existing = this.loginAttempts.get(key);
    if (!existing || now - existing.firstSeenAt > windowMs) {
      this.loginAttempts.set(key, { count: 1, firstSeenAt: now });
      return;
    }

    existing.count += 1;
    if (existing.count > maxAttempts) {
      throw new HttpException('Demasiados intentos. Intentalo de nuevo en unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  clearLoginRateLimit(email: string) {
    const key = this.normalizeEmail(email);
    this.loginAttempts.delete(key);
  }
}
