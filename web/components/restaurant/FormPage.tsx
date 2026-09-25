import Link from "next/link";

// กรอบหน้าสร้าง/แก้ไขร้าน: breadcrumb + หัวข้อ
export function FormPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pt-5 pb-10 md:px-8 md:pt-7 md:pb-[72px] xl:px-0">
      <nav aria-label="เส้นทาง" className="flex items-center gap-2 text-base text-muted">
        <Link href="/owner" className="flex min-h-11 items-center">
          ร้านของฉัน
        </Link>
        <span aria-hidden>/</span>
        <span>{title}</span>
      </nav>
      <h1 className="font-heading text-[32px] leading-tight tracking-[-0.01em] md:text-[52px]">{title}</h1>
      {children}
    </div>
  );
}
