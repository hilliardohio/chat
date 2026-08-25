# Hilliard Assistant — Setup & Admin Guide

A self-contained chat agent prototype for the City of Hilliard, Ohio. One HTML file — no install, no server. Open `hilliard-chat-agent.html` in any modern browser.

## Setup (2 minutes)

1. Open the file in Chrome/Edge/Safari.
2. Go to **Settings** → paste a Claude API key (get one at console.anthropic.com → API Keys) → **Save settings** → **Test connection**.
3. Ask a question in the **Chat** tab.

The key, log, and customizations are stored only in that browser (localStorage).

## What it knows

Built-in knowledge base compiled Aug 25, 2026 from:
- **hilliardohio.gov** — services, contacts, trash/recycling, taxes, permits, parks, police, events, records, jobs
- **Code of Ordinances** (Municode, Supp. 10, through Ord. 25-28) — parking (§351), noise (§531), animals/chickens (§505, §1121.08), fences/sheds (§1121.02), signs (Ch. 1129), fireworks (Ch. 1519), curfew (Ch. 539), grass/weeds (Ch. 917), sidewalk snow (§909.02), trash rules (Ch. 975), zoning districts (§1104)

The agent cites code sections, includes phone numbers/URLs, refuses to invent facts, and avoids quoting prices that change. To update facts, edit the knowledge base text in **Settings** (or ask me to re-crawl and refresh it).

## Address-based zoning lookup (live GIS)

For questions about a specific property ("What's the zoning at 4123 Main St?", "Can I open a shop at my house?"), the agent calls the City's own ArcGIS services live:

1. Matches the address against the **Franklin County parcel layer** (`Franklin_County_Parcel_Features`) to find the parcel and its centroid — no external geocoder needed
2. Runs a point-in-polygon query against the **"Zoning Districts and PUDs (Hilliard)"** layer (`Hosted/Zoning_Districts_Public_View/FeatureServer/10`)
3. Answers using that district's regulations from the knowledge base (all 16 districts' uses, setbacks, lot sizes, and heights from Chs. 1109–1117 are built in)

For **PUD** parcels, the layer usually includes a link to that PUD's approved development text PDF — the agent shares it and explains that the PUD text governs, not the citywide tables. Parcels outside city zoning (tax district ≠ City of Hilliard) are flagged. Answers note that the Planning Division provides official zoning verification letters. Responses that used the map are tagged "Checked city zoning GIS" in chat and "+ GIS" in the log.

Both services are public (no token) and allow cross-origin requests — verified working from a browser. If the City ever restricts them, the agent degrades gracefully and refers the resident to the Planning Division.

## Q&A logging

Every exchange is logged with timestamp, question, answer, auto-detected topic, and source (AI vs. custom response). In the **Q&A Log** tab:
- **Download spreadsheet (CSV)** — opens directly in Excel
- **Export JSON** — for feeding other systems
- Top-topic stats show what residents ask most

## Customizing responses by topic

**Topics** tab. Each topic = name + keywords + one of two modes:
- **Guide the AI** — your instructions/facts are injected as priority guidance; the AI still writes a natural answer (tagged "Customized" in chat and "AI + custom" in the log).
- **Fixed answer** — your exact text is returned instantly with no AI call (good for emergencies, disclaimers, or seasonal notices).

Three starter topics are included: emergency routing to 911, a legal-advice guardrail, and a no-quoting-prices rule. Topics can be disabled, edited, exported/imported as JSON (so you can share a config across machines).

## Before public deployment

- **Move the API key server-side.** The prototype calls the Claude API from the browser, fine for internal testing, but a public page must proxy requests through a small backend (a ~30-line Cloudflare Worker or Lambda) so the key is never exposed.
- Add rate limiting and the server-side copy of the Q&A log there too.
- Consider a periodic knowledge-base refresh (the site changes seasonally: leaf zones, pool passes, event dates).

## Files

- `hilliard-chat-agent.html` — the app
- `research_website.md` / `research_code.md` — sourced research the knowledge base was built from (with URLs and code citations for verification)
