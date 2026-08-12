import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";
import { formatDate, formatZAR } from "@/lib/format";
import { payrollStatusMeta } from "@/lib/status";
import { can } from "@/lib/permissions";
import { Calculator, Plus, ArrowRight, AlertCircle } from "lucide-react";

export default function Payroll() {
  const { user, business } = useBusiness();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ period_start: "", period_end: "", pay_date: "", frequency: "monthly", notes: "" });

  const role = user?.app_role || "business_owner";
  const canRun = can(role, "run_payroll");

  const load = async () => {
    if (!business?.id) return;
    try {
      const list = await base44.entities.PayrollRun.filter({ business_id: business.id }, "-created_date", 50);
      setRuns(list);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not load payroll runs", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [business?.id]);

  const grouped = {
    current: runs.filter((r) => ["draft", "validating", "calculated", "review_required"].includes(r.status)),
    completed: runs.filter((r) => ["approved", "completed", "locked"].includes(r.status)),
    failed: runs.filter((r) => r.status === "validation_failed")
  };

  const createRun = async () => {
    if (!draft.period_start || !draft.period_end || !draft.pay_date) {
      return toast({ variant: "destructive", title: "Please complete the period dates." });
    }
    try {
      const name = `${draft.frequency.charAt(0).toUpperCase()}${draft.frequency.slice(1)} · ${formatDate(draft.period_start)}`;
      const created = await base44.entities.PayrollRun.create({
        business_id: business.id,
        period_name: name,
        period_start: draft.period_start,
        period_end: draft.period_end,
        pay_date: draft.pay_date,
        frequency: draft.frequency || business.payroll_frequency || "monthly",
        status: "draft",
        notes: draft.notes
      });
      await logAudit(business.id, user, "payroll_created", "PayrollRun", created.id, null, { period: name });
      toast({ title: "Payroll period created" });
      setCreating(false);
      setDraft({ period_start: "", period_end: "", pay_date: "", frequency: "monthly", notes: "" });
      navigate(`/payroll/run/${created.id}`);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not create payroll", description: e.message });
    }
  };

  const Row = ({ r }) => {
    const m = payrollStatusMeta(r.status);
    return (
      <TableRow className="cursor-pointer hover:bg-accent/40" onClick={() => navigate(`/payroll/run/${r.id}`)}>
        <TableCell className="text-sm font-medium text-foreground">{r.period_name}</TableCell>
        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{formatDate(r.period_start)} – {formatDate(r.period_end)}</TableCell>
        <TableCell className="hidden text-sm md:table-cell">{formatDate(r.pay_date)}</TableCell>
        <TableCell className="text-sm">{r.employee_count || "—"}</TableCell>
        <TableCell className="hidden text-right text-sm md:table-cell">{formatZAR(r.net_total)}</TableCell>
        <TableCell><Badge variant="outline" className={m.cls}>{m.label}</Badge></TableCell>
        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/payroll/run/${r.id}`); }}>Open <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></TableCell>
      </TableRow>
    );
  };

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Create, review and complete payroll periods. Calculations are performed by the PayFlow Payroll Engine."
        actions={canRun && !creating && <Button className="gap-2" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create Payroll</Button>}
      />

      {creating && (
        <Card className="mb-6 border-border">
          <CardContent className="p-6">
            <h3 className="mb-4 font-heading text-base font-semibold">Create Payroll Period</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5"><Label className="text-xs">Period Start</Label><Input type="date" value={draft.period_start} onChange={(e) => setDraft({ ...draft, period_start: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Period End</Label><Input type="date" value={draft.period_end} onChange={(e) => setDraft({ ...draft, period_end: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Pay Date</Label><Input type="date" value={draft.pay_date} onChange={(e) => setDraft({ ...draft, pay_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Frequency</Label>
                <Select value={draft.frequency} onValueChange={(v) => setDraft({ ...draft, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={createRun}>Create & Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>
      ) : runs.length === 0 ? (
        <EmptyState icon={Calculator} title="No payroll runs yet" description="Create your first payroll period to validate employees, run calculations and approve." action={canRun && <Button className="gap-2" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create Payroll</Button>} />
      ) : (
        <div className="space-y-8">
          {grouped.failed.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-rose-700"><AlertCircle className="h-4 w-4" /> Failed Payrolls</div>
              <Card><CardContent className="p-0"><Table><TableBody>{grouped.failed.map((r) => <Row key={r.id} r={r} />)}</TableBody></Table></CardContent></Card>
            </div>
          )}
          <div>
            <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">Current Payrolls</h3>
            <Card className="border-border"><CardContent className="p-0">
              {grouped.current.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No active payroll periods.</p> : (
                <Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="hidden sm:table-cell">Dates</TableHead><TableHead className="hidden md:table-cell">Pay Date</TableHead><TableHead>Employees</TableHead><TableHead className="hidden text-right md:table-cell">Net</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{grouped.current.map((r) => <Row key={r.id} r={r} />)}</TableBody></Table>
              )}
            </CardContent></Card>
          </div>
          <div>
            <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">Completed Payrolls</h3>
            <Card className="border-border"><CardContent className="p-0">
              {grouped.completed.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No completed payrolls.</p> : (
                <Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="hidden sm:table-cell">Dates</TableHead><TableHead className="hidden md:table-cell">Pay Date</TableHead><TableHead>Employees</TableHead><TableHead className="hidden text-right md:table-cell">Net</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{grouped.completed.map((r) => <Row key={r.id} r={r} />)}</TableBody></Table>
              )}
            </CardContent></Card>
          </div>
        </div>
      )}
    </div>
  );
}