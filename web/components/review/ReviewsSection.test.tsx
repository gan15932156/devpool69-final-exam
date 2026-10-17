// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restaurant } from "@/test/fixtures";
import { mockFetch, renderWithQuery, sentJSON } from "@/test/render";

const session = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => session(), signOut: vi.fn() }));

const { ReviewsSection } = await import("./ReviewsSection");

const shop = restaurant({ id: 1, ownerId: 9, avgRating: 4.2, reviewCount: 5, hasEnoughReviews: true, distribution: { 1: 0, 2: 0, 3: 0, 4: 4, 5: 1 } });
const review = (id: number, extra: object = {}) => ({
  id,
  rating: 4,
  comment: `รีวิว ${id}`,
  userName: `คน ${id}`,
  isMine: false,
  createdAt: "2026-09-20T10:00:00Z",
  updatedAt: "2026-09-21T10:00:00Z",
  ...extra,
});
const page = (items: object[], total = items.length, mine: object | null = null) => ({ total, items, mine });
const listPath = /\/api\/v1\/restaurants\/1\/reviews\?offset=0$/;

const asCustomer = () => session.mockReturnValue({ data: { user: { id: "2" } }, status: "authenticated" });
beforeEach(() => session.mockReturnValue({ data: null, status: "unauthenticated" }));
afterEach(() => vi.unstubAllGlobals());

describe("ReviewsSection", () => {
  it("สรุปคะแนนและการกระจายดาว", async () => {
    mockFetch([{ path: listPath, body: page([]) }]);
    renderWithQuery(<ReviewsSection restaurant={shop} />);
    expect(screen.getByText("4.2")).toBeInTheDocument();
    expect(screen.getByText("เฉลี่ยจาก 5 รีวิว")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4.2 จาก 5 ดาว" })).toBeInTheDocument();
    const row = screen.getByText("4 ดาว").parentElement!;
    expect(within(row).getByText("4")).toBeInTheDocument();
  });

  it("ยังไม่มีรีวิว", () => {
    mockFetch([{ path: listPath, body: page([]) }]);
    renderWithQuery(<ReviewsSection restaurant={restaurant()} />);
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีรีวิว")).toBeInTheDocument();
  });

  it("ยังไม่ login → ปุ่มไป login แล้วกลับมาที่ส่วนรีวิว", () => {
    mockFetch([{ path: listPath, body: page([]) }]);
    renderWithQuery(<ReviewsSection restaurant={shop} />);
    expect(screen.getByRole("link", { name: "เข้าสู่ระบบ" })).toHaveAttribute("href", "/login?callbackUrl=/restaurants/1%23review");
    expect(screen.queryByRole("group", { name: "ให้คะแนน 1 ถึง 5 ดาว" })).toBeNull();
  });

  it("เจ้าของร้าน → ไม่มีฟอร์ม เห็นกล่องล็อกแทน", async () => {
    session.mockReturnValue({ data: { user: { id: "9" } }, status: "authenticated" });
    mockFetch([{ path: listPath, body: page([]) }]);
    renderWithQuery(<ReviewsSection restaurant={shop} />);
    expect(screen.getByText("รีวิวร้านของตัวเองไม่ได้")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "ให้คะแนน 1 ถึง 5 ดาว" })).toBeNull();
  });

  it("เขียนรีวิวใหม่: ต้องเลือกดาวก่อน → PUT แล้วบอกว่าบันทึกแล้ว · โหลดรายการใหม่", async () => {
    asCustomer();
    const fetch = mockFetch([
      { path: listPath, body: page([]) },
      { method: "PUT", path: "/api/v1/restaurants/1/reviews/me", body: review(1, { isMine: true }) },
    ]);
    renderWithQuery(<ReviewsSection restaurant={shop} />);
    expect(await screen.findByText("เขียนรีวิวของคุณ")).toBeInTheDocument();
    const post = screen.getByRole("button", { name: "โพสต์รีวิว" });
    expect(post).toBeDisabled();
    expect(screen.getByText("แตะดาวเพื่อให้คะแนน")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "ให้ 4 ดาว" }));
    expect(screen.getByText("4 ดาว — ดีมาก")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("ข้อความรีวิว"), "อร่อย");
    await userEvent.click(post);

    expect(await screen.findByText("บันทึกรีวิวแล้ว ขอบคุณครับ")).toBeInTheDocument();
    const put = fetch.mock.calls.findIndex(([, init]) => init?.method === "PUT");
    expect(sentJSON(fetch, put)).toEqual({ rating: 4, comment: "อร่อย" });
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => listPath.test(url))).toHaveLength(2));

    // แก้ค่าต่อ → ข้อความ "บันทึกแล้ว" หาย เพราะค่าบนจอยังไม่ได้บันทึก
    await userEvent.click(screen.getByRole("button", { name: "ให้ 5 ดาว" }));
    expect(screen.queryByText("บันทึกรีวิวแล้ว ขอบคุณครับ")).toBeNull();
  });

  it("เคยรีวิวแล้ว → ฟอร์มขึ้นค่าเดิมเป็นโหมดแก้ไข", async () => {
    asCustomer();
    const mine = review(3, { isMine: true, rating: 2, comment: "ช้า", userName: "ต้น" });
    mockFetch([{ path: listPath, body: page([mine], 1, mine) }]);
    renderWithQuery(<ReviewsSection restaurant={shop} />);
    expect(await screen.findByText("แก้ไขรีวิวของคุณ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ให้ 2 ดาว" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("ข้อความรีวิว")).toHaveValue("ช้า");
    expect(screen.getByRole("button", { name: "บันทึกรีวิว" })).toBeEnabled();
    expect(screen.getByText("(รีวิวของคุณ)")).toBeInTheDocument();
  });

  it("Go ตอบ error → แสดงข้อความของ Go", async () => {
    asCustomer();
    mockFetch([
      { path: listPath, body: page([]) },
      { method: "PUT", path: "/api/v1/restaurants/1/reviews/me", status: 403, body: { error: { code: "OWN_RESTAURANT", message: "รีวิวร้านของตัวเองไม่ได้" } } },
    ]);
    renderWithQuery(<ReviewsSection restaurant={shop} />);
    await userEvent.click(await screen.findByRole("button", { name: "ให้ 5 ดาว" }));
    await userEvent.click(screen.getByRole("button", { name: "โพสต์รีวิว" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("รีวิวร้านของตัวเองไม่ได้");
  });

  it("รายการรีวิว + ดูเพิ่มทีละหน้า จนครบ total", async () => {
    const first = Array.from({ length: 20 }, (_, i) => review(i + 1));
    const fetch = mockFetch([
      { path: listPath, body: page(first, 21) },
      { path: /reviews\?offset=20$/, body: page([review(21, { userName: "เชฟนิด", comment: "" })], 21) },
    ]);
    renderWithQuery(<ReviewsSection restaurant={shop} />);
    expect(await screen.findByText("รีวิว 20")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(20);
    expect(screen.getAllByText("21 ก.ย. 2569")).toHaveLength(20); // วันที่จาก updatedAt

    await userEvent.click(screen.getByRole("button", { name: "ดูรีวิวเพิ่ม" }));
    expect(await screen.findByText("เชฟนิด")).toBeInTheDocument();
    expect(screen.getByText("ช")).toBeInTheDocument(); // ตัวอักษรแรกข้ามสระหน้า
    expect(screen.getAllByRole("article")).toHaveLength(21);
    expect(screen.queryByRole("button", { name: "ดูรีวิวเพิ่ม" })).toBeNull();
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/v1/restaurants/1/reviews?offset=20");
  });
});
