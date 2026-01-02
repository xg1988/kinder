import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";

// GET /api/kindergartens?sido=&sigungu=&eupmyeondong=&q=&limit=&offset=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return jsonError(401, "UNAUTHORIZED", "Auth session missing.", userErr.message);
    if (!user) return jsonError(401, "UNAUTHORIZED", "Login required.");

    const { searchParams } = new URL(req.url);
    const sido = searchParams.get("sido") || undefined;
    const sigungu = searchParams.get("sigungu") || undefined;
    const eupmyeondong = searchParams.get("eupmyeondong") || undefined;
    const q = searchParams.get("q") || undefined;

    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

    // facilities where type=KINDERGARTEN
    let query = supabase
      .from("facilities")
      .select("*", { count: "exact" })
      .eq("type", "KINDERGARTEN");

    if (sido) query = query.eq("sido", sido);
    if (sigungu) query = query.eq("sigungu", sigungu);
    if (eupmyeondong) query = query.eq("eupmyeondong", eupmyeondong);

    if (q) query = query.ilike("name", `%${q}%`);

    const { data, error, count } = await query
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) return jsonError(500, "DB_ERROR", "Failed to fetch kindergartens.", error);

    return NextResponse.json({ data, meta: { count, limit, offset } });
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.", String(e));
  }
}
