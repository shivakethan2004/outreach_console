"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Phone,
  Radio,
  CalendarClock,
  Users,
  ChartNoAxesCombined,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Phone },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/advisor", label: "AI Advisor", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  function renderLinks(mobile = false) {
    return links.map(({ href, label, icon: Icon }) => {
      const active = href === "/" ? pathname === href : pathname.startsWith(href);
      return (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileMenuOpen(false)}
          aria-current={active ? "page" : undefined}
          title={!mobile && sidebarCollapsed ? label : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            active
              ? "bg-navy text-white"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            mobile && "min-h-11",
            !mobile && sidebarCollapsed && "justify-center px-0"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className={!mobile && sidebarCollapsed ? "sr-only" : undefined}>{label}</span>
        </Link>
      );
    });
  }

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur md:hidden">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
            <Radio className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Outreach Console
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Main navigation"
          className="border-t border-border px-3 py-3"
        >
          <div className="grid gap-1">{renderLinks(true)}</div>
        </nav>
      )}
    </header>

    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-background px-3 py-5 transition-[width] duration-200 md:flex",
        sidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      <div
        className={cn(
          "mb-6 flex items-center",
          sidebarCollapsed ? "flex-col gap-3" : "justify-between gap-2"
        )}
      >
        <Link
          href="/"
          aria-label="Outreach Console home"
          className={cn(
            "flex min-w-0 items-center gap-3",
            sidebarCollapsed ? "justify-center" : "px-2"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
            <Radio className="h-5 w-5" />
          </span>
          {!sidebarCollapsed && (
            <span className="text-base font-semibold tracking-tight text-foreground">
              Outreach Console
            </span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
        {renderLinks()}
      </nav>
      <Button
        variant="ghost"
        aria-label={sidebarCollapsed ? "Sign out" : undefined}
        title={sidebarCollapsed ? "Sign out" : undefined}
        className={cn(
          "mt-4 w-full gap-3 text-muted-foreground",
          sidebarCollapsed ? "justify-center px-0" : "justify-start px-3"
        )}
        onClick={signOut}
      >
        <LogOut className="h-4 w-4" />
        {!sidebarCollapsed && "Sign out"}
      </Button>
    </aside>
    </>
  );
}
