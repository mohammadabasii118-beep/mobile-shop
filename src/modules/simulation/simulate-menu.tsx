"use client";
import { Bot, FlaskConical, MessageCircle, MessagesSquare, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown, MenuItem } from "@/components/ui/dropdown";
import { useSimulation, type SimKind } from "./simulation-provider";

const ITEMS: { kind: SimKind; label: string; icon: typeof Send }[] = [
  { kind: "telegram", label: "Simulate Telegram Post", icon: Send },
  { kind: "comment", label: "Simulate Instagram Comment", icon: MessageCircle },
  { kind: "message", label: "Simulate Instagram DM", icon: MessagesSquare },
  { kind: "customer", label: "Simulate New Customer", icon: UserPlus },
];

export function SimulateMenu() {
  const { simulate, busy } = useSimulation();
  return (
    <Dropdown trigger={<Button variant="outline" size="sm" disabled={busy}><FlaskConical className="size-4" /><span className="hidden sm:inline">Simulate</span></Button>}>
      {(close) => (
        <>
          <p className="px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Demo events</p>
          {ITEMS.map(({ kind, label, icon: Icon }) => (
            <MenuItem key={kind} icon={<Icon className="size-4 text-muted-foreground" />} onClick={() => { close(); simulate(kind); }}>{label}</MenuItem>
          ))}
          <div className="my-1 border-t" />
          <MenuItem icon={<Bot className="size-4 text-primary" />} onClick={() => { close(); simulate("full"); }}>🚀 Run Full Demo</MenuItem>
        </>
      )}
    </Dropdown>
  );
}
