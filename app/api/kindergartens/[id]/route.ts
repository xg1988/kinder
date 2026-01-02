import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";

// GET /api/kindergartens/[id]
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonError(401, "UNAUTHORIZED", "Auth session missing.", userErr.message);
    if (!user) return jsonError(401, "UNAUTHORIZED", "Login required.");

    const { id } = await ctx.params;
    const facilityId = Number(id);
    if (!Number.isFinite(facilityId)) return jsonError(400, "BAD_REQUEST", "Invalid id.");

    const { data, error } = await supabase
      .from("facilities")
      .select("*")
      .eq("id", facilityId)
      .eq("type", "KINDERGARTEN")
      .maybeSingle();

    if (error) return jsonError(500, "DB_ERROR", "Failed to fetch kindergarten.", error);
    if (!data) return jsonError(404, "NOT_FOUND", "Kindergarten not found.");

    return NextResponse.json({ data });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}
