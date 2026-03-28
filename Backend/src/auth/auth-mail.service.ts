import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.transporter = this.createTransporter();
  }

  private createTransporter(): nodemailer.Transporter | null {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') || '587');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn('SMTP is not configured. Email links will be logged to console.');
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  private getFromAddress() {
    return this.configService.get<string>('MAIL_FROM') || 'no-reply@klarity.local';
  }

  async sendVerificationEmail(to: string, name: string, url: string): Promise<void> {
    const subject = 'Verifica tu correo en Klarity';
    const text = `Hola ${name},\n\nVerifica tu correo haciendo clic en este enlace:\n${url}\n\nSi no solicitaste esta cuenta, ignora este mensaje.`;

    await this.sendMailFallback({ to, subject, text, html: `<p>Hola ${name},</p><p>Verifica tu correo haciendo clic en este enlace:</p><p><a href=\"${url}\">Verificar correo</a></p><p>Si no solicitaste esta cuenta, ignora este mensaje.</p>` });
  }

  async sendPasswordResetEmail(to: string, name: string, url: string): Promise<void> {
    const subject = 'Recuperacion de cuenta Klarity';
    const text = `Hola ${name},\n\nPuedes restablecer tu contrasena aqui:\n${url}\n\nSi no solicitaste este cambio, ignora este mensaje.`;

    await this.sendMailFallback({ to, subject, text, html: `<p>Hola ${name},</p><p>Puedes restablecer tu contrasena aqui:</p><p><a href=\"${url}\">Restablecer contrasena</a></p><p>Si no solicitaste este cambio, ignora este mensaje.</p>` });
  }

  private async sendMailFallback(payload: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) {
    if (!this.transporter) {
      this.logger.log(`[MAIL:FALLBACK] to=${payload.to} subject="${payload.subject}" body="${payload.text}"`);
      return;
    }

    await this.transporter.sendMail({
      from: this.getFromAddress(),
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  }
}
