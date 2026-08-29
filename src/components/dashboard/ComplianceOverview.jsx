import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/format";

const ORDER = ["PAYE", "UIF", "SDL", "EMP201", "EMP501", "IRP5", "IT3A", "ETI"];

function statusMeta(status, dueDate) {
  if (status === "overdue") return { label: "Overdue", cls: "bg-rose-50 text-rose-600" };
  if (status === "action_required") return { label: "Action Required", cls: "bg-amber-50 text-amber-600" };
  if (status === "compliant") return { label: "Ready", cls: "bg-emerald-50 text-emerald-600" };
  return { label: dueDate ? `Due ${formatDate(dueDate)}` : "Not Due", cls: "bg-slate-100 text-slate-600" };
}

export default function ComplianceOverview({ compliance = [] }) {
  const byType = (type) => compliance.find((c) => c.type === type);
  const rows = ORDER.map((type) => {
    const c = byType(type);
    const m = c ? statusMeta(c.status, c.due_date) : { label: "Not Due", cls: "bg-slate-100 text-slate-600" };
    return { type, label: m.label, cls: m.cls };
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Compliance Overview</CardTitle>
        <Link to="/compliance" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline">
          View Compliance <ArrowRight style={{ width: 13, height: 13 }} />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/70">
          {rows.map((r) => (
            <div key={r.type} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium text-foreground">{r.type}</span>
              <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${r.cls}`}>{r.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}