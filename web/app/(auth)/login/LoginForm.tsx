"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, FormAlert, Input } from "@/components/ui/Field";
import { loginSchema, type LoginValues } from "@/lib/schemas/auth";

// callbackUrl = หน้าที่จะกลับไปหลัง login · ผ่าน safeCallbackUrl มาแล้วใน page.tsx (กัน open redirect ไปเว็บอื่น)
export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [formError, setFormError] = useState(""); // error ทั้งฟอร์ม · บอกรวม "อีเมลหรือรหัสผ่าน" ไม่บอกว่าผิดช่องไหน → เดาไม่ได้ว่าอีเมลนี้มีบัญชีไหม
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setFormError("");
    // redirect: false → ไม่ให้ NextAuth พาไปหน้าอื่นเอง เราจะเช็กผลก่อน
    // signIn → authorize() ใน auth.ts (ฝั่ง server) เรียก Go /auth/login → ได้ token มาเก็บใน cookie แบบ httpOnly
    const res = await signIn("credentials", { ...values, redirect: false });
    if (res?.error) {
      setFormError(
        res.code === "too_many_attempts" // ตั้งใน auth.ts ตอน Go ตอบ 429
          ? "ใส่รหัสผ่านผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่"
          : "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      );
      return;
    }
    // โหลดหน้าใหม่ทั้งหน้า → header และ session อัปเดตครบทุกส่วน
    window.location.assign(callbackUrl);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-[28px] tracking-[-0.01em] md:text-[34px]">เข้าสู่ระบบ</h2>
        <p className="mt-1 text-base text-muted">ยินดีต้อนรับกลับ — จองโต๊ะหรือจัดการร้านของคุณต่อได้เลย</p>
      </div>

      {formError && <FormAlert>{formError}</FormAlert>}

      <Field label="อีเมล" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="รหัสผ่าน" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          invalid={!!errors.password}
          {...register("password")}
        />
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" />
        ยังไม่มีบัญชี
        <span className="h-px flex-1 bg-line" />
      </div>
      <ButtonLink href="/register" variant="outline-red" size="lg">
        สมัครสมาชิก
      </ButtonLink>
      <p className="text-center text-sm text-muted">
        <Link href="/" className="underline">
          กลับไปดูร้านก่อน
        </Link>
      </p>
    </form>
  );
}
