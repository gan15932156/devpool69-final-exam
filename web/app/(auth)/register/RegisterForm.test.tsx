// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockFetch, sentJSON } from "@/test/render";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...a: unknown[]) => signIn(...a) }));

const { RegisterForm } = await import("./RegisterForm");

const assign = vi.fn();
beforeEach(() => {
  signIn.mockReset().mockResolvedValue({ ok: true });
  assign.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
});
afterEach(() => vi.unstubAllGlobals());

type FillValues = { name?: string; email?: string; password?: string; confirm?: string; agree?: boolean };

// กรอกฟอร์มสมัคร · ไม่ส่ง confirm = พิมพ์ซ้ำเหมือน password
async function fill({ name = "ต้น", email = "ton@example.com", password = "password1", confirm, agree = true }: FillValues = {}) {
  confirm ??= password;
  if (name) await userEvent.type(screen.getByLabelText("ชื่อที่แสดง"), name);
  if (email) await userEvent.type(screen.getByLabelText("อีเมล"), email);
  if (password) await userEvent.type(screen.getByLabelText("รหัสผ่าน"), password);
  if (confirm) await userEvent.type(screen.getByLabelText("ยืนยันรหัสผ่าน"), confirm);
  if (agree) await userEvent.click(screen.getByRole("checkbox"));
}

const submitButton = () => screen.getByRole("button", { name: /^สมัคร/ });
const rule = (text: string) => screen.getByText(text).closest("li")!;

describe("RegisterForm", () => {
  it("checklist รหัสผ่านอัปเดตตามที่พิมพ์ · ปุ่มเปิดเมื่อครบทุกช่อง", async () => {
    render(<RegisterForm />);
    expect(submitButton()).toBeDisabled();
    const rules = () => ["อย่างน้อย 8 ตัว", "มีตัวเลข", "ยืนยันตรงกัน"].map((t) => rule(t).textContent);
    expect(rules()).toEqual(["ยังไม่ผ่าน: อย่างน้อย 8 ตัว", "ยังไม่ผ่าน: มีตัวเลข", "ยังไม่ผ่าน: ยืนยันตรงกัน"]);

    await userEvent.type(screen.getByLabelText("รหัสผ่าน"), "abcdefgh");
    expect(rules()).toEqual(["ผ่าน: อย่างน้อย 8 ตัว", "ยังไม่ผ่าน: มีตัวเลข", "ยังไม่ผ่าน: ยืนยันตรงกัน"]);
    await userEvent.clear(screen.getByLabelText("รหัสผ่าน"));

    await fill({ agree: false });
    expect(rules()).toEqual(["ผ่าน: อย่างน้อย 8 ตัว", "ผ่าน: มีตัวเลข", "ผ่าน: ยืนยันตรงกัน"]);
    expect(submitButton()).toBeDisabled(); // ยังไม่ยอมรับข้อกำหนด
    await userEvent.click(screen.getByRole("checkbox"));
    expect(submitButton()).toBeEnabled();
  });

  it("รหัสยืนยันไม่ตรง → ปุ่มปิด", async () => {
    render(<RegisterForm />);
    await fill({ confirm: "password2" });
    expect(submitButton()).toBeDisabled();
  });

  it("สมัครสำเร็จ → login ต่อทันทีแล้วไปหน้าแรก", async () => {
    const fetch = mockFetch([{ method: "POST", path: "/api/v1/auth/register", status: 201, body: {} }]);
    render(<RegisterForm />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "สมัครและเริ่มใช้งาน" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(sentJSON(fetch, 0)).toEqual({ name: "ต้น", email: "ton@example.com", password: "password1" }); // ไม่ส่ง confirm/agree
    expect(signIn).toHaveBeenCalledWith("credentials", { email: "ton@example.com", password: "password1", redirect: false });
  });

  it("อยากเปิดร้านด้วย → ไปหน้าสร้างร้าน", async () => {
    mockFetch([{ method: "POST", path: "/api/v1/auth/register", status: 201, body: {} }]);
    render(<RegisterForm />);
    await fill();
    const toggle = screen.getByRole("switch", { name: /อยากเปิดร้านด้วย/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("button", { name: "สมัครแล้วไปสร้างร้าน" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/owner/restaurants/new"));
  });

  it("อีเมลซ้ำ → ขึ้นใต้ช่องอีเมล ไม่ login", async () => {
    mockFetch([{ method: "POST", path: "/api/v1/auth/register", status: 409, body: { error: { code: "EMAIL_TAKEN", message: "อีเมลนี้มีบัญชีอยู่แล้ว" } } }]);
    render(<RegisterForm />);
    await fill();
    await userEvent.click(submitButton());
    expect(await screen.findByText("อีเมลนี้มีบัญชีอยู่แล้ว")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("Go ตอบ VALIDATION → ขึ้นใต้ช่องนั้น · error อื่น → กล่องรวม", async () => {
    const fetch = mockFetch([
      { method: "POST", path: "/api/v1/auth/register", status: 400, body: { error: { code: "VALIDATION", message: "ข้อมูลไม่ถูกต้อง", details: { password: "รหัสผ่านยาวเกินไป" } } } },
    ]);
    render(<RegisterForm />);
    await fill();
    await userEvent.click(submitButton());
    expect(await screen.findByText("รหัสผ่านยาวเกินไป")).toBeInTheDocument();

    fetch.mockResolvedValue(Response.json({ error: { code: "TOO_MANY_REQUESTS", message: "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" } }, { status: 429 }));
    await userEvent.type(screen.getByLabelText("รหัสผ่าน"), "2");
    await userEvent.type(screen.getByLabelText("ยืนยันรหัสผ่าน"), "2");
    await userEvent.click(submitButton());
    expect(await screen.findByText("ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});
