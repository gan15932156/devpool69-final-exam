"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Search, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { Prajamyam } from "@/components/ui/Prajamyam";
import { Segmented } from "@/components/ui/Segmented";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useApi } from "@/lib/use-api";
import type { Restaurant } from "@/lib/types";

export type SortKey = "rating" | "reviews";

export function RestaurantSearch({ initialQ, initialSort }: { initialQ: string; initialSort: SortKey }) {
  const api = useApi();
  const router = useRouter();
  const { data: session } = useSession();
  const [text, setText] = useState(initialQ); // สิ่งที่กำลังพิมพ์
  const [q, setQ] = useState(initialQ); // คำที่ใช้ค้นจริง (หน่วง 300ms)
  const [sort, setSort] = useState<SortKey>(initialSort);

  // พิมพ์หยุด 300ms ค่อยค้น — ไม่ยิง API ทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  // เก็บค่าไว้ใน URL → reload / แชร์ลิงก์ แล้วได้ผลเดิม
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort !== "rating") params.set("sort", sort);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [q, sort, router]);

  // queryKey เปลี่ยน (q หรือ sort เปลี่ยน) → TanStack Query ยิงใหม่ให้เอง
  const { data, isPending, isError } = useQuery({
    queryKey: ["restaurants", q, sort],
    queryFn: () => api<Restaurant[]>(`/api/v1/restaurants?${new URLSearchParams({ q, sort })}`),
  });

  const myId = session?.user.id;

  return (
    <>
      <section className="bg-prajamyam text-cream">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-7 md:gap-4 md:px-8 md:pt-[60px] md:pb-[68px] xl:px-0">
          <p className="flex items-center gap-2.5 text-sm font-semibold tracking-[0.06em] text-gold-on-dark md:text-[15px]">
            <Prajamyam size={18} />
            จองโต๊ะร้านโปรด · อ่านรีวิวจากคนกินจริง
          </p>
          <h1 className="font-heading text-[32px] leading-[1.3] tracking-[-0.01em] md:text-[56px]">
            หาโต๊ะว่าง
            <br />
            ร้านอร่อยที่คนรีวิวจริง
          </h1>
          <p className="max-w-[620px] text-base leading-relaxed text-[#D9DCEA] md:text-lg">
            เลือกร้าน กรอกจำนวนคน วันที่ และเวลา แล้วรู้ทันทีว่าที่นั่งพอไหม
          </p>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(text.trim()); // กดค้นหา = ค้นทันทีไม่ต้องรอ
            }}
            className="mt-1.5 flex max-w-[760px] gap-2 md:mt-3 md:gap-3 md:rounded-[14px] md:border md:border-gold-on-dark/45 md:bg-cream/12 md:p-2"
          >
            <label htmlFor="q" className="sr-only">
              ค้นหาร้าน
            </label>
            <div className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-[10px] bg-surface px-3.5 text-muted md:h-[52px] md:px-4">
              <Search size={20} aria-hidden />
              <input
                id="q"
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="ชื่อร้าน หรือประเภทอาหาร"
                className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none md:text-[17px]"
              />
            </div>
            <button type="submit" className="h-[50px] rounded-[10px] bg-vermilion px-5 text-base font-bold text-cream md:h-[52px] md:px-[30px] md:text-[17px]">
              ค้นหา
            </button>
          </form>
        </div>
      </section>
      <div className="band-kruay-choeng-red" aria-hidden />

      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pt-6 pb-10 md:gap-[22px] md:px-8 md:pt-12 md:pb-[72px] xl:px-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[200px] flex-1">
            <SectionHeading extra={data && <span className="mt-1.5 text-[15px] text-muted">{data.length} ร้าน</span>}>
              {q ? `ผลการค้นหา “${q}”` : "ร้านทั้งหมด"}
            </SectionHeading>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[15px] text-muted sm:inline">เรียงตาม</span>
            <Segmented
              label="เรียงร้าน"
              value={sort}
              onChange={setSort}
              options={[
                { value: "rating", label: "คะแนนสูงสุด", icon: <Star size={16} aria-hidden /> },
                { value: "reviews", label: "รีวิวมากที่สุด", icon: <MessageSquare size={16} aria-hidden /> },
              ]}
            />
          </div>
        </div>
        <p className="text-[15px] text-muted">
          {sort === "rating"
            ? "เรียงจากค่าเฉลี่ยมากไปน้อย · ร้านที่มีน้อยกว่า 5 รีวิวจะแสดงท้ายรายการ"
            : "เรียงจากจำนวนรีวิวมากไปน้อย"}
        </p>

        {isPending && <p className="py-10 text-center text-muted">กำลังโหลดร้าน…</p>}
        {isError && <p className="py-10 text-center text-vermilion">โหลดรายการร้านไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>}
        {data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-muted">
            ไม่พบร้านที่ตรงกับ “{q}” · ลองคำอื่น เช่น ชื่อร้าน หรือประเภทอาหาร
          </p>
        )}
        {data && data.length > 0 && (
          <div className="mt-2 grid gap-5 md:grid-cols-2 md:gap-7 lg:grid-cols-3">
            {data.map((r) => (
              <RestaurantCard key={r.id} restaurant={r} isOwn={String(r.ownerId) === myId} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
