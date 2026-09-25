"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

export default function Providers({ session, children }: { session: Session | null; children: React.ReactNode }) {
  // useState → สร้าง QueryClient ครั้งเดียวต่อหน้าต่าง ไม่สร้างใหม่ทุกครั้งที่ render
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } }),
  );
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
