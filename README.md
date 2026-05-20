# Alex Agent Intake Site

A lightweight static questionnaire for initial client onboarding.

## What it does
- captures the minimum go-live setup details
- keeps the intake short and human
- works as a plain static site
- generates a clean text summary on submit

## Why static
GitHub Pages is the easiest fast host for this. Because Pages is static, this version does not store submissions server-side. Instead, it:
- renders a structured submission preview
- lets the user copy the summary
- lets the user download a `.txt` file

## Files
- `index.html` — form markup
- `styles.css` — visual styling
- `app.js` — submit/copy/download behavior
- `intake-copy.md` — plain-language questionnaire copy

## Local preview
Open `index.html` in a browser.

## Deployment options
### Fastest
Deploy to GitHub Pages as a static site.

### Better later
If you want real submission storage, wire the form to one of these:
- Formspree
- Formspark
- Airtable automation
- Google Forms / Apps Script
- a tiny custom backend
