import { redirect } from "next/navigation";
import { auth } from "@/auth";

// ใช้บนหน้าที่ต้อง login: const session = await requireSession("/bookings")
export async function requireSession(currentPath: string) {
  const session = await auth();
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
  return session;
}

// กัน open redirect: รับเฉพาะ path ในเว็บเรา ("/xxx" แต่ไม่ใช่ "//evil.com")
export function safeCallbackUrl(value: string | string[] | undefined) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
