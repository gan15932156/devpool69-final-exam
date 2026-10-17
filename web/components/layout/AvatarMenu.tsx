"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { initialOf } from "@/lib/format";

// <details> = เมนูเปิด/ปิดได้โดยไม่ต้องเขียน state เอง และใช้คีย์บอร์ดได้
export function AvatarMenu({ name }: { name: string }) {
  return (
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full border border-line-strong bg-gold-tint font-heading text-base text-gold-text"
        >
          {initialOf(name)}
        </span>
        <span className="hidden text-[15px] font-medium md:inline">{name}</span>
        <span className="sr-only md:hidden">เมนูบัญชีของ {name}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-line-strong bg-surface p-1 shadow-card">
        <button
          type="button"
          // signOut ลบ cookie ฝั่งเว็บ และ events.signOut ใน auth.ts บอก Go ให้ยกเลิก token ด้วย (token_version +1)
          onClick={() => signOut({ redirectTo: "/" })}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left hover:bg-paper"
        >
          <LogOut size={18} aria-hidden />
          ออกจากระบบ
        </button>
      </div>
    </details>
  );
}
