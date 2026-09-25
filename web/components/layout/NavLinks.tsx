"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_LINKS } from "./nav";

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลัก" className="hidden gap-8 md:flex">
      {NAV_LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center px-0.5 text-base",
              active
                ? "font-bold text-vermilion shadow-[inset_0_-2px_0_var(--color-vermilion)]"
                : "font-medium text-ink-2 hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
