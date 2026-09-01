"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { AppHeader } from "@/components/AppHeader";
import { TecnicoNav } from "@/components/TecnicoNav";

export default function TecnicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard ruolo="tecnico">
      <AppHeader title="Area tecnico" />
      <div className="page">
        <TecnicoNav />
        {children}
      </div>
    </RoleGuard>
  );
}
