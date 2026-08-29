import { Card, CardContent } from "@/components/ui/card";
import { formatZAR } from "@/lib/format";
import { TrendingUp, Wallet, Receipt, ShieldCheck, Users, ArrowUp, ArrowDown } from "lucide-react";

function pctChange(curr, prev) {
  if (prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export default function KpiCards({ current, previous, activeEmployees }) {
  const items = [
    { label: "Net Payroll", raw: current.net_total || 0, prev: previous?.net_total, icon: TrendingUp, tint: "bg-emerald-500/10 text-emerald-600" },
    { label: "Gross Payroll", raw: current.gross_total || 0, prev: previous?.gross_total, icon: Wallet, tint: "bg-slate-500/10 text-slate-600" },
    { label: "PAYE", raw: current.paye_total || 0, prev: previous?.paye_total, icon: Receipt, tint: "bg-violet-500/10 text-violet-600" },
    { label: "UIF", raw: current.uif_total || 0, prev: previous?.uif_total, icon: ShieldCheck, tint: "bg-amber-500/10 text-amber-600" },
    { label: "SDL", raw: current.sdl_total || 0, prev: previous?.sdl_total, icon: ShieldCheck, tint: "bg-blue-500/10 text-blue-600" },
    { label: "Active Employees", raw: activeEmployees, prev: null, icon: Users, tint: "bg-slate-500/10 text-slate-600", isCount: true }
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((s) => {
        const change = pctChange(s.raw, s.prev);
        const up = change != null && change >= 0;
        return (
          <Card key={s.label} className="transition-shadow hover:shadow-card-hover">
            <CardContent className="p-5">
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.tint}`}>
                <s.icon style={{ width: 18, height: 18 }} />
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="tabular mt-1 font-heading text-lg font-semibold text-foreground">
                {s.isCount ? s.raw : formatZAR(s.raw)}
              </div>
              {change != null && (
                <div className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
                  {up ? <ArrowUp style={{ width: 12, height: 12 }} /> : <ArrowDown style={{ width: 12, height: 12 }} />}
                  {Math.abs(change).toFixed(1)}%
                  <span className="font-normal text-muted-foreground">vs prev</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}