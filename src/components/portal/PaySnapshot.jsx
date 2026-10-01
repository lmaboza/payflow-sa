import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatZAR, formatDate } from "@/lib/format";
import { ReceiptText, Download, MessageCircle, CalendarDays } from "lucide-react";

export default function PaySnapshot({ payslip, onDownload, downloading }) {
  if (!payslip) {
    return (
      <Card className="overflow-hidden border-border">
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <ReceiptText className="h-4 w-4" /> Latest Pay
          </div>
          <div className="mt-2 font-heading text-lg font-semibold">No payslip available yet</div>
          <p className="mt-1 text-sm text-slate-400">Your payslip will appear here once payroll is processed.</p>
        </div>
      </Card>
    );
  }

  const deductions = (Number(payslip.paye) || 0) + (Number(payslip.uif) || 0) + (Number(payslip.other_deductions) || 0);
  const period = `${formatDate(payslip.pay_period_start)} – ${formatDate(payslip.pay_period_end)}`;

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Hi, my payslip for ${period} is available on PayFlow SA. I'll share details securely through the app.`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <Card className="overflow-hidden border-border shadow-card">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <ReceiptText className="h-4 w-4" /> Latest Pay
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <CalendarDays className="h-3 w-3" /> {formatDate(payslip.pay_date)}
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-400">{period}</div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Gross Pay</div>
            <div className="mt-1 font-heading text-xl font-semibold text-white sm:text-2xl">{formatZAR(payslip.gross_salary)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Deductions</div>
            <div className="mt-1 font-heading text-xl font-semibold text-rose-300 sm:text-2xl">-{formatZAR(deductions)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-emerald-300">Net Pay</div>
            <div className="mt-1 font-heading text-2xl font-bold text-emerald-400 sm:text-3xl">{formatZAR(payslip.net_salary)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        <Link to={`/portal/payslips/${payslip.id}`}>
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <ReceiptText className="h-4 w-4" /> View Payslip
          </Button>
        </Link>
        <Button size="sm" variant="outline" className="gap-2" onClick={onDownload} disabled={downloading}>
          <Download className="h-4 w-4" /> {downloading ? "Preparing…" : "Download PDF"}
        </Button>
        <Button size="sm" variant="ghost" className="gap-2 text-emerald-700" onClick={shareWhatsApp}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </Button>
      </div>
    </Card>
  );
}