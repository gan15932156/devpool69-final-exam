// เพิ่ม matcher ของ DOM เช่น toBeInTheDocument() / toBeDisabled() ให้ expect
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// ล้าง component ที่ render ไว้หลังแต่ละ test (ไม่มี globals: true จึงไม่ล้างให้เอง)
afterEach(() => cleanup());

// jsdom ยังไม่มี <dialog>.showModal()/close() → ทำแบบย่อ: เปิด = ใส่ open · ปิด = เอา open ออกแล้วยิง event close เหมือนเบราว์เซอร์
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
