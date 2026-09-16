/**
 * @gst-engine/email — transactional email behind a provider abstraction.
 * Phase 0: contract + console stub. Providers (Resend/SES/SendGrid) in M7.
 * Production requires a verified sending domain (DECISIONS.md D8).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Prefer a secure download link over attaching the PDF (DECISIONS.md D6). */
  attachments?: { filename: string; content: Uint8Array; contentType: string }[];
}

export interface EmailResult {
  providerMessageId: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

/** Dev provider: logs instead of sending. TODO(M7): flesh out formatting. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  send(message: EmailMessage): Promise<EmailResult> {
    console.warn(`[email:console] would send "${message.subject}" to ${message.to}`);
    return Promise.resolve({ providerMessageId: `console-${Date.now()}` });
  }
}
