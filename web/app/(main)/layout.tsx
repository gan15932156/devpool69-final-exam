import { Header } from "@/components/layout/Header";
import { TabBar } from "@/components/layout/TabBar";

// ทุกหน้าในโฟลเดอร์ (main) มี header + tab bar · ชื่อโฟลเดอร์ในวงเล็บไม่โผล่ใน URL
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 pb-28 md:pb-0">{children}</main>
      <TabBar />
    </>
  );
}
