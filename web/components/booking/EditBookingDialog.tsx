"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormAlert, inputClass } from "@/components/ui/Field";
import {
  atMinutes,
  bookingErrorText,
  checkSeats,
  invalidateBookingQueries,
  nextDays,
  seatText,
  serviceRange,
  thaiDate,
  type Availability,
} from "@/lib/booking";
import { cn } from "@/lib/cn";
import { toHHMM, toMinutes } from "@/lib/format";
import type { Booking, RestaurantDetail } from "@/lib/types";
import { useApi, useRestaurant } from "@/lib/use-api";
import { TimeRangeSelect } from "./Pickers";

// แก้ไขการจอง: desktop = dialog กลางจอ · มือถือ = bottom sheet
// ใช้ <dialog> ของเบราว์เซอร์ → กด Esc ปิดได้ โฟกัสวนอยู่ใน dialog และกลับไปที่ปุ่มเดิมเมื่อปิดให้เอง
export function EditBookingDialog({ booking: b, onClose }: { booking: Booking; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const { data: r } = useRestaurant(b.restaurantId);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={`edit-${b.id}`}
      className="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-2xl bg-surface p-0 text-ink shadow-[0_24px_64px_rgba(0,0,0,0.3)] backdrop:bg-ink/50 md:m-auto md:max-w-[620px] md:rounded-2xl"
    >
      <div className="bg-vermilion bg-[url(/design/pattern-prajamyam-tile-light.svg)] bg-[length:84px_126px] px-5 py-5 text-cream md:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={`edit-${b.id}`} className="font-heading text-[28px] leading-tight md:text-[34px]">
              แก้ไขใบจอง
            </h2>
            <p className="mt-0.5 text-[15px] text-[#F6D9CF]">
              {b.restaurantName}
              {r && ` · ร้านมี ${r.seats} ที่นั่ง`}
            </p>
          </div>
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => ref.current?.close()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cream text-vermilion"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
      </div>
      <div className="band-kruay-choeng-red" aria-hidden />
      {r ? <EditForm booking={b} restaurant={r} close={() => ref.current?.close()} /> : <p className="p-8 text-center text-muted">กำลังโหลด…</p>}
    </dialog>
  );
}

