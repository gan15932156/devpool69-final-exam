"use client";

import { ArrowLeft, Clock, Moon, Store, Timer, Users } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookingTicket } from "@/components/booking/BookingTicket";
import { ReviewsSection } from "@/components/review/ReviewsSection";
import { LateNightBadge } from "@/components/ui/Badge";
import { DomeImage } from "@/components/ui/DomeImage";
import { Prajamyam } from "@/components/ui/Prajamyam";
import { RatingSeal } from "@/components/ui/RatingSeal";
import { ApiError } from "@/lib/api";
import { durationText, hoursText, reviewCountText } from "@/lib/format";
import { useRestaurant } from "@/lib/use-api";

// หน้าร้าน = ข้อมูลร้าน + ใบจอง + รีวิว · ดึงข้อมูลฝั่ง client → จอง/รีวิวแล้ว invalidate ตัวเลขบนหน้าก็อัปเดตเอง
export function RestaurantView({ id }: { id: number }) {
  const { data: session } = useSession();
  const { data: r, error, isPending } = useRestaurant(id);

  if (isPending) return <p className="py-20 text-center text-muted">กำลังโหลดร้าน…</p>;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <p className="font-heading text-2xl">{notFound ? "ไม่พบร้านนี้" : "โหลดข้อมูลร้านไม่สำเร็จ"}</p>
        <Link href="/" className="mt-4 inline-block font-semibold text-indigo underline">
          กลับไปหน้าค้นหา
        </Link>
      </div>
    );
  }

  // เทียบเป็น string เพราะ session.user.id ของ NextAuth เป็น string · ใช้แค่โชว์แถบเจ้าของ (สิทธิ์จริง Go เช็กเองทุกครั้ง)
  const isOwner = session?.user.id === String(r.ownerId);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pt-4 pb-10 md:gap-6 md:px-8 md:pt-6 md:pb-[72px] xl:px-0">
      <Link href="/" className="flex min-h-11 items-center gap-2 self-start text-base font-semibold">
        <ArrowLeft size={20} aria-hidden />
        กลับไปหน้าค้นหา
      </Link>

      {isOwner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-ink px-5 py-3.5 text-cream">
          <span className="flex items-center gap-2.5 text-base font-medium">
            <Store size={20} aria-hidden />
            คุณเป็นเจ้าของร้านนี้ · ลูกค้าเห็นหน้านี้แบบเดียวกัน ยกเว้นส่วนรีวิว
          </span>
          <Link
            href={`/owner/restaurants/${r.id}/edit`}
            className="flex min-h-[42px] items-center rounded-full bg-cream px-[18px] text-[15px] font-bold text-ink"
          >
            แก้ไขร้าน
          </Link>
        </div>
      )}

      {/* รูป: จอเล็กกว่า 1024 แสดงรูปหลักรูปเดียว · desktop แสดง 3 รูปแบบ 2:1:1 */}
      <div className="grid h-[240px] gap-4 md:h-[380px] lg:grid-cols-[2fr_1fr_1fr]">
        <DomeImage src={r.images[0]} alt={r.name} priority radius="rounded-[50%_50%_12px_12px/30%_30%_12px_12px]" />
        {[1, 2].map((i) => (
          <DomeImage
            key={i}
            src={r.images[i]}
            alt=""
            radius="rounded-[50%_50%_12px_12px/22%_22%_12px_12px]"
            className="hidden lg:block"
          />
        ))}
      </div>

      {/* grid: มือถือเรียง ข้อมูลร้าน → ใบจอง → รีวิว · desktop ใบจองอยู่คอลัมน์ขวา */}
      <div className="mt-2 grid gap-10 lg:grid-cols-[minmax(0,1fr)_470px] lg:gap-x-12">
        <section className="flex flex-col gap-3.5 lg:col-start-1 lg:row-start-1">
          {r.cuisine && (
            <p className="flex items-center gap-2 text-[15px] font-bold tracking-[0.04em] text-gold-text">
              <Prajamyam size={16} />
              {r.cuisine}
            </p>
          )}
          <div className="flex items-center justify-between gap-6">
            <h1 className="font-heading text-[32px] leading-tight tracking-[-0.01em] md:text-[54px]">{r.name}</h1>
            <RatingSeal
              avg={r.avgRating}
              count={r.reviewCount}
              enough={r.hasEnoughReviews}
              size="lg"
              caption={reviewCountText(r.reviewCount)}
            />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Chip icon={<Users size={16} />}>{r.seats} ที่นั่ง</Chip>
            <Chip icon={<Clock size={16} />}>เปิด {hoursText(r.openTime, r.closeTime)} ทุกวัน</Chip>
            <Chip icon={<Timer size={16} />}>ยกเลิกล่วงหน้า {durationText(r.cancelLeadMinutes)}</Chip>
            {r.crossesMidnight && <LateNightBadge />}
          </div>
          {r.crossesMidnight && (
            <p className="flex items-start gap-2.5 rounded-[10px] border border-[#B9C0DA] bg-indigo-tint px-4 py-3 text-[15px] leading-relaxed text-[#1A2450]">
              <Moon size={18} className="mt-0.5 shrink-0" aria-hidden />
              ร้านปิดหลังเที่ยงคืน — ช่วงหลัง 00:00 นับเป็นรอบของคืนเดียวกัน เช่น จองคืนวันศุกร์ได้ถึง {r.closeTime} เช้าวันเสาร์
            </p>
          )}
          {r.description && (
            <p className="mt-1.5 max-w-[680px] text-lg leading-[1.8] whitespace-pre-line text-ink-2">{r.description}</p>
          )}
        </section>

        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <BookingTicket restaurant={r} />
        </aside>
        <div className="lg:col-start-1 lg:row-start-2">
          <ReviewsSection restaurant={r} />
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 py-2 text-[15px]">
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}
