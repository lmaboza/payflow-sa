import { useState, useEffect } from "react";
import { useEmployee } from "@/lib/useEmployee";
import { Link } from "react-router-dom";
import EmployeeHeader from "@/components/portal/EmployeeHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { base44 } from "@/api/base44Client";
import { formatDateTime } from "@/lib/format";
import {
  Bell, ReceiptText, CheckCircle2, CalendarDays, FileText, Wallet, MessageSquare,
  UserCog, Loader2, CheckCheck
} from "lucide-react";

const TYPE_ICON = {
  payslip_available: ReceiptText,
  salary_processed: CheckCircle2,
  leave_approved: CalendarDays,
  leave_rejected: CalendarDays,
  tax_document: FileText,
  claim_status: Wallet,
  query_response: MessageSquare,
  detail_change: UserCog
};

const PREFS = [
  { key: "payslip_available", label: "Payslip available" },
  { key: "leave_approved", label: "Leave decisions" },
  { key: "tax_document", label: "Tax documents" },
  { key: "claim_status", label: "Claim updates" },
  { key: "query_response", label: "Payroll query responses" }
];

export default function EmployeeNotifications() {
  const { employee, user } = useEmployee();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState({});

  const load = async () => {
    if (!employee?.id) return;
    try {
      const n = await base44.entities.EmployeeNotification.filter({ employee_id: employee.id }, "-created_date", 100);
      setNotifications(n || []);
      setPrefs(user?.notification_prefs || {});
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [employee?.id]);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    await base44.entities.EmployeeNotification.bulkUpdate(unread.map((n) => ({ id: n.id, read: true })));
    setNotifications((arr) => arr.map((n) => ({ ...n, read: true })));
  };

  const togglePref = async (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    await base44.auth.updateMe({ notification_prefs: next });
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <EmployeeHeader title="Notifications" subtitle="Stay up to date with your payroll activity."
        actions={unread > 0 ? <Button size="sm" variant="outline" className="gap-2" onClick={markAllRead}><CheckCheck className="h-4 w-4" /> Mark all read</Button> : null} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {notifications.length === 0 ? (
            <Card className="border-border"><CardContent className="p-6">
              <EmptyState icon={Bell} title="No notifications" description="Payroll updates will appear here." />
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell;
                return (
                  <Card key={n.id} className={`border-border ${!n.read ? "ring-1 ring-emerald-200" : ""}`}>
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${!n.read ? "bg-emerald-50 text-emerald-600" : "bg-accent text-muted-foreground"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{n.title}</span>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                        </div>
                        {n.message && <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>}
                        <div className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.created_date)}</div>
                      </div>
                      {n.link && <Link to={n.link}><Button variant="ghost" size="sm">View</Button></Link>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Bell className="h-4 w-4 text-muted-foreground" /> Notification preferences
              </div>
              <div className="space-y-3">
                {PREFS.map((p) => (
                  <div key={p.key} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{p.label}</span>
                    <Switch checked={!!prefs[p.key]} onCheckedChange={(v) => togglePref(p.key, v)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}