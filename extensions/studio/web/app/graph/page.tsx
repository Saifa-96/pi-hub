import { StudioShell } from "../components/studio-shell";
import { GraphView } from "../components/graph-view";

export const dynamic = "force-dynamic";

export default function GraphPage() {
  return (
    <StudioShell bridgeUrl={process.env.BRIDGE_URL ?? ""} bridgeToken={process.env.BRIDGE_TOKEN ?? ""}>
      <GraphView />
    </StudioShell>
  );
}
