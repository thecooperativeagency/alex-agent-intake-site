const form = document.getElementById('intakeForm');
const output = document.getElementById('output');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusPill = document.getElementById('statusPill');

function getValues() {
  const businesses = Array.from(document.querySelectorAll('input[name="business"]:checked')).map((el) => el.value);
  const businessOther = document.getElementById('businessOther').value.trim();
  if (businessOther) businesses.push(`Other: ${businessOther}`);

  const channel = document.getElementById('channel').value;
  const channelOther = document.getElementById('channelOther').value.trim();
  const channelValue = channel === 'Other' && channelOther ? `${channel} — ${channelOther}` : channel || channelOther;

  return {
    agentName: document.getElementById('agentName').value.trim(),
    businesses,
    tools: document.getElementById('tools').value.trim(),
    googleAccount: document.getElementById('googleAccount').value.trim(),
    budget: document.getElementById('budget').value,
    channel: channelValue,
    approval: document.getElementById('approval').value.trim(),
    critical: document.getElementById('critical').value.trim(),
  };
}

function buildSummary() {
  const data = getValues();
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

function refreshOutput(markReady = true) {
  output.textContent = buildSummary();
  if (markReady) {
    statusPill.textContent = 'Ready to copy';
    statusPill.classList.add('ready');
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  refreshOutput(true);
});

copyBtn.addEventListener('click', async () => {
  refreshOutput(true);
  try {
    await navigator.clipboard.writeText(output.textContent);
    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy summary'), 1400);
  } catch (err) {
    copyBtn.textContent = 'Copy failed';
    setTimeout(() => (copyBtn.textContent = 'Copy summary'), 1800);
  }
});

downloadBtn.addEventListener('click', () => {
  refreshOutput(true);
  const blob = new Blob([output.textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'alex-agent-intake.txt';
  a.click();
  URL.revokeObjectURL(url);
});
