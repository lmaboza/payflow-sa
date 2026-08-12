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
      setEngineError({ title: "Engine returned an error", message: JSON.stringify(data) });
    } else {
      setEngineError({ title: fallback || "Operation failed", message: data?.message || "Unexpected response from the payroll engine." });
    }
  };

  const doValidate = async () => {
    setBusy("validate"); setEngineError(null);
    try {
      await base44.entities.PayrollRun.update(id, { status: "validating" });
      setRun({ ...run, status: "validating" });
      const data = await validatePayroll(business.id, buildPayload());
      if (data.status === "ok") {
        const newStatus = data.valid ? "calculated" : "validation_failed";
        await base44.entities.PayrollRun.update(id, { status: newStatus });
        await logAudit(business.id, user, "payroll_validated", "PayrollRun", id, null, { valid: data.valid });
        setRun((r) => ({ ...r, status: newStatus }));
        toast({ title: data.valid ? "Validation passed" : "Validation issues found", variant: data.valid ? "default" : "destructive", description: data.summary || "" });
        load();
      } else {
        handleEngineError(data, "Validation failed");
      }
    } catch (e) {
      handleEngineError({ status: "offline", reason: "unreachable", message: e.message });
    } finally { setBusy(null); }
  };

  const doCalculate = async () => {
    setBusy("calculate"); setEngineError(null);
    try {
      const data = await calculatePayroll(business.id, buildPayload());
      if (data.status === "ok" && (data.line_items || data.results)) {
        const items = data.line_items || data.results || [];
        // Persist line items
        await base44.entities.PayrollLineItem.deleteMany({ payroll_run_id: id });
        if (items.length) {
          await base44.entities.PayrollLineItem.bulkCreate(
            items.map((it) => ({
              business_id: business.id,
              payroll_run_id: id,
              employee_id: it.employee_id || it.employeeId,
              employee_name: it.employee_name || it.name,
              basic_salary: Number(it.basic_salary) || 0,
              allowances: Number(it.allowances) || 0,
              overtime: Number(it.overtime) || 0,
              bonus: Number(it.bonus) || 0,
              gross_pay: Number(it.gross_pay || it.gross) || 0,
              paye: Number(it.paye) || 0,
              uif: Number(it.uif) || 0,
              sdl: Number(it.sdl) || 0,
              other_deductions: Number(it.other_deductions || it.deductions) || 0,
              net_pay: Number(it.net_pay || it.net) || 0,
              exceptions: it.exceptions || [],
              status: (it.exceptions && it.exceptions.length) ? "review" : "ok"
            }))
          );
        }
        const totals = data.totals || {};
        const status = items.some((it) => it.exceptions && it.exceptions.length) ? "review_required" : "calculated";
        await base44.entities.PayrollRun.update(id, {
          status,
          gross_total: Number(totals.gross || 0),
          paye_total: Number(totals.paye || 0),
          uif_total: Number(totals.uif || 0),
          sdl_total: Number(totals.sdl || 0),
          net_total: Number(totals.net || 0),
          employee_count: items.length,
          exceptions_count: items.filter((it) => it.exceptions && it.exceptions.length).length
        });
        await logAudit(business.id, user, "payroll_calculated", "PayrollRun", id, null, { employees: items.length });
        setRun((r) => ({ ...r, status, ...totals }));
        toast({ title: "Payroll calculated", description: `${items.length} employees processed.` });
        load();
      } else {
        handleEngineError(data, "Calculation failed");
      }
    } catch (e) {
      handleEngineError({ status: "offline", reason: "unreachable", message: e.message });
    } finally { setBusy(null); }
  };

  const doApprove = async () => {
    setBusy("approve"); setEngineError(null);
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
    setBusy("complete"); setEngineError(null);
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

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>;
  if (!run) return <div className="py-20 text-center text-muted-foreground">Payroll run not found.</div>;

  const m = payrollStatusMeta(run.status);
  const locked = run.status === "completed" || run.status === "locked";
  const filtered = lines.filter((l) => (l.employee_name || "").toLowerCase().includes(search.toLowerCase()));

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
          {canRun && run.status === "draft" && <Button onClick={doValidate} disabled={!!busy} className="gap-2">{busy === "validate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Validate Employees</Button>}
          {canRun && (run.status === "draft" || run.status === "validating" || run.status === "validation_failed") && <Button onClick={doCalculate} disabled={!!busy} className="gap-2">{busy === "calculate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Calculate Payroll</Button>}
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
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>View System Status</Button>
              <Button size="sm" onClick={() => { setEngineError(null); doCalculate(); }}>Retry</Button>
            </div>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          { l: "Employees", v: run.employee_count || lines.length },
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
          <div className="p-10 text-center text-sm text-muted-foreground">
            No calculations yet. {canRun && run.status === "draft" ? "Validate employees then run the calculation." : "Calculations appear here after the engine processes payroll."}
          </div>
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