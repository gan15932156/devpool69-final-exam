// หน้า login / สมัคร ไม่มี header และ tab bar
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex-1">{children}</main>;
}
