import type { Metadata } from "next";
import { Pridi, Sarabun } from "next/font/google";
import { auth } from "@/auth";
import Providers from "./providers";
import "./globals.css";

const pridi = Pridi({
  variable: "--font-pridi",
  weight: "600",
  subsets: ["thai", "latin"],
});

const sarabun = Sarabun({
  variable: "--font-sarabun",
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "โต๊ะว่าง — จองโต๊ะ · รีวิวร้าน",
  description: "ระบบจองโต๊ะร้านอาหารและรีวิวร้าน",
  icons: { icon: "/design/logo-seal.svg" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // อ่าน session ฝั่ง server แล้วส่งให้ SessionProvider → หน้าเว็บรู้ทันทีว่า login อยู่ไหม ไม่ต้องรอโหลด
  const session = await auth();
  return (
    <html lang="th" className={`${pridi.variable} ${sarabun.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
