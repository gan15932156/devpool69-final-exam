import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";

// render พร้อม QueryClient ใหม่ทุกครั้ง (ไม่ retry → error ขึ้นทันที)
export function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

type Route = { method?: string; path: string | RegExp; status?: number; body?: unknown };

// fetch ปลอม: ตอบตาม route แรกที่ตรง (method + path ที่ขึ้นต้นด้วย /api/v1) · ไม่ตรง = 404
export function mockFetch(routes: Route[]) {
  const fn = vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const r = routes.find(
      (x) => (x.method ?? "GET") === method && (typeof x.path === "string" ? input === x.path : x.path.test(input)),
    );
    if (!r) return Response.json({ error: { code: "NOT_FOUND", message: `no mock for ${method} ${input}` } }, { status: 404 });
    return r.status === 204 ? new Response(null, { status: 204 }) : Response.json(r.body ?? {}, { status: r.status ?? 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

// body JSON ของคำขอที่ n
export const sentJSON = (fn: ReturnType<typeof mockFetch>, n: number) => JSON.parse(String(fn.mock.calls[n][1]?.body));
