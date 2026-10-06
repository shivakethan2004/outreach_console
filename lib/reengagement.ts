import { addDaysToDate, dateInTimeZone } from "./crm-time";

type LeadForReengagement = {
  phone: string;
  status: string;
  is_archived: boolean;
  updated_at: string;
};

type ActivityForReengagement = {
  lead_phone: string | null;
  occurred_at: string;
};

type FollowUpForReengagement = {
  lead_phone: string;
  status: string;
};

export function findReengagementLeads<T extends LeadForReengagement>(
  leads: T[],
  activities: ActivityForReengagement[],
  followUps: FollowUpForReengagement[],
  today: string,
  days: number,
  timeZone: string
): T[] {
  const latestActivity = new Map<string, string>();
  for (const activity of activities) {
    if (
      activity.lead_phone &&
      (!latestActivity.has(activity.lead_phone) ||
        latestActivity.get(activity.lead_phone)! < activity.occurred_at)
    ) {
      latestActivity.set(activity.lead_phone, activity.occurred_at);
    }
  }
  const leadsWithPendingFollowUp = new Set(
    followUps.filter((item) => item.status === "pending").map((item) => item.lead_phone)
  );
  const cutoffDate = addDaysToDate(today, -days);

  return leads.filter((lead) => {
    if (
      lead.is_archived ||
      lead.status !== "in_progress" ||
      leadsWithPendingFollowUp.has(lead.phone)
    ) {
      return false;
    }
    const activity = latestActivity.get(lead.phone);
    const lastActivityDate = activity
      ? activity.slice(0, 10)
      : dateInTimeZone(new Date(lead.updated_at), timeZone);
    return lastActivityDate <= cutoffDate;
  });
}
