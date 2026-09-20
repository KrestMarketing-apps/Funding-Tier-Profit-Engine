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
  if (/level|settlement|jkb|forth|pinnacle/.test(hay)) return 'LEVEL';
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
  diag: { conversations: number; messagesRead: number; messageErrors: string[]; types: Record<string, number> };
}> {
  const { items: conversations } = await walkConversations(cfg, since);
  const calls: CallRecord[] = [];
  const events: ActivityEvent[] = [];
  const diag = { conversations: conversations.length, messagesRead: 0, messageErrors: [] as string[], types: {} as Record<string, number> };

  for (const c of conversations) {
    const convId = String(pick(c, 'id', '_id') ?? '');
    if (!convId) continue;
    let messages: any[] = [];
    try {
      const data = await ghlFetch<any>(cfg, `/conversations/${convId}/messages`, { query: { limit: 100 } });
      messages = data?.messages?.messages ?? data?.messages ?? data?.data ?? [];
      if (!Array.isArray(messages)) messages = [];
    } catch (e: any) {
      // A single unreadable conversation must not fail the sync, but a pattern
      // of them (a missing scope) has to be visible.
      if (diag.messageErrors.length < 3) diag.messageErrors.push(`${e?.message ?? e} ${String(e?.body ?? '').slice(0, 150)}`);
      continue;
    }
    diag.messagesRead += messages.length;

    for (const m of messages) {
      const at = toIso(pick(m, 'dateAdded', 'dateUpdated', 'createdAt'));
      if (!at || new Date(at) < since) continue;
      const type = String(pick(m, 'messageType', 'type') ?? '').toUpperCase();
      diag.types[type || '(none)'] = (diag.types[type || '(none)'] ?? 0) + 1;
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
  return { calls, events, conversations: conversations.length, diag };
}

// ── Opportunities → enrollments ──────────────────────────────────────────────

// ── Enrollment rules ─────────────────────────────────────────────────────────

/**
 * Stages that mean "this client enrolled". A deal is credited, and only
 * reconciled against the backends, once it has been in one of these — every
 * pitched or in-progress opportunity stays out of the cross-check, where it
 * would only show up as "not at backend" and bury the real problems.
 *
 * Post-enrollment stages (first payment, welcome call, NSF, retention,
 * cancelled) count too: a deal that has reached them was enrolled first.
 * Override with AO_ENROLLED_STAGES (comma-separated, exact names, any case).
 */
const DEFAULT_ENROLLED_STAGES = [
  'ENROLLED',
  'ENROLLED - LEVEL / SETTLEMENT',
  'ENROLLED - ELP - DEBT WAIVER',
  'ENROLLED - CONSUMER SHIELD - DEBT VALIDATION',
  'APPOINTMENT (Enrolled) - WELCOME CALL TRANSFER',
  'FIRST PAYMENT MADE',
  'ENROLLED - NSF',
  'RE-ENROLLMENT NEEDED (DOCS ISSUE)',
  'ACCOUNT ON HOLD - RETENTION',
  'CANCELLED',
  'CANCELLED / CHARGEBACK',
];
/** Stage-name patterns that also mean post-enrollment (the WELCOME CALL COMPLETED variants). */
const ENROLLED_PATTERNS = [/welcome call completed/i];

/** How recent a stage change must be for the current owner to count as the closer. */
const STAMP_FRESH_MS = Number(process.env.AO_STAMP_FRESH_HOURS || 72) * 3600_000;

const normStage = (v: string | null | undefined) => (v ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

export function enrolledStageSet(): Set<string> {
  const fromEnv = (process.env.AO_ENROLLED_STAGES ?? '').split(',').map(normStage).filter(Boolean);
  return new Set(fromEnv.length ? fromEnv : DEFAULT_ENROLLED_STAGES.map(normStage));
}

export function isEnrolledStage(stage: string | null | undefined, status: string | null | undefined,
  stages: Set<string> = enrolledStageSet()): boolean {
  if (String(status ?? '').toLowerCase() === 'won') return true;
  const n = normStage(stage);
  if (!n) return false;
  if (stages.has(n)) return true;
  // Env list replaces the defaults entirely, patterns included.
  if ((process.env.AO_ENROLLED_STAGES ?? '').trim()) return false;
  return ENROLLED_PATTERNS.some((re) => re.test(n));
}

/** The stage a closer moves a deal into — as opposed to what happens after. */
export function isInitialEnrollmentStage(stage: string | null | undefined): boolean {
  const n = normStage(stage);
  return n === 'ENROLLED' || (n.startsWith('ENROLLED - ') && !/NSF/.test(n));
}

/**
 * Optional opportunity custom fields, by GHL field id. The opportunity search
 * returns custom fields as { id, value } pairs with no names, so the ids are
 * configured rather than guessed:
 *   AO_FIELD_CLOSER    a user picker / text field holding the closer's GHL user id
 *   AO_FIELD_BACKEND   dropdown: Level Debt | Pinnacle | Consumer Shield | ELP
 *   AO_FIELD_FILE_REF  the backend's file / account id for this client
 * Any that are unset are simply not used.
 */
function customFieldValue(o: any, fieldId: string | undefined): string | null {
  if (!fieldId) return null;
  const list: any[] = pick<any[]>(o, 'customFields', 'custom_fields') ?? [];
  const hit = list.find((f) => String(pick(f, 'id', 'fieldId', 'key') ?? '') === fieldId);
  if (!hit) return null;
  const v = pick<any>(hit, 'fieldValueString', 'fieldValue', 'value', 'field_value');
  if (v === null || v === undefined) return null;
  const str = Array.isArray(v) ? v.join(',') : String(v);
  return str.trim() || null;
}

/** Pipeline and stage ids → names. The search endpoint returns ids only. */
export async function fetchPipelineNames(cfg: GhlConfig): Promise<{
  pipelines: Map<string, string>; stages: Map<string, string>;
}> {
  const pipelines = new Map<string, string>();
  const stages = new Map<string, string>();
  const data = await ghlFetch<any>(cfg, '/opportunities/pipelines', { query: { locationId: cfg.locationId } });
  const list: any[] = data?.pipelines ?? data?.data ?? [];
  for (const p of list) {
    const pid = String(pick(p, 'id', '_id') ?? '');
    if (pid) pipelines.set(pid, String(pick(p, 'name') ?? pid));
    for (const st of (pick<any[]>(p, 'stages') ?? [])) {
      const sid = String(pick(st, 'id', '_id') ?? '');
      if (sid) stages.set(sid, String(pick(st, 'name') ?? sid));
    }
  }
  return { pipelines, stages };
}

export async function fetchEnrollments(cfg: GhlConfig, since: Date, maxPages = 100): Promise<{
  enrollments: Enrollment[]; events: ActivityEvent[];
}> {
  const enrollments: Enrollment[] = [];
  const events: ActivityEvent[] = [];
  const stagesEnrolled = enrolledStageSet();
  const names = await fetchPipelineNames(cfg).catch(() => ({ pipelines: new Map<string, string>(), stages: new Map<string, string>() }));
  // Only enrolled deals are needed, so ask GHL for exactly those: one search
  // per enrolled stage (plus status=won), each walked with GHL's cursor. A
  // walk of the whole book stopped at the page cap (4,000 of a larger book)
  // and was slow. If stage names can't be read, fall back to the whole book.
  // (GHL's `date` filter is on creation date and wants mm-dd-yyyy, so it is
  // not used: it would hide older deals that reached an enrolled stage today.)
  void since;
  const enrolledStageIds = [...names.stages]
    .filter(([, name]) => isEnrolledStage(name, null, stagesEnrolled))
    .map(([sid]) => sid);
  const filters: Record<string, string>[] = enrolledStageIds.length
    ? [...enrolledStageIds.map((sid) => ({ pipeline_stage_id: sid })), { status: 'won' }]
    : [{}];
  const seen = new Set<string>();

  for (const filter of filters) {
  let page = 1;
  let cursor: { startAfter?: string | number; startAfterId?: string } = {};
  while (page <= maxPages) {
    const data = await ghlFetch<any>(cfg, '/opportunities/search', {
      query: {
        location_id: cfg.locationId,
        limit: 100,
        ...filter,
        ...(cursor.startAfterId ? { startAfter: cursor.startAfter, startAfterId: cursor.startAfterId } : {}),
      },
    });
    const batch: any[] = data?.opportunities ?? data?.data ?? [];
    if (batch.length === 0) break;
    const meta = data?.meta ?? {};
    cursor = { startAfter: meta.startAfter, startAfterId: meta.startAfterId };

    for (const o of batch) {
      const id = String(pick(o, 'id', '_id') ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const contact = pick<any>(o, 'contact') ?? {};
      const pipelineId = pick<string>(o, 'pipelineId');
      const stageId = pick<string>(o, 'pipelineStageId');
      const pipeline = pick<string>(o, 'pipelineName', 'pipeline.name')
        ?? (pipelineId ? names.pipelines.get(pipelineId) ?? pipelineId : null);
      const stage = pick<string>(o, 'pipelineStageName', 'stage.name')
        ?? (stageId ? names.stages.get(stageId) ?? stageId : null);
      const status = pick<string>(o, 'status');
      const enrolledAt = toIso(pick(o, 'createdAt', 'dateAdded', 'created_at'));
      const stageChangedAt = toIso(pick(o, 'lastStageChangeAt', 'lastStatusChangeAt'));
      const updatedAt = toIso(pick(o, 'updatedAt', 'dateUpdated'));
      const agentId = pick<string>(o, 'assignedTo', 'userId', 'assigned_to');
      const isEnrolled = isEnrolledStage(stage, status, stagesEnrolled);

      // Credit. An explicit Closer field wins. Otherwise the owner is stamped
      // the first time the deal is seen enrolled, and the database keeps that
      // first stamp (see sync.ts) — so a later reassignment never moves it.
      // The stamp is only trustworthy if the deal entered its current stage
      // recently — otherwise it may have been reassigned since, and the owner
      // we see now is a guess. That holds for a wide manual backfill too, which
      // is why this is measured from now and not from the sync window.
      const closerField = customFieldValue(o, process.env.AO_FIELD_CLOSER);
      let closerId: string | null = null;
      let closerSource: Enrollment['closerSource'] = null;
      if (closerField) { closerId = closerField; closerSource = 'ghl_field'; }
      else if (isEnrolled && agentId) {
        closerId = agentId;
        const enteredAt = stageChangedAt ?? updatedAt;
        // It must also be an enrollment stage itself. A deal seen for the first
        // time in FIRST PAYMENT MADE or a welcome-call stage may already sit
        // with the welcome-call or retention person, not the closer.
        const fresh = enteredAt && Date.now() - new Date(enteredAt).getTime() <= STAMP_FRESH_MS;
        closerSource = fresh && isInitialEnrollmentStage(stage) ? 'stamped' : 'backfill';
      }

      const backendField = customFieldValue(o, process.env.AO_FIELD_BACKEND);

      enrollments.push({
        id,
        locationId: cfg.locationId,
        agentId,
        closerId,
        closerSource,
        isEnrolled,
        firstEnrolledAt: isEnrolled ? (stageChangedAt ?? updatedAt ?? enrolledAt) : null,
        backendFileRef: customFieldValue(o, process.env.AO_FIELD_FILE_REF),
        contactId: pick<string>(o, 'contactId', 'contact.id'),
        clientName: pick<string>(o, 'contact.name', 'name')
          ?? ([pick(contact, 'firstName'), pick(contact, 'lastName')].filter(Boolean).join(' ') || null),
        clientPhone: digits(pick(o, 'contact.phone', 'phone')),
        clientEmail: pick<string>(o, 'contact.email', 'email'),
        backend: backendField ? backendFromText(backendField) : backendFromText(pipeline, stage, pick<string>(o, 'name')),
        pipeline,
        stage,
        status,
        enrolledDebt: toNumber(pick(o, 'monetaryValue', 'monetary_value', 'value')),
        enrolledAt,
        updatedAt,
      });

      if (agentId && enrolledAt) {
        events.push({ id: `opp:${id}`, locationId: cfg.locationId, agentId, at: enrolledAt, kind: 'opportunity', ref: id });
      }
    }
    if (batch.length < 100 || !cursor.startAfterId) break;
    page += 1;
  }
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
    { endpoint: 'GET /opportunities/pipelines', note: 'stage names (enrolled-stage filter)', run: () => ghlFetch(cfg, '/opportunities/pipelines', { query: { locationId: cfg.locationId } }) },
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
