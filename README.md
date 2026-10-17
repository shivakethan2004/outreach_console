# Outreach Console

A single-owner sales CRM for calls, leads, follow-ups, meetings, and deals. Supabase is the source of truth; the web app can be installed as a PWA on supported desktop and mobile browsers.

## Requirements

- Node.js 20.9 or newer
- A Supabase project

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Apply the SQL migrations in `supabase/migrations/` to the Supabase project, in filename order.
4. Create the single CRM owner account in Supabase Auth. Public sign-up is intentionally disabled.
5. Start the app:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`. If Supabase is not configured, the app shows its setup instructions. Sign in using the owner account at `/sign-in`.

## Migrating the existing CSV data

The migration script reads the original files in `data/` and does not modify or delete them. It uses the Supabase service-role key only from the local environment; never expose that key to browser code or commit it.

1. Apply all SQL migrations and create the owner account.
2. Add `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_OWNER_ID` to `.env.local`. The owner ID is the UUID of that Supabase Auth user.
3. Run:

   ```bash
   npm run migrate:csv
   ```

The script is idempotent and preserves the original CSV rows in legacy payload columns. Phone numbers are normalized and are the unique lead identity. Rows with duplicate normalized phone numbers, invalid phones, ambiguous statuses, incomplete follow-ups/meetings, unresolved product links, or invalid activity timestamps are staged in the Settings page's **Legacy data review** queue rather than guessed or discarded. Historical CSV notes and changelog entries are retained. Review items preserve the source data; marking one reviewed does not automatically merge, change, or import a lead.

The script maps the legacy product name “Photo Club” to “Photo Cloud SaaS”. Legacy meeting date/time fields are preserved, but meeting mode or timezone is not inferred. A `Deal Closed` lead without an unambiguous Won/Lost outcome is held for review.

Do not delete the source CSVs until the migration has been run and the imported records and review queue have been checked in Supabase.

## CRM sections

- **Dashboard** — today's call goal, meetings, follow-ups, tasks, lead analytics, estimated in-progress pipeline, actual earnings, monthly income-goal progress, and a suggested pipeline target based on historical Won/Lost outcomes.
- **Campaigns** — create campaigns with manually selected or randomly selected leads; pause/resume or complete them while tracking active elapsed time, reset call history without removing leads/scripts, review answered call and not-dialed disposition stats plus average and total idle time between attempts (excluding pauses and recorded talk time), and keep multiple text scripts or PDFs alongside the campaign. Text scripts support Markdown preview and in-place editing with bold, text-color, and highlight controls.
- **Calls** — opens the campaign workflow; call attempts are recorded with a manually started/stopped duration timer and outcome. Wrong or unqualified leads can be logged without a timer and are excluded from answered and call-duration metrics. Phone Link audio is not captured by the web app.
- **Follow-ups** — meetings, scheduled calls, WhatsApp queue, upcoming/overdue work, re-engagement alerts, and relative due-date labels. Its Schedule view shows free days and scheduled meetings/calls/WhatsApp follow-ups for the next 7 days, 30 days, or 3 months, with per-item rescheduling.
- **Leads** — phone-unique lead records, product interests, status, estimated deal value, actual amount received for won deals, call priority, notes, activity timeline, and CSV import for new leads. In-progress leads show their next scheduled call/WhatsApp/meeting follow-up, or the latest completed follow-up and whether another action is needed. New deals start with a ₹12,000 estimate that can be edited per lead; only unarchived In Progress leads count toward pipeline. Low-priority leads appear after normal-priority leads in the call queue. Not-calling leads remain available in Leads but are excluded from lead totals and the call queue.
- **Analytics** — filter lead, deal, call, category, and follow-up metrics by product; review open follow-ups by due date and channel.
- **AI Advisor** — ask read-only questions about the complete CRM, including notes, activity history, meetings, tasks, and all call, WhatsApp, and meeting follow-ups. Its context memory is an editable, per-owner instruction document.
- **Settings** — call target, re-engagement window, timezone, monthly income goal, products/services, and legacy data review.

The activity history is append-only for call attempts and recorded CRM events. Follow-ups and meetings are separate records; cancelling an individual follow-up does not mark a lead as lost. “Not Qualified” and “Wrong Lead” dispositions archive the lead without counting it as a closed Won/Lost deal. Leads can also be closed as “Not now” when the prospect asks for no further contact; this cancels scheduled follow-ups and pending tasks without counting as Won or Lost. Deal outcome is stored separately from lead status.

The dashboard counts actual amounts on Won leads toward earnings; a Won deal requires recording the amount received. Monthly earnings use the date the lead was marked Won, and existing Won deals can be updated with their amount from the Leads page. Suggested pipeline target is the monthly goal divided by the historical Won/(Won + Lost) rate, so it is an estimate and includes the number of closed deals used to calculate it.

The AI Advisor requires `TOGETHER_API_KEY` in the server environment (add it to `.env.local` for local development, or your deployment's server environment settings). The key must not use a `NEXT_PUBLIC_` prefix. Select the model in the Advisor; the default is free Ternary Bonsai 27B. Displayed token rates are approximate and can change; check [Together's current model catalog](https://docs.together.ai/docs/serverless/models). Advisor questions and the owner's CRM records are sent to Together AI to generate responses; review Together AI's data handling terms before enabling it. The advisor has no CRM write tools. Its context memory is stored in Supabase and only the signed-in owner can access it.

## PWA and data availability

The app includes a web manifest and can be installed from browsers that support PWA installation. Production deployment must use HTTPS. A service worker only provides a small offline notice when the network is unavailable; it deliberately does not cache authenticated pages, leads, or activity data. CRM data operations require a working connection to Supabase.

## Environment variables

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server Supabase clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server Supabase clients; not a service-role key |
| `SUPABASE_SERVICE_ROLE_KEY` | One-time CSV migration script only; server-side secret |
| `SUPABASE_OWNER_ID` | One-time CSV migration script; owner Auth UUID |
| `TOGETHER_API_KEY` | AI Advisor server route; server-side secret |

## Validation

```bash
npm run lint
npm run build
```

The SQL migrations and CSV migration require a configured Supabase project to execute and verify. The app does not fall back to CSV storage.
