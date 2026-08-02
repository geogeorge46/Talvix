import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../shared/utils/logger.js';
import { normalizeEmailError } from '../utils/emailError.js';

const disabled = {
  sendEmail: async () => ({ provider: 'disabled', status: 'suppressed' }),
};

const consoleAdapter = {
  sendEmail: async ({ to, subject, text, html, idempotencyKey }) => {
    logger.info(`[Console Email]\nTo: ${to}\nSubject: ${subject}\nBody: ${text || html}\nIdempotency: ${idempotencyKey}`);
    return { provider: 'console', providerMessageId: `console-${idempotencyKey}`, status: 'sent' };
  },
};

const resend = {
  sendEmail: async (input) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
          from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: input.replyTo || undefined,
          tags: input.tags,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const e = new Error('Provider request failed');
        e.status = response.status;
        throw e;
      }
      const data = await response.json();
      return { provider: 'resend', providerMessageId: data.id, status: 'sent' };
    } catch (error) {
      throw Object.assign(new Error('Email provider error'), normalizeEmailError(error));
    } finally {
      clearTimeout(timeout);
    }
  },
};

const smtp = {
  sendEmail: async (input) => {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_SECURE || false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo || undefined,
      });

      return {
        provider: 'smtp',
        providerMessageId: info.messageId,
        status: 'sent',
      };
    } catch (error) {
      throw Object.assign(new Error('Email provider error'), normalizeEmailError(error));
    }
  },
};

export const getEmailProvider = () => {
  if (process.env.NODE_ENV === 'test') return consoleAdapter;
  if (!env.EMAIL_ENABLED) return disabled;
  if (env.EMAIL_PROVIDER === 'resend') return resend;
  if (env.EMAIL_PROVIDER === 'console') return consoleAdapter;
  if (env.EMAIL_PROVIDER === 'smtp') return smtp;
  return disabled;
};

export const sendEmail = (input) => getEmailProvider().sendEmail(input);
