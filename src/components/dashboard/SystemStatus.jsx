import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Server, Database, BookOpen, GitBranch, Clock } from "lucide-react";

function Row({ icon: Icon, label, value, dot }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Icon style={{ width: 15, height: 15 }} />
        {label}
      </span>
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        {value}
      </span>
    </div>
  );
}

export default function SystemStatus({ health, checkedAt }) {
  const connected = health?.status === "connected";
  const dbConnected = connected && health?.database && health.database !== "disconnected";
  const taxYear = health?.tax_year || "—";
  const version = health?.version || "—";
  const lastCheck = checkedAt
    ? checkedAt.toLocaleString("en-ZA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">System Status</CardTitle>
        <Link to="/settings" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline">
          View System Status <ArrowRight style={{ width: 13, height: 13 }} />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/70">
          <Row icon={Server} label="Payroll Engine" value={connected ? "Connected" : "Offline"} dot={connected ? "bg-emerald-500" : "bg-rose-500"} />
          <Row icon={Database} label="Database" value={dbConnected ? "Connected" : "Offline"} dot={dbConnected ? "bg-emerald-500" : "bg-rose-500"} />
          <Row icon={BookOpen} label="Tax Rules" value={taxYear} />
          <Row icon={GitBranch} label="Engine Version" value={version} />
          <Row icon={Clock} label="Last Health Check" value={lastCheck} />
        </div>
      </CardContent>
    </Card>
  );
}