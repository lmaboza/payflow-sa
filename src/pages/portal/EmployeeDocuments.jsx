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
import { FileText, Download, Loader2, FolderClosed } from "lucide-react";

const TYPE_LABEL = { contract: "Contract", id: "ID Document", tax: "Tax", bank: "Banking", payslip: "Payslip", other: "Document" };

export default function EmployeeDocuments() {
  const { employee } = useEmployee();
  const { toast } = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!employee?.id) return;
    (async () => {
      try {
        const d = await base44.entities.EmployeeDocument.filter({ employee_id: employee.id }, "-uploaded_date", 200);
        setDocs(d || []);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [employee?.id]);

  const types = useMemo(() => ["all", ...Array.from(new Set((docs || []).map((d) => d.type)))], [docs]);
  const filtered = useMemo(() => (docs || []).filter((d) => filter === "all" || d.type === filter), [docs, filter]);

  const openDoc = async (d) => {
    setBusyId(d.id);
    try {
      const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: d.file_url });
      window.open(res.signed_url, "_blank");
    } catch (e) {
      toast({ variant: "destructive", title: "Could not open document", description: e.message });
    } finally { setBusyId(null); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <EmployeeHeader title="Documents" subtitle="Contracts, IDs and other documents shared with you." />

      <div className="mb-4 flex flex-wrap gap-2">
        {types.map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === t ? "bg-slate-900 text-white" : "bg-accent text-muted-foreground hover:bg-accent/80"}`}>
            {t === "all" ? "All" : TYPE_LABEL[t] || t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border"><CardContent className="p-6">
          <EmptyState icon={FolderClosed} title="No documents" description="Documents shared by your employer will appear here." />
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <Card key={d.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FileText className="h-5 w-5" /></div>
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[d.type] || d.type}</Badge>
                </div>
                <div className="mt-3 text-sm font-medium text-foreground">{d.name}</div>
                <div className="text-[11px] text-muted-foreground">{formatDate(d.uploaded_date)}</div>
                <Button variant="outline" size="sm" className="mt-3 w-full gap-2" onClick={() => openDoc(d)} disabled={busyId === d.id}>
                  {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} View / Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}