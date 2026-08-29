import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export default function RecentActivity({ audit = [] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <Link to="/audit" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline">
          View Audit Log <ArrowRight style={{ width: 13, height: 13 }} />
        </Link>
      </CardHeader>
      <CardContent>
        {audit.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <ol className="relative space-y-4 pl-5">
            <span className="absolute left-1.5 top-1.5 bottom-1.5 w-px bg-border" />
            {audit.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[15px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                <div className="text-sm font-medium text-foreground">{a.action} · {a.entity}</div>
                <div className="text-xs text-muted-foreground">{a.user_name || "System"} · {formatDateTime(a.date_time)}</div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}