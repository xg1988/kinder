import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";

type Body = { email?: string; code?: string; password?: string };

// POST /api/auth/verify-otp  { email, code, password? }
// Verifies the OTP and optionally sets a password for future password logins.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = (await req.json().catch(() => ({}))) as Body;

    const email = body.email?.trim();
    const code = body.code?.trim();
    const password = body.password;

    if (!email || !code) {
      return jsonError(400, "BAD_REQUEST", "email and code are required.");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) return jsonError(401, "AUTH_ERROR", "OTP verification failed.", error.message);

    if (password) {
      const { data: upd, error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) return jsonError(400, "AUTH_ERROR", "Password set failed.", updErr.message);

      return NextResponse.json({
        data: {
          user: upd.user ?? data.user ?? null,
          session: data.session ? { expires_at: data.session.expires_at } : null,
          password_set: true,
        },
      });
    }

    return NextResponse.json({
      data: {
        user: data.user ?? null,
        session: data.session ? { expires_at: data.session.expires_at } : null,
        password_set: false,
      },
    });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}
