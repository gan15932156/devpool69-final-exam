"use client";

import { Lock } from "lucide-react";
import { RestaurantForm } from "@/components/restaurant/RestaurantForm";
import { useRestaurant } from "@/lib/use-api";

// myId มาจาก session ที่ page.tsx (server) อ่านไว้ · โหลดร้านด้วย key เดียวกับหน้าร้าน → เปิดจากหน้าร้านมาก็ไม่ต้องโหลดซ้ำ
export function EditRestaurant({ id, myId }: { id: number; myId: number }) {
  const { data, error, isPending } = useRestaurant(id);

  if (isPending) return <p className="py-10 text-muted">กำลังโหลด…</p>;
  if (error) return <p className="py-10 text-vermilion">{error.message}</p>;

  // ซ่อนฟอร์มเพื่อ UX เท่านั้น — ถึงจะยิง PUT ตรงไป Go ก็ได้ 403 อยู่ดี
  if (data.ownerId !== myId) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-dashed border-line-strong bg-[#EFE3CC] px-7 py-6">
        <Lock size={22} aria-hidden />
        <div>
          <p className="font-heading text-lg">ไม่มีสิทธิ์แก้ไขร้านนี้</p>
          <p className="text-ink-2">แก้ไขได้เฉพาะร้านที่คุณเป็นเจ้าของ</p>
        </div>
      </div>
    );
  }
  return <RestaurantForm initial={data} ownerId={myId} />;
}
