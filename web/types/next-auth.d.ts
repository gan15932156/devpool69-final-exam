import type { DefaultSession } from "next-auth";

// บอก TypeScript ว่า session มี user.id เพิ่มมา · accessToken ของ Go อยู่ใน JWT (cookie) เท่านั้น ไม่อยู่ใน session
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
  interface User {
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
  }
}
