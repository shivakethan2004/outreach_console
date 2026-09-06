# Outreach Tracker CSV Guide

This document describes the structure and handling rules for
`data/outreach_master_tracker.csv`. The CSV is the local runtime database for
the Outreach Console. It is read and written by the app's server-side code.

## Files

- `data/outreach_master_tracker.csv`: the current contact and outreach data.
- `data/outreach_master_tracker.backup.csv`: the most recent pre-save backup.
- `data/changelog.csv`: append-only history of create, edit, delete, import, and
  undo operations.

These files are local data and are ignored by Git. Do not rename them or move
them out of the `data/` directory.

## CSV columns

| Column | Type / allowed values | Meaning |
|---|---|---|
| `contact_id` | ID such as `C001` | Unique contact identifier. Preserve existing IDs. |
| `name` | Text | Business or contact name. |
| `category` | Text | Business type or category used for filtering. |
| `phone` | Text | Phone number. Keep as text so spaces, prefixes, and leading zeroes are preserved. |
| `address` | Text, optional | Business address. Commas must remain inside CSV quotes. |
| `rating` | Decimal, optional | Public rating, when available. |
| `reviews` | Integer, optional | Number of public reviews, when available. |
| `cold_call_status` | Text | Call outcome, such as `Not Contacted`, `No Answer`, or `Interested`. |
| `cold_call_last_contacted_at` | `YYYY-MM-DD`, optional | Date of the latest cold-call attempt. |
| `whatsapp_status` | `Not Contacted` or `Contacted` | Current WhatsApp outreach status. |
| `whatsapp_initial_contacted_at` | `YYYY-MM-DD`, optional | Date of the first WhatsApp contact. Do not replace it with later dates. |
| `whatsapp_followup_contacted_at` | `YYYY-MM-DD`, optional | Date of the latest WhatsApp follow-up after the initial contact. |
| `interest_level` | `Cold`, `Warm`, `Hot`, or blank | Current lead interest. |
| `is_meeting_milestone` | `Yes` or `No` | Whether a meeting milestone has been reached. |
| `meeting_date` | `YYYY-MM-DD`, optional | Scheduled or completed meeting date. |
| `meeting_time` | `HH:MM`, optional | Meeting time using 24-hour time. |
| `next_follow_up_date` | `YYYY-MM-DD`, optional | Date when the next outreach should happen. |
| `notes` | Text, optional | Running activity log and free-form context. New entries are appended rather than replacing older notes. |

## Data rules

1. Keep the header row and column names exactly as shown above.
2. Keep one contact per row. Do not add extra columns unless the app code is
   updated to support them.
3. Empty values are valid for optional fields. Use an empty field, not `N/A`,
   when a value is unknown.
4. Dates must use `YYYY-MM-DD`; times must use 24-hour `HH:MM` format.
5. Treat phone numbers as strings. Do not convert them to numbers in Excel or
   other spreadsheet tools.
6. Quote any field containing a comma, line break, or double quote according to
   standard CSV rules.
7. Preserve `contact_id` values and avoid duplicate phone numbers. The import
   flow uses phone numbers to skip duplicate leads.
8. Preserve existing notes. Notes contain a chronological activity history and
   may include lines such as `[2026-08-02] Call: No Answer`.

## Safe AI editing workflow

Before changing the CSV, identify the contact by `contact_id` and verify the
phone number. Change only the fields required by the request. Keep unrelated
fields unchanged, preserve the exact header order, and validate that every row
still has the same number of columns after writing.

When recording outreach:

- A call updates `cold_call_status` and
  `cold_call_last_contacted_at`.
- The first WhatsApp touch sets `whatsapp_status` to `Contacted` and fills
  `whatsapp_initial_contacted_at`.
- Later WhatsApp touches update `whatsapp_followup_contacted_at`.
- A booked meeting sets `is_meeting_milestone` to `Yes` and records
  `meeting_date` and, when known, `meeting_time`.
- Add a dated entry to `notes` without deleting the prior activity history.