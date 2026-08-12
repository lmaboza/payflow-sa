import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { formatZAR, formatDate } from "@/lib/format";
import { BarChart3, Users, Wallet, TrendingUp } from "lucide-react";

export default function Reports() {
  const { business } = useBusiness();
  const [runs, setRuns] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business?.id) return;
    (async () => {
      try {
        const [r, e] = await Promise.all([
          base44.entities.PayrollRun.filter({ business_id: business.id }, "-period_start", 50),
          base44.entities.Employee.filter({ business_id: business.id })
        ]);
        setRuns(r);
        setEmployees(e);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [business?.id]);

  const chartData = runs.filter((r) => r.status !== "draft").reverse().map((r) => ({
    name: r.period_name || formatDate(r.period_start),
    Gross: Number(r.gross_total) || 0,
    PAYE: Number(r.paye_total) || 0,
    UIF: Number(r.uif_total) || 0,
    Net: Number(r.net_total) || 0
  }));

  const totalGross = runs.reduce((s, r) => s + (Number(r.gross_total) || 0), 0);
  const totalPaye = runs.reduce((s, r) => s + (Number(r.paye_total) || 0), 0);
  const totalNet = runs.reduce((s, r) => s + (Number(r.net_total) || 0), 0);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Payroll summaries and trends across periods." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Total Employees", v: employees.filter(e => e.status === "active").length, icon: Users },
          { l: "Total Gross (all periods)", v: formatZAR(totalGross), icon: Wallet },
          { l: "Total PAYE", v: formatZAR(totalPaye), icon: TrendingUp },
          { l: "Total Net Paid", v: formatZAR(totalNet), icon: Wallet }
        ].map((s) => (
          <Card key={s.l} className="border-border"><CardContent className="p-5">
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent"><s.icon className="h-4 w-4 text-muted-foreground" /></div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.l}</div>
            <div className="mt-1 font-heading text-xl font-semibold text-foreground">{s.v}</div>
          </CardContent></Card>
        ))}
      </div>

      {chartData.length === 0 ? (
        <EmptyState icon={BarChart3} title="No payroll data yet" description="Run and complete payroll periods to see reports and trends here." />
      ) : (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Payroll Over Time</CardTitle></CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatZAR(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Gross" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="PAYE" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="UIF" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Net" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}