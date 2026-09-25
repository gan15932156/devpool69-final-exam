"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Checklist } from "@/components/ui/Checklist";
import { Field, FormAlert, Input } from "@/components/ui/Field";
import { ApiError, request } from "@/lib/api";
import { cn } from "@/lib/cn";
import { registerSchema, type RegisterValues } from "@/lib/schemas/auth";

export function RegisterForm() {
  const [wantsShop, setWantsShop] = useState(false);
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirm: "", agree: false },
  });

  // useWatch = ค่าปัจจุบันของฟอร์ม เปลี่ยนทุกครั้งที่พิมพ์ → ใช้ทำ checklist แบบสด
  const values = useWatch({ control });
  const pw = values.password ?? "";
  const rules = [
    { ok: pw.length >= 8, text: "อย่างน้อย 8 ตัว" },
    { ok: /[0-9]/.test(pw), text: "มีตัวเลข" },
    { ok: !!values.confirm && values.confirm === pw, text: "ยืนยันตรงกัน" },
  ];
  const ready = registerSchema.safeParse(values).success;

  async function onSubmit({ name, email, password }: RegisterValues) {
    setFormError("");
    try {
      // ยิงผ่าน rewrite ของ Next → Go
      await request("/api/v1/auth/register", { method: "POST", json: { name, email, password } });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      if (e.code === "EMAIL_TAKEN") {
        setError("email", { message: e.message });
      } else if (Object.keys(e.fieldErrors).length > 0) {
        // Go ตอบ { details: { ชื่อช่อง: ข้อความ } } → เอาไปแสดงใต้ช่องนั้น
        for (const [field, message] of Object.entries(e.fieldErrors)) {
          setError(field as keyof RegisterValues, { message });
        }
      } else {
        setFormError(e.message);
      }
      return;
    }

    // สมัครเสร็จ → login ต่อทันทีด้วยอีเมล/รหัสเดิม
    await signIn("credentials", { email, password, redirect: false });
    window.location.assign(wantsShop ? "/owner/restaurants/new" : "/");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">
      <div>
        <h2 className="font-heading text-[28px] tracking-[-0.01em] md:text-[34px]">สร้างบัญชี</h2>
        <p className="mt-1 text-base text-muted">ไม่ต้องเลือกบทบาท — บัญชีนี้ใช้จอง รีวิว และเปิดร้านได้ในที่เดียว</p>
      </div>

      {formError && <FormAlert>{formError}</FormAlert>}

      <Field label="ชื่อที่แสดง" htmlFor="name" error={errors.name?.message} hint="ชื่อนี้จะแสดงคู่กับรีวิวของคุณ">
        <Input id="name" autoComplete="name" placeholder="ชื่อที่จะแสดงในรีวิว" invalid={!!errors.name} {...register("name")} />
      </Field>
      <Field label="อีเมล" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" invalid={!!errors.email} {...register("email")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="รหัสผ่าน" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="อย่างน้อย 8 ตัว"
            invalid={!!errors.password}
            {...register("password")}
          />
        </Field>
        <Field label="ยืนยันรหัสผ่าน" htmlFor="confirm" error={errors.confirm?.message}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="พิมพ์ซ้ำ"
            invalid={!!errors.confirm}
            {...register("confirm")}
          />
        </Field>
      </div>

      <Checklist
        label="เงื่อนไขรหัสผ่าน"
        tone="neutral"
        items={rules}
        className="grid grid-cols-1 gap-2 rounded-md border border-dashed border-line-strong bg-paper px-3.5 py-3 sm:grid-cols-3"
      />

      {/* สวิตช์: role="switch" + aria-checked ให้ screen reader อ่านว่าเปิด/ปิด */}
      <button
        type="button"
        role="switch"
        aria-checked={wantsShop}
        onClick={() => setWantsShop(!wantsShop)}
        className={cn(
          "flex items-center gap-3.5 rounded-[10px] border px-4 py-3.5 text-left",
          wantsShop ? "border-indigo bg-indigo-tint" : "border-line-strong bg-surface",
        )}
      >
        <span className={cn("flex h-[26px] w-11 shrink-0 rounded-full p-[3px]", wantsShop ? "justify-end bg-indigo" : "justify-start bg-[#C9B9A0]")}>
          <span className="size-5 rounded-full bg-cream" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-bold">อยากเปิดร้านด้วย</span>
          <span className="text-sm text-muted">สมัครเสร็จแล้วพาไปสร้างร้านต่อทันที · ข้ามไปก่อนก็ได้</span>
        </span>
      </button>

      <label className="flex cursor-pointer items-start gap-2.5 text-[15px] leading-normal text-ink-2">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-indigo" {...register("agree")} />
        <span>ยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว</span>
      </label>

      <Button type="submit" size="lg" disabled={!ready || isSubmitting}>
        {isSubmitting ? "กำลังสมัคร…" : wantsShop ? "สมัครแล้วไปสร้างร้าน" : "สมัครและเริ่มใช้งาน"}
      </Button>
      <p className="text-center text-[15px] text-muted">
        มีบัญชีแล้ว?{" "}
        <Link href="/login" className="font-bold text-vermilion">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
