import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const API_BASE = process.env.AGENTMAIL_API_BASE || 'https://api.agentmail.to/v0';
const API_KEY = process.env.AGENTMAIL_API_KEY || '';
const TARGET_INBOX_EMAIL = process.env.AGENTMAIL_TARGET_INBOX_EMAIL || 'archicoop@agentmail.to';
const SENDER_USERNAME = process.env.AGENTMAIL_SENDER_USERNAME || 'alex-intake-form';
const SENDER_CLIENT_ID = process.env.AGENTMAIL_SENDER_CLIENT_ID || 'alex-agent-intake-form-sender-v1';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const DRY_RUN = process.env.AGENTMAIL_DRY_RUN === '1';

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
    `2. Business focus: ${data.businesses.length ? data.businesses.join(', ') : '[not provided]'}`,
    `3. Tools/accounts: ${data.tools || '[not provided]'}`,
    `4. Google account: ${data.googleAccount || '[not provided]'}`,
    `5. Monthly budget: ${data.budget || '[not provided]'}`,
    `6. Main channel: ${data.channel || '[not provided]'}`,
    `7. Never without approval: ${data.approval || '[not provided]'}`,
    `8. Launch-critical notes: ${data.critical || '[not provided]'}`,
  ].join('\n');
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

async function getOrCreateSenderInbox() {
  const existing = await findInboxByEmail(`${SENDER_USERNAME}@agentmail.to`);
  if (existing) return existing;

  return agentmail('/inboxes', {
    method: 'POST',
    body: JSON.stringify({
      username: SENDER_USERNAME,
      client_id: SENDER_CLIENT_ID,
      display_name: 'Alex Intake Form',
    }),
  });
}

async function sendSubmissionToAgentMail(data) {
  if (DRY_RUN) {
    const summary = buildSummary(data);
    const subject = `Alex intake: ${data.agentName || 'new submission'}`;
    const text = [
      summary,
      '',
      `Submitted at: ${new Date().toISOString()}`,
      `Source URL: ${data.sourceUrl || '[not provided]'}`,
    ].join('\n');

    return {
      dryRun: true,
      senderInbox: {
        email: `${SENDER_USERNAME}@agentmail.to`,
        inbox_id: 'dry-run-sender',
      },
      targetInbox: {
        email: TARGET_INBOX_EMAIL,
        inbox_id: 'dry-run-target',
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

  const senderInbox = await getOrCreateSenderInbox();
  const summary = buildSummary(data);
  const subject = `Alex intake: ${data.agentName || 'new submission'}`;
  const text = [
    summary,
    '',
    `Submitted at: ${new Date().toISOString()}`,
    `Source URL: ${data.sourceUrl || '[not provided]'}`,
  ].join('\n');

  const sent = await agentmail(`/inboxes/${senderInbox.inbox_id}/messages/send`, {
    method: 'POST',
    body: JSON.stringify({
      to: [targetInbox.email],
      subject,
      text,
    }),
  });

  return {
    dryRun: false,
    senderInbox,
    targetInbox,
    sent,
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
        senderInbox: result.senderInbox.email,
        messageId: result.sent?.message_id || null,
        threadId: result.sent?.thread_id || null,
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
