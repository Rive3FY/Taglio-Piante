"use client";

import { SessionProvider } from "@/lib/SessionContext";
import { SyncProvider } from "@/lib/SyncContext";
import { PwaRegister } from "@/components/PwaRegister";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SyncProvider>
        <PwaRegister />
        {children}
      </SyncProvider>
    </SessionProvider>
  );
}
