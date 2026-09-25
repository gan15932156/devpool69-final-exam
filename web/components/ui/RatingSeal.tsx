import { cn } from "@/lib/cn";
import { ratingText } from "@/lib/format";

const sizes = {
  sm: { box: "size-11", num: "text-base", sub: "text-[9px]" }, // 44px มือถือ
  md: { box: "size-16", num: "text-[22px]", sub: "text-[11px]" }, // 64px การ์ด
  lg: { box: "size-[88px]", num: "text-[30px]", sub: "text-xs" }, // 88px หน้าร้าน
};

// ตราคะแนนวงกลม · ร้านที่รีวิวยังน้อยใช้สีน้ำตาลแทนชาด
export function RatingSeal({
  avg,
  count,
  enough,
  size = "md",
  caption = "คะแนน",
  className,
}: {
  avg: number | null;
  count: number;
  enough: boolean;
  size?: keyof typeof sizes;
  caption?: string;
  className?: string;
}) {
  const s = sizes[size];
  const color = enough ? "var(--color-vermilion)" : "var(--color-low-review-seal)";
  return (
    <div
      role="img"
      aria-label={avg === null ? "ยังไม่มีรีวิว" : `คะแนนเฉลี่ย ${ratingText(avg)} จาก ${count} รีวิว`}
      className={cn("flex shrink-0 flex-col items-center justify-center rounded-full text-cream", s.box, className)}
      style={{
        background: color,
        boxShadow: `inset 0 0 0 3px ${color}, inset 0 0 0 4px rgba(251, 245, 234, 0.7)`,
      }}
    >
      <span className={cn("font-heading leading-none", s.num)}>{ratingText(avg)}</span>
      <span className={cn("leading-snug", s.sub)}>{caption}</span>
    </div>
  );
}
