import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { fetchCompliance } from "@/lib/payrollEngine";
import { formatDate, formatDateTime } from "@/lib/format";
import { complianceStatusMeta } from "@/lib/status";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { ShieldCheck, RefreshCw, Loader2, AlertTriangle } from "lucide-react";

const TYPES = ["PAYE", "UIF", "SDL", "EMP201", "EMP501", "IRP5", "IT3A", "ETI", "TaxNumbers"];
const TYPE_LABELS = {
  PAYE: "PAYE", UIF: "UIF", SDL: "SDL", EMP201: "EMP201", EMP501: "EMP501",
  IRP5: "IRP5", IT3A: "IT3(a)", ETI: "ETI", TaxNumbers: "Employee Tax Numbers"
};

export default function Compliance() {
  const { user, business } = useBusiness();
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const role = user?.app_role || "business_owner";
  const canManage = can(role, "manage_settings") || role === "accountant";

  const load = async () => {
    if (!business?.id) return;
    try {
      const list = await base44.entities.ComplianceEvent.filter({ business_id: business.id });
      setEvents(list);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [business?.id]);

  const refreshFromEngine = async () => {
    setRefreshing(true);
    try {
      const data = await fetchCompliance(business.id, {
        business: { paye_reference: business.paye_reference, uif_reference: business.uif_reference, sdl_number: business.sdl_number },
        year: new Date().getFullYear()
      });
      if (data.status === "ok" && data.items) {
        await base44.entities.ComplianceEvent.deleteMany({ business_id: business.id });
        await base44.entities.ComplianceEvent.bulkCreate(
          data.items.map((it) => ({
            business_id: business.id,
            type: it.type,
            status: it.status || "pending",
            due_date: it.due_date,
            responsible_user_id: it.responsible_user_id || "",
            last_updated: new Date().toISOString(),
            action_required: it.action_required || "",
            description: it.description || ""
          }))
        );
        await logAudit(business.id, user, "compliance_refreshed", "ComplianceEvent", null, null, { count: data.items.length });
        toast({ title: "Compliance data refreshed", description: `${data.items.length} items updated.` });
        load();
      } else if (data.status === "offline") {
        toast({ variant: "destructive", title: "Payroll Engine Unavailable", description: data.message || "Compliance data requires the Payroll Engine." });
      } else {
        toast({ variant: "destructive", title: "Could not refresh", description: "Engine did not return compliance items." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Payroll Engine Unavailable", description: e.message });
    } finally { setRefreshing(false); }
  };

  return (
    <div>
      <PageHeader
        title="Compliance"
        subtitle="SARS, UIF and SDL obligations. Compliance rules are provided by the Payroll Engine."
        actions={canManage && <Button variant="outline" onClick={refreshFromEngine} disabled={refreshing} className="gap-2">{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh from Engine</Button>}
      />

      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>
      ) : events.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No compliance events" description="Connect and refresh from the Payroll Engine to populate your compliance dashboard." action={canManage && <Button variant="outline" onClick={refreshFromEngine} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh from Engine</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((type) => {
            const ev = events.find((e) => e.type === type);
            const m = complianceStatusMeta(ev?.status);
            return (
              <Card key={type} className="border-border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                      <span className="font-heading text-sm font-semibold text-foreground">{TYPE_LABELS[type]}</span>
                    </div>
                    <Badge variant="outline" className={m.cls}>{m.label}</Badge>
                  </div>
                  {ev ? (
                    <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between"><span>Due date</span><span className="text-foreground">{formatDate(ev.due_date)}</span></div>
                      <div className="flex justify-between"><span>Last updated</span><span className="text-foreground">{formatDateTime(ev.last_updated)}</span></div>
                      {ev.action_required && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-700">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {ev.action_required}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-muted-foreground">Not configured.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}