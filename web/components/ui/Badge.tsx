import { Moon } from "lucide-react";
import { cn } from "@/lib/cn";

// ป้าย 3 แบบจากดีไซน์ (HANDOFF §5)
export function OwnBadge() {
  return <span className="rounded-sm bg-ink px-2.5 py-1 text-[13px] font-semibold text-cream">ร้านของคุณ</span>;
}

export function LateNightBadge() {
  return (
    <span className="flex items-center gap-1 rounded-sm bg-indigo px-2.5 py-1 text-[13px] font-semibold text-cream">
      <Moon size={13} aria-hidden />
      เปิดข้ามเที่ยงคืน
    </span>
  );
}

export function FewReviewsBadge() {
  return <span className="rounded-sm bg-gold-tint px-2 py-0.5 text-[13px] font-bold text-gold-text">รีวิวยังน้อย</span>;
}

// สถานะการจอง: ยืนยันแล้ว / ผ่านไปแล้ว / ยกเลิกแล้ว
const STATUS = {
  confirmed: { text: "ยืนยันแล้ว", className: "bg-success-tint text-success" },
  past: { text: "ผ่านไปแล้ว", className: "bg-paper text-ink-2" },
  cancelled: { text: "ยกเลิกแล้ว", className: "bg-[#EDE3D2] text-muted" },
};

export function StatusBadge({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status];
  return <span className={cn("rounded-sm px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap", s.className)}>{s.text}</span>;
}