function EditForm({ booking: b, restaurant: r, close }: { booking: Booking; restaurant: RestaurantDetail; close: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { open, close: closeM } = serviceRange(r.openTime, r.closeTime);
  // เวลาเดิม → นาทีในรอบ (ร้านข้ามคืน: เวลาหลังเที่ยงคืนบวก 1440)
  const inRound = (hhmm: string) => {
    const m = toMinutes(hhmm);
    return r.crossesMidnight && m <= toMinutes(r.closeTime) ? m + 1440 : m;
  };

  const [party, setParty] = useState(b.partySize);
  const [date, setDate] = useState(b.serviceDate);
  const [start, setStart] = useState(inRound(b.start));
  const [end, setEnd] = useState(inRound(b.end));
  const [error, setError] = useState("");

  const days = nextDays(5);
  // วันเดิมอยู่นอก 5 วันข้างหน้า (จองไว้ไกล) → ใส่เป็นตัวเลือกแรก ไม่งั้น <select> ไม่มีค่าที่ตรงกับวันเดิม
  const dateOptions = days.some((d) => d.iso === b.serviceDate) ? days.map((d) => d.iso) : [b.serviceDate, ...days.map((d) => d.iso)];

  // excludeBookingId → Go ไม่นับที่นั่งเดิมของการจองนี้ในตัวเลข used
  // ใส่ b.id ใน key ด้วย → แยกแคชจากกราฟของหน้าร้าน (ซึ่งนับการจองนี้รวมอยู่)
  const { data: av } = useQuery({
    queryKey: ["availability", r.id, date, b.id],
    queryFn: () => api<Availability>(`/api/v1/restaurants/${r.id}/availability?date=${date}&excludeBookingId=${b.id}`),
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/api/v1/bookings/${b.id}`, {
        method: "PUT",
        json: { date, start: toHHMM(start), end: toHHMM(end), partySize: party },
      }),
    onSuccess: async () => {
      await invalidateBookingQueries(queryClient);
      close();
    },
    onError: (e) => {
      setError(bookingErrorText(e, "edit"));
      queryClient.invalidateQueries({ queryKey: ["availability", r.id, date, b.id] });
    },
  });

  const check = av ? checkSeats(av, open, party, start, end) : null;
  const others = check?.peak ?? 0; // คนอื่นจองไว้ (ช่วงที่แน่นที่สุด) — ไม่รวมของเรา
  const need = others + party;
  const seats = check?.seats ?? r.seats; // ใช้ตัวเดียวกับที่ตัดสินว่าเกิน (availability) · ระหว่างโหลดใช้ของร้าน
  const seatsOk = !!check && !check.firstOver;
  const notPast = atMinutes(date, start) > new Date();
  const ok = seatsOk && notPast && end > start;

  const msg = check ? seatText(check, party, "edit") : "กำลังตรวจที่นั่ง…";

  return (
    <div className="flex max-h-[75vh] flex-col gap-5 overflow-y-auto px-5 pt-5 pb-7 md:px-7">
      <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-dashed border-line-strong bg-paper px-4 py-3 text-base text-ink-2">
        <span className="font-bold">เดิม</span>
        <span>
          {thaiDate(b.serviceDate)} · {b.start}–{b.end} · {b.partySize} คน
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px] font-semibold">จำนวนคน</span>
          <div className={cn("flex h-[52px] items-center justify-between rounded-md border bg-surface px-1", seatsOk ? "border-line-strong" : "border-vermilion")}>
            <button
              type="button"
              aria-label="ลดจำนวนคน"
              disabled={party <= 1}
              onClick={() => setParty(party - 1)}
              className="flex size-11 items-center justify-center rounded-full bg-paper text-xl disabled:text-line-strong"
            >
              −
            </button>
            <output aria-live="polite" className="font-heading text-[22px]">
              {party}
            </output>
            <button
              type="button"
              aria-label="เพิ่มจำนวนคน"
              disabled={party >= seats}
              onClick={() => setParty(party + 1)}
              className="flex size-11 items-center justify-center rounded-full bg-paper text-xl disabled:text-line-strong"
            >
              +
            </button>
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
          วันที่
          <select
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError("");
            }}
            className={inputClass(false, "px-3 font-normal")}
          >
            {dateOptions.map((iso) => (
              <option key={iso} value={iso}>
                {thaiDate(iso)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TimeRangeSelect
        open={open}
        close={closeM}
        start={start}
        end={end}
        isPast={(m) => atMinutes(date, m) <= new Date()}
        onChange={(s, e) => {
          setStart(s);
          setEnd(e);
          setError("");
        }}
      />

      {/* จุดที่นั่ง: คนอื่น / ของคุณ / ว่าง / เกิน */}
      <div className={cn("flex flex-col gap-3.5 rounded-lg border p-4", seatsOk ? "border-[#C8D8BC] bg-[#EEF3E8]" : "border-[#E9BBAE] bg-[#FBEDE8]")}>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">
            ที่นั่งช่วง {toHHMM(start)}–{toHHMM(end)}
          </span>
          <span className={cn("font-heading text-lg", seatsOk ? "text-success" : "text-vermilion")}>
            {need} / {seats} ที่
          </span>
        </div>
        <SeatDots seats={seats} others={others} mine={party} />
        <div className="flex flex-wrap gap-4 text-sm text-ink-2">
          <Dot className="bg-seat-booked">คนอื่นจองไว้ {others}</Dot>
          <Dot className="bg-indigo">การจองของคุณ {party}</Dot>
          <Dot className="border-[1.5px] border-line-strong bg-surface">ว่าง</Dot>
        </div>
        <p role="status" className={cn("text-base leading-normal font-bold", seatsOk ? "text-success" : "text-vermilion")}>
          {msg}
        </p>
        <p className="text-[15px] text-muted">ที่นั่งเดิม {b.partySize} ที่ของคุณถูกนำมาคิดใหม่ ไม่นับซ้ำกับจำนวนใหม่</p>
      </div>

      {!notPast && <p className="text-[15px] text-vermilion">เวลาเริ่มผ่านไปแล้ว เลือกเวลาใหม่</p>}
      {error && <FormAlert>{error}</FormAlert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[15px] text-muted">
          ยกเลิกได้ถึง {thaiDate(date)} {toHHMM(start - b.cancelLeadMinutes)}
        </span>
        <div className="flex gap-2.5">
          <Button variant="outline" onClick={close}>
            ไม่บันทึก
          </Button>
          <Button disabled={!ok || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// วงกลม 1 วง = 1 ที่นั่ง · ส่วนที่เกินแยกไว้หลังเส้นประชาด
function SeatDots({ seats, others, mine }: { seats: number; others: number; mine: number }) {
  const need = others + mine;
  const size = seats > 20 ? "size-5" : "size-[26px]";
  return (
    <div className="flex flex-wrap items-center gap-3" aria-hidden>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: seats }, (_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full border-[1.5px]",
              size,
              i < others ? "border-seat-booked bg-seat-booked" : i < need ? "border-indigo bg-indigo" : "border-line-strong bg-surface",
            )}
          />
        ))}
      </div>
      {need > seats && (
        <div className="flex flex-wrap gap-1.5 border-l-2 border-dashed border-vermilion pl-3">
          {Array.from({ length: need - seats }, (_, i) => (
            <span key={i} className={cn("rounded-full border-[1.5px] border-dashed border-vermilion bg-vermilion-tint", size)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Dot({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-full", className)} />
      {children}
    </span>
  );
}
