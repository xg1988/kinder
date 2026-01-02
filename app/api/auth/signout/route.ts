import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";

// POST /api/auth/signout
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) return jsonError(400, "AUTH_ERROR", "Sign out failed.", error.message);

    return NextResponse.json({ data: { signed_out: true } });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}
