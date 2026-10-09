/*
 * In-memory mock of the Brainbox staff-dashboard API (contract v1) for the preview.
 * Enable with `?mock=1`. Intercepts both fetch() and XMLHttpRequest (axios uses XHR) for requests
 * to `${apiUrl}/api/*`; everything else goes to the network untouched.
 *
 * Demo accounts (password: "password123"):
 *   owner@acme.test (owner + PLATFORM ADMIN) · admin@acme.test · trainer@acme.test · viewer@acme.test
 *   temp@acme.test — admin-set password: must choose a new one after signing in
 *   grace@northwind.test (owner of another company, not a platform admin)
 * Four companies are seeded for the Platform pages (Companies / All users / All API keys).
 * `?smtp=0` simulates a server without SMTP (invite links must be copied manually).
 * Console helpers: window.__bbMock.simulateGap(), window.__bbMock.db
 */

const DAY = 86400000;
const PASSWORD = 'password123';

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (t) => new Date(t).toISOString();
const dayKey = (t) => new Date(t).toISOString().slice(0, 10); // UTC dates, like the backend
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2));
function similarity(a, b) {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / (A.size + B.size - inter);
}
const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fromB64url = (s) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
const rid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

class HttpError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

function seed(now) {
  const rnd = mulberry32(20261008);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const TENANT = 'acme-energy';
  const smtp = new URLSearchParams(window.location.search).get('smtp') !== '0';

  const staff = [
    ['Olivia Bennett', 'owner@acme.test', 'owner', true, false, 0.2],
    ['Marcus Chen', 'admin@acme.test', 'admin', true, false, 0.9],
    ['Priya Raman', 'trainer@acme.test', 'trainer', true, false, 2.5],
    ['Daniel Okafor', 'daniel.okafor@acme.test', 'trainer', true, false, 6],
    ['Sofia Martinez', 'viewer@acme.test', 'viewer', true, false, 26],
    ['James Wilson', 'james.wilson@acme.test', 'viewer', false, false, 40],
    ['Hannah Kim', 'hannah.kim@acme.test', 'trainer', true, true, null],
    ['', 'lucas.ferreira@acme.test', 'admin', true, true, null]
  ].map(([full_name, email, role, is_active, invited, lastDays], i) => ({
    id: i + 1,
    tenant_id: TENANT,
    email,
    full_name: full_name || null,
    role,
    is_active,
    notify_email: i !== 4,
    notify_in_app: true,
    last_login_at: lastDays == null ? null : iso(now - lastDays * DAY - i * 3600e3),
    created_at: iso(now - (90 - i * 6) * DAY),
    invited,
    password: invited ? null : PASSWORD,
    is_platform_admin: email === 'owner@acme.test',
    must_change_password: false
  }));
  staff.push({
    id: staff.length + 1, tenant_id: TENANT, email: 'temp@acme.test', full_name: 'Tess Temp', role: 'viewer', is_active: true,
    notify_email: true, notify_in_app: true, last_login_at: null, created_at: iso(now - 1 * DAY), invited: false,
    password: PASSWORD, is_platform_admin: false, must_change_password: true
  });

  // Other companies (platform admin pages). Usage numbers are static for these.
  const LEGACY = 'eyJhbGciOiJIUzI1NiJ9.eyJ0ZW5hbnRfaWQiOiJiZXRhLWNsaWVudCJ9.Q2x5ZGVfbGVnYWN5X3RlbmFudA';
  const tenants = {
    [TENANT]: { display_name: 'Acme Energy', created_at: iso(now - 92 * DAY), live: true },
    'northwind-logistics': { display_name: 'Northwind Logistics', created_at: iso(now - 61 * DAY), documents: 412, sources: 6, conversations: 1830, open_gaps: 9, last_activity_at: iso(now - 0.08 * DAY), questions_30d: 2210, unanswered_30d: 141 },
    'globex-health': { display_name: 'Globex Health', created_at: iso(now - 19 * DAY), documents: 96, sources: 3, conversations: 214, open_gaps: 4, last_activity_at: iso(now - 2.5 * DAY), questions_30d: 388, unanswered_30d: 52 },
    [LEGACY]: { display_name: null, created_at: iso(now - 240 * DAY), documents: 1204, sources: 1, conversations: 5400, open_gaps: 0, last_activity_at: iso(now - 12 * DAY), questions_30d: 61, unanswered_30d: 3 }
  };
  [
    ['northwind-logistics', 'Grace Liu', 'grace@northwind.test', 'owner', true, false, false, 0.1],
    ['northwind-logistics', 'Tom Becker', 'tom@northwind.test', 'admin', true, false, false, 1.4],
    ['northwind-logistics', null, 'sam@northwind.test', 'trainer', true, true, false, null],
    ['globex-health', 'Dr. Amara Nwosu', 'amara@globex.test', 'owner', true, false, true, null],
    ['globex-health', 'Lee Park', 'lee@globex.test', 'viewer', false, false, false, 30]
  ].forEach(([tenant_id, full_name, email, role, is_active, invited, must, lastDays], i) => {
    staff.push({
      id: staff.length + 1, tenant_id, email, full_name, role, is_active, notify_email: true, notify_in_app: true,
      last_login_at: lastDays == null ? null : iso(now - lastDays * DAY), created_at: iso(now - (50 - i * 7) * DAY),
      invited, password: invited ? null : PASSWORD, is_platform_admin: false, must_change_password: must
    });
  });

  const people = [
    ['Emma Johnson', 'customer'],
    ['Noah Williams', 'customer'],
    ['Ava Brown', 'customer'],
    ['Liam Davis', 'customer'],
    ['Mia Garcia', 'customer'],
    ['Ethan Miller', 'vendor'],
    ['Grace Lee', 'vendor'],
    ['Oliver Wilson', 'internal'],
    ['Chloe Martin', 'internal'],
    [null, 'public'],
    [null, 'public'],
    ['Ben Carter', 'admin']
  ];

  const GAP_SEED = [
    ['Can I pay my bill in installments if I’m behind?', 'no_context', 'open', 14],
    ['How do I add a second property to my account?', 'no_context', 'open', 9],
    ['What is the late payment fee for commercial accounts?', 'low_confidence', 'open', 7],
    ['Do you offer a discount for seniors or veterans?', 'llm_unknown', 'open', 6],
    ['Why did my meter reading jump 40% this month?', 'negative_feedback', 'open', 3],
    ['How long does a new meter installation take?', 'low_confidence', 'open', 5],
    ['Can vendors submit invoices through the portal?', 'no_context', 'open', 4],
    ['What happens to my autopay if my card expires?', 'llm_unknown', 'open', 4],
    ['Is there a mobile app for checking usage?', 'no_context', 'open', 3],
    ['How do I transfer service when I move out?', 'negative_feedback', 'open', 2],
    ['What are your call center hours on public holidays?', 'llm_unavailable', 'open', 2],
    ['Can I get a paper copy of my bill mailed to a different address?', 'low_confidence', 'open', 2],
    ['Which documents do I need to open a business account?', 'no_context', 'open', 1],
    ['How is the demand charge calculated for EV chargers?', 'llm_unknown', 'open', 1],
    ['The bot told me my outage was resolved but power is still off', 'negative_feedback', 'open', 1],
    ['What is the payment reference format for bank transfers?', 'no_context', 'resolved', 6],
    ['How do I download last year’s statements as PDF?', 'low_confidence', 'resolved', 5],
    ['Can I change my billing date?', 'llm_unknown', 'resolved', 8],
    ['Where do I find my account number?', 'no_context', 'resolved', 11],
    ['How do I report a damaged meter seal?', 'negative_feedback', 'resolved', 2],
    ['Do you support paperless billing?', 'low_confidence', 'resolved', 3],
    ['asdf test test', 'no_context', 'dismissed', 1],
    ['What’s the weather tomorrow?', 'llm_unknown', 'dismissed', 2],
    ['Write me a poem about electricity', 'no_context', 'dismissed', 1],
    ['Can you hack my neighbour’s meter?', 'llm_unknown', 'dismissed', 1],
    ['Is the service down right now?', 'llm_unavailable', 'resolved', 4]
  ];

  const BOT_ANSWERS = {
    no_context: 'I’m sorry, I don’t have information about that yet. Please contact our support team and they’ll be happy to help.',
    low_confidence: 'I think this may depend on your account type, but I’m not certain. You may want to check with our billing team for the exact details.',
    llm_unknown: 'I don’t have information about that. Would you like me to connect you with a member of our team?',
    llm_unavailable: 'Our assistant is temporarily unavailable. Please try again in a few minutes.',
    negative_feedback: 'Your reading was estimated based on last year’s usage for the same period.'
  };

  const conversations = [];
  const gaps = [];
  let msgId = 1;

  GAP_SEED.forEach(([question, reason, status, occ], i) => {
    const [user_name, user_role] = people[i % people.length];
    const last = now - (i < 15 ? rnd() * 6 * DAY + i * 0.4 * DAY : (5 + rnd() * 40) * DAY);
    const created = last - (occ > 1 ? (2 + rnd() * 20) * DAY : 0);
    const session_id = i < 15 ? `sess_${(1000 + i).toString(36)}${i}` : null;
    const g = {
      id: i + 1,
      tenant_id: TENANT,
      question,
      reason,
      status,
      occurrences: occ,
      best_distance: reason === 'no_context' ? null : reason === 'low_confidence' ? 0.58 + rnd() * 0.2 : 0.31 + rnd() * 0.2,
      answer_given: BOT_ANSWERS[reason],
      session_id,
      user_id: user_name ? `u_${i % people.length}` : null,
      user_name,
      user_role,
      resolution_note: status === 'dismissed' ? pick(['Out of scope', 'Spam / test message', 'Not something we support']) : null,
      resolved_by: status === 'open' ? null : pick(['Priya Raman', 'Marcus Chen', 'Daniel Okafor']),
      resolved_at: status === 'open' ? null : iso(last + 3600e3 * (2 + rnd() * 20)),
      source_id: status === 'resolved' ? `src_ans_${i}` : null,
      last_feedback_comment: reason === 'negative_feedback' ? pick(['That’s not right — someone read the meter in person.', 'This didn’t answer my question.', 'Power is still out on my street!']) : null,
      created_at: iso(created),
      last_seen_at: iso(last)
    };
    gaps.push(g);
  });

  const TOPICS = [
    ['Payment plan question', 'Can I pay my bill in installments if I’m behind?'],
    ['Adding a property', 'How do I add a second property to my account?'],
    ['Late fee for business', 'What is the late payment fee for commercial accounts?'],
    ['Senior discount', 'Do you offer a discount for seniors or veterans?'],
    ['High bill this month', 'Why did my meter reading jump 40% this month?'],
    ['Meter installation', 'How long does a new meter installation take?'],
    ['Vendor invoices', 'Can vendors submit invoices through the portal?'],
    ['Autopay and expired card', 'What happens to my autopay if my card expires?'],
    ['Mobile app', 'Is there a mobile app for checking usage?'],
    ['Moving out', 'How do I transfer service when I move out?'],
    ['Holiday hours', 'What are your call center hours on public holidays?'],
    ['Paper bill address', 'Can I get a paper copy of my bill mailed to a different address?'],
    ['Business account documents', 'Which documents do I need to open a business account?'],
    ['EV charger demand charge', 'How is the demand charge calculated for EV chargers?'],
    ['Outage follow-up', 'The bot told me my outage was resolved but power is still off']
  ];
  const ANSWERED = [
    ['How do I read my bill?', 'Your bill has three sections: account summary, usage details and charges. The amount due and due date are at the top right.'],
    ['When is my payment due?', 'Payments are due 21 days after the statement date shown on your bill. You can see it any time under Billing → Statements.'],
    ['How do I set up autopay?', 'Go to Billing → Payment methods, add a card or bank account and switch on “Pay automatically on the due date”.'],
    ['Report an outage', 'You can report an outage from the Outages page or by calling 0800 555 0199. We’ll text you updates as crews are dispatched.']
  ];

  TOPICS.forEach(([title, q], i) => {
    const g = gaps[i];
    const [user_name, user_role] = [g.user_name, g.user_role];
    const start = new Date(g.last_seen_at).getTime() - 6 * 60e3;
    const [q0, a0] = ANSWERED[i % ANSWERED.length];
    const msgs = [
      { id: msgId++, role: 'user', content: q0, created_at: iso(start) },
      { id: msgId++, role: 'assistant', content: a0, created_at: iso(start + 9e3), gap_reason: null, feedback: null },
      { id: msgId++, role: 'user', content: q, created_at: iso(start + 5 * 60e3) },
      { id: msgId++, role: 'assistant', content: g.answer_given, created_at: iso(start + 5 * 60e3 + 8e3), gap_reason: g.reason, feedback: g.reason === 'negative_feedback' ? 'down' : null }
    ];
    if (i % 3 === 0) msgs.push({ id: msgId++, role: 'user', content: 'Ok, thanks anyway.', created_at: iso(start + 7 * 60e3) });
    conversations.push({
      session_id: g.session_id,
      title,
      user_id: g.user_id,
      user_name,
      user_role,
      created_at: iso(start),
      last_message_at: msgs[msgs.length - 1].created_at,
      has_gap: true,
      messages: msgs
    });
  });
  // A few fully-answered conversations too.
  ANSWERED.forEach(([q, a], i) => {
    const start = now - (0.3 + i * 1.7) * DAY;
    const [user_name, user_role] = people[(i * 5 + 2) % people.length];
    conversations.push({
      session_id: `sess_ok_${i}`,
      title: q.replace(/\?$/, ''),
      user_id: user_name ? `u_ok_${i}` : null,
      user_name,
      user_role,
      created_at: iso(start),
      last_message_at: iso(start + 40e3),
      has_gap: false,
      messages: [
        { id: msgId++, role: 'user', content: q, created_at: iso(start) },
        { id: msgId++, role: 'assistant', content: a, created_at: iso(start + 8e3), gap_reason: null, feedback: i % 2 ? 'up' : null },
        { id: msgId++, role: 'user', content: 'Perfect, thank you!', created_at: iso(start + 40e3) }
      ]
    });
  });
  conversations.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

  // 60 days of activity (the workspace launched 60 days ago).
  const daily = [];
  for (let d = 89; d >= 0; d--) {
    const t = now - d * DAY;
    const dow = new Date(t).getDay();
    let questions = 0;
    let unanswered = 0;
    if (d < 60) {
      const growth = 40 + (60 - d) * 1.6;
      const weekly = dow === 0 || dow === 6 ? 0.55 : 1;
      questions = Math.round(growth * weekly * (0.8 + rnd() * 0.4));
      const rate = 0.2 - (60 - d) * 0.0018 + rnd() * 0.04;
      unanswered = Math.max(0, Math.round(questions * Math.max(0.04, rate)));
    }
    daily.push({ date: dayKey(t), questions, unanswered });
  }

  const SRC = [
    ['Customer billing handbook 2026.pdf', 'file', 'pdf', 'public', 'completed', 184],
    ['Tariffs & rates 2026.csv', 'file', 'csv', 'public', 'completed', 62],
    ['Zendesk support tickets', 'api', 'support_tickets', 'internal', 'completed', 1290],
    ['Vendor onboarding guide.docx', 'file', 'docx', 'vendor', 'completed', 41],
    ['Outage procedures (internal)', 'text', 'text', 'internal', 'completed', 12],
    ['FAQ — payments', 'text', 'text', 'public', 'completed', 18],
    ['Admin escalation runbook.md', 'file', 'md', 'admin', 'completed', 9],
    ['Product catalog API', 'api', 'api_generic', 'customer', 'processing', 0],
    ['Smart meter FAQ.pdf', 'file', 'pdf', 'public', 'queued', 0],
    ['Legacy CRM export.xml', 'file', 'xml', 'internal', 'failed', 0]
  ];
  const sources = SRC.map(([name, kind, type, audience, status, docs], i) => ({
    source_id: `src_${i + 1}`,
    tenant_id: TENANT,
    name,
    kind,
    source_type: kind === 'file' ? 'file' : kind === 'text' ? 'text' : type,
    filename: kind === 'file' ? name : null,
    url: kind === 'api' ? (type === 'support_tickets' ? 'https://acme.zendesk.com/api/v2/tickets.json' : 'https://api.acme.test/v1/products') : null,
    audience,
    status,
    documents_count: docs,
    records_count: kind === 'api' ? (status === 'completed' ? 3120 : null) : null,
    last_task_id: `task_seed_${i}`,
    last_synced_at: status === 'completed' ? iso(now - (i + 1) * 2.3 * DAY) : null,
    error_message: status === 'failed' ? 'Could not parse XML: unexpected end of file at line 4,212.' : null,
    created_at: iso(now - (50 - i * 4) * DAY),
    config: null
  }));
  // Keep "processing"/"queued" seed sources moving so polling shows progress.
  const tasks = {};
  sources.forEach((s) => {
    if (s.status === 'processing' || s.status === 'queued') {
      tasks[s.last_task_id] = { task_id: s.last_task_id, source_id: s.source_id, started: now + (s.status === 'queued' ? 4000 : 0), docs: 37 + s.name.length };
    }
  });

  const notifications = [];
  let nid = 1;
  gaps
    .filter((g) => g.status === 'open')
    .slice(0, 9)
    .forEach((g) => {
      notifications.push({
        id: nid++,
        type: g.reason === 'negative_feedback' ? 'feedback' : 'gap',
        title: g.reason === 'negative_feedback' ? 'Negative feedback on an answer' : 'New question the AI couldn’t answer',
        body: `“${g.question}” — ${g.user_name || 'Anonymous visitor'}`,
        link: `#/gaps/${g.id}`,
        created_at: g.created_at,
        read_by: new Set(g.id % 3 === 0 ? [1, 2, 3, 4, 5] : [])
      });
    });
  notifications.push({ id: nid++, type: 'training_failed', title: 'Training failed: Legacy CRM export.xml', body: 'Could not parse XML: unexpected end of file.', link: '#/training', created_at: iso(now - 2.1 * DAY), read_by: new Set([1]) });
  notifications.push({ id: nid++, type: 'staff', title: 'Hannah Kim was invited', body: 'Invited as trainer by Marcus Chen.', link: '#/staff', created_at: iso(now - 3 * DAY), read_by: new Set([1, 2, 3, 4, 5]) });
  notifications.push({ id: nid++, type: 'staff', title: 'Daniel Okafor joined the team', body: 'Accepted the invite as trainer.', link: '#/staff', created_at: iso(now - 12 * DAY), read_by: new Set([1, 2, 3, 4, 5]) });
  notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const settings = {
    tenant_id: TENANT,
    display_name: 'Acme Energy',
    support_email: 'support@acme-energy.test',
    gap_distance_threshold: 0.55,
    notify_on_gap: true,
    notify_on_feedback: true,
    email_max_per_hour: 20,
    smtp_configured: smtp,
    widget: {
      theme: { primary: '#1d4ed8', panel: '#eff6ff', ink: '#0f172a' },
      branding: { botName: 'Ava', title: 'Acme Energy Support', subtitle: 'Usually answers instantly', logoUrl: null },
      launcher: { type: 'button', text: 'Need help?' },
      welcomeMessages: ["Hi {{name}}! I'm {{botName}}, Acme's virtual assistant.", 'Ask me about bills, payments, outages or your account.'],
      quickActions: ['Pay my bill', 'Report an outage', 'Understand my bill'],
      placeholder: 'Ask about your bill, payments, outages…'
    }
  };

  const keys0 = [
    { id: 1, name: 'Website chat', key_type: 'publishable', key_prefix: 'pk_live_7Hq2', is_active: true, created_at: iso(now - 58 * DAY), last_used: iso(now - 0.02 * DAY), expires_at: null },
    { id: 2, name: 'Odoo production', key_type: 'secret', key_prefix: 'sk_live_Lm9x', is_active: true, created_at: iso(now - 45 * DAY), last_used: iso(now - 0.1 * DAY), expires_at: null },
    { id: 3, name: 'Staging (old)', key_type: 'secret', key_prefix: 'sk_live_02aB', is_active: false, created_at: iso(now - 80 * DAY), last_used: iso(now - 40 * DAY), expires_at: null }
  ];

  keys0.push(
    { id: 4, tenant_id: 'northwind-logistics', name: 'Website chat', key_type: 'publishable', key_prefix: 'pk_live_N0rt', is_active: true, created_at: iso(now - 60 * DAY), last_used: iso(now - 0.08 * DAY), expires_at: null },
    { id: 5, tenant_id: 'northwind-logistics', name: 'Odoo production', key_type: 'secret', key_prefix: 'sk_live_wQ8e', is_active: true, created_at: iso(now - 59 * DAY), last_used: iso(now - 0.3 * DAY), expires_at: null },
    { id: 6, tenant_id: 'globex-health', name: 'Patient portal', key_type: 'publishable', key_prefix: 'pk_live_G1bx', is_active: true, created_at: iso(now - 18 * DAY), last_used: iso(now - 2.5 * DAY), expires_at: iso(now + 160 * DAY) },
    { id: 7, tenant_id: LEGACY, name: 'Legacy widget (imported)', key_type: 'publishable', key_prefix: 'Ab3xQ9', is_active: true, created_at: iso(now - 240 * DAY), last_used: iso(now - 12 * DAY), expires_at: null }
  );
  const keys = keys0.map((k) => ({ tenant_id: TENANT, ...k, expired: false }));
  return {
    TENANT,
    staff,
    gaps,
    conversations,
    daily,
    sources,
    tasks,
    notifications,
    settings,
    keys,
    tenants,
    invites: {},
    loginFails: {},
    resets: {},
    seq: { staff: 100, gap: 100, notif: 100, key: 100, src: 100 }
  };
}

