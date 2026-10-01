import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useEmployee } from "@/lib/useEmployee";
import EmployeeHeader from "@/components/portal/EmployeeHeader";
import PaySnapshot from "@/components/portal/PaySnapshot";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { generatePayslip } from "@/lib/payrollEngine";
import { formatZAR, formatDate } from "@/lib/format";
import { base44 } from "@/api/base44Client";
import {
  ReceiptText, CalendarDays, FileText, Wallet, User, MessageSquare,
  TrendingUp, ShieldCheck, Loader2
} from "lucide-react";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_ACTIONS = [
  { label: "View Payslip", to: "/portal/payslips", icon: ReceiptText, desc: "Payslip archive" },
  { label: "Request Leave", to: "/portal/leave", icon: CalendarDays, desc: "Apply for leave" },
  { label: "Tax Documents", to: "/portal/tax-documents", icon: FileText, desc: "Certificates" },
  { label: "Submit Claim", to: "/portal/claims", icon: Wallet, desc: "Reimbursements" },
  { label: "Update Details", to: "/portal/profile", icon: User, desc: "My information" },
  { label: "Payroll Query", to: "/portal/queries", icon: MessageSquare, desc: "Ask Payroll" }
];

export default function EmployeeDashboard() {
  const { employee, business } = useEmployee();
  const { toast } = useToast();
  const [latestPayslip, setLatestPayslip] = useState(null);
  const [payslipCount, setPayslipCount] = useState(0);
  const [ytdGross, setYtdGross] = useState(0);
  const [ytdTax, setYtdTax] = useState(0);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee?.id) return;
    (async () => {
      try {
        const pays = await base44.entities.Payslip.filter({ employee_id: employee.id }, "-pay_date", 50);
        setLatestPayslip(pays?.[0] || null);
        setPayslipCount(pays?.length || 0);
        const gross = (pays || []).reduce((s, p) => s + (Number(p.ytd_gross) || Number(p.gross_salary) || 0), 0);
        const tax = (pays || []).reduce((s, p) => s + (Number(p.ytd_paye) || Number(p.paye) || 0), 0);
        setYtdGross(gross);
        setYtdTax(tax);

        const lb = await base44.entities.LeaveBalance.filter({ employee_id: employee.id }, "-created_date", 1);
        setLeaveBalance(lb?.[0] || null);

        const claims = await base44.entities.Claim.filter({ employee_id: employee.id, status: { $in: ["submitted", "under_review"] } }, "-created_date", 50);
        setPendingClaims(claims?.length || 0);
      } catch (e) {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
  }, [employee?.id]);

  const handleDownload = async () => {
    if (!latestPayslip) return;
    setDownloading(true);
    try {
      const data = await generatePayslip(business?.id, { payslip_id: latestPayslip.id, employee_id: employee.id, payroll_run_id: latestPayslip.payroll_run_id });
      if (data.status === "ok" && (data.pdf_url || data.url)) {
        window.open(data.pdf_url || data.url, "_blank");
        toast({ title: "Payslip PDF generated" });
      } else {
        toast({ variant: "destructive", title: "Payslip PDF unavailable", description: data.message || "The Payroll Engine could not generate the PDF." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Payslip PDF unavailable", description: e.message });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  const annualLeft = leaveBalance ? Math.max(0, (leaveBalance.annual_total || 0) - (leaveBalance.annual_used || 0)) : null;

  return (
    <div>
      <EmployeeHeader
        title={`${greeting()}, ${employee?.first_name || "there"}`}
        subtitle={business ? `${business.trading_name || business.name} · Employee Self-Service` : "Employee Self-Service"}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PaySnapshot payslip={latestPayslip} onDownload={handleDownload} downloading={downloading} />
        </div>

        <div className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Year to date
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">YTD Gross</div>
                  <div className="font-heading text-xl font-semibold text-foreground">{formatZAR(ytdGross)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">YTD Tax (PAYE)</div>
                  <div className="font-heading text-xl font-semibold text-foreground">{formatZAR(ytdTax)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Payslips this year</div>
                  <div className="font-heading text-xl font-semibold text-foreground">{payslipCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" /> Leave balance
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Annual leave left</div>
                  <div className="font-heading text-2xl font-semibold text-foreground">
                    {annualLeft !== null ? `${annualLeft} days` : "—"}
                  </div>
                </div>
                <Link to="/portal/leave">
                  <Button variant="outline" size="sm">Request</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" /> Claims
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pending claims</div>
                  <div className="font-heading text-2xl font-semibold text-foreground">{pendingClaims}</div>
                </div>
                <Link to="/portal/claims">
                  <Button variant="outline" size="sm">New</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.label} to={a.to}>
              <Card className="group h-full border-border transition-shadow hover:shadow-card-hover">
                <CardContent className="flex h-full flex-col items-start gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    <a.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.label}</div>
                    <div className="text-[11px] text-muted-foreground">{a.desc}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}