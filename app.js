const form = document.getElementById('intakeForm');
const submitBtn = document.getElementById('submitBtn');
const submitStatus = document.getElementById('submitStatus');
const successScreen = document.getElementById('successScreen');
const submitEndpoint = window.ALEX_AGENT_CONFIG?.submitEndpoint || '';

function getValues() {
  const businesses = Array.from(document.querySelectorAll('input[name="business"]:checked')).map((el) => el.value);
  const businessOther = document.getElementById('businessOther').value.trim();
  if (businessOther) businesses.push(`Other: ${businessOther}`);

  return {
    agentName: document.getElementById('agentName').value.trim(),
    businesses,
    mainHelp: document.getElementById('mainHelp').value.trim(),
    tools: document.getElementById('tools').value.trim(),
    googleAccount: document.getElementById('googleAccount').value.trim(),
    approval: document.getElementById('approval').value.trim(),
    budget: document.getElementById('budget').value,
  };
}

function buildSummary() {
  const data = getValues();
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

function setSubmitStatus(message = '', kind = '') {
  submitStatus.textContent = message;
  submitStatus.classList.remove('error', 'success');
  if (kind) submitStatus.classList.add(kind);
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.textContent = isSubmitting ? 'Submitting…' : 'Submit answers';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!submitEndpoint) {
    setSubmitStatus('Submission endpoint is not connected yet.', 'error');
    return;
  }

  setSubmitting(true);
  setSubmitStatus('Sending your answers…');

  try {
    const payload = {
      ...getValues(),
      summary: buildSummary(),
      sourceUrl: window.location.href,
    };

    const response = await fetch(submitEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Submission failed');
    }

    setSubmitStatus('Thanks — your answers were sent successfully.', 'success');
    submitBtn.textContent = 'Submitted';
    submitBtn.disabled = true;
    form.classList.add('submitted');
    successScreen?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setSubmitStatus(`Sorry — there was a problem sending this form. ${error.message}`, 'error');
    setSubmitting(false);
  }
});
