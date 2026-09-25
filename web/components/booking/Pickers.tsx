"use client";

import { timeOptions, type nextDays } from "@/lib/booking";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/ui/Field";

// หัวข้อขั้นตอน ๑ ๒ ๓ ในวงกลมขอบชาด (เลขไทยใช้เฉพาะลำดับขั้นตอน)
export function StepLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 font-heading text-[17px]">
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-vermilion text-base text-vermilion">
        {n}
      </span>
      {children}
    </span>
  );
}

// ปุ่มเลือกวันที่ทรงซุ้มเล็ก 5 วัน (วันนี้ + 4)
export function DateDomes({ value, onChange, days }: { value: string; onChange: (iso: string) => void; days: ReturnType<typeof nextDays> }) {
  return (
    <div role="group" aria-label="เลือกวันที่" className="grid grid-cols-5 gap-2">
      {days.map((d) => {
        const on = d.iso === value;
        return (
          <button
            key={d.iso}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(d.iso)}
            className={cn(
              "flex min-h-[70px] flex-col items-center justify-center gap-px rounded-[40px_40px_8px_8px/22px_22px_8px_8px] border py-1.5",
              on ? "border-indigo bg-indigo text-cream" : "border-line-strong bg-surface text-ink",
            )}
          >
            <span className="text-[13px]">{d.dow}</span>
            <span className="font-heading text-[22px] leading-tight">{d.day}</span>
            <span className="text-[11px]">{d.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

// เลือกเวลาเริ่ม–สิ้นสุดทีละ 30 นาที · ร้านข้ามเที่ยงคืนรายการต่อไปถึงหลัง 00:00
// ใช้ <select> แทน <input type="time"> เพื่อให้เลือกได้แค่เวลาที่ลง :00/:30 และอยู่ในเวลาเปิด
export function TimeRangeSelect({
  open,
  close,
  start,
  end,
  onChange,
  isPast,
}: {
  open: number;
  close: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  isPast: (minutes: number) => boolean;
}) {
  const starts = timeOptions(open, close - 30);
  const ends = timeOptions(start + 30, close);
  return (
    <div className="flex items-end gap-2.5">
      <label className="flex flex-1 flex-col gap-1.5 text-sm text-muted">
        เริ่ม
        <select
          value={start}
          onChange={(e) => {
            const s = Number(e.target.value);
            // เลื่อนเวลาเริ่ม → คงระยะเวลาเดิมไว้ ถ้าเกินเวลาปิดให้ชนเวลาปิด
            onChange(s, Math.min(close, Math.max(s + 30, s + (end - start))));
          }}
          className={inputClass(false, "h-[50px] px-3")}
        >
          {starts.map((o) => (
            <option key={o.minutes} value={o.minutes} disabled={isPast(o.minutes)}>
              {o.label}
              {isPast(o.minutes) ? " (ผ่านแล้ว)" : ""}
            </option>
          ))}
        </select>
      </label>
      <span className="pb-3 text-muted">–</span>
      <label className="flex flex-1 flex-col gap-1.5 text-sm text-muted">
        สิ้นสุด
        <select value={end} onChange={(e) => onChange(start, Number(e.target.value))} className={inputClass(false, "h-[50px] px-3")}>
          {ends.map((o) => (
            <option key={o.minutes} value={o.minutes}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
