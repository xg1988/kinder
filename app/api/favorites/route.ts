import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";

type FavoriteBody = { facility_id?: number };

// POST /api/favorites  body: { facility_id }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonError(401, "UNAUTHORIZED", "Auth session missing.", userErr.message);
    if (!user) return jsonError(401, "UNAUTHORIZED", "Login required.");

    const body = (await req.json().catch(() => ({}))) as FavoriteBody;
    const facility_id = Number(body.facility_id);
    if (!Number.isFinite(facility_id)) return jsonError(400, "BAD_REQUEST", "facility_id is required.");

    const { data, error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, facility_id })
      .select("*")
      .single();

    if (error) return jsonError(400, "DB_ERROR", "Failed to add favorite.", error);

    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}

// DELETE /api/favorites  body: { facility_id }
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonError(401, "UNAUTHORIZED", "Auth session missing.", userErr.message);
    if (!user) return jsonError(401, "UNAUTHORIZED", "Login required.");

    const body = (await req.json().catch(() => ({}))) as FavoriteBody;
    const facility_id = Number(body.facility_id);
    if (!Number.isFinite(facility_id)) return jsonError(400, "BAD_REQUEST", "facility_id is required.");

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("facility_id", facility_id);

    if (error) return jsonError(400, "DB_ERROR", "Failed to delete favorite.", error);

    return NextResponse.json({ data: { deleted: true } });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}
