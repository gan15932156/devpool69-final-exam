// ตัวกลางเรียก Go API — ใช้ได้ทั้งฝั่ง server และ browser

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
  token?: string;
  json?: unknown; // ส่ง object มา จะแปลงเป็น JSON ให้
  body?: BodyInit;
};

export async function request<T>(url: string, { token, json, ...init }: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(json);
  }

  const res = await fetch(url, { ...init, headers });
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "INTERNAL", e?.message ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง", e?.details ?? null);
  }
  return data as T;
}
