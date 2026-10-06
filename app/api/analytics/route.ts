import { NextRequest, NextResponse } from "next/server";
import { addDaysToDate, dateInTimeZone } from "@/lib/crm-time";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("product_id");
  if (productId && !UUID_PATTERN.test(productId)) {
    return NextResponse.json({ error: "Choose a valid product filter." }, { status: 400 });
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const [leadsResult, productsResult, leadProductsResult, activitiesResult, followUpsResult, settingsResult] =
    await Promise.all([
      supabase.from("leads").select("phone,category,status,closed_outcome").eq("is_archived", false),
      supabase.from("products").select("id,name,is_active").order("name"),
      supabase.from("lead_products").select("lead_phone,product_id,interest_status,is_active"),
      supabase.from("activities").select("lead_phone,occurred_at,is_call_attempt"),
      supabase.from("follow_ups").select("lead_phone,type,status,scheduled_at"),
      supabase.from("crm_settings").select("time_zone").maybeSingle(),
    ]);

  if (leadsResult.error) return supabaseErrorResponse("Load analytics leads", leadsResult.error);
  if (productsResult.error) return supabaseErrorResponse("Load analytics products", productsResult.error);
  if (leadProductsResult.error) return supabaseErrorResponse("Load analytics product interest", leadProductsResult.error);
  if (activitiesResult.error) return supabaseErrorResponse("Load analytics activity", activitiesResult.error);
  if (followUpsResult.error) return supabaseErrorResponse("Load analytics follow-ups", followUpsResult.error);
  if (settingsResult.error) return supabaseErrorResponse("Load analytics settings", settingsResult.error);

  const products = productsResult.data;
  if (productId && !products.some((product) => product.id === productId)) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const activeLeadPhones = new Set(leadsResult.data.map((lead) => lead.phone));
  const activeRelations = leadProductsResult.data.filter(
    (relation) => relation.is_active && activeLeadPhones.has(relation.lead_phone)
  );
  const scopedPhones = productId
    ? new Set(
        activeRelations
          .filter((relation) => relation.product_id === productId)
          .map((relation) => relation.lead_phone)
      )
    : activeLeadPhones;
  const leads = leadsResult.data.filter((lead) => scopedPhones.has(lead.phone));
  const categories = new Map<string, number>();
  for (const lead of leads) {
    const category = lead.category.trim() || "Uncategorized";
    categories.set(category, (categories.get(category) || 0) + 1);
  }
  const productPipeline = products.map((product) => {
    const linked = activeRelations.filter((relation) => relation.product_id === product.id);
    return {
      ...product,
      lead_count: linked.length,
      interested: linked.filter((relation) => relation.interest_status === "interested").length,
      follow_up_needed: linked.filter((relation) => relation.interest_status === "follow_up_needed").length,
      converted: linked.filter((relation) => relation.interest_status === "converted").length,
    };
  });

  const timeZone = settingsResult.data?.time_zone || "Asia/Kolkata";
  const today = dateInTimeZone(new Date(), timeZone);
  const progressStart = addDaysToDate(today, -89);
  const callsByDate = new Map<string, number>();
  for (const activity of activitiesResult.data) {
    if (
      !activity.is_call_attempt ||
      !activity.lead_phone ||
      !scopedPhones.has(activity.lead_phone)
    ) {
      continue;
    }
    const date = activity.occurred_at.slice(0, 10);
    if (date < progressStart || date > today) continue;
    callsByDate.set(date, (callsByDate.get(date) || 0) + 1);
  }

  const pendingFollowUps = followUpsResult.data.filter(
    (followUp) => followUp.status === "pending" && scopedPhones.has(followUp.lead_phone)
  );
  const followUpCounts = {
    pending: pendingFollowUps.length,
    today: pendingFollowUps.filter((item) => item.scheduled_at?.slice(0, 10) === today).length,
    upcoming: pendingFollowUps.filter((item) => item.scheduled_at && item.scheduled_at.slice(0, 10) > today).length,
    overdue: pendingFollowUps.filter((item) => item.scheduled_at && item.scheduled_at.slice(0, 10) < today).length,
    by_type: {
      call: pendingFollowUps.filter((item) => item.type === "call").length,
      whatsapp: pendingFollowUps.filter((item) => item.type === "whatsapp").length,
      meeting: pendingFollowUps.filter((item) => item.type === "meeting").length,
    },
  };

  return NextResponse.json({
    selected_product_id: productId,
    products: productPipeline,
    total_leads: leads.length,
    leads_by_status: {
      not_contacted: leads.filter((lead) => lead.status === "not_contacted").length,
      in_progress: leads.filter((lead) => lead.status === "in_progress").length,
      no_answer: leads.filter((lead) => lead.status === "no_answer").length,
      deals_closed: leads.filter((lead) => lead.status === "deal_closed").length,
    },
    leads_by_category: [...categories]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count),
    calls_by_date: [...callsByDate]
      .map(([date, calls]) => ({ date, calls }))
      .sort((left, right) => left.date.localeCompare(right.date)),
    deals: {
      won: leads.filter(
        (lead) => lead.status === "deal_closed" && lead.closed_outcome === "won"
      ).length,
      lost: leads.filter(
        (lead) => lead.status === "deal_closed" && lead.closed_outcome === "lost"
      ).length,
    },
    follow_ups: followUpCounts,
  });
}
