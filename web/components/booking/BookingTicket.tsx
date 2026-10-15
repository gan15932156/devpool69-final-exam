"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checklist } from "@/components/ui/Checklist";
import { FormAlert } from "@/components/ui/Field";
import { Stepper } from "@/components/ui/Stepper";
import {
  atMinutes,
  bookingErrorText,
  checkSeats,
  invalidateBookingQueries,
  nextDays,
  seatText,
  serviceRange,
  thaiDate,
  timeOptions,
  type Availability,
} from "@/lib/booking";
import { durationText, hoursText, toHHMM } from "@/lib/format";
import type { RestaurantDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { DateDomes, StepLabel, TimeRangeSelect } from "./Pickers";
import { SeatTimeline } from "./SeatTimeline";

// เวลาเริ่มแรกที่ยังไม่ผ่านของวันนั้น (null = วันนั้นไม่เหลือช่วงให้จองแล้ว)
function firstFutureStart(date: string, open: number, close: number) {
  const now = new Date();
  return timeOptions(open, close - 30).find((o) => atMinutes(date, o.minutes) > now)?.minutes ?? null;
}

// ช่วงเวลาเริ่มต้นเมื่อเลือกวัน: เวลาแรกที่ยังไม่ผ่าน นาน 1 ชั่วโมง (ไม่เกินเวลาปิด)
function defaultSlot(date: string, open: number, close: number) {
  const start = firstFutureStart(date, open, close) ?? open;
  return { start, end: Math.min(close, start + 60) };
}

export function BookingTicket({ restaurant: r }: { restaurant: RestaurantDetail }) {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { open, close } = serviceRange(r.openTime, r.closeTime);
  const days = nextDays(5);

  const [party, setParty] = useState(Math.min(2, r.seats)); // เริ่ม 2 คน (กรณีที่พบบ่อย) แต่ไม่เกินที่นั่งของร้าน
  // วันแรกที่ยังจองได้: ถ้าวันนี้ร้านปิดไปแล้ว (เช่น เปิดถึง 14:00 แต่ตอนนี้บ่ายสาม) เริ่มที่พรุ่งนี้ · คิดครั้งเดียวตอนเปิดใบจอง
  const [initial] = useState(() => {
    const iso = (days.find((d) => firstFutureStart(d.iso, open, close) !== null) ?? days[0]).iso;
    return { date: iso, ...defaultSlot(iso, open, close) };
  });
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [serverError, setServerError] = useState("");

  const { data: av } = useQuery({
    queryKey: ["availability", r.id, date],
    queryFn: () => api<Availability>(`/api/v1/restaurants/${r.id}/availability?date=${date}`),
  });

  const book = useMutation({
    mutationFn: () =>
      api(`/api/v1/restaurants/${r.id}/bookings`, {
        method: "POST",
        json: { date, start: toHHMM(start), end: toHHMM(end), partySize: party },
      }),
    onSuccess: async () => {
      await invalidateBookingQueries(queryClient);
      router.push("/bookings");
    },
    onError: (e) => {
      // แสดงสิ่งที่ Go ตอบเสมอ — เช่นมีคนจองตัดหน้าไปก่อนเสี้ยววินาที
      // แล้วโหลดกราฟใหม่ → เห็นที่นั่งล่าสุดที่ทำให้จองไม่ผ่าน
      setServerError(bookingErrorText(e, "new"));
      queryClient.invalidateQueries({ queryKey: ["availability", r.id, date] });
    },
  });

  function changeDate(iso: string) {
    setDate(iso);
    const slot = defaultSlot(iso, open, close);
    setStart(slot.start);
    setEnd(slot.end);
    setServerError("");
  }

  const now = new Date();
  const inHours = start >= open && end <= close && end > start;
  const notPast = atMinutes(date, start) > now;
  const check = av ? checkSeats(av, open, party, start, end) : null;
  const seatsOk = !!check && !check.firstOver;
  const ok = inHours && notPast && seatsOk;
  const hours = hoursText(r.openTime, r.closeTime);

  return (
    <section aria-labelledby="ticket-title" className="flex flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-ticket">
      <div className="relative bg-vermilion bg-[url(/design/pattern-prajamyam-tile-light.svg)] bg-[length:84px_126px] px-7 pt-6 pb-5 text-cream">
        <h2 id="ticket-title" className="font-heading text-[34px] leading-tight tracking-[-0.01em] md:text-[38px]">
          ใบจองโต๊ะ
        </h2>
        <p className="mt-0.5 text-[15px] text-[#F6D9CF]">
          {r.name} · ร้านมี {r.seats} ที่นั่ง · เปิด {hours}
        </p>
      </div>
      <div className="band-kruay-choeng-red" aria-hidden />

      <div className="flex flex-col gap-[22px] px-5 pt-5 pb-2 md:px-7">
        <div className="flex flex-col gap-2.5">
          <StepLabel n="๑">จำนวนคน</StepLabel>
          <Stepper
            value={party}
            min={1}
            max={r.seats}
            onChange={(n) => {
              setParty(n);
              setServerError("");
            }}
            format={(n) => `${n} คน`}
            decreaseLabel="ลดจำนวนคน"
            increaseLabel="เพิ่มจำนวนคน"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <StepLabel n="๒">วันที่</StepLabel>
          <DateDomes value={date} onChange={changeDate} days={days} />
        </div>

        <div className="flex flex-col gap-2.5">
          <StepLabel n="๓">เวลาเริ่ม–สิ้นสุด</StepLabel>
          <TimeRangeSelect
            open={open}
            close={close}
            start={start}
            end={end}
            isPast={(m) => atMinutes(date, m) <= now}
            onChange={(s, e) => {
              setStart(s);
              setEnd(e);
              setServerError("");
            }}
          />
        </div>

        <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-paper p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">ที่นั่งที่ถูกจองแล้ว · {thaiDate(date)}</span>
            <span className="text-[13px] text-muted">ช่องละ 30 นาที</span>
          </div>
          {av ? (
            <SeatTimeline availability={av} open={open} request={check ? { party, ...check } : undefined} />
          ) : (
            <p className="py-6 text-center text-sm text-muted">กำลังโหลดที่นั่ง…</p>
          )}
        </div>

        {/* aria-live: screen reader อ่านผลตรวจใหม่ทุกครั้งที่เปลี่ยนค่า */}
        <div aria-live="polite">
          <Checklist
            label="เงื่อนไขการจอง"
            className="flex flex-col gap-2.5 text-base [&_li]:text-base"
            items={[
              { ok: inHours, text: inHours ? `อยู่ในเวลาเปิดร้าน ${hours}` : `อยู่นอกเวลาเปิดร้าน ${hours}` },
              {
                ok: notPast,
                text: notPast ? "ไม่ใช่เวลาที่ผ่านไปแล้ว" : `เวลาเริ่มผ่านไปแล้ว (ตอนนี้ ${toHHMM(now.getHours() * 60 + now.getMinutes())})`,
              },
              { ok: seatsOk, text: check ? seatText(check, party, "new") : "กำลังตรวจที่นั่ง…" },
            ]}
          />
        </div>
      </div>

      {/* รอยปรุ + รอยบากครึ่งวงกลมซ้าย–ขวา */}
      <div aria-hidden className="relative my-1.5 h-7">
        <span className="absolute top-0 -left-[15px] size-7 rounded-full bg-paper shadow-[inset_-1px_0_0_var(--color-line-strong)]" />
        <span className="absolute top-[13px] right-[22px] left-[22px] border-t-2 border-dashed border-line-strong" />
        <span className="absolute top-0 -right-[15px] size-7 rounded-full bg-paper shadow-[inset_1px_0_0_var(--color-line-strong)]" />
      </div>

      <div className="flex flex-col gap-3 px-5 pt-1 pb-7 md:px-7">
        <div className="flex justify-between gap-3 text-base">
          <span className="text-muted">สรุป</span>
          <span className="text-right font-bold">
            {thaiDate(date)} · {toHHMM(start)}–{toHHMM(end)} · {party} คน
          </span>
        </div>
        {serverError && <FormAlert>{serverError}</FormAlert>}
        {session ? (
          <Button size="lg" className="min-h-14 text-lg" disabled={!ok || book.isPending} onClick={() => book.mutate()}>
            {book.isPending ? "กำลังจอง…" : "ยืนยันการจอง"}
          </Button>
        ) : (
          <ButtonLink href={`/login?callbackUrl=/restaurants/${r.id}`} size="lg" className="min-h-14 text-lg">
            เข้าสู่ระบบเพื่อจอง
          </ButtonLink>
        )}
        <p className="text-center text-sm text-muted">
          ยกเลิกได้ถึง {toHHMM(start - r.cancelLeadMinutes)} ของวันที่จอง (ร้านกำหนดล่วงหน้า {durationText(r.cancelLeadMinutes)})
        </p>
      </div>
    </section>
  );
}
