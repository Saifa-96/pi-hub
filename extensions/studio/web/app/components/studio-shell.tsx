"use client";

import { useEffect, useState } from "react";
import { Separator, SidebarInset, SidebarProvider, SidebarTrigger } from "shadcn-ui-lib/ui";
import { AppSidebar } from "./app-sidebar";

interface Hello {
  type: "hello";
  busy: boolean;
  model?: string;
  cwd?: string;
  session?: string;
}

type BridgeEvent = Hello | { type: "busy"; busy: boolean };

export function StudioShell({ bridgeUrl, bridgeToken, children }: { bridgeUrl: string; bridgeToken: string; children: React.ReactNode }) {
  const [hello, setHello] = useState<Hello | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const configured = bridgeUrl !== "" && bridgeToken !== "";

  useEffect(() => {
    if (!configured) return;
    const es = new EventSource(`${bridgeUrl}/events?token=${encodeURIComponent(bridgeToken)}`);
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data) as BridgeEvent;
      if (ev.type === "hello") {
        setHello(ev);
        setBusy(ev.busy);
      } else if (ev.type === "busy") {
        setBusy(ev.busy);
      }
    };
    es.onerror = () => setError("bridge connection lost (pi session ended or restarted)");
    return () => es.close();
  }, [bridgeUrl, bridgeToken, configured]);

  if (!configured) {
    return (
      <p className="p-4 text-sm text-destructive">
        Bridge not configured — start this app via the <code>/studio</code> command in pi.
      </p>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <h1 className="text-sm font-semibold">pi studio</h1>
          <span
            className={`ml-1 inline-block size-2 rounded-full ${busy ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`}
          />
          <span className="truncate text-xs text-muted-foreground">
            {hello?.model ?? "…"}
            {hello?.cwd ? ` · ${hello.cwd}` : ""}
          </span>
        </header>
        {error && <p className="border-b bg-destructive/10 px-4 py-1 text-xs text-destructive">{error}</p>}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
