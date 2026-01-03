-- 006_echildschoolinfo_codes.sql
-- 목적: 유치원알리미 OpenAPI(기본현황: basicInfo2.do) 명세 기반으로 시도/시군구 코드 검색 및 주요 공시 필드 적재를 지원

begin;

-- 코드 기반 검색 지원 (sidoCode, sggCode)
alter table public.facilities
  add column if not exists sido_code integer,
  add column if not exists sigungu_code integer;

create index if not exists idx_facilities_codes on public.facilities(sido_code, sigungu_code);

-- 유치원알리미 basicInfo2 출력항목 일부(필요 최소) 저장
alter table public.facilities
  add column if not exists office_edu text,
  add column if not exists sub_office_edu text,
  add column if not exists establish text,            -- 설립유형
  add column if not exists opened_date date,          -- 개원일(odate)
  add column if not exists founded_date date,         -- 설립일(edate)
  add column if not exists oper_time text,            -- 운영시간(opertime)
  add column if not exists class_count jsonb,         -- {"age3":..,"age4":..,"age5":..,"mix":..,"special":..}
  add column if not exists capacity_by_age jsonb,     -- {"total":..,"age3":..,"age4":..,"age5":..,"mix":..,"special":..}
  add column if not exists enrolled_by_age jsonb,     -- {"age3":..,"age4":..,"age5":..,"mix":..,"special":..}
  add column if not exists disclosure_timing text;    -- 공시차수(pbnttmng)

commit;
