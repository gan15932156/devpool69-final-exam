import type { ReactNode } from "react";
import { Prajamyam } from "./Prajamyam";

// หัวข้อส่วน: ประจำยามทอง + h2 + เส้นทองยืดจนสุดแถว
export function SectionHeading({ id, children, extra }: { id?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Prajamyam className="shrink-0 text-gold" />
      <h2 id={id} className="font-heading text-2xl md:text-[30px]">
        {children}
      </h2>
      {extra}
      <span aria-hidden className="h-px flex-1 bg-line-strong" />
    </div>
  );
}
