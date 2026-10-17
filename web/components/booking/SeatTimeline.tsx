import type { Availability } from "@/lib/booking";
import { cn } from "@/lib/cn";
import { toHHMM } from "@/lib/format";

// กราฟที่นั่งรายช่อง 30 นาที (div ธรรมดา ไม่ต้องใช้ library กราฟ)
// จองแล้ว = สีทราย · ของคุณ = คราม · เกิน = ชาด + พื้นชมพู · ช่วงที่ผ่านไปแล้ว = จาง · เส้นประบน = เต็มที่นั่ง
export function SeatTimeline({
  availability: av,
  open,
  request,
  height: H = 64, // ความสูงกราฟ (px) = ที่นั่งเต็มร้าน
}: {
  availability: Availability;
  open: number;
  request?: { party: number; inRange: (t: number) => boolean; over: (t: number) => boolean };
  height?: number;
}) {
  // request = การจองที่กำลังเลือกอยู่ (ไม่ส่ง = แสดงแค่ที่จองแล้ว) · inRange/over มาจาก checkSeats ใน lib/booking.ts
  const close = open + av.slots.length * 30; // เวลาปิดคิดจากจำนวนช่องที่ Go ส่งมา → ป้ายท้ายแกนตรงกับข้อมูลเสมอ
  // ป้ายแกนเวลา ~5 จุด
  const step = Math.max(1, Math.round(av.slots.length / 4));
  const ticks = av.slots.map((_, i) => open + i * 30).filter((_, i) => i % step === 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-0.5 border-t border-dashed border-muted" style={{ height: H }} role="img" aria-label="กราฟที่นั่งที่ถูกจองในแต่ละช่วง 30 นาที">
        {av.slots.map((s, i) => {
          const t = open + i * 30;
          // ความสูงแท่ง = สัดส่วนของที่นั่งร้าน · min กับ seats กันแท่งล้นกรอบ (เช่น เจ้าของลดที่นั่งหลังมีคนจองไว้แล้ว)
          const usedH = Math.round((Math.min(s.used, av.seats) / av.seats) * H);
          // ส่วนของเราซ้อนบนส่วนที่จองแล้ว แต่ไม่ให้สูงเกินกรอบ · ส่วนที่เกินแสดงด้วยสีแดง (over) แทน
          const mine = request?.inRange(t) ? Math.max(0, Math.min(Math.round((request.party / av.seats) * H), H - usedH)) : 0;
          const over = request?.over(t) ?? false;
          return (
            <div
              key={s.start}
              title={`${s.start} จองแล้ว ${s.used}/${av.seats} ที่`}
              className={cn(
                "flex h-full flex-1 flex-col justify-end overflow-hidden rounded-[3px]",
                over ? "bg-vermilion-tint ring-2 ring-vermilion" : s.past ? "bg-[#F1E9DA]" : "bg-[#EADFC9]",
              )}
            >
              <div className={over ? "bg-vermilion" : "bg-indigo"} style={{ height: mine }} />
              <div className={s.past ? "bg-[#DDD0B8]" : "bg-seat-booked"} style={{ height: usedH }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted">
        {ticks.map((t) => (
          <span key={t}>{toHHMM(t)}</span>
        ))}
        <span>{toHHMM(close)}</span>
      </div>
      <div className="flex flex-wrap gap-3.5 text-[13px] text-ink-2">
        <Legend className="bg-seat-booked">จองแล้ว</Legend>
        {request && <Legend className="bg-indigo">การจองของคุณ</Legend>}
        {request && <Legend className="bg-vermilion">เกินที่นั่ง</Legend>}
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 border-t border-dashed border-muted" />
          {av.seats} ที่
        </span>
      </div>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[2px]", className)} />
      {children}
    </span>
  );
}
