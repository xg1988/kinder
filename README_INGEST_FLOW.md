# 공공 API 적재 흐름(요약)

## 1) 데이터 소스(권장)
- 어린이집: data.go.kr에 등록된 "전국 어린이집 정보 조회" OpenAPI(제공기관: 한국사회보장정보원) citeturn11view2  
  - 실제 호출 URL은 `info.childcare.go.kr` OpenAPI 링크에서 확인
- 어린이집(대량/표준): "전국어린이집표준데이터" 표준데이터셋(항목: 시도/시군구/시설명/유형/운영현황/주소/정원/현원/위경도 등) citeturn11view0
- 유치원: "전국유치원표준데이터"(유치원알리미, LINK 타입 OpenAPI 안내 포함) citeturn11view1

## 2) 테이블 변경 요지
- `facilities`에 `source`, `source_facility_id`(원천 시설코드) 추가 → 소스별 upsert 키로 사용
- 원본 JSON 보관: `facility_source_records`
- 적재 이력: `ingest_runs`
- 변경 이벤트: `facility_change_events` (정원/현원/상태 변화 감지 → 알림 생성에 활용)

## 3) 적재 실행 방식(서버/크론)
- Vercel Cron(또는 Supabase Scheduled Trigger/Edge Function)에서
  - `POST https://<your-domain>/api/admin/ingest?source=all`
  - Header `x-ingest-secret: <CRON_SECRET>`로 호출
- 이 엔드포인트는 `SUPABASE_SERVICE_ROLE_KEY`로 DB upsert (RLS 우회 가능)

## 4) 로직(배치 한 사이클)
1. `ingest_runs`에 run 생성
2. 공공 API를 페이지 단위로 fetch
3. 레코드별로:
   - 원본을 `facility_source_records`에 upsert
   - 정규화 → `facilities`에 upsert
   - 기존 `data_hash`와 비교하여 변경 이벤트 기록(`facility_change_events`)
4. run 완료/실패 상태 업데이트

> 주의: 현재 코드에서 공공 API의 실제 응답 필드명/형식(XML vs JSON)은 "가정"으로 처리했습니다.  
> 제공기관의 명세서 기준으로 `normalize*Record()`와 파서(XML→JSON)를 확정하면 즉시 운영 가능합니다.
