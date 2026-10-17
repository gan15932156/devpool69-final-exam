"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookingStub } from "@/components/booking/BookingStub";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { MyBookings } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Tab = "upcoming" | "past" | "cancelled";
const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "upcoming", label: "กำลังจะถึง", empty: "ยังไม่มีการจองที่กำลังจะถึง" },
  { key: "past", label: "ที่ผ่านมา", empty: "ยังไม่มีการจองที่ผ่านมา" },
  { key: "cancelled", label: "ยกเลิกแล้ว", empty: "ไม่มีการจองที่ยกเลิก" },
];

// หน้าการจองของฉัน · page.tsx (server) เช็ก login ก่อน แล้วค่อย render ส่วนนี้ (client) ที่ดึงข้อมูลเอง
export function MyBookingsView() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>("upcoming"); // แท็บที่เลือก · สลับแท็บไม่ยิง API ใหม่ เพราะคำตอบเดียวมีครบทั้ง 3 กลุ่ม
  // key ["my-bookings"] = key ที่ invalidateBookingQueries ล้าง → จอง/แก้/ยกเลิกจากหน้าไหน รายการนี้ก็อัปเดต
  const { data, isPending, isError } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => api<MyBookings>("/api/v1/me/bookings"),
  });

  const list = data?.[tab] ?? [];
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 pt-6 pb-10 md:px-8 md:pt-12 md:pb-[72px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-[32px] leading-tight tracking-[-0.01em] md:text-[52px]">การจองของฉัน</h1>
          <p className="mt-1 text-base text-muted md:text-[17px]">
            แก้ไขหรือยกเลิกได้จากหน้านี้ · แต่ละร้านกำหนดเวลายกเลิกล่วงหน้าเอง (อย่างน้อย 30 นาที)
          </p>
        </div>
        <ButtonLink href="/" variant="cta">
          จองร้านใหม่
        </ButtonLink>
      </div>

      <div role="tablist" aria-label="สถานะการจอง" className="flex gap-7 border-b border-line-strong">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-12 px-0.5 text-base",
              tab === t.key ? "font-bold text-vermilion shadow-[inset_0_-3px_0_var(--color-vermilion)]" : "font-medium text-muted",
            )}
          >
            {t.label}
            {data && ` · ${data[t.key].length}`}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="flex flex-col gap-[18px]">
        {isPending && <p className="py-10 text-center text-muted">กำลังโหลด…</p>}
        {isError && <p className="py-10 text-center text-vermilion">โหลดการจองไม่สำเร็จ</p>}
        {data && list.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
            <p className="text-muted">{current.empty}</p>
            {tab === "upcoming" && <ButtonLink href="/">ไปหาร้าน</ButtonLink>}
          </div>
        )}
        {list.map((b) => (
          <BookingStub key={b.id} booking={b} kind={tab} />
        ))}
      </div>
    </div>
  );
}
