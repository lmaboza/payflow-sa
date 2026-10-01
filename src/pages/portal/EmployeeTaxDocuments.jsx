import { useState, useEffect, useMemo } from "react";
import { useEmployee } from "@/lib/useEmployee";
import EmployeeHeader from "@/components/portal/EmployeeHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { formatDate } from "@/lib/format";
import { FileText, Download, MessageCircle, Loader2, ShieldCheck } from "lucide-react";

export default function EmployeeTaxDocuments() {
  const { employee } = useEmployee();
  const { toast } = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!employee?.id) return;
    (async () => {
      try {
        const d = await base44.entities.EmployeeDocument.filter({ employee_id: employee.id, type: "tax" }, "-uploaded_date", 100);
        setDocs(d || []);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [employee?.id]);

  const byYear = useMemo(() => {
    const groups = {};
    (docs || []).forEach((d) => {
      const y = d.uploaded_date ? new Date(d.uploaded_date).getFullYear() : "General";
      (groups[y] = groups[y] || []).push(d);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [docs]);

  const openDoc = async (d) => {
    setBusyId(d.id);
    try {
      const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: d.file_url });
      window.open(res.signed_url, "_blank");
    } catch (e) {
      toast({ variant: "destructive", title: "Could not open document", description: e.message });
    } finally { setBusyId(null); }
  };

  const shareWhatsApp = (d) => {
    const msg = encodeURIComponent(`Hi, my tax document "${d.name}" is available on PayFlow SA. I'll share it securely through the app.`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <EmployeeHeader title="Tax Documents" subtitle="Your tax certificates, grouped by tax year." />

      <div className="mb-5 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Only documents officially generated or imported by your payroll administrator are shown here. A SARS certificate (e.g. IRP5) will appear only once it has been issued.
      </div>

      {docs.length === 0 ? (
        <Card className="border-border"><CardContent className="p-6">
          <EmptyState icon={FileText} title="No tax documents yet" description="Your IRP5 / tax certificates will appear here once issued by payroll." />
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {byYear.map(([year, list]) => (
            <div key={year}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tax Year {year}</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((d) => (
                  <Card key={d.id} className="border-border">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileText className="h-5 w-5" /></div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{d.name}</div>
                          <div className="text-[11px] text-muted-foreground">{formatDate(d.uploaded_date)}</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDoc(d)} disabled={busyId === d.id}>
                          {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => shareWhatsApp(d)}>
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}