import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useEmployee } from "@/lib/useEmployee";
import EmployeeHeader from "@/components/portal/EmployeeHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { downloadPayslipPdf } from "@/lib/payslipPdf";
import { base44 } from "@/api/base44Client";
import { formatZAR, formatDate } from "@/lib/format";
import { ReceiptText, Eye, Download, MessageCircle, Loader2 } from "lucide-react";

export default function EmployeePayslips() {
  const { employee, business } = useEmployee();
  const { toast } = useToast();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState("all");
  const [period, setPeriod] = useState("all");
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (!employee?.id) return;
    (async () => {
      try {
        const pays = await base44.entities.Payslip.filter({ employee_id: employee.id }, "-pay_date", 100);
        setPayslips(pays || []);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [employee?.id]);

  const years = useMemo(() => {
    const set = new Set();
    (payslips || []).forEach((p) => { if (p.pay_date) set.add(new Date(p.pay_date).getFullYear()); });
    return ["all", ...Array.from(set).sort((a, b) => b - a)];
  }, [payslips]);

  const periods = useMemo(() => {
    const set = new Set((payslips || []).filter((p) => p.pay_period_start).map((p) => `${p.pay_period_start}|${p.pay_period_end}`));
    return ["all", ...Array.from(set)];
  }, [payslips]);

  const filtered = useMemo(() => (payslips || []).filter((p) => {
    if (year !== "all" && p.pay_date && new Date(p.pay_date).getFullYear() !== Number(year)) return false;
    if (period !== "all" && `${p.pay_period_start}|${p.pay_period_end}` !== period) return false;
    return true;
  }), [payslips, year, period]);

  const handleDownload = async (p) => {
    setDownloadingId(p.id);
    try {
      const result = await downloadPayslipPdf({ payslip: p, employee, business });
      if (result.ok) toast({ title: "Payslip PDF ready" });
      else if (result.status === "generating") toast({ title: "Preparing payslip", description: result.message });
      else toast({ variant: "destructive", title: "Payslip PDF unavailable", description: result.message || "Unable to generate your payslip PDF." });
    } catch (e) {
      toast({ variant: "destructive", title: "Payslip PDF unavailable", description: "Unable to generate your payslip PDF." });
    } finally { setDownloadingId(null); }
  };

  const shareWhatsApp = (p) => {
    const msg = encodeURIComponent(`Hi, my payslip for ${formatDate(p.pay_period_start)} – ${formatDate(p.pay_period_end)} is available on PayFlow SA. I'll share details securely through the app.`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div>
      <EmployeeHeader title="Payslips" subtitle="Your complete payslip archive." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={y}>{y === "all" ? "All years" : y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Pay period" /></SelectTrigger>
          <SelectContent>
            {periods.map((pp, i) => {
              const [s, e] = pp.split("|");
              return <SelectItem key={i} value={pp}>{pp === "all" ? "All periods" : `${formatDate(s)} – ${formatDate(e)}`}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border"><CardContent className="p-0">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={ReceiptText} title="No payslips found" description="Payslips appear here once your payroll is processed." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pay Period</TableHead>
                <TableHead className="hidden md:table-cell">Pay Date</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const ded = (Number(p.paye) || 0) + (Number(p.uif) || 0) + (Number(p.other_deductions) || 0);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium text-foreground">
                      {formatDate(p.pay_period_start)} – {formatDate(p.pay_period_end)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(p.pay_date)}</TableCell>
                    <TableCell className="text-right text-sm tabular">{formatZAR(p.gross_salary)}</TableCell>
                    <TableCell className="hidden text-right text-sm text-rose-600 tabular sm:table-cell">-{formatZAR(ded)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-emerald-700 tabular">{formatZAR(p.net_salary)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/portal/payslips/${p.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(p)} disabled={downloadingId === p.id}>
                          {downloadingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => shareWhatsApp(p)} className="text-emerald-700">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}