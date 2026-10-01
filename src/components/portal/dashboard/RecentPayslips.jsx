import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatZAR, formatDate } from "@/lib/format";
import { Eye, Download, Loader2, ReceiptText } from "lucide-react";

export default function RecentPayslips({ payslips, onView, onDownload, downloadingId }) {
  const recent = (payslips || []).slice(0, 3);
  return (
    <Card className="border-border shadow-card">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-foreground">Recent Payslips</h3>
          <Button asChild variant="ghost" size="sm" className="text-emerald-700">
            <Link to="/portal/payslips">View all</Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No payslips are available yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((p) => {
              const ded = (Number(p.paye) || 0) + (Number(p.uif) || 0) + (Number(p.other_deductions) || 0);
              return (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:bg-secondary/60">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {formatDate(p.pay_period_start)} – {formatDate(p.pay_period_end)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Paid {formatDate(p.pay_date)}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Net</div>
                      <div className="text-sm font-semibold text-emerald-700 tabular">{formatZAR(p.net_salary)}</div>
                    </div>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDownload(p)} disabled={downloadingId === p.id}>
                        {downloadingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}