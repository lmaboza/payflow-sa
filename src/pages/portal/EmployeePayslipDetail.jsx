import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEmployee } from "@/lib/useEmployee";
import EmployeeHeader from "@/components/portal/EmployeeHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { generatePayslip } from "@/lib/payrollEngine";
import { base44 } from "@/api/base44Client";
import { formatZAR, formatDate } from "@/lib/format";
import {
  ArrowLeft, Download, MessageCircle, ChevronDown, TrendingUp, MinusCircle,
  PlusCircle, Wallet, Loader2, ReceiptText
} from "lucide-react";

function Line({ label, amount, strong, muted }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2.5 last:border-0">
      <span className={`text-sm ${muted ? "text-muted-foreground" : "text-foreground"}`}>{label}</span>
      <span className={`text-sm tabular ${strong ? "font-heading font-semibold text-foreground" : ""}`}>{formatZAR(amount)}</span>
    </div>
  );
}

function Section({ title, icon: Icon, total, totalLabel = "Total", children, accent = "emerald" }) {
  const accentMap = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    blue: "bg-blue-50 text-blue-700"
  };
  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentMap[accent]}`}><Icon className="h-4 w-4" /></span>
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children}
        {total !== undefined && (
          <div className="mt-3 flex items-center justify-between border-t-2 border-border pt-3">
            <span className="text-sm font-semibold text-foreground">{totalLabel}</span>
            <span className="font-heading text-lg font-bold text-foreground tabular">{formatZAR(total)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EmployeePayslipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { employee, business } = useEmployee();
  const { toast } = useToast();
  const [payslip, setPayslip] = useState(null);
  const [lineItem, setLineItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [ytdOpen, setYtdOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await base44.entities.Payslip.get(id);
        setPayslip(p);
        if (p.payroll_run_id && p.employee_id) {
          const li = await base44.entities.PayrollLineItem.filter({ payroll_run_id: p.payroll_run_id, employee_id: p.employee_id }, "-created_date", 1);
          setLineItem(li?.[0] || null);
        }
      } catch (e) {
        toast({ variant: "destructive", title: "Payslip not found", description: e.message });
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  if (!payslip) return <div className="py-20 text-center text-muted-foreground">Payslip not found.</div>;

  // Security: ensure the payslip belongs to the signed-in employee
  if (employee && payslip.employee_id && payslip.employee_id !== employee.id) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">You don't have access to this payslip.</p>
        <Link to="/portal/payslips" className="mt-3 inline-block text-sm font-medium text-emerald-700">Back to payslips</Link>
      </div>
    );
  }

  const earnings = [
    { label: "Basic / Cash Salary", amount: payslip.basic_salary },
    { label: "Overtime", amount: payslip.overtime },
    { label: "Bonus", amount: payslip.bonus },
    { label: "Allowances", amount: payslip.allowances }
  ].filter((e) => Number(e.amount) > 0);

  const deductions = [
    { label: "PAYE", amount: payslip.paye },
    { label: "UIF", amount: payslip.uif },
    { label: "Other Deductions", amount: payslip.other_deductions }
  ].filter((d) => Number(d.amount) > 0);

  const totalEarnings = Number(payslip.gross_salary) || 0;
  const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);

  const employerUif = Number(payslip.uif) || 0; // employer UIF mirrors employee UIF
  const employerSdl = Number(lineItem?.sdl) || 0;
  const employerRetirement = Number(employee?.retirement_contribution) || 0; // employer portion not separately stored
  const employerMedical = Number(employee?.medical_aid) || 0;
  const totalEmployer = employerUif + employerSdl;
  const ctc = totalEarnings + employerUif + employerSdl;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const data = await generatePayslip(business?.id, { payslip_id: payslip.id, employee_id: employee.id, payroll_run_id: payslip.payroll_run_id });
      if (data.status === "ok" && (data.pdf_url || data.url)) {
        window.open(data.pdf_url || data.url, "_blank");
      } else {
        toast({ variant: "destructive", title: "PDF unavailable", description: data.message || "The Payroll Engine could not generate the PDF." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "PDF unavailable", description: e.message });
    } finally { setDownloading(false); }
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Hi, my payslip for ${formatDate(payslip.pay_period_start)} – ${formatDate(payslip.pay_period_end)} is available on PayFlow SA.`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/portal/payslips")} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Payslips
      </Button>

      <EmployeeHeader
        title="Payslip"
        subtitle={`${formatDate(payslip.pay_period_start)} – ${formatDate(payslip.pay_period_end)} · Paid ${formatDate(payslip.pay_date)}`}
        actions={
          <>
            <Button size="sm" variant="outline" className="gap-2" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
            </Button>
            <Button size="sm" variant="ghost" className="gap-2 text-emerald-700" onClick={shareWhatsApp}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </>
        }
      />

      {/* Net pay hero */}
      <Card className="mb-6 overflow-hidden border-border">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-6 text-white">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Net Pay</div>
              <div className="mt-1 font-heading text-4xl font-bold text-emerald-400">{formatZAR(payslip.net_salary)}</div>
              <div className="mt-1 text-xs text-slate-400">{business?.trading_name || business?.name}</div>
            </div>
            <div className="flex gap-6">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Gross</div>
                <div className="font-heading text-lg font-semibold">{formatZAR(payslip.gross_salary)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Deductions</div>
                <div className="font-heading text-lg font-semibold text-rose-300">-{formatZAR(totalDeductions)}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Earnings" icon={PlusCircle} accent="emerald" total={totalEarnings} totalLabel="Total Earnings">
          {earnings.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No earnings recorded.</p> :
            earnings.map((e) => <Line key={e.label} label={e.label} amount={e.amount} />)}
        </Section>

        <Section title="Deductions" icon={MinusCircle} accent="rose" total={totalDeductions} totalLabel="Total Deductions">
          {deductions.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No deductions recorded.</p> :
            deductions.map((d) => <Line key={d.label} label={d.label} amount={d.amount} />)}
          <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-800">Net Pay</span>
              <span className="font-heading text-xl font-bold text-emerald-700 tabular">{formatZAR(payslip.net_salary)}</span>
            </div>
          </div>
        </Section>

        <Section title="Your Employer Contributions" icon={Wallet} accent="blue" total={totalEmployer} totalLabel="Total Employer Contributions">
          <Line label="Employer UIF" amount={employerUif} />
          <Line label="SDL (Skills Development Levy)" amount={employerSdl} muted={!employerSdl} />
          <Line label="Retirement Contribution" amount={employerRetirement} muted={!employerRetirement} />
          <Line label="Medical Contribution" amount={employerMedical} muted={!employerMedical} />
        </Section>

        {/* Cost to company */}
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><TrendingUp className="h-4 w-4" /></span>
            Your Total Employment Package
          </CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Line label="Basic / Gross Remuneration" amount={totalEarnings} />
              <Line label="+ Employer Contributions" amount={totalEmployer} />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3 text-white">
              <span className="text-sm font-semibold">Cost to Company</span>
              <span className="font-heading text-xl font-bold text-emerald-400 tabular">{formatZAR(ctc)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* YTD - collapsible, values from engine/payslip only */}
      <Collapsible open={ytdOpen} onOpenChange={setYtdOpen} className="mt-6">
        <Card className="border-border">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-5 text-left">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-muted-foreground" />
              <span className="font-heading text-base font-semibold text-foreground">Year-to-Date (YTD)</span>
              <Badge variant="outline" className="text-[10px]">Engine values</Badge>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${ytdOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid gap-x-8 sm:grid-cols-2">
                <Line label="YTD Gross / Taxable Earnings" amount={payslip.ytd_gross} />
                <Line label="YTD Tax Paid (PAYE)" amount={payslip.ytd_paye} />
                <Line label="YTD UIF" amount={payslip.ytd_uif} />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Year-to-date figures are sourced from the Payroll Engine. Contact payroll if a value appears incorrect.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}