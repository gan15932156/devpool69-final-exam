"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Moon, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, buttonClass } from "@/components/ui/Button";
import { DomeImage } from "@/components/ui/DomeImage";
import { Field, FormAlert, Input, inputClass } from "@/components/ui/Field";
import { Stepper } from "@/components/ui/Stepper";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { durationText, HALF_HOURS, toHHMM, toMinutes } from "@/lib/format";
import { restaurantSchema, type RestaurantValues } from "@/lib/schemas/restaurant";
import type { RestaurantDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { RestaurantCard } from "./RestaurantCard";

const LEAD_PRESETS = [30, 60, 120, 180];

// ฟอร์มเดียวใช้ทั้ง "สร้างร้าน" (ไม่มี initial) และ "แก้ไขร้าน" (มี initial)
export function RestaurantForm({ initial, ownerId }: { initial?: RestaurantDetail; ownerId: number }) {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RestaurantValues>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: initial?.name ?? "",
      cuisine: initial?.cuisine ?? "",
      description: initial?.description ?? "",
      seats: initial?.seats ?? 10,
      openTime: initial?.openTime ?? "11:00",
      closeTime: initial?.closeTime ?? "22:00",
      cancelLeadMinutes: initial?.cancelLeadMinutes ?? 30,
      images: initial?.images ?? [],
    },
  });
  const v = useWatch({ control });
  const images = v.images ?? [];
  const lead = v.cancelLeadMinutes ?? 30;
  const crosses = !!v.openTime && !!v.closeTime && toMinutes(v.closeTime) < toMinutes(v.openTime);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError("");
    const urls = [...images];
    try {
      for (const file of Array.from(files).slice(0, 8 - urls.length)) {
        const body = new FormData();
        body.append("file", file);
        const { url } = await api<{ url: string }>("/api/v1/uploads", { method: "POST", body });
        urls.push(url);
      }
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setValue("images", urls, { shouldValidate: true });
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function onSubmit(values: RestaurantValues) {
    setFormError("");
    try {
      const saved = await api<RestaurantDetail>(initial ? `/api/v1/restaurants/${initial.id}` : "/api/v1/restaurants", {
        method: initial ? "PUT" : "POST",
        json: values,
      });
      await queryClient.invalidateQueries(); // ข้อมูลร้านเปลี่ยน → ให้ทุกหน้าที่แคชไว้โหลดใหม่
      router.push(`/restaurants/${saved.id}`);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      const fields = Object.entries(e.fieldErrors);
      for (const [field, message] of fields) setError(field as keyof RestaurantValues, { message });
      if (fields.length === 0) setFormError(e.message);
    }
  }

  // ตัวอย่างการ์ดในหน้าค้นหา (อัปเดตตามที่พิมพ์)
  const preview = {
    id: initial?.id ?? 0,
    ownerId,
    name: v.name || "ชื่อร้าน",
    cuisine: v.cuisine ?? "",
    description: "",
    seats: v.seats || 0,
    openTime: v.openTime ?? "",
    closeTime: v.closeTime ?? "",
    crossesMidnight: crosses,
    cancelLeadMinutes: lead,
    images,
    avgRating: initial?.avgRating ?? null,
    reviewCount: initial?.reviewCount ?? 0,
    hasEnoughReviews: initial?.hasEnoughReviews ?? false,
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-10 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <Section n="๑" title="ข้อมูลร้าน">
          <Field label="ชื่อร้าน" htmlFor="name" error={errors.name?.message}>
            <Input id="name" invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="ประเภทอาหาร (ไม่บังคับ)" htmlFor="cuisine" error={errors.cuisine?.message} hint="แสดงใต้ชื่อร้านในการ์ด เช่น อาหารอีสาน · ส้มตำ ไก่ย่าง">
            <Input id="cuisine" invalid={!!errors.cuisine} {...register("cuisine")} />
          </Field>
          <Field label="รายละเอียด" htmlFor="description" error={errors.description?.message} hint="เช่น ประเภทอาหาร ที่ตั้ง ที่จอดรถ เมนูแนะนำ">
            <textarea
              id="description"
              rows={4}
              placeholder="ประเภทอาหาร ที่ตั้ง หรือสิ่งที่ลูกค้าควรรู้"
              className={inputClass(!!errors.description, "h-auto py-3.5 leading-relaxed")}
              {...register("description")}
            />
          </Field>
        </Section>

        <Section n="๒" title="รูปร้าน">
          <p className="-mt-1.5 text-[15px] text-muted">อย่างน้อย 1 รูป · รูปแรกคือรูปหลัก · JPG, PNG, WEBP ไม่เกิน 5MB</p>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {images.map((url, i) => (
              <div key={url} className="relative h-[170px]">
                <DomeImage src={url} alt={`รูป ${i + 1}`} className="size-full" radius="rounded-[50%_50%_10px_10px/30%_30%_10px_10px]" />
                {i === 0 && (
                  <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-sm bg-vermilion px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-cream">
                    รูปหลัก
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`ลบรูป ${i + 1}`}
                  onClick={() => setValue("images", images.filter((u) => u !== url), { shouldValidate: true })}
                  className="absolute top-11 right-2 flex size-8 items-center justify-center rounded-full bg-surface/95 text-ink"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
            ))}
            {images.length < 8 && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className="flex h-[170px] flex-col items-center justify-center gap-1.5 rounded-[50%_50%_10px_10px/30%_30%_10px_10px] border-[1.5px] border-dashed border-line-strong bg-paper text-[15px] font-bold text-ink-2"
              >
                <Upload size={22} aria-hidden />
                {uploading ? "กำลังอัปโหลด…" : "เพิ่มรูป"}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
          {(uploadError || errors.images) && <p className="text-sm text-vermilion">{uploadError || errors.images?.message}</p>}
        </Section>

        <Section n="๓" title="ที่นั่งและเวลาเปิด–ปิด">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="จำนวนที่นั่ง" htmlFor="seats" error={errors.seats?.message}>
              <Input id="seats" type="number" min={1} inputMode="numeric" invalid={!!errors.seats} {...register("seats", { valueAsNumber: true })} />
            </Field>
            <Field label="เวลาเปิด" htmlFor="openTime" error={errors.openTime?.message}>
              <select id="openTime" className={inputClass(!!errors.openTime)} {...register("openTime")}>
                {HALF_HOURS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="เวลาปิด" htmlFor="closeTime" error={errors.closeTime?.message}>
              <select id="closeTime" className={inputClass(!!errors.closeTime)} {...register("closeTime")}>
                {HALF_HOURS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-[15px] text-muted">
            นับเป็นที่นั่งรวม ไม่แยกโต๊ะ · {v.seats || 0} ที่ = รับลูกค้าพร้อมกันได้ {v.seats || 0} คนทุกช่วงเวลา · เวลาเลือกได้ทีละ 30 นาที
          </p>
          {crosses && (
            <div className="flex items-start gap-3 rounded-[10px] border border-[#B9C0DA] bg-indigo-tint px-4 py-3.5 text-[#1A2450]">
              <Moon size={20} className="mt-0.5 shrink-0" aria-hidden />
              <p className="text-base leading-relaxed">
                <strong>ปิดข้ามเที่ยงคืน</strong> — เวลาปิดน้อยกว่าเวลาเปิด ระบบจะถือว่า {v.closeTime} คือของวันถัดไป
                ลูกค้าจองคืนวันศุกร์ได้ถึง {v.closeTime} เช้าวันเสาร์
              </p>
            </div>
          )}
        </Section>

        <Section n="๔" title="ยกเลิกล่วงหน้า">
          <p className="-mt-1.5 text-[15px] text-muted">
            ลูกค้าต้องยกเลิกก่อนเวลาจองอย่างน้อยเท่านี้ · ค่าเริ่มต้น 30 นาที ตั้งมากขึ้นได้ แต่ต่ำกว่า 30 นาทีไม่ได้
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <Stepper
              value={lead}
              min={30}
              step={15}
              format={durationText}
              onChange={(n) => setValue("cancelLeadMinutes", n, { shouldValidate: true })}
              decreaseLabel="ลด 15 นาที"
              increaseLabel="เพิ่ม 15 นาที"
            />
            <div role="group" aria-label="ค่าที่ใช้บ่อย" className="flex flex-wrap gap-2">
              {LEAD_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={lead === m}
                  onClick={() => setValue("cancelLeadMinutes", m, { shouldValidate: true })}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-[15px] font-bold",
                    lead === m ? "border-indigo bg-indigo text-cream" : "border-line-strong bg-surface text-ink",
                  )}
                >
                  {durationText(m)}
                </button>
              ))}
            </div>
          </div>
          {lead <= 30 && <p className="text-[15px] text-gold-text">30 นาทีคือค่าต่ำสุดที่ระบบอนุญาต</p>}
          <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-line-strong bg-paper px-4 py-3.5 text-base">
            <Info size={20} className="shrink-0 text-muted" aria-hidden />
            <span>
              ตัวอย่าง: ลูกค้าจองเวลา <strong>20:00</strong> ยกเลิกได้ถึง <strong>{toHHMM(20 * 60 - lead)}</strong>
            </span>
          </div>
        </Section>

        {formError && <FormAlert>{formError}</FormAlert>}
        <div className="flex justify-end gap-3">
          <Link href={initial ? `/restaurants/${initial.id}` : "/owner"} className={buttonClass("outline", "lg")}>
            ยกเลิก
          </Link>
          <Button type="submit" size="lg" disabled={isSubmitting || uploading}>
            {isSubmitting ? "กำลังบันทึก…" : initial ? "บันทึกการเปลี่ยนแปลง" : "สร้างร้าน"}
          </Button>
        </div>

        {initial && <DeleteRestaurant id={initial.id} />}
      </div>

      <aside className="hidden w-[370px] shrink-0 flex-col gap-3 lg:sticky lg:top-6 lg:flex">
        <span className="text-[15px] font-bold text-gold-text">ตัวอย่างในหน้าค้นหา</span>
        <RestaurantCard restaurant={preview} isOwn preview />
      </aside>
    </form>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[18px] rounded-xl border border-line bg-surface p-5 md:p-7">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-vermilion font-heading text-[17px] text-vermilion">
          {n}
        </span>
        <h2 className="font-heading text-[22px]">{title}</h2>
        <span aria-hidden className="h-px flex-1 bg-line-strong" />
      </div>
      {children}
    </section>
  );
}

