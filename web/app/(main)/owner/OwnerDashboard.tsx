"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChartColumn, Moon, Pencil, Plus, Star, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateDomes } from "@/components/booking/Pickers";
import { SeatTimeline } from "@/components/booking/SeatTimeline";
import { StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { DomeImage } from "@/components/ui/DomeImage";
import { nextDays, serviceRange, thaiDate, type Availability } from "@/lib/booking";
import { cn } from "@/lib/cn";
import { hoursText, ratingText, reviewCountText } from "@/lib/format";
import type { Restaurant } from "@/lib/types";
import { useApi } from "@/lib/use-api";

// การจอง 1 รายการในตารางของเจ้าของร้าน (ownerBookingDTO ใน Go) · Go ส่งแค่ชื่อลูกค้า ไม่ส่งอีเมล
// กรองด้วยวันของรอบ → ร้านโต้รุ่ง การจอง 01:00 ของคืนวันที่ 25 อยู่ในรายการวันที่ 25
type OwnerBooking = { id: number; customerName: string; partySize: number; start: string; end: string; status: "confirmed" | "cancelled" };

// Dashboard เจ้าของร้าน: เลือกร้าน → เลือกวัน → เห็นกราฟที่นั่ง + รายการจองของวันนั้น
export function OwnerDashboard({ initialId }: { initialId?: number }) {
  const api = useApi();
  const router = useRouter();
  const days = nextDays(5);
  const [date, setDate] = useState(days[0].iso); // วันของรอบที่ดูอยู่ · เริ่มที่วันนี้
  const [pickedId, setPickedId] = useState(initialId); // ร้านที่เลือก (มาจาก ?r= ใน URL ตอนเปิดหน้า)

  const { data: shops, isPending } = useQuery({
    queryKey: ["my-restaurants"],
    queryFn: () => api<Restaurant[]>("/api/v1/me/restaurants"),
  });
  // ?r= ไม่ตรงร้านไหนของเรา (ลบไปแล้ว / พิมพ์ id ร้านคนอื่น) → ใช้ร้านแรกแทน ไม่ขึ้นหน้าว่าง
  const cur = shops?.find((s) => s.id === pickedId) ?? shops?.[0];

  // กราฟใช้ endpoint availability ตัวเดียวกับใบจองของลูกค้า → ตัวเลขตรงกันเสมอ
  const { data: av } = useQuery({
    queryKey: ["availability", cur?.id, date],
    queryFn: () => api<Availability>(`/api/v1/restaurants/${cur!.id}/availability?date=${date}`),
    enabled: !!cur, // ยังโหลดรายชื่อร้านไม่เสร็จ / ไม่มีร้าน → ยังไม่ยิง (cur! ปลอดภัยเพราะเหตุนี้)
  });
  // Go เช็กว่าเป็นเจ้าของร้านนี้จริง (ownedRestaurant) · คนอื่นยิงตรงได้ 403
  const { data: bookings } = useQuery({
    queryKey: ["owner-bookings", cur?.id, date],
    queryFn: () => api<OwnerBooking[]>(`/api/v1/restaurants/${cur!.id}/bookings?date=${date}`),
    enabled: !!cur,
  });

  // เลือกร้าน → จำใน URL ด้วย (replace ไม่เพิ่มประวัติ) → reload / กด back จากหน้าแก้ไขร้านแล้วยังอยู่ร้านเดิม
  function pick(id: number) {
    setPickedId(id);
    router.replace(`/owner?r=${id}`, { scroll: false });
  }

  if (isPending) return <p className="py-20 text-center text-muted">กำลังโหลด…</p>;

  // ตัวเลขสรุปของวันนั้น คิดจากข้อมูลที่โหลดมาแล้ว ไม่ต้องมี endpoint เพิ่ม
  const active = bookings?.filter((b) => b.status === "confirmed") ?? []; // ยกเลิกแล้วยังโชว์ในตาราง แต่ไม่นับ
  const guests = active.reduce((n, b) => n + b.partySize, 0); // ลูกค้าทั้งวัน (คนละช่วงเวลาก็นับรวม)
  const peak = av ? Math.max(0, ...av.slots.map((s) => s.used)) : 0; // ช่วงที่แน่นที่สุด = ต้องเตรียมโต๊ะเท่านี้

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 pt-6 pb-10 md:px-8 md:pt-11 md:pb-[72px] xl:px-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-[32px] leading-tight tracking-[-0.01em] md:text-[52px]">ร้านของฉัน</h1>
          <p className="mt-1 text-base text-muted md:text-[17px]">
            {shops?.length ? `คุณเป็นเจ้าของ ${shops.length} ร้าน · แก้ไขหรือลบได้เฉพาะร้านของคุณเอง` : "ยังไม่มีร้าน"}
          </p>
        </div>
        <ButtonLink href="/owner/restaurants/new" variant="cta">
          <Plus size={18} aria-hidden />
          สร้างร้านใหม่
        </ButtonLink>
      </div>

      {!cur ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <Store size={40} className="text-muted" aria-hidden />
          <p className="font-heading text-xl">ยังไม่มีร้านของคุณ</p>
          <p className="text-muted">สร้างร้านแรก ตั้งที่นั่ง เวลาเปิด–ปิด และเวลายกเลิกล่วงหน้า แล้วลูกค้าจะจองได้ทันที</p>
          <ButtonLink href="/owner/restaurants/new" variant="cta">
            สร้างร้าน
          </ButtonLink>
        </div>
      ) : (
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
          {/* ตัวสลับร้าน: มือถือเลื่อนแนวนอน · desktop เป็นคอลัมน์ซ้าย */}
          <nav aria-label="เลือกร้าน" className="flex shrink-0 gap-3 overflow-x-auto pb-1 lg:w-[320px] lg:flex-col lg:overflow-visible">
            {shops!.map((s) => {
              const on = s.id === cur.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pick(s.id)}
                  className={cn(
                    "flex min-w-[260px] items-center gap-3.5 rounded-lg border-2 p-3 text-left",
                    on ? "border-indigo bg-indigo-tint" : "border-line bg-surface",
                  )}
                >
                  <DomeImage src={s.images[0]} alt="" className="h-[72px] w-16 shrink-0" radius="rounded-[50%_50%_8px_8px/40%_40%_8px_8px]" />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-heading text-lg">{s.name}</span>
                    <span className="text-sm text-muted">
                      {hoursText(s.openTime, s.closeTime)} · {s.seats} ที่นั่ง
                    </span>
                    <span className="flex items-center gap-1 text-sm text-ink-2">
                      <Star size={14} className="fill-gold text-gold" aria-hidden />
                      {ratingText(s.avgRating)} · {reviewCountText(s.reviewCount)}
                    </span>
                  </span>
                </button>
              );
            })}
            <p className="hidden text-sm leading-relaxed text-muted lg:block">
              ร้านเหล่านี้แสดงป้าย “ร้านของคุณ” ในหน้าค้นหา และคุณจะรีวิวร้านเหล่านี้ไม่ได้
            </p>
          </nav>

          <section className="flex min-w-0 flex-1 flex-col gap-[18px]">
            <div className="bg-prajamyam flex flex-wrap items-center justify-between gap-4 rounded-xl px-6 py-6 text-cream md:px-7">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-heading text-[28px]">{cur.name}</h2>
                  {cur.crossesMidnight && (
                    <span className="flex items-center gap-1 rounded-sm bg-gold-on-dark px-2.5 py-0.5 text-[13px] font-bold text-indigo">
                      <Moon size={13} aria-hidden />
                      เปิดข้ามเที่ยงคืน
                    </span>
                  )}
                </div>
                {cur.cuisine && <span className="text-base text-[#D9DCEA]">{cur.cuisine}</span>}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/restaurants/${cur.id}`}
                  className="flex min-h-11 items-center rounded-md border border-cream/50 px-4 text-[15px] font-bold text-cream"
                >
                  ดูหน้าร้าน
                </Link>
                <Link
                  href={`/owner/restaurants/${cur.id}/edit`}
                  className="flex min-h-11 items-center gap-1.5 rounded-md bg-cream px-4 text-[15px] font-bold text-indigo"
                >
                  <Pencil size={16} aria-hidden />
                  แก้ไขร้าน
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="คะแนนเฉลี่ย" value={ratingText(cur.avgRating)} unit={reviewCountText(cur.reviewCount)} />
              <Stat label={`การจอง · ${thaiDate(date)}`} value={String(active.length)} unit={`รายการ · ${guests} คน`} />
              <Stat label="ที่นั่ง · เวลาเปิด" value={String(cur.seats)} unit={`ที่ · ${hoursText(cur.openTime, cur.closeTime)}`} />
              <Stat label="ยกเลิกล่วงหน้า" value={String(cur.cancelLeadMinutes)} unit="นาที" />
            </div>

            <DateDomes value={date} onChange={setDate} days={days} />

            <div className="flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ChartColumn size={20} className="text-gold" aria-hidden />
                  <h3 className="font-heading text-xl">ที่นั่งถูกจอง · {thaiDate(date)}</h3>
                </div>
                <span className="text-[15px] text-muted">
                  ช่วงที่แน่นที่สุด {peak}/{cur.seats} ที่
                </span>
              </div>
              {av ? (
                <SeatTimeline availability={av} open={serviceRange(cur.openTime, cur.closeTime).open} height={160} />
              ) : (
                <p className="py-10 text-center text-muted">กำลังโหลด…</p>
              )}
              {cur.crossesMidnight && (
                <p className="flex items-center gap-2 text-sm text-indigo">
                  <Moon size={14} aria-hidden />
                  ช่วงหลัง 00:00 นับเป็นรอบเปิดของคืนเดียวกัน (เวลาปิด {cur.closeTime} คือของวันถัดไป)
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="flex items-center gap-2.5 px-6 pt-[18px] pb-2.5">
                <CalendarDays size={20} className="text-gold" aria-hidden />
                <h3 className="font-heading text-xl">รายการจอง · {thaiDate(date)}</h3>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line-strong text-sm text-muted">
                    <th className="px-3 py-2.5 font-bold md:px-6">เวลา</th>
                    <th className="px-2 py-2.5 font-bold whitespace-nowrap">ลูกค้า</th>
                    <th className="px-2 py-2.5 font-bold whitespace-nowrap">จำนวนคน</th>
                    <th className="px-3 py-2.5 font-bold md:px-6">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted">
                        ยังไม่มีการจองในวันนี้
                      </td>
                    </tr>
                  )}
                  {bookings?.map((b) => {
                    const cancelled = b.status === "cancelled";
                    return (
                      <tr key={b.id} className={cn("border-b border-dashed border-line text-base", cancelled && "text-muted")}>
                        <td className="px-3 py-3.5 font-bold whitespace-nowrap md:px-6">
                          {b.start}–{b.end}
                        </td>
                        <td className="px-2 py-3.5">{b.customerName}</td>
                        <td className="px-2 py-3.5 whitespace-nowrap">{b.partySize} คน</td>
                        <td className="px-3 py-3.5 md:px-6">
                          <StatusBadge status={b.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-[18px] shadow-[inset_0_3px_0_var(--color-gold)]">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
        <span className="font-heading text-[32px]">{value}</span>
        <span className="text-[15px] text-muted">{unit}</span>
      </div>
    </div>
  );
}
