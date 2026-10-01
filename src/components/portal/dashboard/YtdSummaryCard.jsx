import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { formatZAR } from "@/lib/format";

export default function YtdSummaryCard({ ytdGross, ytdPaye, ytdUif, payslipCount, onViewDetails }) {
  return (
    <Card className="border-border shadow-card">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-emerald-600" /> Year to Date
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">YTD Gross</div>
            <div className="font-heading text-xl font-semibold text-foreground tabular">{formatZAR(ytdGross)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">YTD Tax (PAYE)</div>
            <div className="font-heading text-xl font-semibold text-foreground tabular">{formatZAR(ytdPaye)}</div>
          </div>
          {ytdUif > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">YTD UIF</div>
              <div className="font-heading text-lg font-semibold text-foreground tabular">{formatZAR(ytdUif)}</div>
            </div>
          )}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Payslips this year</div>
            <div className="font-heading text-xl font-semibold text-foreground">{payslipCount}</div>
          </div>
        </div>
        {onViewDetails && (
          <Button variant="ghost" size="sm" className="mt-4 -ml-2 text-emerald-700" onClick={onViewDetails}>
            View Details
          </Button>
        )}
      </CardContent>
    </Card>
  );
}