"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_LINKS } from "./nav";

// แถบเมนูล่างจอ แสดงเฉพาะจอเล็กกว่า 768px (md:hidden)
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line-strong bg-surface px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),12px)] shadow-[inset_0_3px_0_var(--color-indigo)] md:hidden"
    >
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[54px] flex-1 flex-col items-center justify-center gap-[3px] text-xs font-bold",
              active ? "text-vermilion" : "text-ink-2",
            )}
          >
            <Icon size={22} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
