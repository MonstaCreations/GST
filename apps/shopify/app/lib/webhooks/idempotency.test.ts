import { describe, it, expect, beforeEach } from 'vitest';
import { claimWebhook, resetWebhookIdempotency } from './idempotency.server';

describe('claimWebhook', () => {
  beforeEach(() => resetWebhookIdempotency());

  it('claims an id the first time and refuses it the second', () => {
    expect(claimWebhook('wh-1')).toBe(true);
    expect(claimWebhook('wh-1')).toBe(false);
  });

  it('treats distinct ids independently', () => {
    expect(claimWebhook('wh-1')).toBe(true);
    expect(claimWebhook('wh-2')).toBe(true);
  });

  it('lets an id through again once its TTL has passed', () => {
    const t0 = 1_000_000;
    expect(claimWebhook('wh-1', t0)).toBe(true);
    expect(claimWebhook('wh-1', t0 + 60_000)).toBe(false);
    expect(claimWebhook('wh-1', t0 + 11 * 60_000)).toBe(true);
  });

  it('always allows processing when there is no id to dedupe on', () => {
    expect(claimWebhook('')).toBe(true);
    expect(claimWebhook('')).toBe(true);
  });
});
