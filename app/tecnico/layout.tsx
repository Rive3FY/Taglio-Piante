"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { RoleGuard } from "@/components/RoleGuard";
import { AppHeader } from "@/components/AppHeader";
import { TecnicoNav } from "@/components/TecnicoNav";
import { tecnicoBackHref } from "@/lib/tecnico/nav";
import { useTecnicoHardwareBack } from "@/lib/tecnico/useHardwareBack";

export default function TecnicoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  useTecnicoHardwareBack(search.get("da"));
  return (
    <RoleGuard ruolo="tecnico">
      <div className="tecnico-shell">
        <AppHeader title="Area tecnico" backHref={tecnicoBackHref(pathname, search.get("da"))} />
        <div className="tecnico-body">
          <TecnicoNav />
          <div className="page page-with-dock tecnico-main">{children}</div>
        </div>
      </div>
    </RoleGuard>
  );
}