// ลบร้าน: กดครั้งแรกขอยืนยัน · Go ตอบ 409 ถ้ายังมีการจองที่ยังไม่ถึงเวลา
function DeleteRestaurant({ id }: { id: number }) {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: () => api(`/api/v1/restaurants/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.push("/owner");
    },
    onError: () => setConfirming(false),
  });

  return (
    <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-[#E9BBAE] bg-[#FBEDE8] px-5 py-6 md:px-7">
      <div>
        <h2 className="font-heading text-[19px] text-[#6E1F18]">ลบร้านนี้</h2>
        <p className="mt-1 text-[15px] text-[#6E1F18]">ลบแล้วกู้คืนไม่ได้ · ลบได้เมื่อไม่มีการจองที่ยังไม่ถึงเวลา</p>
        {remove.error && (
          <p role="alert" className="mt-2 text-[15px] font-bold text-vermilion">
            {remove.error instanceof ApiError ? remove.error.message : "ลบไม่สำเร็จ"}
          </p>
        )}
      </div>
      {confirming ? (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfirming(false)}>
            ไม่ลบ
          </Button>
          <Button variant="cta" disabled={remove.isPending} onClick={() => remove.mutate()}>
            <Trash2 size={18} aria-hidden />
            ยืนยันลบร้าน
          </Button>
        </div>
      ) : (
        <Button variant="cta" onClick={() => setConfirming(true)}>
          <Trash2 size={18} aria-hidden />
          ลบร้าน
        </Button>
      )}
    </section>
  );
}
