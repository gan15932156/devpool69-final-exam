"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string; icon?: ReactNode };

// ปุ่มเลือกแบบกลุ่ม (เช่น เรียงตามคะแนน / รีวิวมากสุด) · ตัวที่เลือก = พื้นคราม ตัวครีม
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-full border border-line-strong bg-surface p-1">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-bold md:px-5",
              on ? "bg-indigo text-cream" : "text-ink-2 hover:bg-paper",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
