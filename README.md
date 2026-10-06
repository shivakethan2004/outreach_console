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

- **Dashboard** — today's call goal, meetings, follow-ups, tasks, and lead analytics.
- **Calls** — a focused queue of new and callable leads; every attempted call counts toward daily progress, including No Answer.
- **Follow-ups** — meetings, scheduled calls, WhatsApp queue, upcoming/overdue work, re-engagement alerts, and relative due-date labels. Its Schedule view shows free days and scheduled meetings/calls/WhatsApp follow-ups for the next 7 days, 30 days, or 3 months, with per-item rescheduling.
- **Leads** — phone-unique lead records, product interests, status, notes, activity timeline, and CSV import for new leads.
- **Analytics** — filter lead, deal, call, category, and follow-up metrics by product; review open follow-ups by due date and channel.
- **Settings** — call target, re-engagement window, timezone, products/services, and legacy data review.

The activity history is append-only for call attempts and recorded CRM events. Follow-ups and meetings are separate records; cancelling an individual follow-up does not mark a lead as lost. Deal outcome is stored separately from lead status.

## PWA and data availability

The app includes a web manifest and can be installed from browsers that support PWA installation. Production deployment must use HTTPS. A service worker only provides a small offline notice when the network is unavailable; it deliberately does not cache authenticated pages, leads, or activity data. CRM data operations require a working connection to Supabase.

## Environment variables

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server Supabase clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server Supabase clients; not a service-role key |
| `SUPABASE_SERVICE_ROLE_KEY` | One-time CSV migration script only; server-side secret |
| `SUPABASE_OWNER_ID` | One-time CSV migration script; owner Auth UUID |

## Validation

```bash
npm run lint
npm run build
```

The SQL migrations and CSV migration require a configured Supabase project to execute and verify. The app does not fall back to CSV storage.
