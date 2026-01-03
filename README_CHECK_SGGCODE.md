# 시군구코드 검색 가능 여부(검토 결과)

- 유치원알리미 OpenAPI 제공목록(일반현황: basicInfo2.do) "OPEN API 요청인자"에
  - `sidoCode`(필수) / `sggCode`(필수) 가 명시되어 있어 **시군구코드로 조회(필터) 가능**합니다. citeturn4view0
- Sample URL에도 `sidoCode=27&sggCode=27140` 형식이 제공됩니다. citeturn4view0

## 이 패치가 하는 일
1) DB 컬럼 추가: `facilities.sido_code`, `facilities.sigungu_code` (+ 인덱스)
2) basicInfo2 출력항목 주요 필드를 저장할 컬럼/JSONB 추가
3) 적재 코드 수정: basicInfo2 명세 파라미터(`pageCnt/currentPage`)로 페이지네이션, (sidoCode, sggCode) 페어 목록을 환경변수로 받아 순회
