import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";

type Body = { email?: string };

// POST /api/auth/request-otp  { email }
// Sends an email OTP (or magic link depending on Supabase email templates).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = (await req.json().catch(() => ({}))) as Body;

    const email = body.email?.trim();
    if (!email) return jsonError(400, "BAD_REQUEST", "email is required.");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (error) return jsonError(400, "AUTH_ERROR", "Failed to send verification code.", error.message);

    return NextResponse.json({ data: { sent: true } });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}