/* ------------------------------------------------------------------ */
/* Request handling                                                    */
/* ------------------------------------------------------------------ */

const RANK = { viewer: 0, trainer: 1, admin: 2, owner: 3 };

function createApi() {
  const db = seed(Date.now());

  const publicUser = (u) => {
    const { password, ...rest } = u;
    return { ...rest };
  };
  const issue = (u) => {
    u.last_login_at = new Date().toISOString();
    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${b64url({ sub: u.id, tenant: db.TENANT, role: u.role, exp: Math.floor(Date.now() / 1000) + 86400 })}.mock-signature`;
    return { access_token: token, token_type: 'bearer', expires_in: 86400, user: publicUser(u) };
  };
  const auth = (headers, min = 'viewer') => {
    const h = headers.authorization || '';
    const tok = h.replace(/^Bearer\s+/i, '');
    const parts = tok.split('.');
    const SESSION = 'Invalid or expired session. Please log in again.';
    if (parts.length !== 3) throw new HttpError(401, SESSION);
    let payload;
    try {
      payload = fromB64url(parts[1]);
    } catch {
      throw new HttpError(401, SESSION);
    }
    if (!payload || payload.exp * 1000 < Date.now()) throw new HttpError(401, SESSION);
    const u = db.staff.find((s) => s.id === payload.sub);
    if (!u || !u.is_active || u.invited) throw new HttpError(401, SESSION);
    if (RANK[u.role] < RANK[min]) throw new HttpError(403, `Your role (${u.role}) can't do this`);
    return u;
  };
  const findStaff = (id) => {
    const u = db.staff.find((s) => String(s.id) === String(id));
    if (!u) throw new HttpError(404, 'Staff member not found');
    return u;
  };
  const findGap = (id) => {
    const g = db.gaps.find((x) => String(x.id) === String(id));
    if (!g) throw new HttpError(404, 'Gap not found');
    return g;
  };
  const findSource = (id) => {
    const s = db.sources.find((x) => x.source_id === id);
    if (!s) throw new HttpError(404, 'Source not found');
    return s;
  };
  // Admins can only invite/edit/remove trainers and viewers; owners manage everyone.
  // Platform-admin accounts can only be changed by a platform admin.
  const canManage = (actor, target) => (actor.role === 'owner' || RANK[target.role] < RANK.admin) && (!target.is_platform_admin || actor.is_platform_admin);
  const activeOwners = (tenant = db.TENANT) => db.staff.filter((s) => s.tenant_id === tenant && s.role === 'owner' && s.is_active && !s.invited).length;
  const tenantStaff = (me, id) => {
    const u = findStaff(id);
    if (u.tenant_id !== me.tenant_id) throw new HttpError(404, 'Staff member not found');
    return u;
  };
  const randomKey = (type) => `${type === 'secret' ? 'sk' : 'pk'}_live_${Array.from({ length: 40 }, () => 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 56)]).join('')}`;
  const newKey = (tenant_id, type, name, expires_at) => {
    const raw = randomKey(type);
    const key = { id: ++db.seq.key, tenant_id, name, key_type: type, key_prefix: raw.slice(0, 12), is_active: true, created_at: new Date().toISOString(), last_used: null, expires_at: expires_at || null, expired: false };
    db.keys.unshift(key);
    return { key, raw };
  };
  const keyOut = (k) => ({ ...k, expired: !!k.expires_at && new Date(k.expires_at).getTime() < Date.now() });
  const tenantKeyOut = (k) => {
    const { tenant_id, ...rest } = keyOut(k);
    return rest;
  };
  const inviteUrl = (token) => `${window.location.origin}${window.location.pathname}${window.location.search}#/accept-invite?token=${token}`;

  const tickTasks = () => {
    const now = Date.now();
    Object.values(db.tasks).forEach((t) => {
      const s = db.sources.find((x) => x.source_id === t.source_id);
      const age = now - t.started;
      t.status = t.fail ? (age > 3000 ? 'failed' : 'processing') : age < 0 ? 'queued' : age < 2500 ? 'queued' : age < 6000 ? 'processing' : 'completed';
      if (s && s.last_task_id === t.task_id) {
        s.status = t.status;
        if (t.status === 'completed' && !s.documents_count) {
          s.documents_count = t.docs;
          s.last_synced_at = new Date(t.started + 6000).toISOString();
          if (s.kind === 'api') s.records_count = t.docs * 12;
        }
        if (t.status === 'failed') s.error_message = 'Mock failure.';
      }
    });
  };

  const newTask = (source, docs, fail) => {
    const task_id = rid('task');
    db.tasks[task_id] = { task_id, source_id: source.source_id, started: Date.now(), docs, fail };
    source.last_task_id = task_id;
    source.status = 'queued';
    return task_id;
  };

  const newSource = (fields) => {
    const s = {
      source_id: `src_${++db.seq.src}`,
      tenant_id: db.TENANT,
      filename: null,
      url: null,
      audience: 'internal',
      status: 'queued',
      documents_count: 0,
      records_count: null,
      last_task_id: null,
      last_synced_at: null,
      error_message: null,
      created_at: new Date().toISOString(),
      config: null,
      ...fields
    };
    db.sources.unshift(s);
    return s;
  };

  const notifyAll = (n) => {
    db.notifications.unshift({ id: ++db.seq.notif, created_at: new Date().toISOString(), read_by: new Set(), ...n });
  };

  /* ----- platform admin ----- */
  const platformAuth = (headers) => {
    const u = auth(headers);
    if (!u.is_platform_admin) throw new HttpError(403, 'Platform admin access required');
    return u;
  };
  const tenantName = (tid) => (db.tenants[tid] && db.tenants[tid].display_name) || tid;
  const statusOf = (u) => (!u.is_active ? 'disabled' : u.invited ? 'invited' : u.must_change_password ? 'must_change' : 'active');
  const platformUser = (u) => ({ ...publicUser(u), tenant_name: tenantName(u.tenant_id), status: statusOf(u), has_password: !!u.password });
  const platformKey = (k) => ({ ...keyOut(k), tenant_name: tenantName(k.tenant_id) });
  const findTenant = (tid) => {
    if (!db.tenants[tid]) throw new HttpError(404, 'Company not found');
    return db.tenants[tid];
  };
  const tenantSummary = (tid) => {
    const t = db.tenants[tid];
    const people = db.staff.filter((s) => s.tenant_id === tid);
    const keys = db.keys.filter((k) => k.tenant_id === tid);
    const active = keys.filter((k) => k.is_active);
    const live = t.live
      ? {
          documents: db.sources.reduce((n, x) => n + (x.documents_count || 0), 0),
          sources: db.sources.length,
          conversations: db.conversations.length,
          open_gaps: db.gaps.filter((g) => g.status === 'open').length,
          last_activity_at: db.conversations[0] ? db.conversations[0].last_message_at : null
        }
      : { documents: t.documents || 0, sources: t.sources || 0, conversations: t.conversations || 0, open_gaps: t.open_gaps || 0, last_activity_at: t.last_activity_at || null };
    const logins = people.map((p) => p.last_login_at).filter(Boolean);
    const lastLogin = logins.sort().slice(-1)[0] || null;
    return {
      tenant_id: tid,
      display_name: t.display_name || tid,
      staff_count: people.length,
      owners: people.filter((p) => p.role === 'owner').map((p) => p.email),
      key_counts: { publishable: active.filter((k) => k.key_type !== 'secret').length, secret: active.filter((k) => k.key_type === 'secret').length, active: active.length, total: keys.length },
      ...live,
      last_activity_at: [live.last_activity_at, lastLogin].filter(Boolean).sort().slice(-1)[0] || null,
      created_at: t.created_at
    };
  };
  const createUser = (tid, body, actor) => {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(422, 'Enter a valid email address');
    if (!RANK.hasOwnProperty(body.role || 'viewer')) throw new HttpError(422, 'role must be one of: owner, admin, trainer, viewer');
    if (db.staff.some((s) => s.email === email)) throw new HttpError(409, 'This email is already registered');
    if (body.password && String(body.password).length < 10) throw new HttpError(422, 'Password must be at least 10 characters');
    const u = {
      id: ++db.seq.staff, tenant_id: tid, email, full_name: (body.full_name || '').trim() || null, role: body.role || 'viewer', is_active: true,
      notify_email: true, notify_in_app: true, last_login_at: null, created_at: new Date().toISOString(), invited: !body.password,
      password: body.password || null, is_platform_admin: !!body.is_platform_admin, must_change_password: !!body.password && body.must_change_password !== false
    };
    db.staff.push(u);
    const out = { user: platformUser(u), password_set: !!body.password };
    if (!body.password) {
      const token = rid('inv');
      db.invites[token] = u.id;
      out.invite_url = inviteUrl(token);
      out.email_sent = false;
    }
    return out;
  };
  const isActiveOwner = (u) => u.role === 'owner' && u.is_active && !u.invited;

  function platformRoutes() {
    return [
      ['GET', /^\/api\/platform\/overview$/, ({ headers }) => {
        platformAuth(headers);
        const sums = Object.keys(db.tenants).map(tenantSummary);
        const active = db.keys.filter((k) => k.is_active);
        return {
          tenants: sums.length,
          staff: db.staff.length,
          staff_active: db.staff.filter((s) => s.is_active && !s.invited).length,
          platform_admins: db.staff.filter((s) => s.is_platform_admin).length,
          keys: { publishable: active.filter((k) => k.key_type !== 'secret').length, secret: active.filter((k) => k.key_type === 'secret').length, active: active.length, revoked: db.keys.length - active.length },
          documents: sums.reduce((n, t) => n + t.documents, 0),
          sources: sums.reduce((n, t) => n + t.sources, 0),
          conversations: sums.reduce((n, t) => n + t.conversations, 0),
          questions_30d: db.daily.slice(-30).reduce((n, d) => n + d.questions, 0) + Object.values(db.tenants).reduce((n, t) => n + (t.questions_30d || 0), 0),
          open_gaps: sums.reduce((n, t) => n + t.open_gaps, 0)
        };
      }],
      ['GET', /^\/api\/platform\/tenants$/, ({ headers }) => {
        platformAuth(headers);
        return { tenants: Object.keys(db.tenants).map(tenantSummary).sort((a, b) => a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase())) };
      }],
      ['POST', /^\/api\/platform\/tenants$/, ({ headers, body }) => {
        const me = platformAuth(headers);
        const tid = String(body.tenant_id || '').trim();
        if (!/^[A-Za-z0-9._-]{3,64}$/.test(tid)) throw new HttpError(422, "Tenant id must be 3-64 characters: letters, digits, '.', '_' or '-'");
        if (db.tenants[tid]) throw new HttpError(409, 'A company with this tenant id already exists');
        const owner = body.owner || {};
        const email = String(owner.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(422, 'Enter a valid email address');
        if (db.staff.some((s) => s.email === email)) throw new HttpError(409, 'This email is already registered');
        if (owner.password && String(owner.password).length < 10) throw new HttpError(422, 'Password must be at least 10 characters');
        db.tenants[tid] = { display_name: (body.display_name || '').trim() || null, created_at: new Date().toISOString(), documents: 0, sources: 0, conversations: 0, open_gaps: 0, last_activity_at: null, questions_30d: 0, unanswered_30d: 0 };
        const created = createUser(tid, { ...owner, role: 'owner' }, me);
        const keys = [];
        const ck = body.create_keys || {};
        if (ck.publishable) {
          const { key, raw } = newKey(tid, 'publishable', 'Website chat');
          keys.push({ key: platformKey(key), raw_key: raw });
        }
        if (ck.secret) {
          const { key, raw } = newKey(tid, 'secret', 'Server integration');
          keys.push({ key: platformKey(key), raw_key: raw });
        }
        const out = { tenant: tenantSummary(tid), owner: created.user, password_set: created.password_set, keys };
        if (created.invite_url) Object.assign(out, { invite_url: created.invite_url, email_sent: false });
        return { __status: 201, body: out };
      }],
      ['GET', /^\/api\/platform\/tenants\/([^/]+)$/, ({ headers, m }) => {
        platformAuth(headers);
        const tid = decodeURIComponent(m[1]);
        const t = findTenant(tid);
        const sum = tenantSummary(tid);
        const q30 = t.live ? db.daily.slice(-30).reduce((n, d) => n + d.questions, 0) : t.questions_30d || 0;
        const u30 = t.live ? db.daily.slice(-30).reduce((n, d) => n + d.unanswered, 0) : t.unanswered_30d || 0;
        return {
          ...sum,
          usage: { days: 30, questions: q30, unanswered: u30, questions_all_time: t.live ? db.daily.reduce((n, d) => n + d.questions, 0) : Math.round(q30 * 4.2) },
          staff: db.staff.filter((s) => s.tenant_id === tid).map(platformUser),
          keys: db.keys.filter((k) => k.tenant_id === tid).map(platformKey)
        };
      }],
      ['PATCH', /^\/api\/platform\/tenants\/([^/]+)$/, ({ headers, body, m }) => {
        platformAuth(headers);
        const tid = decodeURIComponent(m[1]);
        const t = findTenant(tid);
        if (body.display_name !== undefined) t.display_name = String(body.display_name || '').trim() || null;
        if (t.live) db.settings.display_name = t.display_name || tid;
        return tenantSummary(tid);
      }],
      ['GET', /^\/api\/platform\/users$/, ({ headers, query }) => {
        platformAuth(headers);
        const q = String(query.q || '').trim().toLowerCase();
        const users = db.staff.filter(
          (u) =>
            (!query.tenant_id || u.tenant_id === query.tenant_id) &&
            (!query.role || u.role === query.role) &&
            (!query.status || statusOf(u) === query.status) &&
            (query.platform_admin === undefined || String(!!u.is_platform_admin) === String(query.platform_admin)) &&
            (!q || [u.email, u.full_name, u.tenant_id, tenantName(u.tenant_id)].some((v) => String(v || '').toLowerCase().includes(q)))
        );
        return { users: users.sort((a, b) => tenantName(a.tenant_id).localeCompare(tenantName(b.tenant_id)) || a.id - b.id).map(platformUser) };
      }],
      ['POST', /^\/api\/platform\/users$/, ({ headers, body }) => {
        const me = platformAuth(headers);
        findTenant(String(body.tenant_id || ''));
        return { __status: 201, body: createUser(body.tenant_id, body, me) };
      }],
      ['PATCH', /^\/api\/platform\/users\/([^/]+)$/, ({ headers, body, m }) => {
        const me = platformAuth(headers);
        const u = findStaff(m[1]);
        const self = u.id === me.id;
        if (self && body.is_platform_admin === false) throw new HttpError(400, "You can't remove your own platform admin access");
        if (self && body.is_active === false) throw new HttpError(400, "You can't deactivate your own account");
        if (body.role && !RANK.hasOwnProperty(body.role)) throw new HttpError(422, 'role must be one of: owner, admin, trainer, viewer');
        if (body.tenant_id && body.tenant_id !== u.tenant_id) findTenant(body.tenant_id);
        const loses = isActiveOwner(u) && ((body.role && body.role !== 'owner') || body.is_active === false || (body.tenant_id && body.tenant_id !== u.tenant_id));
        if (loses && activeOwners(u.tenant_id) <= 1) throw new HttpError(409, 'A tenant must keep at least one active owner');
        ['role', 'is_active', 'is_platform_admin', 'tenant_id'].forEach((k) => body[k] !== undefined && body[k] !== null && (u[k] = body[k]));
        if (body.full_name !== undefined) u.full_name = String(body.full_name || '').trim() || null;
        return platformUser(u);
      }],
      ['POST', /^\/api\/platform\/users\/([^/]+)\/password$/, ({ headers, body, m }) => {
        platformAuth(headers);
        const u = findStaff(m[1]);
        if (String(body.password || '').length < 10) throw new HttpError(422, 'Password must be at least 10 characters');
        u.password = body.password;
        u.invited = false;
        u.must_change_password = body.must_change_password !== false;
        return { ok: true, user: platformUser(u) };
      }],
      ['POST', /^\/api\/platform\/users\/([^/]+)\/invite-link$/, ({ headers, m }) => {
        platformAuth(headers);
        const u = findStaff(m[1]);
        if (!u.invited && u.password) throw new HttpError(400, 'This user already has a password. Set a new one instead.');
        Object.keys(db.invites).forEach((t) => db.invites[t] === u.id && delete db.invites[t]);
        const token = rid('inv');
        db.invites[token] = u.id;
        u.invited = true;
        return { invite_url: inviteUrl(token) };
      }],
      ['DELETE', /^\/api\/platform\/users\/([^/]+)$/, ({ headers, m }) => {
        const me = platformAuth(headers);
        const u = findStaff(m[1]);
        if (u.id === me.id) throw new HttpError(400, "You can't remove your own account");
        if (isActiveOwner(u) && activeOwners(u.tenant_id) <= 1) throw new HttpError(409, 'A tenant must keep at least one active owner');
        db.staff = db.staff.filter((s) => s !== u);
        return { deleted: true };
      }],
      ['GET', /^\/api\/platform\/keys$/, ({ headers, query }) => {
        platformAuth(headers);
        return { keys: db.keys.filter((k) => !query.tenant_id || k.tenant_id === query.tenant_id).map(platformKey) };
      }],
      ['POST', /^\/api\/platform\/keys$/, ({ headers, body }) => {
        platformAuth(headers);
        findTenant(String(body.tenant_id || ''));
        if (!['publishable', 'secret'].includes(body.key_type)) throw new HttpError(422, 'key_type must be one of: publishable, secret');
        const { key, raw } = newKey(body.tenant_id, body.key_type, String(body.name || '').trim() || `${body.key_type} key for ${body.tenant_id}`, body.expires_at);
        return { __status: 201, body: { key: platformKey(key), raw_key: raw } };
      }],
      ['POST', /^\/api\/platform\/keys\/([^/]+)\/roll$/, ({ headers, m }) => {
        platformAuth(headers);
        const k = db.keys.find((x) => String(x.id) === m[1]);
        if (!k) throw new HttpError(404, 'API key not found');
        if (!k.is_active) throw new HttpError(400, 'This key is already revoked; create a new key instead');
        const { key, raw } = newKey(k.tenant_id, k.key_type, k.name, k.expires_at);
        k.is_active = false;
        return { key: platformKey(key), raw_key: raw, revoked_id: k.id };
      }],
      ['DELETE', /^\/api\/platform\/keys\/([^/]+)$/, ({ headers, m }) => {
        platformAuth(headers);
        const k = db.keys.find((x) => String(x.id) === m[1]);
        if (!k) throw new HttpError(404, 'API key not found');
        k.is_active = false;
        return { revoked: true, key: platformKey(k) };
      }]
    ];
  }

  const routes = [
    // ----- auth
    ['POST', /^\/api\/staff\/login$/, ({ body }) => {
      const email = String(body.email || '').toLowerCase();
      const now = Date.now();
      const fails = (db.loginFails[email] || []).filter((t) => now - t < 15 * 60e3);
      if (fails.length >= 10) throw new HttpError(429, 'Too many failed login attempts. Try again in a few minutes.');
      const u = db.staff.find((s) => s.email.toLowerCase() === email);
      if (!u || u.invited || u.password !== body.password) {
        db.loginFails[email] = [...fails, now];
        throw new HttpError(401, 'Invalid email or password');
      }
      delete db.loginFails[email];
      if (!u.is_active) throw new HttpError(401, 'This account has been disabled. Contact an admin.');
      return issue(u);
    }],
    ['GET', /^\/api\/staff\/me$/, ({ headers }) => publicUser(auth(headers))],
    ['PATCH', /^\/api\/staff\/me$/, ({ headers, body }) => {
      const u = auth(headers);
      ['full_name', 'notify_email', 'notify_in_app'].forEach((k) => body[k] !== undefined && (u[k] = body[k]));
      return publicUser(u);
    }],
    ['POST', /^\/api\/staff\/me\/password$/, ({ headers, body }) => {
      const u = auth(headers);
      if (u.password !== body.current_password) throw new HttpError(400, 'Current password is incorrect');
      if (String(body.new_password || '').length < 8) throw new HttpError(422, 'Password must be at least 8 characters');
      u.password = body.new_password;
      u.must_change_password = false;
      return { ok: true };
    }],
    ['POST', /^\/api\/staff\/accept-invite$/, ({ body }) => {
      const id = db.invites[body.token];
      const u = id && db.staff.find((s) => s.id === id);
      if (!u) throw new HttpError(400, 'This invite link is invalid or has expired');
      if (String(body.password || '').length < 8) throw new HttpError(422, 'Password must be at least 8 characters');
      u.password = body.password;
      u.invited = false;
      u.must_change_password = false;
      if (body.full_name) u.full_name = body.full_name;
      delete db.invites[body.token];
      notifyAll({ type: 'staff', title: `${u.full_name || u.email} joined the team`, body: `Accepted the invite as ${u.role}.`, link: '#/staff' });
      return issue(u);
    }],
    ['POST', /^\/api\/staff\/forgot-password$/, ({ body }) => {
      const u = db.staff.find((s) => s.email.toLowerCase() === String(body.email || '').toLowerCase());
      if (u && !u.invited) {
        const token = rid('reset');
        db.resets[token] = u.id;
        // eslint-disable-next-line no-console
        console.info('[staff-mock] password reset link:', `${window.location.origin}${window.location.pathname}${window.location.search}#/reset-password?token=${token}`);
      }
      return { ok: true };
    }],
    ['POST', /^\/api\/staff\/reset-password$/, ({ body }) => {
      const id = db.resets[body.token];
      const u = id && db.staff.find((s) => s.id === id);
      if (!u) throw new HttpError(400, 'This reset link is invalid or has expired');
      u.password = body.password;
      u.must_change_password = false;
      delete db.resets[body.token];
      return issue(u);
    }],
    // ----- staff management
    ['GET', /^\/api\/staff$/, ({ headers }) => {
      const me = auth(headers);
      return { staff: db.staff.filter((s) => s.tenant_id === me.tenant_id).map(publicUser) };
    }],
    ['POST', /^\/api\/staff\/invite$/, ({ headers, body }) => {
      const me = auth(headers, 'admin');
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(422, 'Enter a valid email address');
      if (!RANK.hasOwnProperty(body.role)) throw new HttpError(422, 'Invalid role');
      if (me.role !== 'owner' && RANK[body.role] >= RANK.admin) throw new HttpError(403, `Your role (${me.role}) can't do this`);
      if (db.staff.some((s) => s.email === email)) throw new HttpError(409, 'A staff member with this email already exists');
      if (body.password && String(body.password).length < 10) throw new HttpError(422, 'Password must be at least 10 characters');
      const u = { id: ++db.seq.staff, tenant_id: me.tenant_id, email, full_name: body.full_name || null, role: body.role, is_active: true, notify_email: true, notify_in_app: true, last_login_at: null, created_at: new Date().toISOString(), invited: !body.password, password: body.password || null, is_platform_admin: false, must_change_password: !!body.password };
      db.staff.push(u);
      if (body.password) {
        notifyAll({ type: 'staff', title: `${u.full_name || u.email} was added`, body: `Added as ${u.role} by ${me.full_name || me.email} with a temporary password.`, link: '#/staff' });
        return { user: publicUser(u), invite_url: null, email_sent: false, password_set: true };
      }
      const token = rid('inv');
      db.invites[token] = u.id;
      notifyAll({ type: 'staff', title: `${u.full_name || u.email} was invited`, body: `Invited as ${u.role} by ${me.full_name || me.email}.`, link: '#/staff' });
      return { user: publicUser(u), invite_url: inviteUrl(token), email_sent: db.settings.smtp_configured };
    }],
    ['PATCH', /^\/api\/staff\/([^/]+)$/, ({ headers, body, m }) => {
      const me = auth(headers, 'admin');
      const u = tenantStaff(me, m[1]);
      if (!canManage(me, u)) throw new HttpError(403, `Your role (${me.role}) can't manage ${u.role}s`);
      if (body.role && me.role !== 'owner' && RANK[body.role] >= RANK.admin) throw new HttpError(403, `Your role (${me.role}) can't do this`);
      const losingOwner = u.role === 'owner' && ((body.role && body.role !== 'owner') || body.is_active === false);
      if (losingOwner && activeOwners(u.tenant_id) <= 1) throw new HttpError(409, 'A tenant must keep at least one active owner');
      ['role', 'is_active', 'full_name', 'notify_email'].forEach((k) => body[k] !== undefined && (u[k] = body[k]));
      return publicUser(u);
    }],
    ['DELETE', /^\/api\/staff\/([^/]+)$/, ({ headers, m }) => {
      const me = auth(headers, 'admin');
      const u = tenantStaff(me, m[1]);
      if (u.id === me.id) throw new HttpError(400, 'You can’t remove yourself');
      if (!canManage(me, u)) throw new HttpError(403, `Your role (${me.role}) can't manage ${u.role}s`);
      if (u.role === 'owner' && activeOwners(u.tenant_id) <= 1) throw new HttpError(409, 'A tenant must keep at least one active owner');
      db.staff = db.staff.filter((s) => s !== u);
      return { deleted: true };
    }],
    ['POST', /^\/api\/staff\/([^/]+)\/password$/, ({ headers, body, m }) => {
      const me = auth(headers, 'admin');
      const u = tenantStaff(me, m[1]);
      if (u.id === me.id) throw new HttpError(400, 'Use Account settings to change your own password');
      if (!canManage(me, u)) throw new HttpError(403, u.is_platform_admin ? 'Only a platform admin can change a platform admin account' : `Your role (${me.role}) can't do this`);
      if (String(body.password || '').length < 10) throw new HttpError(422, 'Password must be at least 10 characters');
      u.password = body.password;
      u.invited = false;
      u.must_change_password = body.must_change_password !== false;
      return { ok: true, user: publicUser(u) };
    }],
    ['POST', /^\/api\/staff\/([^/]+)\/resend-invite$/, ({ headers, m }) => {
      const me = auth(headers, 'admin');
      const u = tenantStaff(me, m[1]);
      if (!canManage(me, u)) throw new HttpError(403, `Your role (${me.role}) can't manage ${u.role}s`);
      if (!u.invited) throw new HttpError(400, 'This person already accepted their invite');
      const token = rid('inv');
      db.invites[token] = u.id;
      return { invite_url: inviteUrl(token), email_sent: db.settings.smtp_configured };
    }],
    // ----- gaps
    ['GET', /^\/api\/reports\/gaps$/, ({ headers, query }) => {
      auth(headers);
      const status = query.status || 'open';
      const q = norm(query.q);
      const page = Math.max(1, Number(query.page) || 1);
      const size = Math.min(100, Math.max(1, Number(query.page_size) || 20));
      const base = db.gaps.filter((g) => (!query.reason || g.reason === query.reason) && (!q || norm(g.question).includes(q) || norm(g.user_name).includes(q)));
      const counts = { open: 0, resolved: 0, dismissed: 0 };
      base.forEach((g) => counts[g.status]++);
      const items = base
        .filter((g) => status === 'all' || g.status === status)
        .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));
      return { items: items.slice((page - 1) * size, page * size), total: items.length, page, page_size: size, counts };
    }],
    ['GET', /^\/api\/reports\/gaps\/([^/]+)$/, ({ headers, m }) => {
      auth(headers);
      return findGap(m[1]);
    }],
    ['PATCH', /^\/api\/reports\/gaps\/([^/]+)$/, ({ headers, body, m }) => {
      const me = auth(headers, 'trainer');
      const g = findGap(m[1]);
      if (body.status) {
        g.status = body.status;
        if (body.status === 'open') {
          g.resolved_by = null;
          g.resolved_at = null;
          g.resolution_note = null;
        } else {
          g.resolved_by = me.full_name || me.email;
          g.resolved_at = new Date().toISOString();
        }
      }
      if (body.resolution_note !== undefined) g.resolution_note = body.resolution_note || null;
      return g;
    }],
    ['POST', /^\/api\/reports\/gaps\/([^/]+)\/answer$/, ({ headers, body, m }) => {
      const me = auth(headers, 'trainer');
      const g = findGap(m[1]);
      if (!String(body.answer || '').trim()) throw new HttpError(422, 'Answer is required');
      const source = newSource({ name: `Answer: ${g.question.slice(0, 60)}`, kind: 'text', source_type: 'text', audience: body.audience || 'public' });
      const task_id = newTask(source, 1);
      const resolve = (x) => {
        x.status = 'resolved';
        x.resolved_by = me.full_name || me.email;
        x.resolved_at = new Date().toISOString();
        x.source_id = source.source_id;
        x.resolution_note = 'Answered and trained';
      };
      resolve(g);
      const similar = body.also_resolve_similar ? db.gaps.filter((x) => x.status === 'open' && x !== g && similarity(x.question, g.question) >= 0.45) : [];
      similar.forEach(resolve);
      return { gap: g, source, task_id, resolved_similar: similar.length };
    }],
    // {session_id, message_id?, rating, comment?, tenant_id?, user_id?}; 'down' creates/increments a negative_feedback gap.
    ['POST', /^\/api\/chat\/feedback$/, ({ body }) => {
      const conv = db.conversations.find((c) => c.session_id === body.session_id);
      const msgs = conv ? conv.messages : [];
      const byId = msgs.find((x) => String(x.id) === String(body.message_id));
      const ans = byId || [...msgs].reverse().find((x) => x.role === 'assistant');
      if (ans) ans.feedback = body.rating === 'down' ? 'down' : 'up';
      if (body.rating === 'down') {
        const q = ans ? msgs.slice(0, msgs.indexOf(ans)).reverse().find((x) => x.role === 'user') : null;
        const question = q ? q.content : 'Unrated question';
        const existing = db.gaps.find((x) => norm(x.question) === norm(question));
        const nowIso = new Date().toISOString();
        if (existing) {
          existing.occurrences++;
          existing.last_seen_at = nowIso;
          if (body.comment) existing.last_feedback_comment = body.comment;
        } else {
          const g = { id: ++db.seq.gap, tenant_id: db.TENANT, question, reason: 'negative_feedback', status: 'open', occurrences: 1, best_distance: null, answer_given: ans ? ans.content : null, session_id: body.session_id || null, user_id: body.user_id || null, user_name: conv ? conv.user_name : null, user_role: conv ? conv.user_role : null, resolution_note: null, resolved_by: null, resolved_at: null, source_id: null, last_feedback_comment: body.comment || null, created_at: nowIso, last_seen_at: nowIso };
          db.gaps.unshift(g);
          if (db.settings.notify_on_feedback) notifyAll({ type: 'feedback', title: 'Negative feedback on an answer', body: `“${question}”`, link: `#/gaps/${g.id}` });
        }
      }
      return { ok: true };
    }],
    // ----- notifications
    ['GET', /^\/api\/notifications$/, ({ headers, query }) => {
      const me = auth(headers);
      const unreadOnly = String(query.unread_only) === 'true';
      const limit = Math.max(1, Number(query.limit) || 30);
      const mine = me.notify_in_app ? db.notifications : [];
      const shaped = mine.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, created_at: n.created_at, read: n.read_by.has(me.id) }));
      return { items: shaped.filter((n) => !unreadOnly || !n.read).slice(0, limit), unread_count: shaped.filter((n) => !n.read).length };
    }],
    ['POST', /^\/api\/notifications\/read-all$/, ({ headers }) => {
      const me = auth(headers);
      let updated = 0;
      db.notifications.forEach((n) => {
        if (!n.read_by.has(me.id)) {
          n.read_by.add(me.id);
          updated++;
        }
      });
      return { ok: true, updated };
    }],
    ['POST', /^\/api\/notifications\/([^/]+)\/read$/, ({ headers, m }) => {
      const me = auth(headers);
      const n = db.notifications.find((x) => String(x.id) === m[1]);
      if (!n) throw new HttpError(404, 'Notification not found');
      n.read_by.add(me.id);
      return { ok: true };
    }],
    // ----- reports
    ['GET', /^\/api\/reports\/overview$/, ({ headers, query }) => {
      auth(headers);
      tickTasks();
      const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : Math.min(365, Math.max(1, Number(query.days) || 30));
      const daily = db.daily.slice(-days);
      const questions = daily.reduce((s, d) => s + d.questions, 0);
      const unanswered = daily.reduce((s, d) => s + d.unanswered, 0);
      const sbs = { completed: 0, processing: 0, queued: 0, failed: 0 };
      db.sources.forEach((s) => sbs[s.status]++);
      const share = { customer: 0.46, public: 0.27, internal: 0.15, vendor: 0.08, admin: 0.04 };
      const by_role = Object.entries(share).map(([role, f]) => ({ role, questions: Math.round(questions * f) }));
      const TOP = ['How do I read my bill?', 'When is my payment due?', 'How do I set up autopay?', 'Report an outage', 'Where do I find my account number?', 'Can I change my billing date?', 'How do I update my address?', 'What payment methods do you accept?'];
      const top_questions = TOP.map((q, i) => ({ question: q, count: Math.max(1, Math.round((questions * (0.09 - i * 0.009)) / 1)) }));
      const recent_gaps = db.gaps.filter((g) => g.status === 'open').sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at)).slice(0, 5);
      const now = new Date();
      return {
        range: { from: daily[0]?.date, to: dayKey(now), days },
        totals: {
          conversations: Math.round(questions / 3.4),
          questions,
          answered: questions - unanswered,
          unanswered,
          answer_rate: questions ? (questions - unanswered) / questions : 0,
          gaps_open: db.gaps.filter((g) => g.status === 'open').length,
          sources: db.sources.length,
          documents: db.sources.reduce((s, x) => s + (x.documents_count || 0), 0),
          staff: db.staff.filter((s) => s.is_active && !s.invited).length
        },
        daily,
        by_role,
        top_questions,
        recent_gaps,
        sources_by_status: sbs
      };
    }],
    ['GET', /^\/api\/reports\/conversations$/, ({ headers, query }) => {
      auth(headers);
      const q = norm(query.q);
      const page = Math.max(1, Number(query.page) || 1);
      const size = Math.min(100, Math.max(1, Number(query.page_size) || 20));
      const items = db.conversations
        .filter((c) => (!query.user_role || c.user_role === query.user_role) && (!q || norm(c.title).includes(q) || norm(c.user_name).includes(q) || c.messages.some((m) => norm(m.content).includes(q))))
        .map(({ messages, ...c }) => ({ ...c, message_count: messages.length }));
      return { items: items.slice((page - 1) * size, page * size), total: items.length, page, page_size: size };
    }],
    ['GET', /^\/api\/reports\/conversations\/([^/]+)$/, ({ headers, m }) => {
      auth(headers);
      const c = db.conversations.find((x) => x.session_id === decodeURIComponent(m[1]));
      if (!c) throw new HttpError(404, 'Conversation not found');
      const { last_message_at, has_gap, ...rest } = c;
      return rest;
    }],
    // ----- settings
    ['GET', /^\/api\/settings$/, ({ headers }) => {
      auth(headers);
      return JSON.parse(JSON.stringify(db.settings));
    }],
    ['PUT', /^\/api\/settings$/, ({ headers, body }) => {
      auth(headers, 'admin');
      const { tenant_id, smtp_configured, widget, ...rest } = body || {};
      Object.assign(db.settings, rest);
      if (rest.display_name !== undefined && db.tenants[db.TENANT]) db.tenants[db.TENANT].display_name = rest.display_name || null;
      if (widget) {
        // Deep-merge theme/branding/launcher; lists (welcomeMessages, quickActions) are replaced.
        const cur = db.settings.widget;
        db.settings.widget = {
          ...cur,
          ...widget,
          theme: { ...cur.theme, ...(widget.theme || {}) },
          branding: { ...cur.branding, ...(widget.branding || {}) },
          launcher: { ...cur.launcher, ...(widget.launcher || {}) }
        };
      }
      return JSON.parse(JSON.stringify(db.settings));
    }],
    ['GET', /^\/api\/widget-config$/, () => ({ widget: JSON.parse(JSON.stringify(db.settings.widget)) })],
    // ----- api keys
    ['GET', /^\/api\/keys$/, ({ headers }) => {
      const me = auth(headers, 'admin');
      return { keys: db.keys.filter((k) => k.tenant_id === me.tenant_id).map(tenantKeyOut) };
    }],
    ['POST', /^\/api\/keys$/, ({ headers, body }) => {
      const me = auth(headers, 'admin');
      if (!String(body.name || '').trim()) throw new HttpError(422, 'Name is required');
      const { key, raw } = newKey(me.tenant_id, body.key_type === 'secret' ? 'secret' : 'publishable', body.name.trim(), body.expires_at);
      return { __status: 201, body: { key: tenantKeyOut(key), raw_key: raw } };
    }],
    ['POST', /^\/api\/keys\/([^/]+)\/roll$/, ({ headers, m }) => {
      const me = auth(headers, 'admin');
      const k = db.keys.find((x) => String(x.id) === m[1] && x.tenant_id === me.tenant_id);
      if (!k) throw new HttpError(404, 'API key not found');
      if (!k.is_active) throw new HttpError(400, 'This key is already revoked; create a new key instead');
      const { key, raw } = newKey(k.tenant_id, k.key_type, k.name, k.expires_at);
      k.is_active = false;
      return { key: tenantKeyOut(key), raw_key: raw, revoked_id: k.id };
    }],
    ['DELETE', /^\/api\/keys\/([^/]+)$/, ({ headers, m }) => {
      const me = auth(headers, 'admin');
      const k = db.keys.find((x) => String(x.id) === m[1] && x.tenant_id === me.tenant_id);
      if (!k) throw new HttpError(404, 'Key not found');
      k.is_active = false;
      return { revoked: true };
    }],
    // ----- platform admin (/api/platform/*)
    ...platformRoutes(),
    // ----- training (existing endpoints)
    ['GET', /^\/api\/train\/sources$/, ({ headers }) => {
      auth(headers);
      tickTasks();
      return { sources: db.sources, totals: { sources: db.sources.length, documents: db.sources.reduce((s, x) => s + (x.documents_count || 0), 0) } };
    }],
    ['GET', /^\/api\/train\/sources\/([^/]+)$/, ({ headers, m }) => {
      auth(headers);
      tickTasks();
      return findSource(m[1]);
    }],
    ['PATCH', /^\/api\/train\/sources\/([^/]+)$/, ({ headers, body, m }) => {
      auth(headers, 'trainer');
      const s = findSource(m[1]);
      if (body.name) s.name = body.name;
      if (body.audience) s.audience = body.audience;
      return s;
    }],
    ['DELETE', /^\/api\/train\/sources\/([^/]+)$/, ({ headers, m }) => {
      auth(headers, 'trainer');
      const s = findSource(m[1]);
      db.sources = db.sources.filter((x) => x !== s);
      return { deleted: true, documents_deleted: s.documents_count || 0 };
    }],
    ['POST', /^\/api\/train\/sources\/([^/]+)\/sync$/, ({ headers, m }) => {
      auth(headers, 'trainer');
      const s = findSource(m[1]);
      s.documents_count = 0;
      const task_id = newTask(s, 120);
      return { source: s, task_id };
    }],
    ['POST', /^\/api\/train\/text$/, ({ headers, body }) => {
      auth(headers, 'trainer');
      if (!String(body.content || '').trim()) throw new HttpError(422, 'content: field required');
      const s = newSource({ name: body.name || 'Untitled text', kind: 'text', source_type: 'text', audience: body.audience || 'internal' });
      return { source: s, task_id: newTask(s, Math.max(1, Math.ceil(String(body.content).length / 800))) };
    }],
    ['POST', /^\/api\/train\/file$/, ({ headers, body }) => {
      auth(headers, 'trainer');
      const file = body.file;
      const fname = (file && file.name) || 'upload.txt';
      const s = newSource({ name: body.name || fname, kind: 'file', source_type: 'file', filename: fname, audience: body.audience || 'internal' });
      return { source: s, task_id: newTask(s, Math.max(1, Math.round(((file && file.size) || 4000) / 2500)), /fail/i.test(fname)) };
    }],
    ['POST', /^\/api\/train\/api-source\/test$/, ({ headers, body }) => {
      auth(headers, 'trainer');
      if (!/^https?:\/\//.test(body.url || '')) return { ok: false, status_code: null, records_found: 0, preview: [], detected_fields: [], error: 'URL must start with http:// or https://' };
      return {
        ok: true,
        status_code: 200,
        records_found: 248,
        preview: [
          { title: 'Ticket #4821 — Double charge on invoice', text: 'Q: I was charged twice for March.\nA: We refunded the duplicate charge; it appears in 3–5 business days.' },
          { title: 'Ticket #4822 — Meter access', text: 'Q: Do I need to be home for the meter reading?\nA: No, as long as the meter is accessible from outside.' }
        ],
        detected_fields: ['id', 'subject', 'description', 'resolution', 'status', 'created_at']
      };
    }],
    ['POST', /^\/api\/train\/api-source$/, ({ headers, body }) => {
      auth(headers, 'trainer');
      const s = newSource({ name: body.name || 'API source', kind: 'api', source_type: body.source_type || 'api_generic', url: body.url, audience: body.audience || 'internal', config: body });
      return { source: s, task_id: newTask(s, 96) };
    }],
    ['GET', /^\/api\/ingest\/status\/([^/]+)$/, ({ headers, m }) => {
      auth(headers);
      tickTasks();
      const t = db.tasks[m[1]];
      if (!t) return { task_id: m[1], status: 'completed', error_message: null };
      return { task_id: t.task_id, status: t.status, error_message: t.status === 'failed' ? 'Mock failure.' : null };
    }],
    ['GET', /^\/api\/health$/, ({ headers }) => {
      const raw = (headers.authorization || '').replace(/^Bearer\s+/i, '') || headers['x-api-key'] || '';
      if (!raw) return { status: 'ok', mock: true };
      if (raw.split('.').length === 3) {
        const u = auth(headers);
        return { status: 'ok', mock: true, key: { valid: true, key_type: 'staff', tenant_id: u.tenant_id } };
      }
      const k = db.keys.find((x) => x.is_active && raw.startsWith(x.key_prefix));
      if (!k) throw new HttpError(401, 'Invalid API key');
      return { status: 'ok', mock: true, key: { valid: true, key_type: k.key_type, tenant_id: k.tenant_id } };
    }]
  ];

  function handle(method, path, query, headers, body) {
    for (const [m, re, fn] of routes) {
      if (m !== method) continue;
      const match = path.match(re);
      if (match) {
        try {
          const out = fn({ headers, body: body || {}, query, m: match });
          if (out && out.__status) return { status: out.__status, json: out.body };
          return { status: 200, json: out };
        } catch (err) {
          if (err instanceof HttpError) return { status: err.status, json: { detail: err.detail } };
          // eslint-disable-next-line no-console
          console.error('[staff-mock]', err);
          return { status: 500, json: { detail: 'Mock server error' } };
        }
      }
    }
    return { status: 404, json: { detail: 'Not Found' } };
  }

  function simulateGap(question = 'Do you offer budget billing for low-income households?') {
    const g = { id: ++db.seq.gap, tenant_id: db.TENANT, question, reason: 'no_context', status: 'open', occurrences: 1, best_distance: null, answer_given: 'I’m sorry, I don’t have information about that yet.', session_id: db.conversations[0]?.session_id || null, user_id: 'u_live', user_name: 'Taylor Brooks', user_role: 'customer', resolution_note: null, resolved_by: null, resolved_at: null, source_id: null, last_feedback_comment: null, created_at: new Date().toISOString(), last_seen_at: new Date().toISOString() };
    db.gaps.unshift(g);
    notifyAll({ type: 'gap', title: 'New question the AI couldn’t answer', body: `“${question}” — Taylor Brooks`, link: `#/gaps/${g.id}` });
    return g;
  }

  return { db, handle, simulateGap };
}

