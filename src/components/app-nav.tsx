"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Library, Compass, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/app", label: "Search", icon: Search, exact: true },
  { href: "/app/library", label: "Library", icon: Library, exact: false },
  { href: "/app/discover", label: "Discover", icon: Compass, exact: false },
  { href: "/app/settings", label: "Settings", icon: Settings, exact: false },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        // The reader lives under /app/article but belongs to Library.
        const isLibrary = href === "/app/library";
        const activeForReader =
          isLibrary && pathname.startsWith("/app/article");
        const isActive = active || activeForReader;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand/10 text-brand"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
