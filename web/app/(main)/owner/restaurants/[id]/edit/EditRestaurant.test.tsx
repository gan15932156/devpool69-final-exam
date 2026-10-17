// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { restaurant } from "@/test/fixtures";
import { mockFetch, renderWithQuery } from "@/test/render";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "9" } }, status: "authenticated" }), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { EditRestaurant } = await import("./EditRestaurant");

afterEach(() => vi.unstubAllGlobals());

describe("EditRestaurant", () => {
  it("เจ้าของ → ฟอร์มพร้อมค่าเดิม", async () => {
    mockFetch([{ path: "/api/v1/restaurants/1", body: restaurant({ ownerId: 9, name: "ร้านของฉัน" }) }]);
    renderWithQuery(<EditRestaurant id={1} myId={9} />);
    expect(screen.getByText("กำลังโหลด…")).toBeInTheDocument();
    expect(await screen.findByLabelText("ชื่อร้าน")).toHaveValue("ร้านของฉัน");
    expect(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" })).toBeInTheDocument();
  });

  it("ไม่ใช่เจ้าของ → ไม่แสดงฟอร์ม", async () => {
    mockFetch([{ path: "/api/v1/restaurants/1", body: restaurant({ ownerId: 5 }) }]);
    renderWithQuery(<EditRestaurant id={1} myId={9} />);
    expect(await screen.findByText("ไม่มีสิทธิ์แก้ไขร้านนี้")).toBeInTheDocument();
    expect(screen.queryByLabelText("ชื่อร้าน")).toBeNull();
  });

  it("โหลดไม่ได้ → ข้อความของ Go", async () => {
    mockFetch([{ path: "/api/v1/restaurants/1", status: 404, body: { error: { code: "NOT_FOUND", message: "ไม่พบร้าน" } } }]);
    renderWithQuery(<EditRestaurant id={1} myId={9} />);
    expect(await screen.findByText("ไม่พบร้าน")).toBeInTheDocument();
  });
});
