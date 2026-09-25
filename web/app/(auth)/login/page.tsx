import { Store, UtensilsCrossed } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";
import { safeCallbackUrl } from "@/lib/require-session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams; // Next.js 16: searchParams เป็น Promise
  return (
    <AuthShell
      headline={
        <>
          บัญชีเดียว
          <br />
          ใช้ได้สองบทบาท
        </>
      }
      intro="ร้านที่คุณสร้างเอง คุณคือเจ้าของ ร้านของคนอื่น คุณคือลูกค้าและผู้รีวิว ไม่ต้องสมัครแยก"
      items={[
        { badge: <UtensilsCrossed size={20} />, title: "ลูกค้า · ร้านของคนอื่น", text: "ดูร้าน จอง แก้ไข ยกเลิก และเขียนรีวิว" },
        { badge: <Store size={20} />, title: "เจ้าของ · ร้านของฉัน", text: "สร้างร้าน ตั้งที่นั่ง เวลาเปิด–ปิด และเวลายกเลิกล่วงหน้า" },
      ]}
      footnote="รีวิวร้านของตัวเองไม่ได้ เพื่อให้คะแนนมาจากลูกค้าจริง"
    >
      <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />
    </AuthShell>
  );
}
