import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import { Button } from "@/components/ui/button";
import { engineHealth } from "@/lib/payrollEngine";
import { can } from "@/lib/permissions";
import { Play, ChevronDown } from "lucide-react";
import CurrentPayrollHero from "@/components/dashboard/CurrentPayrollHero";
import KpiCards from "@/components/dashboard/KpiCards";
import PayrollCostTrend from "@/components/dashboard/PayrollCostTrend";
import PayrollReadiness from "@/components/dashboard/PayrollReadiness";
import ComplianceOverview from "@/components/dashboard/ComplianceOverview";
import OutstandingActions from "@/components/dashboard/OutstandingActions";
import RecentActivity from "@/components/dashboard/RecentActivity";
import SystemStatus from "@/components/dashboard/SystemStatus";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function currentMonthLabel() {
  return new Date().toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

export default function Dashboard() {
  const { user, business } = useBusiness();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business?.id) return;
    let active = true;
    (async () => {
      try {
        const [employees, runs, compliance, audit, bankAccounts] = await Promise.all([
          base44.entities.Employee.filter({ business_id: business.id, status: "active" }),
          base44.entities.PayrollRun.filter({ business_id: business.id }, "-created_date", 50),
          base44.entities.ComplianceEvent.filter({ business_id: business.id }),
          base44.entities.AuditLog.filter({ business_id: business.id }, "-date_time", 8),
          base44.entities.EmployeeBankAccount.filter({ business_id: business.id })
        ]);
        let health = null;
        try { health = await engineHealth(business.id); } catch { health = { status: "offline" }; }
        if (!active) return;
        setData({ employees, runs, compliance, audit, bankAccounts, health, checkedAt: new Date() });
      } catch {
        if (active) setData({ employees: [], runs: [], compliance: [], audit: [], bankAccounts: [], health: { status: "offline" }, checkedAt: new Date() });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [business?.id]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-8 w-64" />
            <SkeletonBlock className="h-4 w-80" />
          </div>
          <SkeletonBlock className="h-10 w-36" />
        </div>
        <SkeletonBlock className="h-56 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SkeletonBlock className="h-80 lg:col-span-2" />
          <SkeletonBlock className="h-80" />
        </div>
      </div>
    );
  }

  const role = user?.app_role || "business_owner";
  const canRunPayroll = can(role, "run_payroll");
  const engineConnected = data.health?.status === "connected";

  const latest = data.runs[0];
  const previous = data.runs[1];
  const overdueCompliance = data.compliance.filter((c) => c.status === "overdue" || c.status === "action_required");

  // Readiness checks (real data only)
  const totalEmp = data.employees.length;
  const withTax = data.employees.filter((e) => e.tax_number).length;
  const bankCount = data.bankAccounts.length;
  const checks = [
    { label: "Employees validated", value: `${totalEmp} / ${totalEmp}`, status: totalEmp > 0 ? "ok" : "warn" },
    { label: "Banking details", value: bankCount >= totalEmp && totalEmp > 0 ? "Complete" : `${bankCount} / ${totalEmp}`, status: bankCount >= totalEmp && totalEmp > 0 ? "ok" : "warn" },
    { label: "Tax information", value: `${withTax} / ${totalEmp}`, status: withTax >= totalEmp ? "ok" : "warn" },
    { label: "Payroll Engine", value: engineConnected ? "Connected" : "Offline", status: engineConnected ? "ok" : "bad" },
    { label: "Compliance", value: overdueCompliance.length ? "Action Required" : "Ready", status: overdueCompliance.length ? "warn" : "ok" }
  ];
  const okCount = checks.filter((c) => c.status === "ok").length;
  const readinessPct = Math.round((okCount / checks.length) * 100);

  const firstName = user?.full_name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{greeting()}, {firstName}.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's your payroll position for {currentMonthLabel()}.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground">
            {currentMonthLabel()}
            <ChevronDown style={{ width: 15, height: 15 }} className="text-muted-foreground" />
          </div>
          {canRunPayroll && (
            <Button onClick={() => navigate("/payroll")} disabled={!engineConnected} className="gap-2">
              <Play style={{ width: 16, height: 16 }} /> Run Payroll
            </Button>
          )}
        </div>
      </div>

      {/* Hero */}
      <CurrentPayrollHero run={latest} engineConnected={engineConnected} canRunPayroll={canRunPayroll} />

      {/* KPI row */}
      <KpiCards current={latest || {}} previous={previous} activeEmployees={data.employees.length} />

      {/* Mid section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PayrollCostTrend runs={data.runs} />
        <PayrollReadiness checks={checks} pct={readinessPct} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ComplianceOverview compliance={data.compliance} />
        <OutstandingActions overdueCompliance={overdueCompliance} latestRun={latest} />
      </div>

      {/* Lower section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentActivity audit={data.audit} />
        <SystemStatus health={data.health} checkedAt={data.checkedAt} />
      </div>
    </div>
  );
}