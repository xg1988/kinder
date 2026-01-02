import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";

// GET /api/auth/me
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return jsonError(401, "UNAUTHORIZED", "Auth session missing.", error.message);
    if (!user) return jsonError(401, "UNAUTHORIZED", "Login required.");
    return NextResponse.json({ data: { user } });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}
