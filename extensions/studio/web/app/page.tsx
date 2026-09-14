import { StudioShell } from "./components/studio-shell";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <StudioShell bridgeUrl={process.env.BRIDGE_URL ?? ""} bridgeToken={process.env.BRIDGE_TOKEN ?? ""}>
      <p className="p-4 text-sm text-muted-foreground">pi studio — pick a view in the sidebar.</p>
    </StudioShell>
  );
}
