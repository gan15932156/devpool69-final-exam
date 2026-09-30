import { handleApi, isMockEnabled } from "@/mock/api";

// mock ของ Go API — เปิดเฉพาะ `npm run dev:mock` (MOCK_API=1) · โหมดปกติตอบ 404 เหมือนไม่มี route นี้
// ทางเข้า: rewrite /api/v1/* → ${API_URL}/api/v1/* โดย dev:mock ตั้ง API_URL = http://localhost:<port>/mock
async function handle(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isMockEnabled()) return new Response("Not Found", { status: 404 });
  const { path } = await params;
  return handleApi(req, path);
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
