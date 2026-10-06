import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

// โลโก้ตราชาด + ชื่อ · tone="dark" ใช้บนพื้นคราม (ตัวอักษรครีม)
export function Logo({ tagline = false, tone = "light" }: { tagline?: boolean; tone?: "light" | "dark" }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 md:gap-3", tone === "dark" ? "text-cream" : "text-ink")}>
      <Image src="/design/logo-seal.svg" alt="" width={44} height={44} className="size-[34px] md:size-11" />
      <span className="flex flex-col leading-tight">
        <span className="font-heading text-[22px] tracking-[-0.01em] md:text-[26px]">ตึกตึกโต๊ะ</span>
        {tagline && <span className="hidden text-xs tracking-[0.06em] text-muted md:block">จองโต๊ะ · รีวิวร้าน</span>}
      </span>
    </Link>
  );
}
