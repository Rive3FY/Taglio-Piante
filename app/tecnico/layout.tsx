"use client";

import { usePathname } from "next/navigation";
import { RoleGuard } from "@/components/RoleGuard";
import { AppHeader } from "@/components/AppHeader";
import { TecnicoNav } from "@/components/TecnicoNav";

function tecnicoBackHref(pathname: string) {
  if (pathname === "/tecnico") return undefined;
  if (pathname.startsWith("/tecnico/rapportini/")) return "/tecnico/in-attesa";
  if (pathname === "/tecnico/campate/importa") return "/tecnico/campate";
  return "/tecnico";
}

export default function TecnicoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RoleGuard ruolo="tecnico">
      <AppHeader title="Area tecnico" backHref={tecnicoBackHref(pathname)} />
      <div className="page page-with-dock">
        <TecnicoNav />
        {children}
      </div>
    </RoleGuard>
  );
}