/* ------------------------------------------------------------------ */
/* Interceptors                                                        */
/* ------------------------------------------------------------------ */

async function parseBody(body, contentType) {
  if (body == null) return {};
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const out = {};
    body.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      return JSON.parse(await body.text());
    } catch {
      return {};
    }
  }
  return typeof body === 'object' ? body : {};
}

export function installStaffMock({ apiUrl, latency = [120, 380] } = {}) {
  if (window.__bbMock) return window.__bbMock;
  const api = createApi();
  const base = new URL(apiUrl || window.location.origin, window.location.href);
  const basePath = base.pathname.replace(/\/+$/, '');

  const match = (url) => {
    try {
      const u = new URL(url, window.location.href);
      if (u.origin !== base.origin) return null;
      if (!u.pathname.startsWith(`${basePath}/api/`)) return null;
      const query = {};
      u.searchParams.forEach((v, k) => {
        query[k] = v;
      });
      return { path: u.pathname.slice(basePath.length), query };
    } catch {
      return null;
    }
  };
  const delay = () => new Promise((r) => setTimeout(r, latency[0] + Math.random() * (latency[1] - latency[0])));

  // fetch
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const hit = match(url);
    if (!hit) return realFetch(input, init);
    const method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const headers = {};
    new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined)).forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    const body = await parseBody(init.body, headers['content-type']);
    await delay();
    const res = api.handle(method, hit.path, hit.query, headers, body);
    return new Response(JSON.stringify(res.json), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  };

  // XMLHttpRequest (axios)
  const RealXHR = window.XMLHttpRequest;
  class MockableXHR extends RealXHR {
    open(method, url, ...rest) {
      const hit = match(url);
      this.__mock = hit ? { method: String(method).toUpperCase(), hit, headers: {}, aborted: false } : null;
      if (!hit) return super.open(method, url, ...rest);
      this.__set('readyState', 1);
      return undefined;
    }
    __set(k, v) {
      Object.defineProperty(this, k, { value: v, configurable: true, writable: true });
    }
    setRequestHeader(k, v) {
      if (!this.__mock) return super.setRequestHeader(k, v);
      this.__mock.headers[String(k).toLowerCase()] = v;
      return undefined;
    }
    getAllResponseHeaders() {
      if (!this.__mock) return super.getAllResponseHeaders();
      return this.__mock.done ? 'content-type: application/json\r\n' : '';
    }
    getResponseHeader(name) {
      if (!this.__mock) return super.getResponseHeader(name);
      return String(name).toLowerCase() === 'content-type' && this.__mock.done ? 'application/json' : null;
    }
    abort() {
      if (!this.__mock) return super.abort();
      this.__mock.aborted = true;
      this.dispatchEvent(new ProgressEvent('abort'));
      return undefined;
    }
    send(body) {
      if (!this.__mock) return super.send(body);
      const mock = this.__mock;
      (async () => {
        const parsed = await parseBody(body, mock.headers['content-type']);
        const isUpload = typeof FormData !== 'undefined' && body instanceof FormData;
        if (isUpload && this.upload) {
          const total = Object.values(parsed).reduce((s, v) => s + (v && v.size ? v.size : 0), 0) || 1000;
          for (let i = 1; i <= 4; i++) {
            await new Promise((r) => setTimeout(r, 120));
            try {
              this.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: (total * i) / 4, total }));
            } catch {
              /* ignore */
            }
          }
        }
        await delay();
        if (mock.aborted) return;
        const res = api.handle(mock.method, mock.hit.path, mock.hit.query, mock.headers, parsed);
        const text = JSON.stringify(res.json);
        mock.done = true;
        this.__set('status', res.status);
        this.__set('statusText', res.status < 300 ? 'OK' : 'Error');
        this.__set('responseText', text);
        this.__set('response', this.responseType === 'json' ? res.json : text);
        this.__set('responseURL', '');
        this.__set('readyState', 4);
        this.dispatchEvent(new Event('readystatechange'));
        this.dispatchEvent(new ProgressEvent('load'));
        this.dispatchEvent(new ProgressEvent('loadend'));
      })();
      return undefined;
    }
  }
  window.XMLHttpRequest = MockableXHR;

  const handle = { db: api.db, simulateGap: api.simulateGap, apiUrl: base.href };
  window.__bbMock = handle;
  // eslint-disable-next-line no-console
  console.info('[staff-mock] enabled for', `${base.origin}${basePath}/api/*`, '— sign in with owner@acme.test / password123');
  return handle;
}
