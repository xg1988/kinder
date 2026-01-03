-- 005_publicapi_schema.sql
-- 목적: 공공 API/표준데이터 적재를 위한 스키마 확장 (시설 정규화 + 원본 보관 + 적재 이력 + 변경 이벤트)

begin;

-- (가정) 기존 public.facilities 테이블이 있고 pk가 id(bigint)이며 type 컬럼(kindergarten|childcare)이 존재함.
-- (가정) 기존 설계에서 facility 외부키 없이 단일 테이블 유지 원칙.

alter table public.facilities
  add column if not exists source text not null default 'manual' check (source in ('manual','data_go_kr','childcare_portal','e_childschoolinfo')),
  add column if not exists source_facility_id text,                           -- 원천 시스템의 시설 식별자(시설코드/기관코드 등)
  add column if not exists status text,                                       -- 운영현황(운영/휴원/폐지 등)
  add column if not exists facility_type_detail text,                          -- 어린이집유형구분/설립유형 등 세부
  add column if not exists postal_code text,
  add column if not exists phone text,
  add column if not exists fax text,
  add column if not exists homepage_url text,
  add column if not exists approved_date date,                                 -- 인가일자/설립일 등
  add column if not exists capacity integer,                                   -- 정원수
  add column if not exists current_enrolled integer,                           -- 현원수
  add column if not exists teachers_count integer,
  add column if not exists classrooms_count integer,
  add column if not exists cctv_count integer,
  add column if not exists bus_operated boolean,
  add column if not exists last_synced_at timestamptz,                         -- 마지막 적재/갱신 시각
  add column if not exists last_seen_at timestamptz,                           -- 이번 적재 배치에서 관측된 시각
  add column if not exists data_hash text;                                     -- 원천 레코드 해시(변경 감지)

-- 원천 시스템에서 유니크를 보장할 수 있으면 중복 방지(같은 source+source_facility_id는 1개)
create unique index if not exists uq_facilities_source_key
  on public.facilities(source, source_facility_id)
  where source_facility_id is not null;

create index if not exists idx_facilities_region
  on public.facilities(sido, sigungu, eupmyeondong);

create index if not exists idx_facilities_name
  on public.facilities using gin (name gin_trgm_ops);

create index if not exists idx_facilities_type
  on public.facilities(type);

create index if not exists idx_facilities_last_seen
  on public.facilities(last_seen_at);

-- 원본(정제 전) 저장: 재처리/디버깅/스키마 변경 대응용
create table if not exists public.facility_source_records (
  id bigserial primary key,
  source text not null check (source in ('data_go_kr','childcare_portal','e_childschoolinfo')),
  source_facility_id text not null,
  fetched_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text not null,
  -- 매 배치에서 동일 레코드는 upsert로 덮어쓰기(가장 최신 원본 유지)
  unique (source, source_facility_id)
);

create index if not exists idx_facility_source_records_source on public.facility_source_records(source);
create index if not exists idx_facility_source_records_fetched_at on public.facility_source_records(fetched_at desc);

-- 적재 배치 실행 이력
create table if not exists public.ingest_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source text not null check (source in ('data_go_kr','childcare_portal','e_childschoolinfo','multi')),
  status text not null default 'running' check (status in ('running','success','failed')),
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  changed_count integer not null default 0,
  error text
);

create index if not exists idx_ingest_runs_started on public.ingest_runs(started_at desc);

-- 변경 이벤트(알림 트리거용): 정원/현원/모집/상태 등 변경 감지 결과를 누적
create table if not exists public.facility_change_events (
  id bigserial primary key,
  facility_id bigint not null references public.facilities(id) on delete cascade,
  source text not null,
  event_type text not null check (event_type in ('created','updated','status_changed','capacity_changed','enrollment_changed','announcement_updated','other')),
  old_value jsonb,
  new_value jsonb,
  detected_at timestamptz not null default now()
);

create index if not exists idx_facility_change_events_facility on public.facility_change_events(facility_id, detected_at desc);
create index if not exists idx_facility_change_events_type on public.facility_change_events(event_type, detected_at desc);

commit;
