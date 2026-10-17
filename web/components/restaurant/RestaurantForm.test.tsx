// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restaurant } from "@/test/fixtures";
import { mockFetch, renderWithQuery, sentJSON } from "@/test/render";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "9" } }, status: "authenticated" }), signOut: vi.fn() }));

const { RestaurantForm } = await import("./RestaurantForm");

beforeEach(() => push.mockReset());
afterEach(() => vi.unstubAllGlobals());

const png = (name = "a.png") => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: "image/png" });
const fileInput = (c: HTMLElement) => c.querySelector<HTMLInputElement>('input[type="file"]')!;
const submit = (name = "สร้างร้าน") => userEvent.click(screen.getByRole("button", { name }));
const method = (fetch: ReturnType<typeof mockFetch>, m: string, url: string) =>
  fetch.mock.calls.findIndex(([u, init]) => init?.method === m && u === url);

describe("RestaurantForm: สร้างร้าน", () => {
  it("ค่าเริ่มต้น", () => {
    renderWithQuery(<RestaurantForm ownerId={9} />);
    expect(screen.getByLabelText("จำนวนที่นั่ง")).toHaveValue(10);
    expect(screen.getByLabelText("เวลาเปิด")).toHaveValue("11:00");
    expect(screen.getByLabelText("เวลาปิด")).toHaveValue("22:00");
    expect(screen.getByText("30 นาทีคือค่าต่ำสุดที่ระบบอนุญาต")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ยกเลิก" })).toHaveAttribute("href", "/owner");
    expect(screen.queryByRole("button", { name: "ลบร้าน" })).toBeNull();
  });

  it("ตรวจฟอร์มก่อนส่ง ไม่ยิง API", async () => {
    const fetch = mockFetch([]);
    renderWithQuery(<RestaurantForm ownerId={9} />);
    await userEvent.clear(screen.getByLabelText("จำนวนที่นั่ง"));
    await userEvent.type(screen.getByLabelText("จำนวนที่นั่ง"), "0");
    await submit();
    expect(await screen.findByText("กรุณากรอกชื่อร้าน")).toBeInTheDocument();
    expect(screen.getByText("ต้องมีรูปอย่างน้อย 1 รูป")).toBeInTheDocument();
    expect(screen.getByText("ต้องมีอย่างน้อย 1 ที่นั่ง")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("อัปโหลดรูป → กรอก → POST แล้วไปหน้าร้านใหม่", async () => {
    const fetch = mockFetch([
      { method: "POST", path: "/api/v1/uploads", status: 201, body: { url: "/uploads/a.png" } },
      { method: "POST", path: "/api/v1/restaurants", status: 201, body: restaurant({ id: 5 }) },
    ]);
    const { container } = renderWithQuery(<RestaurantForm ownerId={9} />);
    await userEvent.type(screen.getByLabelText("ชื่อร้าน"), "  ร้านใหม่  ");
    await userEvent.upload(fileInput(container), png());
    expect(await screen.findByText("รูปหลัก")).toBeInTheDocument();
    const upload = fetch.mock.calls[method(fetch, "POST", "/api/v1/uploads")][1];
    expect((upload?.body as FormData).get("file")).toBeInstanceOf(File);

    await userEvent.selectOptions(screen.getByLabelText("เวลาเปิด"), "18:00");
    await userEvent.selectOptions(screen.getByLabelText("เวลาปิด"), "02:00");
    await submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/restaurants/5"));
    expect(sentJSON(fetch, method(fetch, "POST", "/api/v1/restaurants"))).toEqual({
      name: "ร้านใหม่",
      cuisine: "",
      description: "",
      seats: 10,
      openTime: "18:00",
      closeTime: "02:00",
      cancelLeadMinutes: 30,
      images: ["/uploads/a.png"],
    });
  });

  it("ปิดข้ามเที่ยงคืน → แสดงคำอธิบาย · เวลาเปิด = ปิด → ไม่รับ", async () => {
    mockFetch([]);
    renderWithQuery(<RestaurantForm ownerId={9} />);
    await userEvent.selectOptions(screen.getByLabelText("เวลาเปิด"), "18:00");
    await userEvent.selectOptions(screen.getByLabelText("เวลาปิด"), "02:00");
    expect(screen.getByText("ปิดข้ามเที่ยงคืน")).toBeInTheDocument();
    expect(screen.getByText(/ระบบจะถือว่า 02:00 คือของวันถัดไป/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("เวลาปิด"), "18:00");
    expect(screen.queryByText("ปิดข้ามเที่ยงคืน")).toBeNull();
    await submit();
    expect(await screen.findByText("เวลาเปิดและปิดต้องไม่ตรงกัน")).toBeInTheDocument();
  });

  it("เวลายกเลิกล่วงหน้า: ปุ่มลัด + ทีละ 15 นาที + ตัวอย่างเวลา", async () => {
    renderWithQuery(<RestaurantForm ownerId={9} />);
    const example = () => screen.getByText(/ยกเลิกได้ถึง/).parentElement!;
    expect(example()).toHaveTextContent("ลูกค้าจองเวลา 20:00 ยกเลิกได้ถึง 19:30");
    expect(screen.getByRole("button", { name: "ลด 15 นาที" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "2 ชั่วโมง" }));
    expect(screen.getByRole("button", { name: "2 ชั่วโมง" })).toHaveAttribute("aria-pressed", "true");
    expect(example()).toHaveTextContent("ยกเลิกได้ถึง 18:00");

    await userEvent.click(screen.getByRole("button", { name: "เพิ่ม 15 นาที" }));
    expect(screen.getByText("2 ชม. 15 นาที")).toBeInTheDocument();
    expect(example()).toHaveTextContent("ยกเลิกได้ถึง 17:45");
    expect(screen.queryByText("30 นาทีคือค่าต่ำสุดที่ระบบอนุญาต")).toBeNull();
  });

  it("รูป: ลบได้ · อัปโหลดพังบอกเหตุผลและเก็บรูปที่ขึ้นไปแล้ว · ครบ 8 รูปปุ่มเพิ่มหาย", async () => {
    let n = 0;
    const fetch = vi.fn(async () => {
      n++;
      if (n === 2) return Response.json({ error: { code: "UNSUPPORTED_FILE", message: "รับเฉพาะรูป JPG, PNG, WEBP ขนาดไม่เกิน 5MB" } }, { status: 400 });
      return Response.json({ url: `/uploads/${n}.png` }, { status: 201 });
    });
    vi.stubGlobal("fetch", fetch);
    const { container } = renderWithQuery(<RestaurantForm ownerId={9} />);

    await userEvent.upload(fileInput(container), [png("1.png"), png("2.png"), png("3.png")]);
    expect(await screen.findByText("รับเฉพาะรูป JPG, PNG, WEBP ขนาดไม่เกิน 5MB")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^ลบรูป/ })).toHaveLength(1); // รูปแรกขึ้นแล้ว รูปที่สองพัง → หยุด

    await userEvent.click(screen.getByRole("button", { name: "ลบรูป 1" }));
    expect(screen.queryByRole("button", { name: /^ลบรูป/ })).toBeNull();

    // ส่ง 10 ไฟล์ → อัปโหลดแค่ 8 (เพดานของ Go) แล้วปุ่มเพิ่มรูปหาย
    n = 10;
    fetch.mockClear();
    await userEvent.upload(fileInput(container), Array.from({ length: 10 }, (_, i) => png(`${i}.png`)));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^ลบรูป/ })).toHaveLength(8));
    expect(fetch).toHaveBeenCalledTimes(8);
    expect(screen.queryByRole("button", { name: "เพิ่มรูป" })).toBeNull();
  });

  it("Go ตอบ VALIDATION → ขึ้นใต้ช่อง · error อื่น → กล่องรวม", async () => {
    const fetch = mockFetch([
      { method: "POST", path: "/api/v1/uploads", status: 201, body: { url: "/uploads/a.png" } },
      { method: "POST", path: "/api/v1/restaurants", status: 400, body: { error: { code: "VALIDATION", message: "ข้อมูลไม่ถูกต้อง", details: { name: "ชื่อนี้ใช้ไม่ได้" } } } },
    ]);
    const { container } = renderWithQuery(<RestaurantForm ownerId={9} />);
    await userEvent.type(screen.getByLabelText("ชื่อร้าน"), "ร้าน");
    await userEvent.upload(fileInput(container), png());
    await screen.findByText("รูปหลัก");
    await submit();
    expect(await screen.findByText("ชื่อนี้ใช้ไม่ได้")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    fetch.mockResolvedValue(Response.json({ error: { code: "INTERNAL", message: "เกิดข้อผิดพลาดในระบบ" } }, { status: 500 }));
    await submit();
    expect(await screen.findByText("เกิดข้อผิดพลาดในระบบ")).toBeInTheDocument();
  });
});

