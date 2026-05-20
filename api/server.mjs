import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const API_BASE = process.env.AGENTMAIL_API_BASE || 'https://api.agentmail.to/v0';
const API_KEY = process.env.AGENTMAIL_API_KEY || '';
const TARGET_INBOX_EMAIL = process.env.AGENTMAIL_TARGET_INBOX_EMAIL || 'archicoop@agentmail.to';
const SENDER_USERNAME = process.env.AGENTMAIL_SENDER_USERNAME || 'alex-intake-form';
const SENDER_DOMAIN = process.env.AGENTMAIL_SENDER_DOMAIN || 'agentmail.to';
const SENDER_CLIENT_ID = process.env.AGENTMAIL_SENDER_CLIENT_ID || 'alex-agent-intake-form-sender-v1';
const SENDER_DISPLAY_NAME = process.env.AGENTMAIL_SENDER_DISPLAY_NAME || 'Alex Intake Form';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const DRY_RUN = process.env.AGENTMAIL_DRY_RUN === '1';

const SENDER_INBOX_EMAIL = `${SENDER_USERNAME}@${SENDER_DOMAIN}`;

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(payload));
}

function normalizeText(value) {
  return String(value || '').trim();
}

function getSubmission(body) {
  return {
    agentName: normalizeText(body.agentName),
    businesses: Array.isArray(body.businesses) ? body.businesses.map(normalizeText).filter(Boolean) : [],
    mainHelp: normalizeText(body.mainHelp),
    tools: normalizeText(body.tools),
    googleAccount: normalizeText(body.googleAccount),
    budget: normalizeText(body.budget),
    channel: normalizeText(body.channel),
    approval: normalizeText(body.approval),
    critical: normalizeText(body.critical),
    summary: normalizeText(body.summary),
    sourceUrl: normalizeText(body.sourceUrl),
  };
}

function buildSummary(data) {
  if (data.summary) return data.summary;
  return [
    'Alex Agent — Initial Setup Submission',
    '',
    `1. Agent name: ${data.agentName || '[not provided]'}`,
    `2. Business scope: ${data.businesses.length ? data.businesses.join(', ') : '[not provided]'}`,
    `3. Main help wanted: ${data.mainHelp || '[not provided]'}`,
    `4. Starting tools/accounts: ${data.tools || '[not provided]'}`,
    `5. Primary Google/work account: ${data.googleAccount || '[not provided]'}`,
    `6. Never without approval: ${data.approval || '[not provided]'}`,
    `7. Monthly budget: ${data.budget || '[not provided]'}`,
  ].join('\n');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(data, submittedAt) {
  const items = [
    ['Agent name', data.agentName || '[not provided]'],
    ['Business scope', data.businesses.length ? data.businesses.join(', ') : '[not provided]'],
    ['Main help wanted', data.mainHelp || '[not provided]'],
    ['Starting tools/accounts', data.tools || '[not provided]'],
    ['Primary Google/work account', data.googleAccount || '[not provided]'],
    ['Never without approval', data.approval || '[not provided]'],
    ['Monthly budget', data.budget || '[not provided]'],
    ['Submitted at', submittedAt],
    ['Source URL', data.sourceUrl || '[not provided]'],
  ];

  return `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
    <h2>Alex Agent — Initial Setup Submission</h2>
    <p>A new onboarding form submission was received.</p>
    <ul>
      ${items
        .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
        .join('')}
    </ul>
  </body>
</html>`;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function agentmail(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`AgentMail ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function listInboxes() {
  const payload = await agentmail('/inboxes', { method: 'GET' });
  return payload.inboxes || [];
}

async function findInboxByEmail(email) {
  const inboxes = await listInboxes();
  return inboxes.find((inbox) => inbox.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function createInbox({ username, domain, display_name, client_id }) {
  return agentmail('/inboxes', {
    method: 'POST',
    body: JSON.stringify({ username, domain, display_name, client_id }),
  });
}

async function getOrCreateSenderInbox() {
  const existingInbox = await findInboxByEmail(SENDER_INBOX_EMAIL);
  if (existingInbox) return existingInbox;

  return createInbox({
    username: SENDER_USERNAME,
    domain: SENDER_DOMAIN,
    display_name: SENDER_DISPLAY_NAME,
    client_id: SENDER_CLIENT_ID,
  });
}

async function resolveSenderInbox(targetInbox) {
  try {
    return await getOrCreateSenderInbox();
  } catch (error) {
    if (error?.status === 403) {
      return targetInbox;
    }
    throw error;
  }
}

async function sendMessageFromInbox(inboxId, payload) {
  return agentmail(`/inboxes/${inboxId}/messages/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function sendSubmissionToAgentMail(data) {
  const submittedAt = new Date().toISOString();
  const summary = buildSummary(data);
  const subject = `Alex intake submission: ${data.agentName || 'new submission'}`;
  const text = [
    summary,
    '',
    `Submitted at: ${submittedAt}`,
    `Source URL: ${data.sourceUrl || '[not provided]'}`,
  ].join('\n');
  const html = buildHtml(data, submittedAt);

  if (DRY_RUN) {
    return {
      dryRun: true,
      targetInbox: {
        email: TARGET_INBOX_EMAIL,
        inbox_id: 'dry-run-target',
      },
      senderInbox: {
        email: SENDER_INBOX_EMAIL,
        inbox_id: 'dry-run-sender',
      },
      subject,
      preview: text,
    };
  }

  const targetInbox = await findInboxByEmail(TARGET_INBOX_EMAIL);
  if (!targetInbox) {
    const error = new Error(`Target inbox not found: ${TARGET_INBOX_EMAIL}`);
    error.status = 404;
    throw error;
  }

  const senderInbox = await resolveSenderInbox(targetInbox);
  const message = await sendMessageFromInbox(senderInbox.inbox_id, {
    to: [targetInbox.email],
    subject,
    text,
    html,
    labels: ['alex-intake-submission'],
  });

  return {
    dryRun: false,
    targetInbox,
    senderInbox,
    message,
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, {
      ok: true,
      dryRun: DRY_RUN,
      targetInboxEmail: TARGET_INBOX_EMAIL,
      senderInboxEmail: SENDER_INBOX_EMAIL,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/submit') {
    try {
      if (!DRY_RUN && !API_KEY) {
        json(response, 500, { ok: false, error: 'Missing AGENTMAIL_API_KEY' });
        return;
      }

      const body = await readJson(request);
      const submission = getSubmission(body);
      const result = await sendSubmissionToAgentMail(submission);

      json(response, 200, {
        ok: true,
        dryRun: result.dryRun,
        targetInbox: result.targetInbox.email,
        senderInbox: result.senderInbox?.email || null,
        messageId: result.message?.message_id || null,
        threadId: result.message?.thread_id || null,
      });
    } catch (error) {
      json(response, error.status || 500, {
        ok: false,
        error: error.message,
        details: error.payload || null,
      });
    }
    return;
  }

  json(response, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Alex intake submit server listening on http://localhost:${PORT}`);
});
