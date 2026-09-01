"use client";

import { usePathname } from "next/navigation";
import { RoleGuard } from "@/components/RoleGuard";
import { AppHeader } from "@/components/AppHeader";
import { SquadraDialog } from "@/components/SquadraDialog";

export default function OperatoreLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RoleGuard ruolo="operatore">
      <AppHeader title="Operatore sul campo" backHref={pathname === "/operatore" ? undefined : "/operatore"} />
      <SquadraDialog />
      <div className="page page-with-dock">{children}</div>
    </RoleGuard>
  );
}
