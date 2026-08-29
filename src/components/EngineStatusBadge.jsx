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
  const label = connected ? "Engine Connected" : state.status === "checking" ? "Checking…" : "Engine Offline";
  const chip = connected
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
    : state.status === "checking"
      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
      : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";

  return (
    <Link
      to="/settings"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${chip}`}
      title={state.message || label}
    >
      <span className={`relative flex h-2 w-2`}>
        {connected && <span className={`absolute inline-flex h-full w-full rounded-full ${dot} opacity-75 animate-ping`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden">{connected ? "Connected" : "Offline"}</span>
    </Link>
  );
}