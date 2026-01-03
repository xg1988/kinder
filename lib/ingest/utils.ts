import crypto from "crypto";

export function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function stableJson(obj: unknown): string {
  // stable stringify: sort keys recursively (simple implementation)
  const seen = new WeakSet<object>();
  const sorter = (v: any): any => {
    if (v && typeof v === "object") {
      if (seen.has(v)) return v;
      seen.add(v);
      if (Array.isArray(v)) return v.map(sorter);
      const out: any = {};
      for (const k of Object.keys(v).sort()) out[k] = sorter(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sorter(obj));
}

export type FacilityNormalized = {
  source: "childcare_portal" | "e_childschoolinfo";
  source_facility_id: string;
  type: "childcare" | "kindergarten";
  name: string;
  sido?: string | null;
  sigungu?: string | null;
  eupmyeondong?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  status?: string | null;
  facility_type_detail?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  fax?: string | null;
  homepage_url?: string | null;
  approved_date?: string | null; // ISO date
  capacity?: number | null;
  current_enrolled?: number | null;
  teachers_count?: number | null;
  classrooms_count?: number | null;
  cctv_count?: number | null;
  bus_operated?: boolean | null;

  data_hash: string;
  payload_hash: string;
  payload: any;
};
