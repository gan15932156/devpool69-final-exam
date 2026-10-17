// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restaurant } from "@/test/fixtures";
import { mockFetch, renderWithQuery } from "@/test/render";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const session = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => session(), signOut: vi.fn() }));

const { RestaurantSearch } = await import("./RestaurantSearch");

const shops = [
  restaurant({ id: 1, ownerId: 2, name: "ครัวริมคลอง", avgRating: 4.8, reviewCount: 126, hasEnoughReviews: true }),
  restaurant({ id: 2, ownerId: 9, name: "ข้าวต้มท่าน้ำ", openTime: "18:00", closeTime: "02:00", crossesMidnight: true, reviewCount: 2 }),
];

beforeEach(() => {
  replace.mockReset();
  session.mockReturnValue({ data: null, status: "unauthenticated" });
});
afterEach(() => vi.unstubAllGlobals());

const urls = (fetch: ReturnType<typeof mockFetch>) => fetch.mock.calls.map(([u]) => decodeURIComponent(u));
const list = /\/api\/v1\/restaurants\?/;

describe("RestaurantSearch", () => {
  it("แสดงร้านทั้งหมด · ป้ายข้ามเที่ยงคืน / รีวิวยังน้อย · ปุ่มไปหน้าร้าน", async () => {
    const fetch = mockFetch([{ path: list, body: shops }]);
    renderWithQuery(<RestaurantSearch initialQ="" initialSort="rating" />);
    expect(screen.getByText("กำลังโหลดร้าน…")).toBeInTheDocument();
    expect(await screen.findByText("2 ร้าน")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ร้านทั้งหมด/ })).toBeInTheDocument();
    expect(screen.getByText("เปิดข้ามเที่ยงคืน")).toBeInTheDocument();
    expect(screen.getByText("รีวิวยังน้อย")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "ดูร้านและจอง" }).map((a) => a.getAttribute("href"))).toEqual(["/restaurants/1", "/restaurants/2"]);
    expect(urls(fetch)[0]).toBe("/api/v1/restaurants?q=&sort=rating");
    expect(replace).toHaveBeenLastCalledWith("/", { scroll: false });
  });

  it("ร้านของตัวเอง → ป้าย ร้านของคุณ และปุ่มไปจัดการร้าน", async () => {
    session.mockReturnValue({ data: { user: { id: "9" } }, status: "authenticated" });
    mockFetch([{ path: list, body: shops }]);
    renderWithQuery(<RestaurantSearch initialQ="" initialSort="rating" />);
    expect(await screen.findByText("ร้านของคุณ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "จัดการร้าน" })).toHaveAttribute("href", "/owner?r=2");
  });

  it("พิมพ์แล้วรอ 300ms ค่อยค้น (ไม่ยิงทุกตัวอักษร) · ใส่คำค้นใน URL", async () => {
    const fetch = mockFetch([{ path: list, body: [] }]);
    renderWithQuery(<RestaurantSearch initialQ="" initialSort="rating" />);
    await screen.findByText("0 ร้าน");
    await userEvent.type(screen.getByLabelText("ค้นหาร้าน"), "ส้มตำ");
    await waitFor(() => expect(urls(fetch)).toContain("/api/v1/restaurants?q=ส้มตำ&sort=rating"));
    // ยิงแค่ตอนเปิดหน้า กับตอนพิมพ์เสร็จ ไม่ยิงทีละตัวอักษร
    expect(urls(fetch)).toEqual(["/api/v1/restaurants?q=&sort=rating", "/api/v1/restaurants?q=ส้มตำ&sort=rating"]);
    expect(replace).toHaveBeenLastCalledWith(`/?q=${encodeURIComponent("ส้มตำ")}`, { scroll: false });
    expect(await screen.findByText(/ไม่พบร้านที่ตรงกับ “ส้มตำ”/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ผลการค้นหา “ส้มตำ”/ })).toBeInTheDocument();
  });

  it("กดค้นหา = ค้นทันที และตัดช่องว่าง", async () => {
    const fetch = mockFetch([{ path: list, body: shops }]);
    renderWithQuery(<RestaurantSearch initialQ="" initialSort="rating" />);
    await userEvent.type(screen.getByLabelText("ค้นหาร้าน"), "  ครัว  {Enter}");
    await waitFor(() => expect(urls(fetch)).toContain("/api/v1/restaurants?q=ครัว&sort=rating"));
  });

  it("เปลี่ยนการเรียง → ค้นใหม่ และจำใน URL", async () => {
    const fetch = mockFetch([{ path: list, body: shops }]);
    renderWithQuery(<RestaurantSearch initialQ="ครัว" initialSort="rating" />);
    expect(screen.getByLabelText("ค้นหาร้าน")).toHaveValue("ครัว");
    await userEvent.click(screen.getByRole("button", { name: "รีวิวมากที่สุด" }));
    expect(screen.getByRole("button", { name: "รีวิวมากที่สุด" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("เรียงจากจำนวนรีวิวมากไปน้อย")).toBeInTheDocument();
    await waitFor(() => expect(urls(fetch)).toContain("/api/v1/restaurants?q=ครัว&sort=reviews"));
    expect(replace).toHaveBeenLastCalledWith(`/?q=${encodeURIComponent("ครัว")}&sort=reviews`, { scroll: false });
  });

  it("โหลดไม่สำเร็จ → บอกให้รีเฟรช", async () => {
    mockFetch([{ path: list, status: 500, body: { error: { code: "INTERNAL", message: "x" } } }]);
    renderWithQuery(<RestaurantSearch initialQ="" initialSort="rating" />);
    expect(await screen.findByText("โหลดรายการร้านไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง")).toBeInTheDocument();
  });
});
