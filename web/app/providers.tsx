"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

export default function Providers({ session, children }: { session: Session | null; children: React.ReactNode }) {
  // useState → สร้าง QueryClient ครั้งเดียวต่อหน้าต่าง ไม่สร้างใหม่ทุกครั้งที่ render
  // staleTime 30 วิ: กลับมาหน้าเดิมภายใน 30 วิไม่ยิง API ซ้ำ · หลังจอง/รีวิว invalidate เองอยู่แล้วจึงไม่เห็นข้อมูลเก่า
  // retry: false — error ส่วนใหญ่เป็น 4xx จาก Go (ที่นั่งเต็ม ไม่มีสิทธิ์) ยิงซ้ำก็ได้ผลเดิม · ให้ผู้ใช้เห็น error ทันที
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } }),
  );
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
