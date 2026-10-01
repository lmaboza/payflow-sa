import { useState, useEffect } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { formatDateTime } from "@/lib/format";
import { MessageSquare, Plus, Paperclip, Loader2, Send, Hash } from "lucide-react";

const CATEGORIES = [
  { value: "payslip", label: "Payslip Question" },
  { value: "paye", label: "PAYE Question" },
  { value: "deduction", label: "Deduction Question" },
  { value: "leave", label: "Leave Question" },
  { value: "banking", label: "Banking Question" },
  { value: "incorrect", label: "Incorrect Information" },
  { value: "other", label: "Other" }
];

const STATUS_STYLE = {
  open: "border-amber-200 bg-amber-50 text-amber-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-slate-200 bg-slate-50 text-slate-600"
};

export default function EmployeePayrollQueries() {
  const { employee, user } = useEmployee();
  const { toast } = useToast();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category: "payslip", subject: "", message: "", attachment_url: "" });
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  const load = async () => {
    if (!employee?.id) return;
    try {
      const q = await base44.entities.PayrollQuery.filter({ employee_id: employee.id }, "-created_date", 100);
      setQueries(q || []);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [employee?.id]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      setForm((f) => ({ ...f, attachment_url: res.file_uri }));
      toast({ title: "Attachment added" });
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!form.subject || !form.message) { toast({ variant: "destructive", title: "Add a subject and message" }); return; }
    setSubmitting(true);
    try {
      const ref = `PF-${Date.now().toString().slice(-6)}`;
      await base44.entities.PayrollQuery.create({
        business_id: employee.business_id,
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        reference_number: ref,
        category: form.category,
        subject: form.subject,
        status: "open",
        messages: [{
          author: user?.full_name || user?.email || "Employee",
          author_role: "employee",
          message: form.message,
          attachment_url: form.attachment_url || null,
          at: new Date().toISOString()
        }]
      });
      toast({ title: "Query submitted", description: `Reference: ${ref}` });
      setOpen(false);
      setForm({ category: "payslip", subject: "", message: "", attachment_url: "" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not submit", description: e.message });
    } finally { setSubmitting(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !active) return;
    setReplying(true);
    try {
      const updated = await base44.entities.PayrollQuery.update(active.id, {
        messages: [...(active.messages || []), { author: user?.full_name || user?.email || "Employee", author_role: "employee", message: reply.trim(), at: new Date().toISOString() }]
      });
      setActive(updated);
      setReply("");
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not send", description: e.message });
    } finally { setReplying(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <EmployeeHeader title="Payroll Queries" subtitle="Ask Payroll a question and track the conversation."
        actions={<Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Ask Payroll</Button>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          {queries.length === 0 ? (
            <Card className="border-border"><CardContent className="p-8 text-center text-sm text-muted-foreground">No queries yet.</CardContent></Card>
          ) : queries.map((q) => (
            <Card key={q.id} className={`cursor-pointer border-border transition-shadow hover:shadow-card-hover ${active?.id === q.id ? "ring-1 ring-emerald-400" : ""}`} onClick={() => setActive(q)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700"><Hash className="h-3 w-3" />{q.reference_number}</span>
                  <Badge variant="outline" className={STATUS_STYLE[q.status]}>{q.status.replace("_", " ")}</Badge>
                </div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{q.subject}</div>
                <div className="mt-1 text-[11px] capitalize text-muted-foreground">{q.category} · {q.messages?.length || 0} message(s)</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {active ? (
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{active.subject}</div>
                    <div className="text-[11px] text-muted-foreground">Ref {active.reference_number} · {active.category}</div>
                  </div>
                  <Badge variant="outline" className={STATUS_STYLE[active.status]}>{active.status.replace("_", " ")}</Badge>
                </div>
                <div className="max-h-[360px] space-y-3 overflow-y-auto">
                  {(active.messages || []).map((m, i) => (
                    <div key={i} className={`flex ${m.author_role === "employee" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.author_role === "employee" ? "bg-emerald-600 text-white" : "bg-accent text-foreground"}`}>
                        <div className="mb-0.5 text-[10px] opacity-75">{m.author_role === "employee" ? "You" : "Payroll"} · {formatDateTime(m.at)}</div>
                        <div>{m.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" onKeyDown={(e) => e.key === "Enter" && sendReply()} />
                  <Button size="icon" onClick={sendReply} disabled={replying || !reply.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                    {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border"><CardContent className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a query to view the conversation, or start a new one.</p>
            </CardContent></Card>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ask Payroll</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Subject</Label><Input className="mt-1.5" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief summary" /></div>
            <div><Label>Message</Label><Textarea className="mt-1.5" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Describe your query…" /></div>
            <div>
              <Label>Attachment</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  {form.attachment_url ? "Change file" : "Attach file"}
                  <input type="file" className="hidden" onChange={handleFile} accept="image/*,application/pdf" />
                </label>
                {form.attachment_url && <span className="text-xs text-emerald-700">Attached</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting ? "Submitting…" : "Submit Query"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}