import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatZAR } from "@/lib/format";
import { TrendingUp } from "lucide-react";

const METRICS = [
  { key: "gross", label: "Gross Payroll", color: "#10B981" },
  { key: "net", label: "Net Payroll", color: "#3B82F6" },
  { key: "taxes", label: "Taxes", color: "#F59E0B" }
];

function monthLabel(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-ZA", { month: "short" });
}

export default function PayrollCostTrend({ runs }) {
  const [metric, setMetric] = useState("gross");

  // Completed/calculated runs, oldest first, last 6
  const completed = runs
    .filter((r) => ["calculated", "approved", "completed", "locked"].includes(r.status))
    .sort((a, b) => new Date(a.period_end) - new Date(b.period_end));
  const points = completed.slice(-6).map((r) => ({
    month: monthLabel(r.period_end),
    gross: r.gross_total || 0,
    net: r.net_total || 0,
    taxes: (r.paye_total || 0) + (r.uif_total || 0) + (r.sdl_total || 0)
  }));

  const active = METRICS.find((m) => m.key === metric);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <TrendingUp style={{ width: 16, height: 16 }} />
          </div>
          <CardTitle className="text-base">Payroll Cost Trend</CardTitle>
        </div>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        {points.length < 2 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <TrendingUp style={{ width: 22, height: 22 }} />
            </div>
            <p className="text-sm font-medium text-foreground">Payroll trends will appear after your first completed payroll.</p>
            <p className="text-xs text-muted-foreground">At least two completed runs are needed to draw a trend.</p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={active.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={active.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748B" }} />
                <YAxis tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} width={48} />
                <Tooltip
                  formatter={(v) => formatZAR(v)}
                  contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", fontSize: 12 }}
                />
                <Area type="monotone" dataKey={metric} stroke={active.color} strokeWidth={2.5} fill="url(#g-trend)" dot={{ r: 3, fill: active.color }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}