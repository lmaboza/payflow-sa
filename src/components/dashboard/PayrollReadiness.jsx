import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

function CheckRow({ label, value, status }) {
  const Icon = status === "ok" ? CheckCircle2 : status === "warn" ? AlertTriangle : XCircle;
  const color = status === "ok" ? "text-emerald-500" : status === "warn" ? "text-amber-500" : "text-rose-500";
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <Icon style={{ width: 15, height: 15 }} className={color} />
        {value}
      </span>
    </div>
  );
}

export default function PayrollReadiness({ checks, pct }) {
  const ok = checks.filter((c) => c.status === "ok").length;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payroll Readiness</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-5">
          <div className="relative h-24 w-24 shrink-0">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#10B981" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 2 * Math.PI * 42} 999`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-heading text-2xl font-bold text-foreground tabular">{pct}%</span>
              <span className="text-[11px] text-muted-foreground">{ok}/{checks.length} ready</span>
            </div>
          </div>
          <div className="flex-1 divide-y divide-border/70">
            {checks.map((c) => (
              <CheckRow key={c.label} label={c.label} value={c.value} status={c.status} />
            ))}
          </div>
        </div>
        <Link to="/compliance" className="mt-4 block">
          <Button variant="outline" size="sm" className="w-full">Resolve Issues</Button>
        </Link>
      </CardContent>
    </Card>
  );
}