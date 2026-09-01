"use client";

import { usePathname } from "next/navigation";
import { RoleGuard } from "@/components/RoleGuard";
import { AppHeader } from "@/components/AppHeader";

export default function OperatoreLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RoleGuard ruolo="operatore">
      <AppHeader title="Operatore sul campo" backHref={pathname === "/operatore" ? undefined : "/operatore"} />
      <div className="page">{children}</div>
    </RoleGuard>
  );
}
