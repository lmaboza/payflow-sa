import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { engineHealth } from "@/lib/payrollEngine";

// Compact Payroll Engine connection indicator for the top bar.
export default function EngineStatusBadge({ businessId }) {
  const [state, setState] = useState({ status: "checking" });

  useEffect(() => {
    let active = true;
    if (!businessId) {
      setState({ status: "offline", reason: "not_configured" });
      return;
    }
    engineHealth(businessId)
      .then((data) => { if (active) setState(data); })
      .catch(() => { if (active) setState({ status: "offline", reason: "unreachable" }); });
    return () => { active = false; };
  }, [businessId]);

  const connected = state.status === "connected";
  const dot = connected ? "bg-emerald-500" : state.status === "checking" ? "bg-amber-400" : "bg-rose-500";
  const label = connected ? "Engine Connected" : state.status === "checking" ? "Checking Engine…" : "Engine Offline";

  return (
    <Link
      to="/settings"
      className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-accent"
      title={state.message || label}
    >
      <span className={`relative flex h-2 w-2`}>
        <span className={`absolute inline-flex h-full w-full rounded-full ${dot} ${connected ? "opacity-75 animate-ping" : ""}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}