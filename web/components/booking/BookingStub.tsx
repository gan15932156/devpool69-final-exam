"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, MessageSquare, Pencil, Star, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { dateParts, invalidateBookingQueries, thaiDate } from "@/lib/booking";
import { cn } from "@/lib/cn";
import { durationText } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { EditBookingDialog } from "./EditBookingDialog";

// การ์ดการจองแบบ "ต้นขั้ว": ซ้ายเป็นวันที่ (วันนี้ = ชาด · ปกติ = คราม · ยกเลิก = เทา) คั่นด้วยเส้นประ
export function BookingStub({ booking: b, kind }: { booking: Booking; kind: "upcoming" | "past" | "cancelled" }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false); // กดยกเลิกครั้งแรก = เปิดแถบยืนยันในการ์ด · ยังไม่ยิง API
  const [editing, setEditing] = useState(false); // true = render EditBookingDialog → โหลดร้าน/ที่นั่งเฉพาะตอนเปิดแก้ไข
  const d = dateParts(b.serviceDate); // ต้นขั้วใช้วันของรอบ → ร้านข้ามคืนที่จอง 01:00 ยังขึ้นเป็นคืนเดิม
  const cancelled = b.status === "cancelled";

  const cancel = useMutation({
    mutationFn: () => api(`/api/v1/bookings/${b.id}/cancel`, { method: "POST" }),
    // onSettled (ไม่ใช่ onSuccess) = ทำทั้งตอนสำเร็จและไม่สำเร็จ
    // ไม่สำเร็จ เช่น เลยเวลายกเลิกระหว่างเปิดหน้าทิ้งไว้ → โหลดใหม่แล้ว canCancel เป็น false ปุ่มปิดเองตามจริง
    onSettled: () => {
      setConfirming(false);
      // โหลดรายการใหม่ → การ์ดย้ายไปแท็บ "ยกเลิกแล้ว" โดยไม่ต้อง reload หน้า
      invalidateBookingQueries(queryClient);
    },
  });

  const stubColor = cancelled ? "bg-[#8A7A66]" : d.isToday && kind === "upcoming" ? "bg-vermilion" : "bg-indigo";
  const lead = durationText(b.cancelLeadMinutes);

  let note: React.ReactNode = null;
  if (cancelled) note = "ยกเลิกเรียบร้อย ร้านได้ที่นั่งคืนแล้ว";
  else if (kind === "upcoming" && b.canCancel)
    note = `แก้ไข/ยกเลิกได้ถึง ${thaiDate(b.cancelDeadlineDate)} ${b.cancelDeadline} · ร้านกำหนดล่วงหน้า ${lead}`;
  else if (kind === "upcoming")
    note = <span className="text-vermilion">เลยเวลายกเลิกแล้ว · ร้านนี้ให้ยกเลิกล่วงหน้า {lead} (ถึง {b.cancelDeadline})</span>;

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card", cancelled && "opacity-72")}>
      <div className="flex items-stretch">
        <div className={cn("flex w-[88px] shrink-0 flex-col items-center justify-center gap-0.5 py-5 text-cream md:w-[132px]", stubColor)}>
          <span className="text-sm">{d.isToday && kind === "upcoming" ? "วันนี้" : d.dow}</span>
          <span className="font-heading text-[36px] leading-none md:text-[44px]">{d.day}</span>
          <span className="text-sm">{d.mon}</span>
        </div>
        <div aria-hidden className="border-l-2 border-dashed border-line-strong" />
        <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:gap-5 md:px-[26px] md:py-[22px]">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-heading text-xl md:text-[22px]">
                <Link href={`/restaurants/${b.restaurantId}`} className="hover:underline">
                  {b.restaurantName}
                </Link>
              </h2>
              <StatusBadge status={cancelled ? "cancelled" : kind === "past" ? "past" : "confirmed"} />
            </div>
            <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-base text-ink-2">
              <span className="flex items-center gap-1.5">
                <Clock size={16} aria-hidden />
                {b.start}–{b.end}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={16} aria-hidden />
                {b.partySize} คน
              </span>
            </div>
            {note && <p className="text-[15px] text-muted">{note}</p>}
            {cancel.error && (
              <p role="alert" className="text-[15px] font-bold text-vermilion">
                {cancel.error instanceof ApiError ? cancel.error.message : "ยกเลิกไม่สำเร็จ"}
              </p>
            )}
          </div>

          {/* disabled ตาม canCancel ที่ Go คิดให้ · ซ่อนปุ่มเป็นแค่ UX — ยิง API ตรงก็โดน Go ตอบ 409 อยู่ดี */}
          {kind === "upcoming" && !confirming && (
            <div className="flex shrink-0 gap-2 md:w-[172px] md:flex-col">
              <Button className="flex-1" disabled={!b.canCancel} onClick={() => setEditing(true)}>
                <Pencil size={16} aria-hidden />
                แก้ไข
              </Button>
              <Button variant="outline-red" className="flex-1" disabled={!b.canCancel} onClick={() => setConfirming(true)}>
                <span className="md:hidden">ยกเลิก</span>
                <span className="hidden md:inline">ยกเลิกการจอง</span>
              </Button>
            </div>
          )}

          {/* ปุ่มเขียนรีวิว / ป้ายรีวิวแล้ว */}
          {kind === "past" &&
            (b.hasReviewed ? (
              <span className="flex shrink-0 items-center gap-1.5 text-base text-ink-2">
                รีวิวแล้ว <Star size={16} className="fill-gold text-gold" aria-hidden />
              </span>
            ) : (
              <Link
                href={`/restaurants/${b.restaurantId}#review`}
                className="flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-md bg-gold-tint px-[18px] text-base font-bold text-gold-text"
              >
                <MessageSquare size={18} aria-hidden />
                เขียนรีวิว
              </Link>
            ))}
        </div>
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-label="ยืนยันการยกเลิก"
          className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E9BBAE] bg-vermilion-tint px-4 py-4 md:px-[26px]"
        >
          <span className="text-base font-semibold text-[#6E1F18]">ยกเลิกการจองนี้? ที่นั่ง {b.partySize} คนจะถูกคืนให้ร้านทันที</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              ไม่ยกเลิก
            </Button>
            <Button variant="cta" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {cancel.isPending ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}
            </Button>
          </div>
        </div>
      )}

      {editing && <EditBookingDialog booking={b} onClose={() => setEditing(false)} />}
    </article>
  );
}
