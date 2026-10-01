import { useState, useEffect, useMemo } from "react";
import { useEmployee } from "@/lib/useEmployee";
import EmployeeHeader from "@/components/portal/EmployeeHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { formatZAR, formatDate } from "@/lib/format";
import { CalendarDays, Plus, Clock, CheckCircle2, XCircle, Calendar as CalIcon } from "lucide-react";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "family_responsibility", label: "Family Responsibility" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "study", label: "Study Leave" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "other", label: "Other" }
];

const STATUS_STYLE = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
  draft: "border-slate-200 bg-slate-50 text-slate-600"
};

function daysBetween(a, b) {
  return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
}

function MiniCalendar({ requests }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const leaveDays = new Set();
  (requests || []).filter((r) => r.status === "approved" || r.status === "pending").forEach((r) => {
    const s = new Date(r.start_date), e = new Date(r.end_date);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === year && d.getMonth() === month) leaveDays.add(d.getDate());
    }
  });

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <CalIcon className="h-4 w-4 text-muted-foreground" /> {today.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => (
            <div key={i} className={`flex h-8 items-center justify-center rounded-md text-xs ${
              d === null ? "" : leaveDays.has(d) ? "bg-emerald-100 font-semibold text-emerald-700" : "text-foreground"
            } ${d === today.getDate() ? "ring-1 ring-emerald-400" : ""}`}>
              {d || ""}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100" /> Scheduled leave
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmployeeLeave() {
  const { employee } = useEmployee();
  const { toast } = useToast();
  const [balance, setBalance] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leave_type: "annual", start_date: "", end_date: "", reason: "" });

  const load = async () => {
    if (!employee?.id) return;
    try {
      const [bal, reqs] = await Promise.all([
        base44.entities.LeaveBalance.filter({ employee_id: employee.id }, "-created_date", 1),
        base44.entities.LeaveRequest.filter({ employee_id: employee.id }, "-created_date", 100)
      ]);
      setBalance(bal?.[0] || null);
      setRequests(reqs || []);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [employee?.id]);

  const cards = useMemo(() => {
    if (!balance) return [];
    return [
      { label: "Annual Leave", total: balance.annual_total || 0, used: balance.annual_used || 0 },
      { label: "Sick Leave", total: balance.sick_total || 0, used: balance.sick_used || 0 },
      { label: "Family Responsibility", total: balance.family_total || 0, used: balance.family_used || 0 },
      { label: "Study Leave", total: balance.study_total || 0, used: balance.study_used || 0 }
    ];
  }, [balance]);

  const submit = async () => {
    if (!form.start_date || !form.end_date) { toast({ variant: "destructive", title: "Select dates" }); return; }
    setSubmitting(true);
    try {
      await base44.entities.LeaveRequest.create({
        business_id: employee.business_id,
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        days: daysBetween(form.start_date, form.end_date),
        reason: form.reason,
        status: "pending"
      });
      toast({ title: "Leave request submitted" });
      setOpen(false);
      setForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not submit", description: e.message });
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <div>
      <EmployeeHeader title="Leave" subtitle="Balances, requests and history."
        actions={<Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Request Leave</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.length === 0 ? (
          <Card className="col-span-full border-border"><CardContent className="p-5 text-sm text-muted-foreground">Leave balances not configured yet. Contact your HR administrator.</CardContent></Card>
        ) : cards.map((c) => {
          const left = Math.max(0, c.total - c.used);
          return (
            <Card key={c.label} className="border-border">
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
                <div className="mt-1 font-heading text-2xl font-semibold text-foreground">{left}<span className="text-sm font-normal text-muted-foreground"> / {c.total} days</span></div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${c.total ? Math.min(100, (c.used / c.total) * 100) : 0}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{c.used} used</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="pending">
            <TabsList className="mb-4">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
              <RequestList items={requests.filter((r) => r.status === "pending" || r.status === "draft")} empty="No pending requests." />
            </TabsContent>
            <TabsContent value="approved">
              <RequestList items={requests.filter((r) => r.status === "approved")} empty="No approved leave." />
            </TabsContent>
            <TabsContent value="history">
              <RequestList items={requests.filter((r) => ["rejected", "cancelled", "approved"].includes(r.status))} empty="No leave history." />
            </TabsContent>
          </Tabs>
        </div>
        <MiniCalendar requests={requests} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Leave Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" className="mt-1.5" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" className="mt-1.5" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Reason</Label><Textarea className="mt-1.5" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestList({ items, empty }) {
  if (!items || items.length === 0) return <Card className="border-border"><CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent></Card>;
  return (
    <div className="space-y-3">
      {items.map((r) => (
        <Card key={r.id} className="border-border">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize text-foreground">{r.leave_type?.replace("_", " ")}</span>
                <Badge variant="outline" className={STATUS_STYLE[r.status]}>{r.status}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{formatDate(r.start_date)} – {formatDate(r.end_date)} · {r.days} day(s)</div>
              {r.reason && <div className="mt-1 text-xs text-muted-foreground">{r.reason}</div>}
              {r.decision_note && <div className="mt-1 text-xs italic text-muted-foreground">“{r.decision_note}”</div>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}