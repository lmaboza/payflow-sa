import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZAR, formatDate, formatDateTime } from "@/lib/format";
import { payrollHealth, payrollStatusMeta, complianceStatusMeta } from "@/lib/status";
import { can } from "@/lib/permissions";
import {
  Users, Wallet, Receipt, ShieldCheck, AlertTriangle, Play, ArrowRight,
  CalendarClock, Activity, TrendingUp
} from "lucide-react";

export default function Dashboard() {
  const { user, business } = useBusiness();
  const navigate = useNavigate();
  const [data, setData] = useState({ employees: [], runs: [], compliance: [], audit: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business?.id) return;
    (async () => {
      try {
        const [employees, runs, compliance, audit] = await Promise.all([
          base44.entities.Employee.filter({ business_id: business.id, status: "active" }),
          base44.entities.PayrollRun.filter({ business_id: business.id }, "-created_date", 10),
          base44.entities.ComplianceEvent.filter({ business_id: business.id }),
          base44.entities.AuditLog.filter({ business_id: business.id }, "-date_time", 6)
        ]);
        setData({ employees, runs, compliance, audit });
      } catch (e) {
      } finally {
        setLoading(false);
      }
    })();
  }, [business?.id]);

  const role = user?.app_role || "business_owner";
  const latest = data.runs[0];
  const health = payrollHealth(latest);
  const totals = latest || {};
  const overdueCompliance = data.compliance.filter((c) => c.status === "overdue" || c.status === "action_required");

  const stats = [
    { label: "Active Employees", value: data.employees.length, icon: Users, accent: "text-blue-600 bg-blue-50" },
    { label: "Gross Payroll", value: formatZAR(totals.gross_total), icon: Wallet, accent: "text-slate-700 bg-slate-100" },
    { label: "PAYE", value: formatZAR(totals.paye_total), icon: Receipt, accent: "text-violet-600 bg-violet-50" },
    { label: "UIF", value: formatZAR(totals.uif_total), icon: ShieldCheck, accent: "text-amber-600 bg-amber-50" },
    { label: "SDL", value: formatZAR(totals.sdl_total), icon: ShieldCheck, accent: "text-emerald-600 bg-emerald-50" },
    { label: "Net Payroll", value: formatZAR(totals.net_total), icon: TrendingUp, accent: "text-emerald-700 bg-emerald-50" }
  ];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user?.full_name?.split(" ")[0] || "there"}.`}
        actions={
          can(role, "run_payroll") && (
            <Button onClick={() => navigate("/payroll")} className="gap-2">
              <Play className="h-4 w-4" /> Run Payroll
            </Button>
          )
        }
      />

      {/* Payroll health banner */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className={`h-3 w-3 rounded-full ${health.dot || "bg-slate-400"}`} />
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payroll Health</div>
            <div className="font-heading text-lg font-semibold text-foreground">{health.label}</div>
          </div>
          {latest && (
            <div className="ml-2 hidden border-l border-border pl-4 sm:block">
              <div className="text-xs text-muted-foreground">Current Period</div>
              <div className="text-sm font-medium text-foreground">{latest.period_name || `${formatDate(latest.period_start)} – ${formatDate(latest.period_end)}`}</div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${health.cls}`}>{health.label}</span>
          {latest && <Link to={`/payroll/run/${latest.id}`} className="text-sm font-medium text-primary hover:underline">Open payroll →</Link>}
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="border-border">
            <CardContent className="p-5">
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${s.accent}`}>
                <s.icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="mt-1 font-heading text-xl font-semibold text-foreground">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Outstanding actions */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Outstanding Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {overdueCompliance.length === 0 && !latest ? (
              <EmptyState icon={ShieldCheck} title="All clear" description="No outstanding actions. Your payroll and compliance are up to date." />
            ) : (
              <>
                {overdueCompliance.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <div>
                        <div className="text-sm font-medium text-foreground">{c.type} — {c.action_required || "Action required"}</div>
                        <div className="text-xs text-muted-foreground">Due {formatDate(c.due_date)}</div>
                      </div>
                    </div>
                    <Link to="/compliance"><Button variant="outline" size="sm">Resolve</Button></Link>
                  </div>
                ))}
                {latest && (latest.status === "draft" || latest.status === "review_required") && (
                  <div className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div className="flex items-center gap-3">
                      <CalendarClock className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="text-sm font-medium text-foreground">Payroll {payrollStatusMeta(latest.status).label.toLowerCase()}</div>
                        <div className="text-xs text-muted-foreground">{latest.period_name}</div>
                      </div>
                    </div>
                    <Link to={`/payroll/run/${latest.id}`}><Button variant="outline" size="sm">Continue <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {data.audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <ol className="space-y-4">
                {data.audit.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                    <div>
                      <div className="text-sm text-foreground"><span className="font-medium">{a.action}</span> · {a.entity}</div>
                      <div className="text-xs text-muted-foreground">{a.user_name} · {formatDateTime(a.date_time)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming deadlines */}
      <Card className="mt-6 border-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">Upcoming Compliance Deadlines</CardTitle></CardHeader>
        <CardContent>
          {data.compliance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No compliance events yet. Connect the Payroll Engine to populate compliance data.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.compliance.slice(0, 6).map((c) => {
                const m = complianceStatusMeta(c.status);
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{c.type}</div>
                      <div className="text-xs text-muted-foreground">Due {formatDate(c.due_date)}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${m.cls}`}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}