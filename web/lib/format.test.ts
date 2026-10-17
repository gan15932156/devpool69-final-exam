import { describe, expect, it } from "vitest";
import { cn } from "./cn";
import { durationText, HALF_HOURS, hoursText, initialOf, ratingText, reviewCountText, toHHMM, toMinutes } from "./format";

describe("toMinutes / toHHMM", () => {
  it("แปลงไปกลับได้ทุกช่อง 30 นาที", () => {
    for (const hhmm of HALF_HOURS) expect(toHHMM(toMinutes(hhmm))).toBe(hhmm);
  });

  it("ค่าตัวอย่าง", () => {
    expect(toMinutes("18:30")).toBe(1110);
    expect(toMinutes("00:00")).toBe(0);
    expect(toHHMM(1110)).toBe("18:30");
  });

  it("เกิน 24 ชม. หรือติดลบวนกลับ (เหมือน FormatHHMM ใน Go)", () => {
    expect(toHHMM(1440)).toBe("00:00");
    expect(toHHMM(1500)).toBe("01:00");
    expect(toHHMM(-30)).toBe("23:30");
  });
});

describe("HALF_HOURS", () => {
  it("48 ช่อง 00:00–23:30", () => {
    expect(HALF_HOURS).toHaveLength(48);
    expect(HALF_HOURS[0]).toBe("00:00");
    expect(HALF_HOURS.at(-1)).toBe("23:30");
  });
});

describe("durationText", () => {
  it.each([
    [30, "30 นาที"],
    [60, "1 ชั่วโมง"],
    [90, "1 ชม. 30 นาที"],
    [120, "2 ชั่วโมง"],
    [10080, "168 ชั่วโมง"],
  ])("%i → %s", (m, text) => expect(durationText(m)).toBe(text));
});

describe("ข้อความอื่น ๆ", () => {
  it("hoursText", () => expect(hoursText("18:00", "02:00")).toBe("18:00–02:00"));

  it("ratingText: null ≠ 0", () => {
    expect(ratingText(null)).toBe("–");
    expect(ratingText(0)).toBe("0.0");
    expect(ratingText(4.8)).toBe("4.8");
    expect(ratingText(5)).toBe("5.0");
  });

  it("reviewCountText ใส่คอมมาหลักพัน", () => {
    expect(reviewCountText(0)).toBe("0 รีวิว");
    expect(reviewCountText(1234)).toBe("1,234 รีวิว");
  });

  it("initialOf ข้ามสระหน้า", () => {
    expect(initialOf("เชฟนิด")).toBe("ช");
    expect(initialOf("ไก่")).toBe("ก");
    expect(initialOf("มะลิ")).toBe("ม");
    expect(initialOf("Ton")).toBe("T");
    expect(initialOf("")).toBe("?");
    expect(initialOf("เแ")).toBe("?");
  });
});

describe("cn", () => {
  it("ตัดค่าว่าง/false ทิ้ง", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
    expect(cn()).toBe("");
  });
});