describe("RestaurantForm: แก้ไขร้าน", () => {
  const initial = restaurant({ id: 3, name: "ร้านเดิม", seats: 20, openTime: "18:00", closeTime: "02:00", cancelLeadMinutes: 120, images: ["/uploads/x.jpg"] });

  it("ค่าเดิมในฟอร์ม → PUT ไปร้านนั้น", async () => {
    const fetch = mockFetch([{ method: "PUT", path: "/api/v1/restaurants/3", body: initial }]);
    renderWithQuery(<RestaurantForm initial={initial} ownerId={9} />);
    expect(screen.getByLabelText("ชื่อร้าน")).toHaveValue("ร้านเดิม");
    expect(screen.getByLabelText("จำนวนที่นั่ง")).toHaveValue(20);
    expect(screen.getByText("ปิดข้ามเที่ยงคืน")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ยกเลิก" })).toHaveAttribute("href", "/restaurants/3");

    fireEvent.change(screen.getByLabelText("จำนวนที่นั่ง"), { target: { value: "25" } });
    await submit("บันทึกการเปลี่ยนแปลง");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/restaurants/3"));
    expect(sentJSON(fetch, method(fetch, "PUT", "/api/v1/restaurants/3"))).toMatchObject({ name: "ร้านเดิม", seats: 25, cancelLeadMinutes: 120, images: ["/uploads/x.jpg"] });
  });

  it("ลบร้าน 2 ขั้น · Go ตอบ 409 → บอกเหตุผล", async () => {
    const fetch = mockFetch([
      { method: "DELETE", path: "/api/v1/restaurants/3", status: 409, body: { error: { code: "HAS_FUTURE_BOOKINGS", message: "ลบไม่ได้ เพราะยังมีการจองที่ยังไม่ถึงเวลา" } } },
    ]);
    renderWithQuery(<RestaurantForm initial={initial} ownerId={9} />);
    await userEvent.click(screen.getByRole("button", { name: "ลบร้าน" }));
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "ไม่ลบ" }));
    await userEvent.click(screen.getByRole("button", { name: "ลบร้าน" }));
    await userEvent.click(screen.getByRole("button", { name: "ยืนยันลบร้าน" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ลบไม่ได้ เพราะยังมีการจองที่ยังไม่ถึงเวลา");
    expect(screen.getByRole("button", { name: "ลบร้าน" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("ลบสำเร็จ → กลับหน้าร้านของฉัน", async () => {
    mockFetch([{ method: "DELETE", path: "/api/v1/restaurants/3", status: 204 }]);
    renderWithQuery(<RestaurantForm initial={initial} ownerId={9} />);
    await userEvent.click(screen.getByRole("button", { name: "ลบร้าน" }));
    await userEvent.click(screen.getByRole("button", { name: "ยืนยันลบร้าน" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/owner"));
  });
});
