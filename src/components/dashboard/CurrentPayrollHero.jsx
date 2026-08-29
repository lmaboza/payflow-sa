import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatZAR, formatDate } from "@/lib/format";
import { payrollStatusMeta } from "@/lib/status";
import { CalendarClock, ArrowRight, Play, Wallet, Users, Receipt, ShieldCheck, TrendingUp } from "lucide-react";

export default function CurrentPayrollHero({ run, engineConnected, canRunPayroll }) {
  if (!run) {
    return (
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">No payroll has been created for this period</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create a payroll period to begin processing.</p>
          </div>
          {canRunPayroll && (
            <Link to="/payroll">
              <Button className="gap-2"><Play className="h-4 w-4" /> Create Payroll</Button>
            </Link>
          )}
        </div>
      </Card>
    );
  }

  const meta = payrollStatusMeta(run.status);
  const headline = run.gross_total || 0;
  const cta = run.status === "draft"
    ? { label: "Run Payroll", to: "/payroll" }
    : { label: "Review Payroll", to: `/payroll/run/${run.id}` };

  const breakdown = [
    { label: "PAYE", value: run.paye_total || 0 },
    { label: "UIF", value: run.uif_total || 0 },
    { label: "SDL", value: run.sdl_total || 0 }
  ];

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: figures */}
        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {run.period_name || "Current Payroll"}
            </span>
            <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
          </div>

          <div className="mt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated Payroll</div>
            <div className="tabular mt-1 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {formatZAR(headline)}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users style={{ width: 16, height: 16 }} />
              <span className="font-medium text-foreground">{run.employee_count || 0}</span> Employees
            </span>
            {breakdown.map((b) => (
              <span key={b.label} className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="font-medium text-foreground tabular">{formatZAR(b.value)}</span>
                {b.label}
              </span>
            ))}
          </div>

          <div className="mt-6">
            {canRunPayroll ? (
              <Link to={cta.to}>
                <Button className="gap-2">
                  {cta.label} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button disabled className="gap-2">
                {cta.label} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {!engineConnected && (
              <p className="mt-2 text-xs text-amber-600">Payroll Engine offline — calculation actions disabled.</p>
            )}
          </div>
        </div>

        {/* Right: pay date + illustration */}
        <div className="relative flex flex-col justify-between border-t border-border/70 bg-gradient-to-br from-emerald-50/60 to-slate-50 p-6 lg:border-l lg:border-t-0 sm:p-7">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pay Date</div>
            <div className="mt-2 flex items-center gap-2 text-foreground">
              <CalendarClock style={{ width: 18, height: 18 }} className="text-emerald-600" />
              <span className="font-heading text-lg font-semibold">{formatDate(run.pay_date)}</span>
            </div>
          </div>
          <div className="mt-6 hidden items-end justify-end gap-3 lg:flex">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Wallet style={{ width: 22, height: 22 }} />
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Receipt style={{ width: 22, height: 22 }} />
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <ShieldCheck style={{ width: 22, height: 22 }} />
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
              <TrendingUp style={{ width: 22, height: 22 }} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}