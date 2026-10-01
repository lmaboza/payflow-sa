import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { formatZAR, formatDate } from "@/lib/format";
import {
  CalendarClock, CalendarDays, Wallet, FileText, MessageSquare, Bell
} from "lucide-react";

export default function UpcomingItems({ nextPayDate, pendingLeave, pendingClaims, unreadNotifs }) {
  const items = [];
  if (nextPayDate) items.push({ icon: CalendarClock, tint: "text-emerald-600", label: "Next pay date", value: formatDate(nextPayDate), to: "/portal/payslips" });
  if (pendingLeave) items.push({ icon: CalendarDays, tint: "text-blue-600", label: "Pending leave request", value: "Awaiting approval", to: "/portal/leave" });
  if (pendingClaims) items.push({ icon: Wallet, tint: "text-amber-600", label: "Claim awaiting review", value: `${pendingClaims} pending`, to: "/portal/claims" });
  if (unreadNotifs) items.push({ icon: Bell, tint: "text-rose-600", label: "Unread notifications", value: `${unreadNotifs} new`, to: "/portal/notifications" });

  return (
    <Card className="border-border shadow-card">
      <CardContent className="p-5">
        <h3 className="mb-4 font-heading text-base font-semibold text-foreground">Upcoming &amp; Notifications</h3>
        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4" /> You're all caught up.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((it, i) => {
              const Icon = it.icon;
              return (
                <Link key={i} to={it.to} className="card-lift rounded-lg border border-border/60 p-3 hover:border-emerald-200 hover:shadow-card-hover">
                  <Icon className={`h-4 w-4 ${it.tint}`} />
                  <div className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">{it.label}</div>
                  <div className="text-sm font-semibold text-foreground">{it.value}</div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}