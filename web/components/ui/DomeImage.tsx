import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/cn";

// รูปทรงซุ้ม (dome) ใช้กับรูปร้านทุกที่ · ไม่มีรูป → กล่องสีทรายพร้อมไอคอน
// unoptimized: รูปมาจาก /uploads ของ Go ผ่าน rewrite จึงไม่ต้องให้ Next ย่อรูปซ้ำ
export function DomeImage({
  src,
  alt,
  className,
  radius = "rounded-dome",
  priority,
}: {
  src?: string;
  alt: string;
  className?: string;
  radius?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#D9B98C] shadow-[inset_0_0_0_1px_rgba(35,24,18,0.14)]",
        radius,
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={alt} fill unoptimized priority={priority} sizes="100vw" className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-ink/40">
          <ImageIcon size={40} aria-hidden />
        </div>
      )}
    </div>
  );
}
