import type { ActivityEvent, Agent, BackendKey, CallRecord, Enrollment } from './types';

/**
 * GoHighLevel (LeadConnector V2) client.
 *
 * Auth is a Private Integration Token per sub-account, plus the fixed
 * `Version: 2021-07-28` header. Rate limit is 100 requests per 10 seconds, so
 * every list walk here paginates politely and backs off on 429.
 *
 * The response shapes GHL returns have moved around between account types and
 * API revisions, so every normaliser below reads several likely field names
 * and tolerates missing ones rather than assuming one schema. `probe()` exists
 * to find out what this account actually answers with before trusting a sync.
 */

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

export interface GhlConfig {
  token: string;
  locationId: string;
}

/** Config from the environment. One token per sub-account, comma-separated. */
export function ghlConfigs(): GhlConfig[] {
  const tokens = (process.env.GHL_TOKENS || process.env.GHL_TOKEN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const locations = (process.env.GHL_LOCATION_IDS || process.env.GHL_LOCATION_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
  // One token covering several locations is the common setup; a token per
  // location is also valid. Pair them off, reusing the single token if that is
  // all there is.
  return locations.map((locationId, i) => ({ locationId, token: tokens[i] ?? tokens[0] ?? '' }))
    .filter((c) => c.token && c.locationId);
}

export class GhlError extends Error {
  constructor(message: string, readonly status: number, readonly body: string) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function ghlFetch<T = any>(
  cfg: GhlConfig,
  path: string,
  init: { method?: string; body?: any; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const qs = new URLSearchParams();
  Object.entries(init.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ''}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Version: VERSION,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });

    if (res.status === 429 || res.status >= 500) {
      await sleep(400 * 2 ** attempt);     // 0.4s, 0.8s, 1.6s, 3.2s, 6.4s
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new GhlError(`GHL ${res.status} on ${path}`, res.status, text.slice(0, 400));
    return (text ? JSON.parse(text) : {}) as T;
  }
  throw new GhlError(`GHL kept rate-limiting or failing on ${path}`, 429, '');
}

// ── Small helpers ────────────────────────────────────────────────────────────

const pick = <T = any>(o: any, ...keys: string[]): T | null => {
  for (const k of keys) {
    const v = k.split('.').reduce((acc: any, part) => (acc == null ? acc : acc[part]), o);
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return null;
};

const toIso = (v: any): string | null => {
  if (!v) return null;
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const toNumber = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const digits = (v: any): string | null => {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length < 7) return null;
  return d.length > 10 ? d.slice(-10) : d;   // normalise to the last 10 digits
};

/**
 * Which servicing partner an opportunity belongs to, read from the pipeline
 * or stage name. Keep the keyword lists here — they are the one place the
 * mapping is expressed.
 */
export function backendFromText(...parts: (string | null | undefined)[]): BackendKey {
  const hay = parts.filter(Boolean).join(' ').toLowerCase();
  if (/level|settlement|jkb|forth/.test(hay)) return 'LEVEL';
  if (/shield|consumer shield|validation/.test(hay)) return 'CS';
  if (/legacy|elite legal|elp|resolution/.test(hay)) return 'LEGACY';
  return 'UNKNOWN';
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function fetchAgents(cfg: GhlConfig): Promise<Agent[]> {
  const data = await ghlFetch<any>(cfg, '/users/', { query: { locationId: cfg.locationId } });
  const list: any[] = data?.users ?? data?.data ?? (Array.isArray(data) ? data : []);
  return list.map((u) => ({
    id: String(pick(u, 'id', '_id', 'userId') ?? ''),
    locationId: cfg.locationId,
    name: String(pick(u, 'name', 'fullName') ?? [pick(u, 'firstName'), pick(u, 'lastName')].filter(Boolean).join(' ')).trim(),
    email: pick<string>(u, 'email'),
    role: null,
    employmentType: null,
    hourlyRate: null,
    scheduledHoursPerWeek: null,
    team: null,
    active: pick<boolean>(u, 'isActive') ?? true,
  })).filter((a) => a.id);
}

// ── Conversations → calls + message activity ─────────────────────────────────

interface Walked<T> { items: T[]; pages: number; }

/**
 * Conversations touched inside the window. GHL's search returns the most
 * recently updated first, so the walk stops as soon as a page falls entirely
 * before `since`.
 */
async function walkConversations(cfg: GhlConfig, since: Date, maxPages = 40): Promise<Walked<any>> {
  const items: any[] = [];
  let page = 0;
  let startAfterDate: number | undefined;
  let startAfterId: string | undefined;

  while (page < maxPages) {
    const data = await ghlFetch<any>(cfg, '/conversations/search', {
      query: {
        locationId: cfg.locationId,
        limit: 100,
        sortBy: 'last_message_date',
        sort: 'desc',
        startAfterDate,
        startAfterId,
      },
    });
    const batch: any[] = data?.conversations ?? data?.data ?? [];
    if (batch.length === 0) break;
    items.push(...batch);
    page += 1;

    const last = batch[batch.length - 1];
    const lastAt = new Date(toIso(pick(last, 'lastMessageDate', 'dateUpdated', 'dateAdded')) ?? 0);
    if (lastAt.getTime() < since.getTime()) break;
    startAfterDate = lastAt.getTime();
    startAfterId = String(pick(last, 'id', '_id') ?? '');
    if (!startAfterId) break;
  }
  return { items, pages: page };
}

const CALL_TYPES = new Set(['TYPE_CALL', 'CALL', 'TYPE_PHONE', 'VOICEMAIL', 'TYPE_VOICEMAIL']);

function normaliseCall(cfg: GhlConfig, m: any, conversation: any): CallRecord | null {
  const startedAt = toIso(pick(m, 'dateAdded', 'dateUpdated', 'createdAt'));
  if (!startedAt) return null;
  const duration = toNumber(pick(m, 'meta.call.duration', 'callDuration', 'duration', 'meta.duration')) ?? 0;
  const status = pick<string>(m, 'meta.call.status', 'callStatus', 'status');
  return {
    id: String(pick(m, 'id', '_id', 'messageId') ?? ''),
    locationId: cfg.locationId,
    agentId: pick<string>(m, 'userId', 'meta.call.userId', 'assignedTo') ?? pick<string>(conversation, 'assignedTo'),
    contactId: pick<string>(m, 'contactId') ?? pick<string>(conversation, 'contactId'),
    contactName: pick<string>(conversation, 'contactName', 'fullName', 'contact.name'),
    direction: (pick<string>(m, 'direction')?.toLowerCase() as 'inbound' | 'outbound' | null) ?? null,
    startedAt,
    durationSeconds: Math.round(duration),
    // GHL reports one duration; treat a connected call's duration as talk time
    // and anything unanswered as zero, which is what "talk" has to mean here.
    talkSeconds: /completed|answered/i.test(status ?? '') ? Math.round(duration) : 0,
    status: status ?? null,
    disposition: pick<string>(m, 'meta.call.disposition', 'disposition'),
    fromNumber: pick<string>(m, 'meta.call.from', 'from'),
    toNumber: pick<string>(m, 'meta.call.to', 'to'),
    recordingUrl: pick<string>(m, 'meta.call.recordingUrl', 'recordingUrl', 'attachments.0'),
  };
}

export async function fetchCallsAndActivity(cfg: GhlConfig, since: Date): Promise<{
  calls: CallRecord[]; events: ActivityEvent[]; conversations: number;
}> {
  const { items: conversations } = await walkConversations(cfg, since);
  const calls: CallRecord[] = [];
  const events: ActivityEvent[] = [];

  for (const c of conversations) {
    const convId = String(pick(c, 'id', '_id') ?? '');
    if (!convId) continue;
    let messages: any[] = [];
    try {
      const data = await ghlFetch<any>(cfg, `/conversations/${convId}/messages`, { query: { limit: 100 } });
      messages = data?.messages?.messages ?? data?.messages ?? data?.data ?? [];
    } catch {
      continue;      // a single unreadable conversation must not fail the sync
    }

    for (const m of messages) {
      const at = toIso(pick(m, 'dateAdded', 'dateUpdated', 'createdAt'));
      if (!at || new Date(at) < since) continue;
      const type = String(pick(m, 'messageType', 'type') ?? '').toUpperCase();
      const agentId = pick<string>(m, 'userId', 'assignedTo') ?? pick<string>(c, 'assignedTo');

      if (CALL_TYPES.has(type)) {
        const call = normaliseCall(cfg, m, c);
        if (call?.id) {
          calls.push(call);
          events.push({ id: `call:${call.id}`, locationId: cfg.locationId, agentId: call.agentId, at, kind: 'call', ref: call.id });
        }
      } else if (agentId) {
        // Outbound SMS/email from a user is activity; inbound from the contact
        // is not the agent working, so it is not counted as attendance.
        const outbound = String(pick(m, 'direction') ?? '').toLowerCase() === 'outbound';
        if (outbound) {
          const id = String(pick(m, 'id', '_id') ?? '');
          events.push({ id: `msg:${id}`, locationId: cfg.locationId, agentId, at, kind: 'message', ref: id });
        }
      }
    }
  }
  return { calls, events, conversations: conversations.length };
}

// ── Opportunities → enrollments ──────────────────────────────────────────────

export async function fetchEnrollments(cfg: GhlConfig, since: Date, maxPages = 40): Promise<{
  enrollments: Enrollment[]; events: ActivityEvent[];
}> {
  const enrollments: Enrollment[] = [];
  const events: ActivityEvent[] = [];
  let page = 1;

  while (page <= maxPages) {
    const data = await ghlFetch<any>(cfg, '/opportunities/search', {
      query: {
        location_id: cfg.locationId,
        limit: 100,
        page,
        date: since.toISOString(),
      },
    });
    const batch: any[] = data?.opportunities ?? data?.data ?? [];
    if (batch.length === 0) break;

    for (const o of batch) {
      const id = String(pick(o, 'id', '_id') ?? '');
      if (!id) continue;
      const contact = pick<any>(o, 'contact') ?? {};
      const pipeline = pick<string>(o, 'pipelineName', 'pipeline.name', 'pipelineId');
      const stage = pick<string>(o, 'pipelineStageName', 'stage.name', 'pipelineStageId');
      const enrolledAt = toIso(pick(o, 'createdAt', 'dateAdded', 'created_at'));
      const agentId = pick<string>(o, 'assignedTo', 'userId', 'assigned_to');

      enrollments.push({
        id,
        locationId: cfg.locationId,
        agentId,
        contactId: pick<string>(o, 'contactId', 'contact.id'),
        clientName: pick<string>(o, 'contact.name', 'name')
          ?? ([pick(contact, 'firstName'), pick(contact, 'lastName')].filter(Boolean).join(' ') || null),
        clientPhone: digits(pick(o, 'contact.phone', 'phone')),
        clientEmail: pick<string>(o, 'contact.email', 'email'),
        backend: backendFromText(pipeline, stage, pick<string>(o, 'name')),
        pipeline,
        stage,
        status: pick<string>(o, 'status'),
        enrolledDebt: toNumber(pick(o, 'monetaryValue', 'monetary_value', 'value')),
        enrolledAt,
        updatedAt: toIso(pick(o, 'updatedAt', 'dateUpdated')),
      });

      if (agentId && enrolledAt) {
        events.push({ id: `opp:${id}`, locationId: cfg.locationId, agentId, at: enrolledAt, kind: 'opportunity', ref: id });
      }
    }
    if (batch.length < 100) break;
    page += 1;
  }
  return { enrollments, events };
}

// ── Probe ────────────────────────────────────────────────────────────────────

export interface ProbeResult {
  endpoint: string;
  ok: boolean;
  status: number | null;
  count: number | null;
  sampleKeys: string[];
  note: string;
}

/**
 * Ask the account what it actually supports, before a sync is trusted.
 * Returns one row per endpoint with the status and the top-level keys of the
 * response, so a shape change shows up as data rather than as a silent zero.
 */
export async function probe(cfg: GhlConfig): Promise<ProbeResult[]> {
  const checks: Array<{ endpoint: string; run: () => Promise<any>; note: string }> = [
    { endpoint: 'GET /users/', note: 'agent directory', run: () => ghlFetch(cfg, '/users/', { query: { locationId: cfg.locationId } }) },
    { endpoint: 'GET /conversations/search', note: 'calls + messages', run: () => ghlFetch(cfg, '/conversations/search', { query: { locationId: cfg.locationId, limit: 1 } }) },
    { endpoint: 'GET /opportunities/search', note: 'enrollments', run: () => ghlFetch(cfg, '/opportunities/search', { query: { location_id: cfg.locationId, limit: 1 } }) },
    { endpoint: 'GET /locations/{id}', note: 'token scope check', run: () => ghlFetch(cfg, `/locations/${cfg.locationId}`) },
  ];

  const out: ProbeResult[] = [];
  for (const c of checks) {
    try {
      const data = await c.run();
      const keys = Object.keys(data ?? {});
      const firstArray = keys.map((k) => data[k]).find((v) => Array.isArray(v)) as any[] | undefined;
      out.push({
        endpoint: c.endpoint, ok: true, status: 200,
        count: firstArray ? firstArray.length : null,
        sampleKeys: firstArray?.[0] ? Object.keys(firstArray[0]).slice(0, 25) : keys.slice(0, 25),
        note: c.note,
      });
    } catch (e: any) {
      out.push({
        endpoint: c.endpoint, ok: false,
        status: e?.status ?? null, count: null, sampleKeys: [],
        note: `${c.note} — ${String(e?.body || e?.message || e).slice(0, 200)}`,
      });
    }
  }
  return out;
}
