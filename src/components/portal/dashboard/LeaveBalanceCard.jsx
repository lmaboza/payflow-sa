import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

export default function LeaveBalanceCard({ balance, onRequest }) {
  const annualLeft = balance ? Math.max(0, (balance.annual_total || 0) - (balance.annual_used || 0)) : null;
  const annualTotal = balance?.annual_total || 0;
  const pct = annualTotal > 0 ? Math.min(100, Math.round((annualLeft / annualTotal) * 100)) : 0;
  const sickLeft = balance ? Math.max(0, (balance.sick_total || 0) - (balance.sick_used || 0)) : null;
  const familyLeft = balance ? Math.max(0, (balance.family_total || 0) - (balance.family_used || 0)) : null;

  return (
    <Card className="border-border shadow-card">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-emerald-600" /> Leave Balance
        </div>
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Annual leave</div>
          <div className="mt-0.5 font-heading text-2xl font-semibold text-foreground">
            {annualLeft !== null ? `${annualLeft} days` : "—"}
          </div>
          {annualTotal > 0 && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sick</div>
            <div className="text-sm font-semibold text-foreground">{sickLeft !== null ? `${sickLeft}d` : "—"}</div>
          </div>
          <div className="rounded-lg bg-secondary px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Family</div>
            <div className="text-sm font-semibold text-foreground">{familyLeft !== null ? `${familyLeft}d` : "—"}</div>
          </div>
        </div>
        {onRequest && (
          <Button variant="outline" size="sm" className="mt-4 w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={onRequest}>
            Request Leave
          </Button>
        )}
      </CardContent>
    </Card>
  );
}