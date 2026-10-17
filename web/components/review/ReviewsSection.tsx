"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Star } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ApiError } from "@/lib/api";
import { thaiDate } from "@/lib/booking";
import { cn } from "@/lib/cn";
import { initialOf, ratingText, reviewCountText } from "@/lib/format";
import type { RestaurantDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

// คำตอบของ GET /restaurants/:id/reviews · isMine = Go บอกว่ารีวิวนี้เป็นของคนที่ login (หน้าเว็บไม่ต้องเทียบ id เอง)
type Review = { id: number; rating: number; comment: string; userName: string; isMine: boolean; createdAt: string; updatedAt: string };
// total = จำนวนรีวิวทั้งหมด (ใช้รู้ว่ายังมีหน้าถัดไปไหม) · mine = รีวิวของฉัน ส่งมาเฉพาะหน้าแรก (offset=0)
type ReviewPage = { total: number; items: Review[]; mine: Review | null };

// ป้ายคะแนนตามดีไซน์ (Restaurant.dc.html บรรทัด 368)
const LABELS = ["แตะดาวเพื่อให้คะแนน", "1 ดาว — แย่", "2 ดาว — พอใช้", "3 ดาว — ดี", "4 ดาว — ดีมาก", "5 ดาว — ยอดเยี่ยม"];

function Stars({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${value} จาก 5 ดาว`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} aria-hidden className={n <= Math.round(value) ? "fill-gold text-gold" : "text-[#9C8A70]"} />
      ))}
    </span>
  );
}

export function ReviewsSection({ restaurant: r }: { restaurant: RestaurantDetail }) {
  const api = useApi();
  const { data: session } = useSession();
  const isOwner = session?.user.id === String(r.ownerId);

  // รีวิวทีละหน้า 20 รายการ · กด "ดูเพิ่ม" โหลดหน้าถัดไป
  const reviews = useInfiniteQuery({
    queryKey: ["reviews", r.id],
    queryFn: ({ pageParam }) => api<ReviewPage>(`/api/v1/restaurants/${r.id}/reviews?offset=${pageParam}`),
    initialPageParam: 0,
    // offset หน้าถัดไป = จำนวนที่โหลดมาแล้ว · ครบ total → undefined = ไม่มีหน้าถัดไป (ซ่อนปุ่ม "ดูเพิ่ม")
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const items = reviews.data?.pages.flatMap((p) => p.items) ?? []; // รวมทุกหน้าที่โหลดแล้วเป็นรายการเดียว
  const mine = reviews.data?.pages[0]?.mine ?? null; // Go ส่ง mine มาแค่หน้าแรก

  // แท่งการกระจายดาวเทียบกับดาวที่มีคนให้มากที่สุด (ไม่ใช่จำนวนรวม) → แท่งยาวสุดเต็มความกว้างพอดี · max ≥ 1 กันหารศูนย์ตอนยังไม่มีรีวิว
  const max = Math.max(1, ...Object.values(r.distribution));

  return (
    <section id="review" aria-labelledby="reviews-title" className="flex scroll-mt-6 flex-col gap-5">
      <SectionHeading id="reviews-title">รีวิวจากลูกค้า</SectionHeading>

      {/* สรุปคะแนน + การกระจายดาว */}
      <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface px-5 py-6 sm:flex-row sm:items-center sm:gap-8 md:px-7">
        <div className="flex w-[170px] shrink-0 flex-col gap-2">
          <span className="font-heading text-[60px] leading-none">{ratingText(r.avgRating)}</span>
          <Stars value={r.avgRating ?? 0} />
          <span className="text-[15px] text-muted">
            {r.reviewCount > 0 ? `เฉลี่ยจาก ${reviewCountText(r.reviewCount)}` : "ยังไม่มีรีวิว"}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = r.distribution[star] ?? 0;
            return (
              <div key={star} className="flex items-center gap-3 text-[15px]">
                <span className="w-12 text-ink-2">{star} ดาว</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-[5px] bg-[#EFE3CC]">
                  <div className="h-2.5 rounded-[5px] bg-gold" style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <span className="w-9 text-right text-muted">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {!session ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-line-strong bg-surface px-7 py-5">
          <span className="text-ink-2">เข้าสู่ระบบเพื่อเขียนรีวิว</span>
          <ButtonLink href={`/login?callbackUrl=/restaurants/${r.id}%23review`} variant="outline">
            เข้าสู่ระบบ
          </ButtonLink>
        </div>
      ) : isOwner ? (
        // เจ้าของเห็นกล่องล็อกแทนฟอร์ม · ถึงยิง API ตรงก็ได้ 403 OWN_RESTAURANT
        <div className="flex items-center gap-4 rounded-xl border border-dashed border-line-strong bg-[#EFE3CC] px-7 py-[22px]">
          <span className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-surface text-ink-2">
            <Lock size={20} aria-hidden />
          </span>
          <div>
            <div className="font-heading text-lg">รีวิวร้านของตัวเองไม่ได้</div>
            <div className="mt-0.5 text-base text-ink-2">ร้านนี้เป็นของคุณ คะแนนและรีวิวมาจากลูกค้าเท่านั้น</div>
          </div>
        </div>
      ) : (
        // แสดงฟอร์มหลังโหลดรีวิวเสร็จ → ค่าเริ่มต้นของฟอร์มเป็นรีวิวเดิม (ถ้ามี)
        !reviews.isPending && <ReviewForm restaurantId={r.id} mine={mine} />
      )}

      <div className="flex flex-col">
        {items.map((rv) => (
          <article key={rv.id} className="flex flex-col gap-2.5 border-b border-dashed border-line-strong py-[22px]">
            <div className="flex items-center gap-3">
              <span className="flex size-[42px] items-center justify-center rounded-full bg-[#B9C7A0] font-heading text-[17px]">
                {initialOf(rv.userName)}
              </span>
              <div className="flex-1">
                <div className="text-base font-semibold">
                  {rv.userName}
                  {rv.isMine && <span className="ml-2 text-sm font-normal text-muted">(รีวิวของคุณ)</span>}
                </div>
                <div className="text-sm text-muted">{thaiDate(rv.updatedAt.slice(0, 10), false)}</div>
              </div>
              <Stars value={rv.rating} size={16} />
            </div>
            {rv.comment && <p className="text-[17px] leading-[1.7] whitespace-pre-line text-ink-2">{rv.comment}</p>}
          </article>
        ))}
        {reviews.hasNextPage && (
          <Button variant="outline" className="mt-4 self-center" disabled={reviews.isFetchingNextPage} onClick={() => reviews.fetchNextPage()}>
            {reviews.isFetchingNextPage ? "กำลังโหลด…" : "ดูรีวิวเพิ่ม"}
          </Button>
        )}
      </div>
    </section>
  );
}

function ReviewForm({ restaurantId, mine }: { restaurantId: number; mine: Review | null }) {
  const api = useApi();
  const queryClient = useQueryClient();
  // ค่าเริ่มต้น = รีวิวเดิม (ถ้ามี) → ฟอร์มเดียวใช้ได้ทั้งเขียนใหม่และแก้ไข · rating 0 = ยังไม่เลือกดาว (ปุ่มโพสต์กดไม่ได้)
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [done, setDone] = useState(false); // โชว์ "บันทึกแล้ว" · แตะดาว/พิมพ์ใหม่ → ล้าง เพราะค่าบนจอไม่ใช่ค่าที่บันทึกแล้ว

  const post = useMutation({
    // PUT .../reviews/me = upsert: ยังไม่มีรีวิว → สร้าง · มีแล้ว → แก้ของเดิม (1 คน 1 รีวิวต่อร้าน บังคับด้วย unique ที่ DB)
    mutationFn: () => api(`/api/v1/restaurants/${restaurantId}/reviews/me`, { method: "PUT", json: { rating, comment } }),
    onSuccess: async () => {
      setDone(true);
      // ค่าเฉลี่ย/จำนวนรีวิวเปลี่ยน → โหลดหน้าร้าน รายการร้าน และรายการรีวิวใหม่
      // my-bookings ด้วย → ป้าย "รีวิวแล้ว" ในหน้าการจองของฉันอัปเดตตาม
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reviews", restaurantId] }),
        queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] }),
        queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
      ]);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        post.mutate();
      }}
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface px-5 py-6 md:px-7"
    >
      <h3 className="font-heading text-xl">{mine ? "แก้ไขรีวิวของคุณ" : "เขียนรีวิวของคุณ"}</h3>
      <div className="flex flex-wrap items-center gap-4">
        <div role="group" aria-label="ให้คะแนน 1 ถึง 5 ดาว" className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`ให้ ${n} ดาว`}
              aria-pressed={n === rating}
              onClick={() => {
                setRating(n);
                setDone(false);
              }}
              className="flex size-12 items-center justify-center rounded-md"
            >
              <Star size={32} aria-hidden className={n <= rating ? "fill-gold text-gold" : "text-[#9C8A70]"} />
            </button>
          ))}
        </div>
        <span aria-live="polite" className="text-base text-ink-2">
          {LABELS[rating]}
        </span>
      </div>
      <label htmlFor="review-text" className="sr-only">
        ข้อความรีวิว
      </label>
      <textarea
        id="review-text"
        rows={4}
        value={comment}
        maxLength={1000}
        onChange={(e) => {
          setComment(e.target.value);
          setDone(false);
        }}
        placeholder="เล่าประสบการณ์ อาหาร บริการ บรรยากาศ"
        className={inputClass(false, "h-auto bg-paper py-3.5 leading-relaxed")}
      />
      {post.error && (
        <p role="alert" className="text-[15px] text-vermilion">
          {post.error instanceof ApiError ? post.error.message : "โพสต์รีวิวไม่สำเร็จ"}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className={cn("text-[15px]", done ? "font-bold text-success" : "text-muted")}>
          {done ? "บันทึกรีวิวแล้ว ขอบคุณครับ" : "ต้องเลือกดาว 1–5 ดวง · ข้อความไม่บังคับ"}
        </span>
        <Button type="submit" disabled={rating === 0 || post.isPending}>
          {post.isPending ? "กำลังโพสต์…" : mine ? "บันทึกรีวิว" : "โพสต์รีวิว"}
        </Button>
      </div>
    </form>
  );
}
