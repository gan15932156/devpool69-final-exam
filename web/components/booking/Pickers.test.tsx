// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Stepper } from "@/components/ui/Stepper";
import { TimeRangeSelect } from "./Pickers";

describe("Stepper", () => {
  const props = { min: 1, max: 3, decreaseLabel: "ลด", increaseLabel: "เพิ่ม", format: (n: number) => `${n} คน` };

  it("ปุ่มปิดที่ขอบ และส่งค่าใหม่", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Stepper {...props} value={1} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "ลด" })).toBeDisabled();
    expect(screen.getByText("1 คน")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "เพิ่ม" }));
    expect(onChange).toHaveBeenLastCalledWith(2);

    rerender(<Stepper {...props} value={3} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "เพิ่ม" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "ลด" })).toBeEnabled();
  });

  it("step ที่ข้ามขอบ → ปุ่มปิด (ไม่ส่งค่าที่ไม่ลงขั้น)", () => {
    render(<Stepper value={60} min={30} max={80} step={30} onChange={vi.fn()} decreaseLabel="ลด" increaseLabel="เพิ่ม" />);
    expect(screen.getByRole("button", { name: "เพิ่ม" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "ลด" })).toBeEnabled();
  });
});

describe("TimeRangeSelect", () => {
  // ร้าน 22:00–02:00 = นาที 1320–1560
  const base = { open: 1320, close: 1560, isPast: () => false };

  const labels = (name: string) => within(screen.getByLabelText(name)).getAllByRole("option").map((o) => o.textContent);

  it("เวลาเริ่มถึงก่อนปิด 30 นาที · เวลาจบต้องหลังเวลาเริ่ม · ข้ามเที่ยงคืนต่อเนื่อง", () => {
    render(<TimeRangeSelect {...base} start={1380} end={1440} onChange={vi.fn()} />);
    expect(labels("เริ่ม")).toEqual(["22:00", "22:30", "23:00", "23:30", "00:00", "00:30", "01:00", "01:30"]);
    expect(labels("สิ้นสุด")).toEqual(["23:30", "00:00", "00:30", "01:00", "01:30", "02:00"]);
  });

  it("เลื่อนเวลาเริ่ม → คงระยะเวลาเดิม · ชนเวลาปิดแล้วหยุด", async () => {
    const onChange = vi.fn();
    render(<TimeRangeSelect {...base} start={1320} end={1410} onChange={onChange} />); // 22:00–23:30 (90 นาที)
    await userEvent.selectOptions(screen.getByLabelText("เริ่ม"), "23:00");
    expect(onChange).toHaveBeenLastCalledWith(1380, 1470);
    await userEvent.selectOptions(screen.getByLabelText("เริ่ม"), "01:30");
    expect(onChange).toHaveBeenLastCalledWith(1530, 1560);
  });

  it("เวลาที่ผ่านแล้วแสดงแต่เลือกไม่ได้", () => {
    render(<TimeRangeSelect {...base} start={1380} end={1440} isPast={(m) => m < 1380} onChange={vi.fn()} />);
    const past = screen.getByRole("option", { name: "22:00 (ผ่านแล้ว)" });
    expect(past).toBeDisabled();
    expect(screen.getByRole("option", { name: "23:00" })).toBeEnabled();
  });
});
