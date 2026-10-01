import { useState, useEffect } from "react";
import { useEmployee } from "@/lib/useEmployee";
import EmployeeHeader from "@/components/portal/EmployeeHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { formatZAR, formatDate } from "@/lib/format";
import { User, Phone, Briefcase, ShieldCheck, Banknote, FileText, Pencil, Loader2, Clock } from "lucide-react";

function InfoRow({ label, value, masked }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{masked ? "••••••••" : (value || "—")}</span>
    </div>
  );
}

const SECTIONS = {
  personal: { label: "Personal", fields: ["address"] },
  contact: { label: "Contact", fields: ["email", "mobile"] },
  banking: { label: "Banking", fields: ["bank_name", "account_number", "branch_code"] }
};

export default function EmployeeMyDetails() {
  const { employee } = useEmployee();
  const { toast } = useToast();
  const [bank, setBank] = useState(null);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, section: "personal", field: "" });
  const [newValue, setNewValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!employee?.id) return;
    try {
      const [banks, ch] = await Promise.all([
        base44.entities.EmployeeBankAccount.filter({ employee_id: employee.id }, "-created_date", 1),
        base44.entities.EmployeeChangeRequest.filter({ employee_id: employee.id }, "-created_date", 50)
      ]);
      setBank(banks?.[0] || null);
      setChanges(ch || []);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [employee?.id]);

  const requestChange = async () => {
    if (!newValue || !dialog.field) { toast({ variant: "destructive", title: "Enter a new value" }); return; }
    setSubmitting(true);
    try {
      await base44.entities.EmployeeChangeRequest.create({
        business_id: employee.business_id,
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        section: dialog.section,
        field: dialog.field,
        field_label: dialog.field.replace(/_/g, " "),
        previous_value: "(on file)",
        new_value: newValue,
        status: "pending"
      });
      toast({ title: "Change request submitted", description: "Your payroll administrator will review it." });
      setDialog({ open: false, section: "personal", field: "" });
      setNewValue("");
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not submit", description: e.message });
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  const pendingCount = changes.filter((c) => c.status === "pending").length;

  return (
    <div>
      <EmployeeHeader title="My Details" subtitle="Sensitive information is masked. Changes require employer approval." />

      {pendingCount > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <Clock className="h-4 w-4" /> You have {pendingCount} change request(s) awaiting approval.
        </div>
      )}

      <Tabs defaultValue="personal">
        <TabsList className="mb-6 flex w-full flex-wrap justify-start">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="changes">Change Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> Personal Information</span>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setDialog({ open: true, section: "personal", field: "address" })}><Pencil className="h-3.5 w-3.5" /> Request change</Button>
            </CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <InfoRow label="Employee Number" value={employee.employee_number} />
                <InfoRow label="ID Number" value={employee.id_number} masked />
                <InfoRow label="Passport Number" value={employee.passport_number} masked />
                <InfoRow label="Date of Birth" value={formatDate(employee.date_of_birth)} />
                <div className="sm:col-span-2"><InfoRow label="Address" value={employee.address} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Phone className="h-4 w-4 text-muted-foreground" /> Contact Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <InfoRow label="Email" value={employee.email} />
                <InfoRow label="Mobile" value={employee.mobile} />
              </div>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setDialog({ open: true, section: "contact", field: "mobile" })}>Request contact change</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4 text-muted-foreground" /> Employment Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <InfoRow label="Employment Date" value={formatDate(employee.employment_date)} />
                <InfoRow label="Employment Type" value={employee.employment_type} />
                <InfoRow label="Pay Frequency" value={employee.pay_frequency} />
                <InfoRow label="Status" value={employee.status} />
                <InfoRow label="Basic Salary" value={formatZAR(employee.basic_salary)} masked />
                <InfoRow label="Allowances" value={formatZAR(employee.allowances)} masked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> Tax Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <InfoRow label="Tax Number" value={employee.tax_number} masked />
                <InfoRow label="Tax Status" value={employee.tax_status} />
                <InfoRow label="UIF Status" value={employee.uif_status} />
                <InfoRow label="SDL Status" value={employee.sdl_status} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banking">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Banknote className="h-4 w-4 text-muted-foreground" /> Banking Information</span>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setDialog({ open: true, section: "banking", field: "account_number" })}><Pencil className="h-3.5 w-3.5" /> Request change</Button>
            </CardTitle></CardHeader>
            <CardContent>
              {bank ? (
                <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <InfoRow label="Bank Name" value={bank.bank_name} />
                  <InfoRow label="Account Number" value={bank.account_number} masked />
                  <InfoRow label="Account Type" value={bank.account_type} />
                  <InfoRow label="Branch Code" value={bank.branch_code} masked />
                </div>
              ) : <p className="text-sm text-muted-foreground">No bank account on record.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changes">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-muted-foreground" /> My Change Requests</CardTitle></CardHeader>
            <CardContent>
              {changes.length === 0 ? <p className="text-sm text-muted-foreground">No change requests submitted.</p> : (
                <div className="space-y-3">
                  {changes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                      <div>
                        <div className="text-sm font-medium capitalize text-foreground">{c.field_label || c.field?.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground">New value: {c.new_value}</div>
                        {c.decision_note && <div className="text-xs italic text-muted-foreground">“{c.decision_note}”</div>}
                      </div>
                      <Badge variant="outline" className={c.status === "approved" ? "border-emerald-200 text-emerald-700" : c.status === "rejected" ? "border-rose-200 text-rose-700" : "border-amber-200 text-amber-700"}>{c.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog({ ...dialog, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a change</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Field</Label>
              <Input className="mt-1.5 capitalize" value={dialog.field?.replace(/_/g, " ")} disabled />
            </div>
            <div>
              <Label>New Value</Label>
              <Input className="mt-1.5" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Enter the new value" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">This won't change your records directly — your payroll administrator must approve it first.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ ...dialog, open: false })}>Cancel</Button>
            <Button onClick={requestChange} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting ? "Submitting…" : "Submit Request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}