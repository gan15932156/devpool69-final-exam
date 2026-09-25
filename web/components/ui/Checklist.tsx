import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type CheckItem = { ok: boolean; text: string };

// รายการ ✓/✕ — สื่อด้วยไอคอน + ข้อความ ไม่ใช่สีอย่างเดียว (HANDOFF §8)
// tone="neutral": ยังไม่ผ่าน = เทา (เช่น เงื่อนไขรหัสผ่านตอนกำลังพิมพ์)
// tone="strict":  ยังไม่ผ่าน = ชาด (เช่น เงื่อนไขการจอง)
export function Checklist({
  items,
  label,
  tone = "strict",
  className,
}: {
  items: CheckItem[];
  label: string;
  tone?: "neutral" | "strict";
  className?: string;
}) {
  return (
    <ul aria-label={label} className={className ?? "flex flex-col gap-2"}>
      {items.map((item) => (
        <li
          key={item.text}
          className={cn(
            "flex items-start gap-2 text-sm",
            item.ok ? "text-success" : tone === "strict" ? "text-vermilion" : "text-muted",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full text-cream",
              item.ok ? "bg-success" : tone === "strict" ? "bg-vermilion" : "bg-line-strong",
            )}
          >
            {item.ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
          </span>
          <span>
            <span className="sr-only">{item.ok ? "ผ่าน: " : "ยังไม่ผ่าน: "}</span>
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
