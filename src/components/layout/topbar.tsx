"use client";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dropdown, MenuItem } from "@/components/ui/dropdown";
import { apiFetch } from "@/hooks/api";
import { SimulateMenu } from "@/modules/simulation/simulate-menu";
import { NotificationCenter } from "./notification-center";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/85 px-4 backdrop-blur lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu className="size-5" /></Button>
      <div className="relative hidden max-w-sm flex-1 md:block">
        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <input
          placeholder="Search anything…" aria-label="Search"
          className="h-9 w-full rounded-lg border bg-muted/50 pr-3 pl-9 text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <SimulateMenu />
        <ThemeToggle />
        <NotificationCenter />
        <Dropdown trigger={<button aria-label="Account" className="ml-1 rounded-full"><Avatar name="Admin" size={34} /></button>}>
          {() => (
            <>
              <div className="px-3 py-2"><p className="text-sm font-medium">Admin</p><p className="text-xs text-muted-foreground">admin@socialmanager.demo</p></div>
              <MenuItem icon={<LogOut className="size-4" />} onClick={logout}>Log out</MenuItem>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
