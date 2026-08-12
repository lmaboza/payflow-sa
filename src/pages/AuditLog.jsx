import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { ScrollText, Search, Lock } from "lucide-react";

export default function AuditLog() {
  const { business } = useBusiness();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    if (!business?.id) return;
    (async () => {
      try {
        const list = await base44.entities.AuditLog.filter({ business_id: business.id }, "-date_time", 200);
        setLogs(list);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [business?.id]);

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))), [logs]);

  const filtered = useMemo(() => {
    let list = logs;
    if (actionFilter !== "all") list = list.filter((l) => l.action === actionFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => (l.user_name || "").toLowerCase().includes(q) || (l.entity || "").toLowerCase().includes(q) || (l.action || "").toLowerCase().includes(q));
    }
    return list;
  }, [logs, search, actionFilter]);

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Immutable record of all actions across your business." />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by user, action or entity…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> Audit logs are immutable and append-only. Records cannot be edited or deleted.
      </div>

      <Card className="border-border"><CardContent className="p-0">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState icon={ScrollText} title="No audit entries" description="Activity will appear here as you and your team use PayFlow SA." /></div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead className="hidden md:table-cell">Entity</TableHead><TableHead className="hidden lg:table-cell">Date / Time</TableHead><TableHead className="hidden lg:table-cell">Change</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm font-medium">{l.user_name}</TableCell>
                  <TableCell className="text-sm"><Badge variant="outline">{l.action}</Badge></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{l.entity}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{formatDateTime(l.date_time)}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {l.previous_value && l.new_value ? `${l.previous_value.slice(0, 24)} → ${l.new_value.slice(0, 24)}` : l.new_value ? l.new_value.slice(0, 40) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}