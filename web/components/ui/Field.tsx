import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// ป้าย + ช่องกรอก + ข้อความใต้ช่อง (error สีชาด หรือ hint สีจาง)
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[15px] font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-vermilion">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function inputClass(invalid?: boolean, className?: string) {
  return cn(
    "h-[52px] w-full rounded-md border bg-surface px-3.5 text-[17px] text-ink placeholder:text-muted/60",
    invalid ? "border-vermilion" : "border-line-strong",
    className,
  );
}

export function Input({ invalid, className, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
      className={inputClass(invalid, className)}
      {...props}
    />
  );
}

// กล่อง error รวมของฟอร์ม (สิ่งที่ไม่ได้ผูกกับช่องใดช่องหนึ่ง)
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-vermilion bg-vermilion-tint px-4 py-3 text-[15px] text-vermilion">
      {children}
    </p>
  );
}
