import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import EmployeeForm from "@/components/EmployeeForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";
import { formatZAR, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { ArrowLeft, Pencil, ShieldCheck, Banknote, FileText, History, ScrollText } from "lucide-react";

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-muted-foreground" /> {title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, business } = useBusiness();
  const { toast } = useToast();
  const [employee, setEmployee] = useState(null);
  const [bank, setBank] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [audit, setAudit] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const role = user?.app_role || "business_owner";
  const canViewSensitive = can(role, "view_sensitive");

  useEffect(() => {
    (async () => {
      try {
        const emp = await base44.entities.Employee.get(id);
        setEmployee(emp);
        const [banks, pays, audits] = await Promise.all([
          base44.entities.EmployeeBankAccount.filter({ employee_id: id }).then((r) => r[0] || null).catch(() => null),
          base44.entities.Payslip.filter({ employee_id: id }, "-pay_date", 20),
          base44.entities.AuditLog.filter({ entity: "Employee", entity_id: id }, "-date_time", 10)
        ]);
        setBank(banks);
        setPayslips(pays);
        setAudit(audits);
      } catch (e) {
        toast({ variant: "destructive", title: "Employee not found", description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>;
  if (!employee) return <div className="py-20 text-center text-muted-foreground">Employee not found.</div>;

  const handleSave = async (form) => {
    try {
      const prev = { ...employee };
      await base44.entities.Employee.update(id, form);
      await logAudit(business.id, user, "employee_updated", "Employee", id, prev, form);
      toast({ title: "Employee updated" });
      setEditOpen(false);
      setEmployee({ ...employee, ...form });
    } catch (e) {
      toast({ variant: "destructive", title: "Update failed", description: e.message });
    }
  };

  const masked = (v) => (canViewSensitive ? v : v ? "••••••••" : "—");

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/employees")} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Employees
      </Button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-foreground">
            {`${employee.first_name?.[0] || ""}${employee.last_name?.[0] || ""}`}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">{employee.first_name} {employee.last_name}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{employee.employee_number}</span>
              <Badge variant="outline" className={employee.status === "active" ? "border-emerald-200 text-emerald-600" : ""}>{employee.status}</Badge>
              <span className="capitalize">· {employee.employment_type}</span>
            </div>
          </div>
        </div>
        {can(role, "edit_employee") && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
              <EmployeeForm initial={employee} onSubmit={handleSave} submitLabel="Save Changes" onCancel={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!canViewSensitive && (
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
          <ShieldCheck className="h-4 w-4" /> Your role limits access to sensitive banking and tax details.
        </div>
      )}

      <Tabs defaultValue="personal">
        <TabsList className="mb-6 flex w-full flex-wrap justify-start">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Payroll History</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
        </TabsList>

        <TabsContent value="personal"><Section title="Personal Information" icon={FileText}>
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <InfoRow label="Employee Number" value={employee.employee_number} />
            <InfoRow label="ID Number" value={employee.id_number} />
            <InfoRow label="Passport Number" value={employee.passport_number} />
            <InfoRow label="Date of Birth" value={formatDate(employee.date_of_birth)} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Mobile" value={employee.mobile} />
            <div className="sm:col-span-2"><InfoRow label="Address" value={employee.address} /></div>
          </div>
        </Section></TabsContent>

        <TabsContent value="employment"><Section title="Employment Information" icon={FileText}>
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <InfoRow label="Employment Date" value={formatDate(employee.employment_date)} />
            <InfoRow label="Termination Date" value={formatDate(employee.termination_date)} />
            <InfoRow label="Employment Type" value={employee.employment_type} />
            <InfoRow label="Department" value={employee.department_id} />
            <InfoRow label="Position" value={employee.position_id} />
            <InfoRow label="Branch" value={employee.branch_id} />
          </div>
        </Section></TabsContent>

        <TabsContent value="payroll"><Section title="Payroll Information" icon={History}>
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <InfoRow label="Basic Salary" value={formatZAR(employee.basic_salary)} />
            <InfoRow label="Pay Frequency" value={employee.pay_frequency} />
            <InfoRow label="Allowances" value={formatZAR(employee.allowances)} />
            <InfoRow label="Deductions" value={formatZAR(employee.deductions)} />
            <InfoRow label="Medical Aid" value={formatZAR(employee.medical_aid)} />
            <InfoRow label="Retirement Contribution" value={formatZAR(employee.retirement_contribution)} />
          </div>
        </Section></TabsContent>

        <TabsContent value="tax"><Section title="Tax Information" icon={ShieldCheck}>
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <InfoRow label="Tax Number" value={masked(employee.tax_number)} />
            <InfoRow label="Tax Status" value={employee.tax_status} />
            <InfoRow label="UIF Status" value={employee.uif_status} />
            <InfoRow label="SDL Status" value={employee.sdl_status} />
            <InfoRow label="ETI Eligible" value={employee.eti_eligible ? "Yes" : "No"} />
          </div>
        </Section></TabsContent>

        <TabsContent value="banking"><Section title="Banking Information" icon={Banknote}>
          {bank ? (
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <InfoRow label="Bank Name" value={bank.bank_name} />
              <InfoRow label="Account Number" value={masked(bank.account_number)} />
              <InfoRow label="Account Type" value={bank.account_type} />
              <InfoRow label="Branch Code" value={masked(bank.branch_code)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No bank account on record.</p>
          )}
        </Section></TabsContent>

        <TabsContent value="documents"><Section title="Documents" icon={FileText}>
          <p className="text-sm text-muted-foreground">Employee documents are managed in the Documents module.</p>
          <Link to="/documents"><Button variant="outline" size="sm" className="mt-3">Go to Documents</Button></Link>
        </Section></TabsContent>

        <TabsContent value="history"><Section title="Payroll History" icon={History}>
          {payslips.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payslips yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Pay Date</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
              <TableBody>
                {payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{formatDate(p.pay_period_start)} – {formatDate(p.pay_period_end)}</TableCell>
                    <TableCell className="text-sm">{formatDate(p.pay_date)}</TableCell>
                    <TableCell className="text-right text-sm">{formatZAR(p.gross_salary)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatZAR(p.net_salary)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section></TabsContent>

        <TabsContent value="audit"><Section title="Audit History" icon={ScrollText}>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit history for this employee.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm font-medium">{a.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.user_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(a.date_time)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section></TabsContent>
      </Tabs>
    </div>
  );
}