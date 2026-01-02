import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";

type AlertRuleCreate = {
  is_active?: boolean;
  frequency?: "daily" | "weekly" | "manual";
  type_filter?: "KINDERGARTEN" | "DAYCARE" | null;
  sido?: string | null;
  sigungu?: string | null;
  eupmyeondong?: string | null;
  keyword?: string | null;
  min_capacity_change?: number | null;
  min_current_enrollment_change?: number | null;
  criteria?: Record<string, unknown>;
};

type AlertRulePatch = AlertRuleCreate & { id?: number };

// GET /api/alerts
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonError(401, "UNAUTHORIZED", "Auth session missing.", userErr.message);
    if (!user) return jsonError(401, "UNAUTHORIZED", "Login required.");

    const { data, error } = await supabase
      .from("alert_rules")
      .select("*")
      .order("id", { ascending: false });

    if (error) return jsonError(500, "DB_ERROR", "Failed to fetch alert rules.", error);

    return NextResponse.json({ data });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}

// POST /api/alerts
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonError(401, "UNAUTHORIZED", "Auth session missing.", userErr.message);
    if (!user) return jsonError(401, "UNAUTHORIZED", "Login required.");

    const body = (await req.json().catch(() => ({}))) as AlertRuleCreate;

    const insertRow = {
      user_id: user.id,
      is_active: body.is_active ?? true,
      frequency: body.frequency ?? "daily",
      type_filter: body.type_filter ?? null,
      sido: body.sido ?? null,
      sigungu: body.sigungu ?? null,
      eupmyeondong: body.eupmyeondong ?? null,
      keyword: body.keyword ?? null,
      min_capacity_change: body.min_capacity_change ?? null,
      min_current_enrollment_change: body.min_current_enrollment_change ?? null,
      criteria: body.criteria ?? {},
    };

    const { data, error } = await supabase
      .from("alert_rules")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) return jsonError(400, "DB_ERROR", "Failed to create alert rule.", error);

    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}

// PATCH /api/alerts  body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonError(401, "UNAUTHORIZED", "Auth session missing.", userErr.message);
    if (!user) return jsonError(401, "UNAUTHORIZED", "Login required.");

    const body = (await req.json().catch(() => ({}))) as AlertRulePatch;
    const id = Number(body.id);
    if (!Number.isFinite(id)) return jsonError(400, "BAD_REQUEST", "id is required.");

    const patch: Record<string, unknown> = {};
    const fields: (keyof AlertRuleCreate)[] = [
      "is_active",
      "frequency",
      "type_filter",
      "sido",
      "sigungu",
      "eupmyeondong",
      "keyword",
      "min_capacity_change",
      "min_current_enrollment_change",
      "criteria",
    ];

    for (const f of fields) {
      if (f in body) patch[f] = (body as any)[f];
    }

    if (Object.keys(patch).length === 0) {
      return jsonError(400, "BAD_REQUEST", "No fields to update.");
    }

    const { data, error } = await supabase
      .from("alert_rules")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return jsonError(400, "DB_ERROR", "Failed to update alert rule.", error);

    return NextResponse.json({ data });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}

// DELETE /api/alerts  body: { id }
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonError(401, "UNAUTHORIZED", "Auth session missing.", userErr.message);
    if (!user) return jsonError(401, "UNAUTHORIZED", "Login required.");

    const body = (await req.json().catch(() => ({}))) as { id?: number };
    const id = Number(body.id);
    if (!Number.isFinite(id)) return jsonError(400, "BAD_REQUEST", "id is required.");

    const { error } = await supabase
      .from("alert_rules")
      .delete()
      .eq("id", id);

    if (error) return jsonError(400, "DB_ERROR", "Failed to delete alert rule.", error);

    return NextResponse.json({ data: { deleted: true } });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}
