# Outreach Console

A local outreach tracker for cold-call + WhatsApp outreach. No database —
your CSV file (`data/outreach_master_tracker.csv`) **is** the database. Every
edit made in the UI is read from and written straight back to that file.

## Running it locally

You need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser.

## Pages

- **Dashboard** (`/`) — today's activity counts (calls, WhatsApp, new
  outreach vs. follow-ups, meetings booked, new leads added), overall stat
  cards, channel funnel chart, interest-level breakdown, category breakdown,
  cold-call outcome chart, and a "needs follow-up" list.
- **Contacts** (`/contacts`) — the full lead table. Search, filter by
  category / cold-call status / WhatsApp status / interest level / meeting
  status.
- **Activity** (`/activity`) — a full changelog of everything that's
  happened, newest first, each with an **Undo** button.

## Logging outreach (the three quick-action icons per row)

Each row in the Contacts table has three quick-action icons plus edit/delete:

- 📞 **Log a cold call** — records the outcome + timestamp to
  `cold_call_status` / `cold_call_last_contacted_at`, and appends your note
  (if any) to the notes field with today's date. Existing notes are kept,
  never overwritten.
- 💬 **Log a WhatsApp touch** — same idea for WhatsApp. First time ever
  contacting this lead on WhatsApp fills `whatsapp_initial_contacted_at`;
  every time after that updates `whatsapp_followup_contacted_at`, so you
  always know when you last touched base.
- 🟢 **Book a meeting** — the "green signal" milestone. Sets
  `is_meeting_milestone = Yes`, the meeting date, and highlights that row in
  green throughout the app. This is the number the dashboard's conversion
  rate is built on.

The **Last call** / **Last WhatsApp** columns show relative time ("Today",
"Yesterday", "3d ago") so you can see at a glance who's gone quiet.

## Undo

Every create/edit/delete/import is written to an append-only changelog
(`data/changelog.csv`). Go to **Activity** to see the history and hit
**Undo** on anything that went wrong — a bad edit, an accidental delete, a
messy import. Undoing doesn't erase history; it writes a new "undo" entry
that restores the prior state, so the log stays a complete, honest record of
what actually happened.

## Mass CSV upload

On the Contacts page, **Import CSV** lets you paste CSV text or upload a
file. It recognizes these columns (case-insensitive, everything else is
ignored): `name`, `business name`/`contact name`/`contact person`,
`category`/`type`, `phone`/`phone number`/`mobile`, `address`, `rating`,
`reviews`, `notes`/`note`. Leads whose phone number already exists in the
tracker are automatically skipped (you'll see a toast telling you how many
were added vs. skipped) — this is exactly the dedupe logic used to merge
your original lead lists together.

## Where your data lives

`data/outreach_master_tracker.csv` — open it directly in Excel/Sheets any
time you like, edit it there, and the app will pick up the changes next time
you load a page. Editing through the app writes back to this same file, and
a rolling backup is kept alongside it at
`data/outreach_master_tracker.backup.csv` (overwritten on every save — it
only protects the single most recent write, not full history; for real
history, use the Activity page's undo, or your own git/backup habits).

`data/changelog.csv` is the append-only activity log described above.

**Don't rename or move either CSV** — the app expects them at those exact
paths. Delete a file to start fresh; the app recreates it with the correct
header row automatically.

### Columns (`outreach_master_tracker.csv`)

| Column | Meaning |
|---|---|
| `contact_id` | Unique ID (auto-generated, e.g. `C001`) |
| `name` | Business / contact name |
| `category` | Business type, for filtering (e.g. "Dental Clinic") |
| `phone` | Phone number |
| `address`, `rating`, `reviews` | Optional lead context |
| `cold_call_status` | Free text — e.g. "Not Contacted", "No Answer", "Interested - requested info" |
| `cold_call_last_contacted_at` | Date of last call |
| `whatsapp_status` | "Not Contacted" or "Contacted" |
| `whatsapp_initial_contacted_at` / `whatsapp_followup_contacted_at` | First contact / most recent follow-up timestamps |
| `interest_level` | "Cold" / "Warm" / "Hot" (or blank) |
| `is_meeting_milestone` | "Yes" / "No" — the green-signal milestone |
| `meeting_date` | When the meeting is/was |
| `next_follow_up_date` | When to touch base again |
| `notes` | Free text — a running log of what happened, what's next |

## Tech stack

Next.js (App Router) + TypeScript + Tailwind v4 + hand-built shadcn-style
components (the shadcn CLI couldn't be used offline, so the component source
was written directly) + Recharts for the charts. CSV parsing/writing via
`papaparse` on the server side only (in the API routes and lib/csv-store.ts,
lib/changelog-store.ts).

## Notes

- Built for **single-user, local use**. No auth, and concurrent writes from
  two open tabs could race — fine for one person editing at a time.
- `npm run build` has been verified to pass cleanly, and the core flows
  (log a call, log WhatsApp, book a meeting, import CSV, undo a change) were
  smoke-tested against the live API before shipping.
