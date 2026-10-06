"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Phone,
  Radio,
  CalendarClock,
  Users,
  ChartNoAxesCombined,
  Settings,
  LogOut,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/setup" || pathname === "/sign-in") return null;

  async function signOut() {
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign out.");
      router.replace("/sign-in");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-navy text-white">
            <Radio className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Outreach Console
          </span>
        </Link>
        <nav className="flex max-w-full items-center gap-1 overflow-x-auto">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3",
                  active
                    ? "bg-navy text-white"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
