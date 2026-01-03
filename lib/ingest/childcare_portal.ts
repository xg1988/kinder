import type { SupabaseClient } from "@supabase/supabase-js";
import { FacilityNormalized, sha256, stableJson } from "./utils";

type RunResult = { source: "childcare_portal"; fetched: number; upserted: number; changed: number };

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function createRun(supabase: SupabaseClient, source: RunResult["source"]) {
  const { data, error } = await supabase
    .from("ingest_runs")
    .insert({ source })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
}

async function finishRun(
  supabase: SupabaseClient,
  runId: number,
  patch: Partial<{ status: string; finished_at: string; fetched_count: number; upserted_count: number; changed_count: number; error: string }>
) {
  const { error } = await supabase
    .from("ingest_runs")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

function normalizeChildcareRecord(item: any): FacilityNormalized | null {
  // item 필드명은 기관별로 다를 수 있어 "가정"으로 처리 (실제는 API 명세서 기준으로 매핑 조정)
  // 최소 매핑: 시설명, 시설코드, 주소, 정원
  const source_facility_id = String(item?.facilityCode ?? item?.시설코드 ?? item?.stcode ?? item?.STCODE ?? "").trim();
  const name = String(item?.facilityName ?? item?.보육시설명 ?? item?.crname ?? item?.CRNAME ?? "").trim();

  if (!source_facility_id || !name) return null;

  const payload = item;
  const payload_hash = sha256(stableJson(payload));

  const out: FacilityNormalized = {
    source: "childcare_portal",
    source_facility_id,
    type: "childcare",
    name,
    sido: item?.sido ?? item?.시도 ?? null,
    sigungu: item?.sigungu ?? item?.시군구 ?? null,
    eupmyeondong: item?.eupmyeondong ?? item?.읍면동 ?? null,
    address: item?.address ?? item?.주소 ?? null,
    latitude: item?.latitude ? Number(item.latitude) : item?.위도 ? Number(item.위도) : null,
    longitude: item?.longitude ? Number(item.longitude) : item?.경도 ? Number(item.경도) : null,
    status: item?.status ?? item?.운영현황 ?? null,
    facility_type_detail: item?.facilityType ?? item?.어린이집유형구분 ?? null,
    postal_code: item?.zip ?? item?.우편번호 ?? null,
    phone: item?.phone ?? item?.어린이집전화번호 ?? null,
    fax: item?.fax ?? item?.어린이집팩스번호 ?? null,
    homepage_url: item?.url ?? item?.홈페이지주소 ?? null,
    approved_date: item?.approvedDate ?? item?.인가일자 ?? null,
    capacity: item?.capacity ? Number(item.capacity) : item?.정원수 ? Number(item.정원수) : item?.정원 ? Number(item.정원) : null,
    current_enrolled: item?.current ? Number(item.current) : item?.현원수 ? Number(item.현원수) : null,
    teachers_count: item?.teachers ? Number(item.teachers) : item?.보육교직원수 ? Number(item.보육교직원수) : null,
    classrooms_count: item?.classrooms ? Number(item.classrooms) : item?.보육실수 ? Number(item.보육실수) : null,
    cctv_count: item?.cctv ? Number(item.cctv) : item?.CCTV설치수 ? Number(item.CCTV설치수) : null,
    bus_operated: item?.busOperated ?? item?.통학차량운영여부 ?? null,
    data_hash: "", // will set below
    payload_hash,
    payload,
  };

  // data_hash: 정규화 필드 기반(변경 감지)
  const data_for_hash = {
    name: out.name,
    sido: out.sido,
    sigungu: out.sigungu,
    eupmyeondong: out.eupmyeondong,
    address: out.address,
    latitude: out.latitude,
    longitude: out.longitude,
    status: out.status,
    facility_type_detail: out.facility_type_detail,
    postal_code: out.postal_code,
    phone: out.phone,
    homepage_url: out.homepage_url,
    approved_date: out.approved_date,
    capacity: out.capacity,
    current_enrolled: out.current_enrolled,
    teachers_count: out.teachers_count,
    classrooms_count: out.classrooms_count,
    cctv_count: out.cctv_count,
    bus_operated: out.bus_operated,
  };
  out.data_hash = sha256(stableJson(data_for_hash));

  return out;
}

async function upsertOne(supabase: SupabaseClient, rec: FacilityNormalized): Promise<{ upserted: number; changed: number }> {
  // 1) 원본 upsert
  const { error: srcErr } = await supabase
    .from("facility_source_records")
    .upsert(
      {
        source: rec.source,
        source_facility_id: rec.source_facility_id,
        fetched_at: new Date().toISOString(),
        payload: rec.payload,
        payload_hash: rec.payload_hash,
      },
      { onConflict: "source,source_facility_id" }
    );
  if (srcErr) throw new Error(srcErr.message);

  // 2) 기존 data_hash 확인
  const { data: existing, error: selErr } = await supabase
    .from("facilities")
    .select("id,data_hash,status,capacity,current_enrolled")
    .eq("source", rec.source)
    .eq("source_facility_id", rec.source_facility_id)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  const nowIso = new Date().toISOString();

  // 3) facilities upsert
  const upsertPayload: any = {
    source: rec.source,
    source_facility_id: rec.source_facility_id,
    type: rec.type,
    name: rec.name,
    sido: rec.sido,
    sigungu: rec.sigungu,
    eupmyeondong: rec.eupmyeondong,
    address: rec.address,
    latitude: rec.latitude,
    longitude: rec.longitude,
    status: rec.status,
    facility_type_detail: rec.facility_type_detail,
    postal_code: rec.postal_code,
    phone: rec.phone,
    fax: rec.fax,
    homepage_url: rec.homepage_url,
    approved_date: rec.approved_date,
    capacity: rec.capacity,
    current_enrolled: rec.current_enrolled,
    teachers_count: rec.teachers_count,
    classrooms_count: rec.classrooms_count,
    cctv_count: rec.cctv_count,
    bus_operated: rec.bus_operated,
    last_synced_at: nowIso,
    last_seen_at: nowIso,
    data_hash: rec.data_hash,
  };

  const { data: upsertedRow, error: upErr } = await supabase
    .from("facilities")
    .upsert(upsertPayload, { onConflict: "source,source_facility_id" })
    .select("id,status,capacity,current_enrolled")
    .single();
  if (upErr) throw new Error(upErr.message);

  const upserted = 1;

  // 4) 변경 이벤트 기록(최소: created/updated + 주요 필드 diff)
  let changed = 0;
  if (!existing) {
    changed = 1;
    const { error } = await supabase.from("facility_change_events").insert({
      facility_id: upsertedRow.id,
      source: rec.source,
      event_type: "created",
      new_value: { status: upsertedRow.status, capacity: upsertedRow.capacity, current_enrolled: upsertedRow.current_enrolled },
    });
    if (error) throw new Error(error.message);
  } else if (existing.data_hash !== rec.data_hash) {
    changed = 1;

    // status change
    if (existing.status !== rec.status) {
      const { error } = await supabase.from("facility_change_events").insert({
        facility_id: existing.id,
        source: rec.source,
        event_type: "status_changed",
        old_value: { status: existing.status },
        new_value: { status: rec.status },
      });
      if (error) throw new Error(error.message);
    }

    // capacity change
    if ((existing.capacity ?? null) !== (rec.capacity ?? null)) {
      const { error } = await supabase.from("facility_change_events").insert({
        facility_id: existing.id,
        source: rec.source,
        event_type: "capacity_changed",
        old_value: { capacity: existing.capacity },
        new_value: { capacity: rec.capacity },
      });
      if (error) throw new Error(error.message);
    }

    // enrollment change
    if ((existing.current_enrolled ?? null) !== (rec.current_enrolled ?? null)) {
      const { error } = await supabase.from("facility_change_events").insert({
        facility_id: existing.id,
        source: rec.source,
        event_type: "enrollment_changed",
        old_value: { current_enrolled: existing.current_enrolled },
        new_value: { current_enrolled: rec.current_enrolled },
      });
      if (error) throw new Error(error.message);
    }

    // generic updated
    const { error } = await supabase.from("facility_change_events").insert({
      facility_id: existing.id,
      source: rec.source,
      event_type: "updated",
      old_value: { data_hash: existing.data_hash },
      new_value: { data_hash: rec.data_hash },
    });
    if (error) throw new Error(error.message);
  }

  return { upserted, changed };
}

export async function ingestChildcarePortal(supabase: SupabaseClient): Promise<RunResult> {
  // (가정) data.go.kr에 등록된 "전국 어린이집 정보 조회" OpenAPI를 사용하며 serviceKey 필요
  // 실제 엔드포인트/파라미터는 기관 문서를 참고하여 맞추세요.
  const endpoint = requireEnv("CHILDCARE_API_ENDPOINT"); // 예: https://info.childcare.go.kr/info/oais/openapi/OpenApiSlL.jsp
  const serviceKey = requireEnv("DATA_GO_KR_SERVICE_KEY"); // data.go.kr 발급키(또는 기관키)

  const runId = await createRun(supabase, "childcare_portal");

  let fetched = 0;
  let upserted = 0;
  let changed = 0;

  try {
    // (가정) page/numOfRows 방식. 실제는 엔드포인트 명세에 따라 수정.
    const pageSize = Number(process.env.INGEST_PAGE_SIZE ?? "200");
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(endpoint);
      url.searchParams.set("serviceKey", serviceKey);
      url.searchParams.set("pageNo", String(page));
      url.searchParams.set("numOfRows", String(pageSize));
      // url.searchParams.set("type", "json"); // 필요 시

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);

      const text = await res.text();

      // 응답이 XML일 수 있어 간단히 JSON 우선 처리 (실제는 XML->JSON 변환 필요)
      // 여기서는 "가정"으로 JSON 응답을 받는다고 처리.
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Childcare API response is not JSON. Update parser (XML->JSON).");
      }

      const items: any[] = json?.response?.body?.items ?? json?.items ?? json?.data ?? [];
      if (!Array.isArray(items)) throw new Error("Unexpected response shape. Adjust items path.");

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of items) {
        const rec = normalizeChildcareRecord(item);
        if (!rec) continue;
        fetched += 1;
        const r = await upsertOne(supabase, rec);
        upserted += r.upserted;
        changed += r.changed;
      }

      // stop condition
      if (items.length < pageSize) hasMore = false;
      page += 1;
    }

    await finishRun(supabase, runId, {
      status: "success",
      fetched_count: fetched,
      upserted_count: upserted,
      changed_count: changed,
    });

    return { source: "childcare_portal", fetched, upserted, changed };
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
