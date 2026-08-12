import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import EmployeeForm from "@/components/EmployeeForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";
import { formatZAR } from "@/lib/format";
import { can } from "@/lib/permissions";
import { Users, Plus, Search, UserPlus, Archive, Upload } from "lucide-react";

export default function Employees() {
  const { user, business } = useBusiness();
  const { toast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortBy, setSortBy] = useState("first_name");
  const [addOpen, setAddOpen] = useState(false);

  const role = user?.app_role || "business_owner";
  const canAdd = can(role, "add_employee");
  const canEdit = can(role, "edit_employee");

  const load = async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const list = await base44.entities.Employee.filter({ business_id: business.id }, "-created_date", 200);
      setEmployees(list);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not load employees", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [business?.id]);

  const filtered = useMemo(() => {
    let list = employees;
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        e.employee_number?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const va = (a[sortBy] ?? "").toString().toLowerCase();
      const vb = (b[sortBy] ?? "").toString().toLowerCase();
      return va.localeCompare(vb);
    });
    return list;
  }, [employees, search, statusFilter, sortBy]);

  const handleAdd = async (form) => {
    try {
      const created = await base44.entities.Employee.create({ ...form, business_id: business.id, status: "active" });
      await logAudit(business.id, user, "employee_created", "Employee", created.id, null, { name: `${form.first_name} ${form.last_name}` });
      toast({ title: "Employee added", description: `${form.first_name} ${form.last_name} has been added.` });
      setAddOpen(false);
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not add employee", description: e.message });
    }
  };

  const handleArchive = async (emp) => {
    try {
      await base44.entities.Employee.update(emp.id, { status: "archived" });
      await logAudit(business.id, user, "employee_archived", "Employee", emp.id, { status: "active" }, { status: "archived" });
      toast({ title: "Employee archived" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not archive", description: e.message });
    }
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${employees.filter(e=>e.status==="active").length} active employees`}
actions={
          <div className="flex items-center gap-2">
            <Link to="/employees/import"><Button variant="outline" className="gap-2"><Upload className="h-4 w-4" /> Import</Button></Link>
            {canAdd && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild><Button className="gap-2"><UserPlus className="h-4 w-4" /> Add Employee</Button></DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
                  <EmployeeForm onSubmit={handleAdd} submitLabel="Add Employee" onCancel={() => setAddOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, number or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="first_name">Sort: Name</SelectItem>
            <SelectItem value="employee_number">Sort: Employee No.</SelectItem>
            <SelectItem value="employment_date">Sort: Hire Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="No employees found"
                description={search ? "Try adjusting your search or filters." : "Add your first employee to get started."}
                action={canAdd && !search && <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Add Employee</Button>}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Employee No.</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Basic Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer hover:bg-accent/40">
                    <TableCell>
                      <Link to={`/employees/${e.id}`} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground">
                          {`${e.first_name?.[0] || ""}${e.last_name?.[0] || ""}`}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{e.first_name} {e.last_name}</div>
                          <div className="text-xs text-muted-foreground">{e.email || "—"}</div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.employee_number}</TableCell>
                    <TableCell className="hidden text-sm capitalize md:table-cell">{e.employment_type}</TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{formatZAR(e.basic_salary)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={e.status === "active" ? "border-emerald-200 text-emerald-600" : "text-muted-foreground"}>{e.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/employees/${e.id}`}><Button variant="ghost" size="sm">View</Button></Link>
                        {can(role, "archive_employee") && e.status === "active" && (
                          <Button variant="ghost" size="sm" onClick={() => handleArchive(e)}><Archive className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}