import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarClock, CheckCircle2, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { payrollStatusMeta } from "@/lib/status";

export default function OutstandingActions({ overdueCompliance = [], latestRun }) {
  const hasItems = overdueCompliance.length > 0 || (latestRun && ["draft", "review_required", "validation_failed"].includes(latestRun.status));

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Outstanding Actions</CardTitle>
        <Link to="/compliance" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline">
          View All <ArrowRight style={{ width: 13, height: 13 }} />
        </Link>
      </CardHeader>
      <CardContent>
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <CheckCircle2 style={{ width: 28, height: 28 }} className="text-emerald-500" />
            <p className="text-sm font-medium text-foreground">All clear</p>
            <p className="text-xs text-muted-foreground">Your payroll currently has no outstanding actions.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {overdueCompliance.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/70 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                    <AlertTriangle style={{ width: 16, height: 16 }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{c.type} — {c.action_required || "Action required"}</div>
                    <div className="text-xs text-muted-foreground">Due {formatDate(c.due_date)}</div>
                  </div>
                </div>
                <Link to="/compliance"><Button variant="outline" size="sm">View</Button></Link>
              </div>
            ))}
            {latestRun && ["draft", "review_required", "validation_failed"].includes(latestRun.status) && (
              <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                    <CalendarClock style={{ width: 16, height: 16 }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">Payroll {payrollStatusMeta(latestRun.status).label.toLowerCase()}</div>
                    <div className="text-xs text-muted-foreground">{latestRun.period_name}</div>
                  </div>
                </div>
                <Link to={`/payroll/run/${latestRun.id}`}>
                  <Button variant="outline" size="sm">Review <ArrowRight style={{ width: 13, height: 13 }} className="ml-1" /></Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}