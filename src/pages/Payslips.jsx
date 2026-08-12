import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { generatePayslip } from "@/lib/payrollEngine";
import { formatZAR, formatDate } from "@/lib/format";
import { ReceiptText, Search, Download, Eye, FileWarning, Loader2 } from "lucide-react";

export default function Payslips() {
  const { business } = useBusiness();
  const { toast } = useToast();
  const [payslips, setPayslips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!business?.id) return;
    (async () => {
      try {
        const [pays, emps] = await Promise.all([
          base44.entities.Payslip.filter({ business_id: business.id }, "-pay_date", 200),
          base44.entities.Employee.filter({ business_id: business.id }, "-created_date", 500)
        ]);
        setPayslips(pays);
        setEmployees(emps);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [business?.id]);

  const empName = (id) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  };

  const filtered = useMemo(() => payslips.filter((p) => empName(p.employee_id).toLowerCase().includes(search.toLowerCase())), [payslips, employees, search]);

  const handleDownload = async (payslip) => {
    setDownloading(true);
    try {
      const data = await generatePayslip(business.id, { payslip_id: payslip.id, employee_id: payslip.employee_id, payroll_run_id: payslip.payroll_run_id });
      if (data.status === "ok" && (data.pdf_url || data.url)) {
        window.open(data.pdf_url || data.url, "_blank");
        toast({ title: "Payslip PDF generated" });
      } else if (data.status === "offline") {
        toast({ variant: "destructive", title: "Payslip Engine Unavailable", description: data.message || "PDF generation requires the Payroll Engine." });
      } else {
        toast({ variant: "destructive", title: "Could not generate PDF", description: "The engine did not return a payslip file. Ensure the engine supports payslip generation." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Payslip Engine Unavailable", description: e.message });
    } finally { setDownloading(false); }
    if (!view) return;
  };

  return (
    <div>
      <PageHeader title="Payslips" subtitle="View and download payslips. PDF generation is handled by the Payroll Engine." />

      <div className="mb-5 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search payslips…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-border"><CardContent className="p-0">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState icon={ReceiptText} title="No payslips yet" description="Payslips are generated when you complete a payroll run." action={<Link to="/payroll"><Button variant="outline">Go to Payroll</Button></Link>} /></div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Period</TableHead><TableHead className="hidden md:table-cell">Pay Date</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="hidden text-right sm:table-cell">PAYE</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">{empName(p.employee_id)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(p.pay_period_start)} – {formatDate(p.pay_period_end)}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{formatDate(p.pay_date)}</TableCell>
                  <TableCell className="text-right text-sm">{formatZAR(p.gross_salary)}</TableCell>
                  <TableCell className="hidden text-right text-sm sm:table-cell">{formatZAR(p.paye)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatZAR(p.net_salary)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setView(p)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(p)} disabled={downloading}><Download className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payslip — {view && empName(view.employee_id)}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-accent/40 p-4">
                <div className="text-xs text-muted-foreground">Employer</div>
                <div className="font-heading text-sm font-semibold text-foreground">{business?.name}</div>
                <div className="mt-2 text-xs text-muted-foreground">Pay Period</div>
                <div className="text-sm text-foreground">{formatDate(view.pay_period_start)} – {formatDate(view.pay_period_end)}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-6">
                {[["Basic Salary", view.basic_salary], ["Allowances", view.allowances], ["Overtime", view.overtime], ["Bonus", view.bonus], ["Gross Salary", view.gross_salary], ["PAYE", view.paye], ["UIF", view.uif], ["Other Deductions", view.other_deductions], ["Net Salary", view.net_salary], ["YTD Gross", view.ytd_gross], ["YTD PAYE", view.ytd_paye], ["YTD UIF", view.ytd_uif]].map(([l, v]) => (
                  <div key={l} className="flex justify-between border-b border-border py-2 text-sm">
                    <span className="text-muted-foreground">{l}</span>
                    <span className={l === "Net Salary" ? "font-semibold text-foreground" : ""}>{formatZAR(v)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <FileWarning className="h-4 w-4" /> PDF generation requires the Payroll Engine to be connected.
              </div>
              <Button onClick={() => handleDownload(view)} disabled={downloading} className="w-full gap-2">
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}