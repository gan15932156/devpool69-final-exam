import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "cta" | "outline" | "outline-red";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-indigo text-cream hover:bg-indigo/90", // ปุ่มหลัก (คราม)
  cta: "bg-vermilion text-cream hover:bg-vermilion/90", // CTA รอง (ชาด) เช่น สร้างร้าน
  outline: "border border-line-strong bg-surface text-ink hover:border-ink-2",
  "outline-red": "border border-vermilion bg-surface text-vermilion hover:bg-vermilion-tint", // ปุ่มรองสีชาด / ปุ่มลบ
};

const sizes: Record<Size, string> = {
  sm: "min-h-11 px-4 text-[15px]",
  md: "min-h-[46px] px-5 text-base",
  lg: "min-h-[54px] px-6 text-[17px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors",
    "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-fg",
    variants[variant],
    sizes[size],
    className,
  );
}

type Style = { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & Style) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

// ลิงก์ที่หน้าตาเหมือนปุ่ม
export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & Style) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
