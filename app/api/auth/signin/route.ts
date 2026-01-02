import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";

type Body = { email?: string; password?: string };

// POST /api/auth/signin  { email, password }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = (await req.json().catch(() => ({}))) as Body;

    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return jsonError(400, "BAD_REQUEST", "email and password are required.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return jsonError(401, "AUTH_ERROR", "Sign in failed.", error.message);

    // Cookie session will be set by @supabase/ssr createServerClient cookie hooks.
    return NextResponse.json({
      data: {
        user: data.user,
        session: { expires_at: data.session?.expires_at ?? null },
      },
    });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}
