import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import {
  ReceiptText, CalendarDays, Wallet, FileText, MessageSquare, Bell
} from "lucide-react";

const TYPE_META = {
  payslip_available: { icon: ReceiptText, tint: "bg-emerald-50 text-emerald-600" },
  salary_processed: { icon: ReceiptText, tint: "bg-emerald-50 text-emerald-600" },
  leave_approved: { icon: CalendarDays, tint: "bg-blue-50 text-blue-600" },
  leave_rejected: { icon: CalendarDays, tint: "bg-rose-50 text-rose-600" },
  tax_document: { icon: FileText, tint: "bg-indigo-50 text-indigo-600" },
  claim_status: { icon: Wallet, tint: "bg-amber-50 text-amber-600" },
  query_response: { icon: MessageSquare, tint: "bg-sky-50 text-sky-600" },
  detail_change: { icon: Bell, tint: "bg-slate-100 text-slate-600" }
};

export default function RecentActivity({ notifications }) {
  const items = (notifications || []).slice(0, 5);
  return (
    <Card className="border-border shadow-card">
      <CardContent className="p-5">
        <h3 className="mb-4 font-heading text-base font-semibold text-foreground">Recent Activity</h3>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {items.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.detail_change;
              const Icon = meta.icon;
              return (
                <li key={n.id} className="relative">
                  <span className={`absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-card ${meta.tint}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="text-sm font-medium text-foreground">{n.title}</div>
                  {n.message && <div className="text-xs text-muted-foreground line-clamp-1">{n.message}</div>}
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(n.created_date)}</div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}