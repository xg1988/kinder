import type { SupabaseClient } from "@supabase/supabase-js";
import { FacilityNormalized, sha256, stableJson } from "./utils";

type RunResult = { source: "e_childschoolinfo"; fetched: number; upserted: number; changed: number };

// 유치원알리미 OpenAPI basicInfo2.do 요청인자
// - key(필수), sidoCode(필수), sggCode(필수), pageCnt, currentPage, timing(옵션)
// 근거: Open API 제공목록 페이지 "OPEN API 요청인자" 섹션 citeturn4view0

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function createRun(supabase: SupabaseClient, source: RunResult["source"]) {
  const { data, error } = await supabase.from("ingest_runs").insert({ source }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as number;
}

async function finishRun(
  supabase: SupabaseClient,
  runId: number,
  patch: Partial<{ status: string; fetched_count: number; upserted_count: number; changed_count: number; error: string }>
) {
  const { error } = await supabase
    .from("ingest_runs")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

function toInt(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDateISO(v: any): string | null {
  if (!v) return null;
  // "YYYY-MM-DD" 또는 "YYYYMMDD" 가정
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return null;
}

function normalizeKinderRecord(item: any, sidoCode: number, sggCode: number): FacilityNormalized | null {
  // 출력항목(일반현황 basicInfo2) 일부 매핑 citeturn4view0
  const source_facility_id = String(item?.kinderCode ?? "").trim();
  const name = String(item?.kindername ?? item?.kinderName ?? "").trim();
  if (!source_facility_id || !name) return null;

  const payload = item;
  const payload_hash = sha256(stableJson(payload));

  const latitude = item?.lttdcdnt ? Number(item.lttdcdnt) : item?.latitude ? Number(item.latitude) : null;
  const longitude = item?.lngtcdnt ? Number(item.lngtcdnt) : item?.longitude ? Number(item.longitude) : null;

  const capacity_total = toInt(item?.prmstfcnt); // 인가총정원수
  const cap3 = toInt(item?.ag3fpcnt);
  const cap4 = toInt(item?.ag4fpcnt);
  const cap5 = toInt(item?.ag5fpcnt);
  const capMix = toInt(item?.mixfpcnt);
  const capSp = toInt(item?.spcnfpcnt);

  const enr3 = toInt(item?.ppcnt3);
  const enr4 = toInt(item?.ppcnt4);
  const enr5 = toInt(item?.ppcnt5);
  const enrMix = toInt(item?.mixppcnt);
  const enrSp = toInt(item?.shppcnt);

  const class3 = toInt(item?.clcnt3);
  const class4 = toInt(item?.clcnt4);
  const class5 = toInt(item?.clcnt5);
  const classMix = toInt(item?.mixclcnt);
  const classSp = toInt(item?.shclcnt);

  const out: FacilityNormalized = {
    source: "e_childschoolinfo",
    source_facility_id,
    type: "kindergarten",
    name,
    address: item?.addr ?? null,
    phone: item?.telno ?? null,
    fax: item?.faxno ?? null,
    homepage_url: item?.hpaddr ?? null,
    latitude: Number.isFinite(latitude as any) ? (latitude as number) : null,
    longitude: Number.isFinite(longitude as any) ? (longitude as number) : null,
    approved_date: toDateISO(item?.edate) ?? null,
    capacity: capacity_total,
    current_enrolled: null,
    status: null,
    facility_type_detail: null,
    data_hash: "",
    payload_hash,
    payload: {
      ...payload,
      __mapped: {
        sido_code: sidoCode,
        sigungu_code: sggCode,
        office_edu: item?.officeedu ?? null,
        sub_office_edu: item?.subofficeedu ?? null,
        establish: item?.establish ?? null,
        founded_date: toDateISO(item?.edate),
        opened_date: toDateISO(item?.odate),
        oper_time: item?.opertime ?? null,
        disclosure_timing: item?.pbnttmng ?? null,
        class_count: { age3: class3, age4: class4, age5: class5, mix: classMix, special: classSp },
        capacity_by_age: { total: capacity_total, age3: cap3, age4: cap4, age5: cap5, mix: capMix, special: capSp },
        enrolled_by_age: { age3: enr3, age4: enr4, age5: enr5, mix: enrMix, special: enrSp },
      },
    },
  };

  const data_for_hash = {
    name: out.name,
    sido_code: sidoCode,
    sigungu_code: sggCode,
    address: out.address,
    phone: out.phone,
    homepage_url: out.homepage_url,
    latitude: out.latitude,
    longitude: out.longitude,
    approved_date: out.approved_date,
    capacity_total,
    cap3,
    cap4,
    cap5,
    capMix,
    capSp,
    enr3,
    enr4,
    enr5,
    enrMix,
    enrSp,
    class3,
    class4,
    class5,
    classMix,
    classSp,
    office_edu: item?.officeedu ?? null,
    sub_office_edu: item?.subofficeedu ?? null,
    establish: item?.establish ?? null,
    founded_date: toDateISO(item?.edate),
    opened_date: toDateISO(item?.odate),
    oper_time: item?.opertime ?? null,
    disclosure_timing: item?.pbnttmng ?? null,
  };
  out.data_hash = sha256(stableJson(data_for_hash));
  return out;
}

async function upsertOne(supabase: SupabaseClient, rec: FacilityNormalized): Promise<{ upserted: number; changed: number }> {
  const nowIso = new Date().toISOString();

  const mapped = rec.payload?.__mapped ?? {};

  const { error: srcErr } = await supabase
    .from("facility_source_records")
    .upsert(
      {
        source: rec.source,
        source_facility_id: rec.source_facility_id,
        fetched_at: nowIso,
        payload: rec.payload,
        payload_hash: rec.payload_hash,
      },
      { onConflict: "source,source_facility_id" }
    );
  if (srcErr) throw new Error(srcErr.message);

  const { data: existing, error: selErr } = await supabase
    .from("facilities")
    .select("id,data_hash")
    .eq("source", rec.source)
    .eq("source_facility_id", rec.source_facility_id)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  const { data: upsertedRow, error: upErr } = await supabase
    .from("facilities")
    .upsert(
      {
        source: rec.source,
        source_facility_id: rec.source_facility_id,
        type: rec.type,
        name: rec.name,
        sido: rec.sido ?? null,
        sigungu: rec.sigungu ?? null,
        eupmyeondong: rec.eupmyeondong ?? null,
        address: rec.address ?? null,
        latitude: rec.latitude ?? null,
        longitude: rec.longitude ?? null,
        phone: rec.phone ?? null,
        fax: rec.fax ?? null,
        homepage_url: rec.homepage_url ?? null,
        approved_date: rec.approved_date ?? null,
        capacity: rec.capacity ?? null,
        current_enrolled: rec.current_enrolled ?? null,

        sido_code: mapped.sido_code ?? null,
        sigungu_code: mapped.sigungu_code ?? null,
        office_edu: mapped.office_edu ?? null,
        sub_office_edu: mapped.sub_office_edu ?? null,
        establish: mapped.establish ?? null,
        founded_date: mapped.founded_date ?? null,
        opened_date: mapped.opened_date ?? null,
        oper_time: mapped.oper_time ?? null,
        class_count: mapped.class_count ?? null,
        capacity_by_age: mapped.capacity_by_age ?? null,
        enrolled_by_age: mapped.enrolled_by_age ?? null,
        disclosure_timing: mapped.disclosure_timing ?? null,

        last_synced_at: nowIso,
        last_seen_at: nowIso,
        data_hash: rec.data_hash,
      },
      { onConflict: "source,source_facility_id" }
    )
    .select("id")
    .single();
  if (upErr) throw new Error(upErr.message);

  let changed = 0;
  if (!existing) changed = 1;
  else if (existing.data_hash !== rec.data_hash) changed = 1;

  if (changed) {
    const { error } = await supabase.from("facility_change_events").insert({
      facility_id: upsertedRow.id,
      source: rec.source,
      event_type: existing ? "updated" : "created",
      new_value: { data_hash: rec.data_hash },
      old_value: existing ? { data_hash: existing.data_hash } : null,
    });
    if (error) throw new Error(error.message);
  }

  return { upserted: 1, changed };
}

function parsePairs(): Array<{ sidoCode: number; sggCode: number }> {
  const pairs = (process.env.KINDER_CODE_PAIRS ?? "").trim();
  if (!pairs) {
    const sido = Number(process.env.KINDER_SIDO_CODE ?? "");
    const sgg = Number(process.env.KINDER_SGG_CODE ?? "");
    if (Number.isFinite(sido) && Number.isFinite(sgg)) return [{ sidoCode: sido, sggCode: sgg }];
    throw new Error("Missing KINDER_CODE_PAIRS (or KINDER_SIDO_CODE + KINDER_SGG_CODE).");
  }
  return pairs
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [a, b] = x.split(":");
      return { sidoCode: Number(a), sggCode: Number(b) };
    })
    .filter((p) => Number.isFinite(p.sidoCode) && Number.isFinite(p.sggCode));
}

export async function ingestEChildschoolinfo(supabase: SupabaseClient) {
  const endpoint = process.env.KINDER_API_ENDPOINT ?? "https://e-childschoolinfo.moe.go.kr/api/notice/basicInfo2.do";
  const key = requireEnv("KINDER_API_KEY");
  const pairs = parsePairs();

  const runId = await createRun(supabase, "e_childschoolinfo");

  let fetched = 0;
  let upserted = 0;
  let changed = 0;

  try {
    const pageCnt = Number(process.env.KINDER_PAGE_CNT ?? "200");
    const timing = (process.env.KINDER_TIMING ?? "").trim();

    for (const { sidoCode, sggCode } of pairs) {
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        const url = new URL(endpoint);
        url.searchParams.set("key", key);
        url.searchParams.set("sidoCode", String(sidoCode));
        url.searchParams.set("sggCode", String(sggCode));
        url.searchParams.set("pageCnt", String(pageCnt));
        url.searchParams.set("currentPage", String(currentPage));
        if (timing) url.searchParams.set("timing", timing);

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);

        const json: any = await res.json();
        const items: any[] = Array.isArray(json?.kinderInfo) ? json.kinderInfo : Array.isArray(json?.data) ? json.data : [];

        if (!Array.isArray(items) || items.length === 0) {
          hasMore = false;
          break;
        }

        for (const item of items) {
          const rec = normalizeKinderRecord(item, sidoCode, sggCode);
          if (!rec) continue;
          fetched += 1;
          const r = await upsertOne(supabase, rec);
          upserted += r.upserted;
          changed += r.changed;
        }

        if (items.length < pageCnt) hasMore = false;
        currentPage += 1;
      }
    }

    await finishRun(supabase, runId, { status: "success", fetched_count: fetched, upserted_count: upserted, changed_count: changed });
    return { source: "e_childschoolinfo", fetched, upserted, changed };
  } catch (e: any) {
    await finishRun(supabase, runId, {
      status: "failed",
      fetched_count: fetched,
      upserted_count: upserted,
      changed_count: changed,
      error: String(e?.message ?? e),
    });
    throw e;
  }
}
