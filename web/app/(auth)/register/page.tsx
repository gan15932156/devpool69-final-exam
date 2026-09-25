import { AuthShell } from "@/components/layout/AuthShell";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <AuthShell
      headline={
        <>
          สมัครครั้งเดียว
          <br />
          จองก็ได้ เปิดร้านก็ได้
        </>
      }
      intro="เริ่มจากเป็นลูกค้าก่อน แล้วค่อยเปิดร้านของตัวเองเมื่อพร้อม ใช้บัญชีเดียวกันทั้งหมด"
      items={[
        // เลขไทยใช้เฉพาะลำดับขั้นตอนที่เป็นการตกแต่ง (HANDOFF §3)
        { badge: "๑", title: "สร้างบัญชี", text: "ชื่อที่แสดง อีเมล และรหัสผ่าน" },
        { badge: "๒", title: "จองโต๊ะและรีวิว", text: "จองร้านของคนอื่น แก้ไข ยกเลิก ให้ดาว 1–5" },
        { badge: "๓", title: "เปิดร้านของคุณ", text: "ตั้งที่นั่ง เวลาเปิด–ปิด และเวลายกเลิกล่วงหน้า" },
      ]}
      footnote="ร้านของคุณเองจะรีวิวไม่ได้ เพื่อให้คะแนนมาจากลูกค้าจริง"
    >
      <RegisterForm />
    </AuthShell>
  );
}
