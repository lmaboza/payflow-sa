import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";
import { formatDate } from "@/lib/format";
import { FolderClosed, Upload, FileText, Plus } from "lucide-react";

export default function Documents() {
  const { user, business } = useBusiness();
  const { toast } = useToast();
  const [docs, setDocs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "other", employee_id: "", file: null });

  const load = async () => {
    if (!business?.id) return;
    try {
      const [d, e] = await Promise.all([
        base44.entities.EmployeeDocument.filter({ business_id: business.id }, "-uploaded_date", 200),
        base44.entities.Employee.filter({ business_id: business.id, status: "active" }, "-created_date", 500)
      ]);
      setDocs(d);
      setEmployees(e);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [business?.id]);

  const empName = (id) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  };

  const handleUpload = async () => {
    if (!form.file || !form.name || !form.employee_id) {
      return toast({ variant: "destructive", title: "Please complete all fields and select a file." });
    }
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: form.file });
      const created = await base44.entities.EmployeeDocument.create({
        business_id: business.id,
        employee_id: form.employee_id,
        name: form.name,
        type: form.type,
        file_url,
        uploaded_date: new Date().toISOString()
      });
      await logAudit(business.id, user, "document_uploaded", "EmployeeDocument", created.id, null, { name: form.name });
      toast({ title: "Document uploaded" });
      setOpen(false);
      setForm({ name: "", type: "other", employee_id: "", file: null });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    }
  };

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Employee contracts, IDs and supporting documents stored securely."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Upload Document</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Employee</Label>
                  <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Document Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="id">ID Document</SelectItem>
                      <SelectItem value="tax">Tax Document</SelectItem>
                      <SelectItem value="bank">Bank Document</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">File</Label>
                  <Input type="file" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
                </div>
                <Button onClick={handleUpload} className="w-full gap-2"><Upload className="h-4 w-4" /> Upload</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="border-border"><CardContent className="p-0">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>
        ) : docs.length === 0 ? (
          <div className="p-6"><EmptyState icon={FolderClosed} title="No documents yet" description="Upload contracts, IDs and supporting documents for your employees." /></div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Employee</TableHead><TableHead className="hidden md:table-cell">Type</TableHead><TableHead className="hidden md:table-cell">Uploaded</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-muted-foreground" /> {d.name}</TableCell>
                  <TableCell className="text-sm">{empName(d.employee_id)}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="outline" className="capitalize">{d.type}</Badge></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(d.uploaded_date)}</TableCell>
                  <TableCell className="text-right"><a href={d.file_url} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm">View</Button></a></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}