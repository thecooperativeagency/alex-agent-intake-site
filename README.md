# Alex Agent Intake Site

A lightweight onboarding form for Alex's first-pass agent setup.

## What changed
This repo now has two parts:
- a static client-facing site for GitHub Pages
- a tiny submission backend that forwards completed forms into AgentMail

## Frontend files
- `index.html` — form markup
- `styles.css` — visual styling
- `app.js` — review + submit behavior
- `config.js` — where the submit endpoint URL goes
- `intake-copy.md` — plain-language questionnaire copy

## Backend files
- `api/server.mjs` — minimal Node server with:
  - `GET /health`
  - `POST /submit`
- `package.json` — local run script

## How the submission flow works
1. Client fills out the form.
2. Client clicks **Review answers**.
3. Client clicks **Submit answers**.
4. The frontend POSTs the submission JSON to your backend.
5. The backend uses AgentMail to:
   - find the target inbox `archicoop@agentmail.to`
   - find or create a sender inbox (`alex-intake-form@agentmail.to` by default)
   - send the submission as an email into the target inbox

That gives you a normal email thread inside AgentMail that Archi can access.

## Required backend environment variables
- `AGENTMAIL_API_KEY` — your real AgentMail API key
- `AGENTMAIL_TARGET_INBOX_EMAIL` — defaults to `archicoop@agentmail.to`
- `ALLOWED_ORIGIN` — the origin allowed to post to the backend

Optional:
- `PORT` — defaults to `8787`
- `AGENTMAIL_SENDER_USERNAME` — defaults to `alex-intake-form`
- `AGENTMAIL_SENDER_CLIENT_ID` — defaults to `alex-agent-intake-form-sender-v1`
- `AGENTMAIL_API_BASE` — defaults to `https://api.agentmail.to/v0`
- `AGENTMAIL_DRY_RUN=1` — local test mode, no real AgentMail call

## Local backend test
Run the backend in dry-run mode:

```bash
cd /opt/data/workspace/alex-agent-intake-site
AGENTMAIL_DRY_RUN=1 npm run dev
```

Then from another shell:

```bash
curl -X POST http://localhost:8787/submit \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "Scout",
    "businesses": ["Home inspection"],
    "tools": "Gmail, Calendar",
    "googleAccount": "alex@example.com",
    "budget": "$50-$150 / month",
    "channel": "Telegram works for me",
    "approval": "Never email clients without approval.",
    "critical": "Keep launch conservative.",
    "summary": "test",
    "sourceUrl": "http://localhost/test"
  }'
```

## Make the static site actually submit
Edit `config.js` and set your deployed backend URL:

```js
window.ALEX_AGENT_CONFIG = {
  submitEndpoint: 'https://your-backend.example.com/submit',
};
```

Then commit and push the static files so GitHub Pages serves the updated endpoint.

## Smallest deployment shape
- Keep the frontend on GitHub Pages.
- Deploy `api/server.mjs` anywhere that can run a tiny Node server.
  - Render
  - Railway
  - Fly.io
  - your own VPS

## Important constraint
GitHub Pages cannot safely hold your AgentMail API key. The key must stay on the backend only.
