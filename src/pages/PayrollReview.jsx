import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";
import { formatZAR, formatDate } from "@/lib/format";
import { payrollStatusMeta } from "@/lib/status";
import { can } from "@/lib/permissions";
import { validatePayroll, calculatePayroll, approvePayroll } from "@/lib/payrollEngine";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, ServerCrash, Loader2, Search,
  ShieldCheck, Calculator, BadgeCheck, Lock, ArrowRight
} from "lucide-react";

const FLOW = ["draft", "validating", "calculated", "review_required", "approved", "completed", "locked"];

export default function PayrollReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, business } = useBusiness();
  const { toast } = useToast();
  const [run, setRun] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [engineError, setEngineError] = useState(null);
  const [search, setSearch] = useState("");
  const [lastAction, setLastAction] = useState("validate");

  const role = user?.app_role || "business_owner";
  const canRun = can(role, "run_payroll");
  const canApprove = can(role, "approve_payroll");
  const canComplete = can(role, "complete_payroll");

  const load = async () => {
    try {
      const r = await base44.entities.PayrollRun.get(id);
      setRun(r);
      const [emps, lns] = await Promise.all([
        base44.entities.Employee.filter({ business_id: business.id, status: "active" }, "-created_date", 500),
        base44.entities.PayrollLineItem.filter({ payroll_run_id: id }, "-created_date", 500)
      ]);
      setEmployees(emps);
      setLines(lns);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not load payroll", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (business?.id) load(); }, [id, business?.id]);

  const buildPayload = () => ({
    payroll_run_id: id,
    business_id: business.id,
    period: { start: run.period_start, end: run.period_end, pay_date: run.pay_date, frequency: run.frequency },
    business: {
      paye_reference: business.paye_reference, uif_reference: business.uif_reference,
      sdl_number: business.sdl_number, payroll_frequency: business.payroll_frequency
    },
    employees: employees.map((e) => ({
      employee_id: e.id, employee_number: e.employee_number,
      name: `${e.first_name} ${e.last_name}`,
      basic_salary: e.basic_salary, allowances: e.allowances, deductions: e.deductions,
      medical_aid: e.medical_aid, retirement_contribution: e.retirement_contribution,
      pay_frequency: e.pay_frequency, tax_number: e.tax_number, tax_status: e.tax_status,
      uif_status: e.uif_status, sdl_status: e.sdl_status, eti_eligible: e.eti_eligible,
      employment_type: e.employment_type, period_start: e.employment_date, period_end: e.termination_date
    }))
  });

  const handleEngineError = (data, fallback) => {
    if (data?.status === "offline") {
      setEngineError({
        title: "Payroll Engine Unavailable",
        message: data.message || "Payroll calculations cannot currently be completed because the PayFlow Payroll Engine is unavailable.",
        reason: data.reason
      });
    } else if (data?.status === "engine_error") {
      setEngineError({ title: "Payroll Engine Error", message: data.userMessage || data.message || "The payroll engine returned an error.", details: data.details || (data.code ? `HTTP ${data.code}` : null) });
    } else {
      setEngineError({ title: fallback || "Operation failed", message: data?.message || "Unexpected response from the payroll engine." });
    }
  };

  const doValidate = async () => {
    setBusy("validate"); setEngineError(null); setLastAction("validate");
    try {
      await base44.entities.PayrollRun.update(id, { status: "validating" });
      setRun({ ...run, status: "validating" });
      const data = await validatePayroll(business.id, { payroll_run_id: id });
      if (data.status === "ok") {
        const newStatus = data.valid ? "validating" : "validation_failed";
        await base44.entities.PayrollRun.update(id, { status: newStatus });
        await logAudit(business.id, user, "payroll_validated", "PayrollRun", id, null, { valid: data.valid });
        setRun((r) => ({ ...r, status: newStatus, engine_valid: !!data.valid, engine_payroll_run_id: data.engine_payroll_run_id || r.engine_payroll_run_id }));
        toast({ title: data.valid ? "Validation passed" : "Validation issues found", variant: data.valid ? "default" : "destructive", description: data.summary || "" });
        load();
      } else {
        await base44.entities.PayrollRun.update(id, { status: "validation_failed" }).catch(() => {});
        setRun((r) => ({ ...r, status: "validation_failed" }));
        handleEngineError(data, "Validation failed");
      }
    } catch (e) {
      await base44.entities.PayrollRun.update(id, { status: "validation_failed" }).catch(() => {});
      setRun((r) => ({ ...r, status: "validation_failed" }));
      handleEngineError({ status: "offline", reason: "unreachable", message: e.message });
    } finally { setBusy(null); }
  };

  const doCalculate = async () => {
    setBusy("calculate"); setEngineError(null); setLastAction("calculate");
    try {
      const data = await calculatePayroll(business.id, { payroll_run_id: id });
      if (data.status === "ok") {
        await logAudit(business.id, user, "payroll_calculated", "PayrollRun", id, null, { employees: data.employee_count ?? 0 });
        toast({ title: "Payroll calculated", description: `${data.employee_count ?? 0} employees processed.` });
        load();
      } else {
        handleEngineError(data, "Calculation failed");
      }
    } catch (e) {
      handleEngineError({ status: "offline", reason: "unreachable", message: e.message });
    } finally { setBusy(null); }
  };

  const doApprove = async () => {
    setBusy("approve"); setEngineError(null); setLastAction("approve");
    try {
      const data = await approvePayroll(business.id, { ...buildPayload(), totals: { gross: run.gross_total, paye: run.paye_total, uif: run.uif_total, sdl: run.sdl_total, net: run.net_total } });
      if (data.status === "ok") {
        await base44.entities.PayrollRun.update(id, { status: "approved" });
        await logAudit(business.id, user, "payroll_approved", "PayrollRun", id, { status: run.status }, { status: "approved" });
        setRun((r) => ({ ...r, status: "approved" }));
        toast({ title: "Payroll approved" });
        load();
      } else {
        handleEngineError(data, "Approval failed");
      }
    } catch (e) {
      handleEngineError({ status: "offline", reason: "unreachable", message: e.message });
    } finally { setBusy(null); }
  };

  const doComplete = async () => {
    setBusy("complete"); setEngineError(null); setLastAction("complete");
    try {
      // Generate payslips for each line item
      if (lines.length) {
        await base44.entities.Payslip.deleteMany({ payroll_run_id: id });
        await base44.entities.Payslip.bulkCreate(
          lines.map((l) => ({
            business_id: business.id, payroll_run_id: id, employee_id: l.employee_id,
            pay_period_start: run.period_start, pay_period_end: run.period_end, pay_date: run.pay_date,
            basic_salary: l.basic_salary, allowances: l.allowances, overtime: l.overtime, bonus: l.bonus,
            gross_salary: l.gross_pay, paye: l.paye, uif: l.uif, other_deductions: l.other_deductions,
            net_salary: l.net_pay
          }))
        );
      }
      await base44.entities.PayrollRun.update(id, { status: "completed" });
      await logAudit(business.id, user, "payroll_completed", "PayrollRun", id, { status: run.status }, { status: "completed" });
      setRun((r) => ({ ...r, status: "completed" }));
      toast({ title: "Payroll completed", description: "Payslips generated." });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not complete payroll", description: e.message });
    } finally { setBusy(null); }
  };

  const retry = () => {
    setEngineError(null);
    if (lastAction === "calculate") doCalculate();
    else if (lastAction === "approve") doApprove();
    else if (lastAction === "complete") doComplete();
    else doValidate();
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>;
  if (!run) return <div className="py-20 text-center text-muted-foreground">Payroll run not found.</div>;

  const m = payrollStatusMeta(run.status);
  const locked = run.status === "completed" || run.status === "locked";
  const filtered = lines.filter((l) => (l.employee_name || "").toLowerCase().includes(search.toLowerCase()));
  const visibleEmployees = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    return !q || `${e.first_name} ${e.last_name} ${e.employee_number}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/payroll")} className="mb-4 gap-1.5"><ArrowLeft className="h-4 w-4" /> Payroll</Button>

      <PageHeader
        title={run.period_name}
        subtitle={`${formatDate(run.period_start)} – ${formatDate(run.period_end)} · Pay date ${formatDate(run.pay_date)}`}
        actions={<Badge variant="outline" className={m.cls}>{m.label}</Badge>}
      />

      {/* Workflow steps */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max items-center gap-1">
          {["Validate", "Calculate", "Review", "Approve", "Complete"].map((label, i) => {
            const stepStatus = ["validating", "calculated", "review_required", "approved", "completed"][i];
            const reached = FLOW.indexOf(run.status) >= FLOW.indexOf(stepStatus);
            return (
              <div key={label} className="flex items-center">
                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${reached ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>
                  {reached ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current" />} {label}
                </div>
                {i < 4 && <ArrowRight className="mx-1 h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      {!locked && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
          {canRun && (run.status === "draft" || run.status === "validation_failed") && <Button onClick={doValidate} disabled={!!busy} className="gap-2">{busy === "validate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Validate Employees</Button>}
          {canRun && run.engine_valid && run.engine_payroll_run_id && <Button onClick={doCalculate} disabled={!!busy} className="gap-2">{busy === "calculate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Calculate Payroll</Button>}
          {canApprove && (run.status === "calculated" || run.status === "review_required") && <Button onClick={doApprove} disabled={!!busy} className="gap-2">{busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Approve Payroll</Button>}
          {canComplete && run.status === "approved" && <Button onClick={doComplete} disabled={!!busy} className="gap-2">{busy === "complete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Complete Payroll</Button>}
        </div>
      )}

      {/* Engine error */}
      {engineError && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start gap-3">
            <ServerCrash className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="flex-1">
              <h3 className="font-heading text-sm font-semibold text-rose-900">{engineError.title}</h3>
              <p className="mt-1 text-sm text-rose-700">{engineError.message}</p>
              {engineError.reason === "not_configured" && <p className="mt-1 text-xs text-rose-600">Configure the engine URL in <Link to="/settings" className="underline">Settings → Payroll Engine</Link>.</p>}
              {engineError.details && <p className="mt-1 break-all text-xs text-rose-500/80">{typeof engineError.details === "string" ? engineError.details : JSON.stringify(engineError.details)}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>View System Status</Button>
              <Button size="sm" onClick={retry}>Retry</Button>
            </div>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          { l: "Employees", v: run.employee_count || employees.length },
          { l: "Gross", v: formatZAR(run.gross_total) },
          { l: "PAYE", v: formatZAR(run.paye_total) },
          { l: "UIF", v: formatZAR(run.uif_total) },
          { l: "SDL", v: formatZAR(run.sdl_total) },
          { l: "Net", v: formatZAR(run.net_total) }
        ].map((s) => (
          <Card key={s.l} className="border-border"><CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.l}</div>
            <div className="mt-1 font-heading text-lg font-semibold text-foreground">{s.v}</div>
          </CardContent></Card>
        ))}
      </div>

      {/* Review table */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-border"><CardContent className="p-0">
        {lines.length === 0 ? (
          employees.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No active employees found. Add or import employees before running payroll.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="text-sm text-muted-foreground"><strong className="text-foreground">{visibleEmployees.length}</strong> active employee(s) will be included in this run.</div>
                {canRun && run.status === "draft" && <span className="text-xs text-muted-foreground">Validate to begin.</span>}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee No.</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="text-right">Basic Salary</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEmployees.map((e) => (
                    <TableRow key={e.id} className="hover:bg-accent/40">
                      <TableCell>
                        <Link to={`/employees/${e.id}`} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground">{`${e.first_name?.[0] || ""}${e.last_name?.[0] || ""}`}</div>
                          <span className="text-sm font-medium text-foreground">{e.first_name} {e.last_name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.employee_number}</TableCell>
                      <TableCell className="hidden text-sm capitalize md:table-cell">{e.employment_type}</TableCell>
                      <TableCell className="text-right text-sm">{formatZAR(e.basic_salary)}</TableCell>
                      <TableCell><Badge variant="outline" className="border-emerald-200 text-emerald-600">{e.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="hidden text-right md:table-cell">Allowances</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Overtime</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Bonus</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="hidden text-right md:table-cell">PAYE</TableHead>
                <TableHead className="hidden text-right md:table-cell">UIF</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id} className={l.status === "review" ? "bg-amber-50/40" : l.status === "error" ? "bg-rose-50/40" : ""}>
                  <TableCell>
                    <Link to={`/employees/${l.employee_id}`} className="text-sm font-medium text-foreground hover:underline">{l.employee_name}</Link>
                    {l.exceptions && l.exceptions.length > 0 && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" /> {l.exceptions.join(", ")}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatZAR(l.basic_salary)}</TableCell>
                  <TableCell className="hidden text-right text-sm md:table-cell">{formatZAR(l.allowances)}</TableCell>
                  <TableCell className="hidden text-right text-sm lg:table-cell">{formatZAR(l.overtime)}</TableCell>
                  <TableCell className="hidden text-right text-sm lg:table-cell">{formatZAR(l.bonus)}</TableCell>
                  <TableCell className="text-right text-sm">{formatZAR(l.gross_pay)}</TableCell>
                  <TableCell className="hidden text-right text-sm md:table-cell">{formatZAR(l.paye)}</TableCell>
                  <TableCell className="hidden text-right text-sm md:table-cell">{formatZAR(l.uif)}</TableCell>
                  <TableCell className="hidden text-right text-sm lg:table-cell">{formatZAR(l.other_deductions)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatZAR(l.net_pay)}</TableCell>
                  <TableCell>{l.status === "review" && <Badge variant="outline" className="border-amber-200 text-amber-600">Review</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}