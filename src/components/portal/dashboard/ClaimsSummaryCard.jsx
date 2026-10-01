import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

export default function ClaimsSummaryCard({ pending, approved, rejected, onNew, onView }) {
  const hasAny = pending + approved + rejected > 0;
  return (
    <Card className="border-border shadow-card">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4 text-emerald-600" /> Claims
        </div>
        {hasAny ? (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-amber-50 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-amber-700">Pending</div>
              <div className="font-heading text-lg font-semibold text-amber-700">{pending}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700">Approved</div>
              <div className="font-heading text-lg font-semibold text-emerald-700">{approved}</div>
            </div>
            <div className="rounded-lg bg-rose-50 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-rose-700">Rejected</div>
              <div className="font-heading text-lg font-semibold text-rose-700">{rejected}</div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No claims submitted yet.</p>
        )}
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={onNew}>New Claim</Button>
          <Button variant="outline" size="sm" onClick={onView}>View</Button>
        </div>
      </CardContent>
    </Card>
  );
}