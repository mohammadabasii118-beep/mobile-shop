import type { ReactNode } from "react";
import { PanelShell } from "@/components/layout/panel-shell";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
