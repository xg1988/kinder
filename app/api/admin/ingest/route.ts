import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api/errors";
import { ingestChildcarePortal } from "@/lib/ingest/childcare_portal";
import { ingestEChildschoolinfo } from "@/lib/ingest/e_childschoolinfo";

export const runtime = "nodejs"; // uses crypto, large fetch, etc.

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing SUPABASE env vars for admin client.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// POST /api/admin/ingest?source=childcare|kindergarten|all
// Header: x-ingest-secret: <CRON_SECRET>
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ingest-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return jsonError(401, "UNAUTHORIZED", "Invalid ingest secret.");
  }

  const supabaseAdmin = getAdminClient();

  const source = new URL(req.url).searchParams.get("source") ?? "all";

  try {
    if (source === "childcare") {
      const result = await ingestChildcarePortal(supabaseAdmin);
      return NextResponse.json({ data: result });
    }
    if (source === "kindergarten") {
      const result = await ingestEChildschoolinfo(supabaseAdmin);
      return NextResponse.json({ data: result });
    }
    if (source === "all") {
      const a = await ingestChildcarePortal(supabaseAdmin);
      const b = await ingestEChildschoolinfo(supabaseAdmin);
      return NextResponse.json({ data: { childcare: a, kindergarten: b } });
    }
    return jsonError(400, "BAD_REQUEST", "source must be childcare|kindergarten|all");
  } catch (e) {
    return jsonError(500, "INTERNAL_ERROR", "Ingest failed.", String(e));
  }
}
