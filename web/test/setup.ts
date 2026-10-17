// เพิ่ม matcher ของ DOM เช่น toBeInTheDocument() / toBeDisabled() ให้ expect
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// ล้าง component ที่ render ไว้หลังแต่ละ test (ไม่มี globals: true จึงไม่ล้างให้เอง)
afterEach(() => cleanup());
