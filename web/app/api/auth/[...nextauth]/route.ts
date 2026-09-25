import { handlers } from "@/auth";

// NextAuth ใช้ /api/auth/* (signin, signout, session, csrf ...)
export const { GET, POST } = handlers;
