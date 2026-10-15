// ตัวกลางเรียก Go API ผ่าน /api/v1/* ของ Next (app/api/v1/[...path]/route.ts แนบ token ให้ฝั่ง server)

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = null,
  ) {
    super(message);
  }

  // details ของ VALIDATION คือ { ชื่อช่อง: ข้อความ }
  get fieldErrors(): Record<string, string> {
    return this.code === "VALIDATION" && this.details && typeof this.details === "object"
      ? (this.details as Record<string, string>)
      : {};
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  json?: unknown; // ส่ง object มา จะแปลงเป็น JSON ให้
  body?: BodyInit;
};

export async function request<T>(url: string, { json, ...init }: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(json);
  }

  const res = await fetch(url, { ...init, headers });
  if (res.status === 204) return undefined as T;

  // body ไม่ใช่ JSON (เช่น proxy ตอบหน้า HTML ตอน 502) → ไม่พัง ใช้ข้อความกลางด้านล่างแทน
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "INTERNAL", e?.message ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง", e?.details ?? null);
  }
  return data as T;
}
