import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { Prajamyam } from "@/components/ui/Prajamyam";

type Item = { badge: ReactNode; title: string; text: string };

// โครงหน้า login / สมัคร: แผงครามลายประจำยามด้านซ้าย (≥1024px) + การ์ดฟอร์มด้านขวา
export function AuthShell({
  headline,
  intro,
  items,
  footnote,
  children,
}: {
  headline: ReactNode;
  intro: string;
  items: Item[];
  footnote: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <section className="bg-prajamyam hidden w-[min(640px,45vw)] shrink-0 text-cream lg:block">
        <div className="flex h-full flex-col justify-between gap-10 px-[72px] py-14">
          <Logo tone="dark" />
          <div className="flex flex-col gap-6">
            <h1 className="font-heading text-[52px] leading-[1.3] tracking-[-0.01em]">{headline}</h1>
            <p className="max-w-[460px] text-lg leading-[1.7] text-[#D9DCEA]">{intro}</p>
            <div className="flex flex-col gap-3.5">
              {items.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-4 rounded-lg border border-gold-on-dark/45 bg-cream/8 px-5 py-[18px]"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-on-dark font-heading text-xl text-indigo">
                    {item.badge}
                  </span>
                  <div>
                    <div className="font-heading text-lg">{item.title}</div>
                    <div className="mt-0.5 text-[15px] text-[#D9DCEA]">{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="flex items-center gap-2.5 text-[15px] text-[#C9CEE2]">
            <Prajamyam size={18} className="text-gold-on-dark" />
            {footnote}
          </p>
        </div>
      </section>
      <div aria-hidden className="hidden w-4 shrink-0 bg-vermilion shadow-[inset_3px_0_0_var(--color-gold-on-dark)] lg:block" />
      <section className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 px-4 py-8 md:p-12">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex w-full max-w-[520px] flex-col gap-5 rounded-2xl border border-line-strong bg-surface p-6 shadow-[0_0_0_6px_var(--color-paper),0_0_0_7px_var(--color-line)] md:p-9">
          {children}
        </div>
      </section>
    </div>
  );
}
