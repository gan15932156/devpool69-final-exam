// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...a: unknown[]) => signIn(...a) }));

const { LoginForm } = await import("./LoginForm");

const assign = vi.fn();
beforeEach(() => {
  signIn.mockReset();
  assign.mockReset();
  // jsdom เปลี่ยนหน้าจริงไม่ได้ → แทน location.assign
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
});

async function fill(email: string, password: string) {
  if (email) await userEvent.type(screen.getByLabelText("อีเมล"), email);
  if (password) await userEvent.type(screen.getByLabelText("รหัสผ่าน"), password);
  await userEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
}

describe("LoginForm", () => {
  it("ตรวจฟอร์มก่อนส่ง (ไม่เรียก signIn)", async () => {
    render(<LoginForm callbackUrl="/" />);
    await fill("not-email", "");
    expect(await screen.findByText("รูปแบบอีเมลไม่ถูกต้อง")).toBeInTheDocument();
    expect(screen.getByText("กรุณากรอกรหัสผ่าน")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("สำเร็จ → โหลดหน้า callbackUrl ใหม่ทั้งหน้า", async () => {
    signIn.mockResolvedValue({ ok: true, error: undefined });
    render(<LoginForm callbackUrl="/restaurants/1" />);
    await fill("usr2@email.com", "123456");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/restaurants/1"));
    expect(signIn).toHaveBeenCalledWith("credentials", { email: "usr2@email.com", password: "123456", redirect: false });
  });

  it("รหัสผิด → ข้อความรวม ไม่บอกว่าช่องไหนผิด", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", code: "credentials" });
    render(<LoginForm callbackUrl="/" />);
    await fill("usr2@email.com", "wrong");
    expect(await screen.findByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("Go ตอบ 429 → บอกให้รอ แทนที่จะบอกว่ารหัสผิด", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", code: "too_many_attempts" });
    render(<LoginForm callbackUrl="/" />);
    await fill("usr2@email.com", "wrong");
    expect(await screen.findByText("ใส่รหัสผ่านผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่")).toBeInTheDocument();
  });
});
