"use client";

import { Minus, Plus } from "lucide-react";

// ปุ่ม − ค่า + · ปุ่ม − ปิดเมื่อถึงค่าต่ำสุด · ปุ่ม + ปิดเมื่อถึงค่าสูงสุด
export function Stepper({
  value,
  onChange,
  min,
  max = Infinity,
  step = 1,
  format = String,
  decreaseLabel,
  increaseLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const btn =
    "flex size-[50px] shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink disabled:cursor-not-allowed disabled:text-line-strong";
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        aria-label={decreaseLabel}
        className={btn}
        disabled={value - step < min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Minus size={20} aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-[120px] text-center font-heading text-[26px]">
        {format(value)}
      </output>
      <button
        type="button"
        aria-label={increaseLabel}
        className={btn}
        disabled={value + step > max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Plus size={20} aria-hidden />
      </button>
    </div>
  );
}
