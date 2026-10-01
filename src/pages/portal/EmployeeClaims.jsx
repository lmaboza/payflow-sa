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
import { formatZAR, formatDate } from "@/lib/format";
import { Wallet, Plus, Paperclip, Loader2, FileText } from "lucide-react";

const CLAIM_TYPES = [
  { value: "travel", label: "Travel" },
  { value: "medical", label: "Medical" },
  { value: "phone", label: "Phone / Data" },
  { value: "equipment", label: "Equipment" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" }
];

const STATUS_STYLE = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  submitted: "border-amber-200 bg-amber-50 text-amber-700",
  under_review: "border-blue-200 bg-blue-50 text-blue-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  paid: "border-emerald-300 bg-emerald-100 text-emerald-800"
};

export default function EmployeeClaims() {
  const { employee } = useEmployee();
  const { toast } = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ claim_type: "travel", date: "", amount: "", description: "", document_url: "" });

  const load = async () => {
    if (!employee?.id) return;
    try {
      const c = await base44.entities.Claim.filter({ employee_id: employee.id }, "-created_date", 100);
      setClaims(c || []);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [employee?.id]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      setForm((f) => ({ ...f, document_url: res.file_uri }));
      toast({ title: "Document attached" });
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!form.date || !form.amount) { toast({ variant: "destructive", title: "Fill in date and amount" }); return; }
    setSubmitting(true);
    try {
      await base44.entities.Claim.create({
        business_id: employee.business_id,
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        claim_type: form.claim_type,
        date: form.date,
        amount: Number(form.amount),
        description: form.description,
        document_url: form.document_url,
        status: "submitted"
      });
      toast({ title: "Claim submitted" });
      setOpen(false);
      setForm({ claim_type: "travel", date: "", amount: "", description: "", document_url: "" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not submit", description: e.message });
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  const totalPending = claims.filter((c) => ["submitted", "under_review"].includes(c.status)).reduce((s, c) => s + (Number(c.amount) || 0), 0);

  return (
    <div>
      <EmployeeHeader title="Claims" subtitle="Submit and track reimbursement claims."
        actions={<Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Claim</Button>} />

      {totalPending > 0 && (
        <Card className="mb-5 border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-emerald-700">Awaiting reimbursement</div>
              <div className="font-heading text-2xl font-bold text-emerald-800">{formatZAR(totalPending)}</div>
            </div>
            <Wallet className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
      )}

      {claims.length === 0 ? (
        <Card className="border-border"><CardContent className="p-10 text-center text-sm text-muted-foreground">No claims yet. Submit your first reimbursement.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <Card key={c.id} className="border-border">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize text-foreground">{c.claim_type}</span>
                    <Badge variant="outline" className={STATUS_STYLE[c.status]}>{c.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(c.date)} · {c.description || "No description"}</div>
                  {c.document_url && <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3" /> Document attached</div>}
                </div>
                <div className="font-heading text-lg font-semibold text-foreground tabular">{formatZAR(c.amount)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Claim</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Claim Type</Label>
              <Select value={form.claim_type} onValueChange={(v) => setForm({ ...form, claim_type: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{CLAIM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" className="mt-1.5" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Amount (ZAR)</Label><Input type="number" className="mt-1.5" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea className="mt-1.5" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Supporting Document</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm hover:bg-accent">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  {form.document_url ? "Change file" : "Attach file"}
                  <input type="file" className="hidden" onChange={handleFile} accept="image/*,application/pdf" />
                </label>
                {form.document_url && <span className="text-xs text-emerald-700">Attached</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting ? "Submitting…" : "Submit Claim"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}