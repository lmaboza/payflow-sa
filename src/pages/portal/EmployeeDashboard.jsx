import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEmployee } from "@/lib/useEmployee";
import EmployeeHeader from "@/components/portal/EmployeeHeader";
import PaySnapshot from "@/components/portal/PaySnapshot";
import DashboardSkeleton from "@/components/portal/dashboard/DashboardSkeleton";
import QuickActions from "@/components/portal/dashboard/QuickActions";
import YtdSummaryCard from "@/components/portal/dashboard/YtdSummaryCard";
import LeaveBalanceCard from "@/components/portal/dashboard/LeaveBalanceCard";
import ClaimsSummaryCard from "@/components/portal/dashboard/ClaimsSummaryCard";
import RecentPayslips from "@/components/portal/dashboard/RecentPayslips";
import RecentActivity from "@/components/portal/dashboard/RecentActivity";
import UpcomingItems from "@/components/portal/dashboard/UpcomingItems";
import { useToast } from "@/components/ui/use-toast";
import { generatePayslip } from "@/lib/payrollEngine";
import { formatZAR } from "@/lib/format";
import { base44 } from "@/api/base44Client";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function nextPayDate(business, latestPayDate) {
  const day = business?.default_pay_date;
  if (!day || day < 1 || day > 31) return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  // try this month's pay day; if passed, next month
  const candidate = new Date(y, m, day);
  if (candidate < now) {
    return new Date(y, m + 1, day);
  }
  return candidate;
}

export default function EmployeeDashboard() {
  const { employee, business } = useEmployee();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [latestPayslip, setLatestPayslip] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [payslipCount, setPayslipCount] = useState(0);
  const [ytdGross, setYtdGross] = useState(0);
  const [ytdPaye, setYtdPaye] = useState(0);
  const [ytdUif, setYtdUif] = useState(0);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [claimsSummary, setClaimsSummary] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee?.id) return;
    (async () => {
      try {
        const [pays, lb, claims, notifs, pendingLv, unread] = await Promise.all([
          base44.entities.Payslip.filter({ employee_id: employee.id }, "-pay_date", 6),
          base44.entities.LeaveBalance.filter({ employee_id: employee.id }, "-created_date", 1),
          base44.entities.Claim.filter({ employee_id: employee.id }, "-created_date", 50),
          base44.entities.EmployeeNotification.filter({ employee_id: employee.id }, "-created_date", 6),
          base44.entities.LeaveRequest.count({ employee_id: employee.id, status: "pending" }),
          base44.entities.EmployeeNotification.count({ employee_id: employee.id, read: false })
        ]);
        setLatestPayslip(pays?.[0] || null);
        setPayslips(pays || []);
        setPayslipCount(pays?.length || 0);
        setYtdGross((pays || []).reduce((s, p) => s + (Number(p.ytd_gross) || Number(p.gross_salary) || 0), 0));
        setYtdPaye((pays || []).reduce((s, p) => s + (Number(p.ytd_paye) || Number(p.paye) || 0), 0));
        setYtdUif((pays || []).reduce((s, p) => s + (Number(p.ytd_uif) || Number(p.uif) || 0), 0));
        setLeaveBalance(lb?.[0] || null);
        setPendingLeave(pendingLv || 0);
        setNotifications(notifs || []);
        setUnreadNotifs(unread || 0);
        const c = claims || [];
        setClaimsSummary({
          pending: c.filter((x) => ["submitted", "under_review"].includes(x.status)).length,
          approved: c.filter((x) => x.status === "approved").length,
          rejected: c.filter((x) => x.status === "rejected").length
        });
      } catch (e) {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
  }, [employee?.id]);

  const handleDownload = async (p) => {
    const target = p || latestPayslip;
    if (!target) return;
    if (p) setDownloadingId(p.id); else setDownloading(true);
    try {
      const data = await generatePayslip(business?.id, { payslip_id: target.id, employee_id: employee.id, payroll_run_id: target.payroll_run_id });
      if (data.status === "ok" && (data.pdf_url || data.url)) {
        window.open(data.pdf_url || data.url, "_blank");
        toast({ title: "Payslip PDF generated" });
      } else {
        toast({ variant: "destructive", title: "Payslip PDF unavailable", description: data.message || "The Payroll Engine could not generate the PDF." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Payslip PDF unavailable", description: e.message });
    } finally {
      if (p) setDownloadingId(null); else setDownloading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div>
      <EmployeeHeader
        title={`${greeting()}, ${employee?.first_name || "there"}`}
        subtitle={business ? `${business.trading_name || business.name} · Employee Self-Service` : "Employee Self-Service"}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PaySnapshot payslip={latestPayslip} onDownload={() => handleDownload()} downloading={downloading} />
        </div>

        <div className="space-y-4">
          <YtdSummaryCard
            ytdGross={ytdGross}
            ytdPaye={ytdPaye}
            ytdUif={ytdUif}
            payslipCount={payslipCount}
            onViewDetails={() => navigate("/portal/payslips")}
          />
          <LeaveBalanceCard balance={leaveBalance} onRequest={() => navigate("/portal/leave")} />
          <ClaimsSummaryCard
            pending={claimsSummary.pending}
            approved={claimsSummary.approved}
            rejected={claimsSummary.rejected}
            onNew={() => navigate("/portal/claims")}
            onView={() => navigate("/portal/claims")}
          />
        </div>
      </div>

      <div className="mt-8">
        <QuickActions />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RecentPayslips
          payslips={payslips}
          onView={(p) => navigate(`/portal/payslips/${p.id}`)}
          onDownload={handleDownload}
          downloadingId={downloadingId}
        />
        <RecentActivity notifications={notifications} />
      </div>

      <div className="mt-6">
        <UpcomingItems
          nextPayDate={nextPayDate(business, latestPayslip?.pay_date)}
          pendingLeave={pendingLeave}
          pendingClaims={claimsSummary.pending}
          unreadNotifs={unreadNotifs}
        />
      </div>
    </div>
  );
}