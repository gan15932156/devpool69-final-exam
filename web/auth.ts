import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Go ตอบ 429 (login ผิดถี่เกินไป) → หน้า login ได้ code นี้ไปบอกให้รอ แทนที่จะบอกว่ารหัสผิด
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

// NextAuth ไม่ได้เก็บ user เอง — แค่ส่งอีเมล/รหัสไปให้ Go ตรวจ แล้วเก็บ token ที่ Go เซ็นไว้ใน session
export const { handlers, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 วัน เท่ากับอายุ token ของ Go
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // ทำงานฝั่ง server เท่านั้น → ต้องใช้ URL เต็มของ Go (ไม่ผ่าน rewrite)
      async authorize(credentials) {
        const res = await fetch(`${process.env.API_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });
        if (res.status === 429) throw new TooManyAttempts();
        if (!res.ok) return null; // null = login ไม่ผ่าน
        const data = await res.json();
        return {
          id: String(data.user.id),
          name: data.user.name,
          email: data.user.email,
          accessToken: data.accessToken,
        };
      },
    }),
  ],
  callbacks: {
    // jwt: เรียกตอน login (มี user) และทุกครั้งที่อ่าน session → เก็บ token ของ Go ไว้ใน cookie ที่เข้ารหัสแล้ว
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    // session: สิ่งที่หน้าเว็บเห็นผ่าน auth() / useSession()
    session({ session, token }) {
      session.user.id = token.id as string;
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  events: {
    // ออกจากระบบ → บอก Go ให้ยกเลิก token ด้วย ไม่งั้น token ที่เคยหลุดไปยังใช้ได้จนหมดอายุ 7 วัน
    async signOut(message) {
      const token = "token" in message ? message.token?.accessToken : undefined;
      if (!token) return;
      await fetch(`${process.env.API_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}); // Go ล่มอยู่ก็ยังออกจากระบบฝั่งเว็บได้
    },
  },
});
