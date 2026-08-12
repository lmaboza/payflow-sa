import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";
import { engineHealth } from "@/lib/payrollEngine";
import { formatDateTime } from "@/lib/format";
import { ROLES, can } from "@/lib/permissions";
import { Server, ShieldCheck, Save, RefreshCw, Loader2, CircleCheck, CircleAlert } from "lucide-react";

export default function Settings() {
  const { user, business, refreshBusiness } = useBusiness();
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);

  const role = user?.app_role || "business_owner";
  const canManage = can(role, "manage_settings");
  const canManageEngine = can(role, "manage_engine");

  useEffect(() => {
    if (business) setForm({ ...business });
  }, [business]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const prev = { ...business };
      await base44.entities.Business.update(business.id, form);
      await logAudit(business.id, user, "business_updated", "Business", business.id, prev, form);
      await refreshBusiness();
      toast({ title: "Settings saved" });
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setChecking(true);
    try {
      await base44.entities.Business.update(business.id, { engine_url: form.engine_url, engine_api_key: form.engine_api_key });
      await refreshBusiness();
      const data = await engineHealth(business.id);
      setHealth(data);
      if (data.status === "connected") toast({ title: "Engine connected" });
      else toast({ variant: "destructive", title: "Engine unavailable", description: data.message });
    } catch (e) {
      setHealth({ status: "offline", message: e.message });
    } finally {
      setChecking(false);
    }
  };

  if (!form) {
    return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>;
  }

  const connected = health?.status === "connected";

  const field = (label, name, opts = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input value={form[name] ?? ""} type={opts.type || "text"} onChange={(e) => set(name, e.target.value)} disabled={!canManage} />
    </div>
  );

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your business profile, payroll configuration and Payroll Engine connection." />

      <Tabs defaultValue="engine">
        <TabsList className="mb-6">
          <TabsTrigger value="engine">Payroll Engine</TabsTrigger>
          <TabsTrigger value="business">Business Profile</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Settings</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="engine" className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4 text-muted-foreground" /> Payroll Engine Status</CardTitle>
              <CardDescription>PayFlow SA delegates all payroll calculations to your external Payroll Engine.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-accent/30 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  {checking ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : connected ? <CircleCheck className="h-5 w-5 text-emerald-500" /> : <CircleAlert className="h-5 w-5 text-rose-500" />}
                  <div>
                    <div className="font-heading text-sm font-semibold text-foreground">PAYROLL ENGINE</div>
                    <div className="text-sm text-muted-foreground">{checking ? "Checking…" : connected ? "● Connected" : "● Offline"}</div>
                  </div>
                </div>
                <Button variant="outline" onClick={testConnection} disabled={checking} className="gap-2">
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Test Connection
                </Button>
              </div>

              {health && (
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Engine Version</div><div className="mt-0.5 text-sm font-medium text-foreground">{health.version || "—"}</div></div>
                  <div className="rounded-xl border border-border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Database</div><div className="mt-0.5 text-sm font-medium text-foreground">{health.database || (connected ? "Connected" : "—")}</div></div>
                  <div className="rounded-xl border border-border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Tax Rules</div><div className="mt-0.5 text-sm font-medium text-foreground">{health.tax_rules || health.tax_year || "—"}</div></div>
                  <div className="rounded-xl border border-border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Last Health Check</div><div className="mt-0.5 text-sm font-medium text-foreground">{formatDateTime(new Date().toISOString())}</div></div>
                </div>
              )}

              {health && !connected && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <div className="font-medium">{health.status === "offline" ? "Payroll Engine Unavailable" : "Connection issue"}</div>
                  <p className="mt-1">{health.message || "The Payroll Engine is not reachable. Calculations cannot be performed until it is online."}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Engine Configuration</CardTitle>
              <CardDescription>The base URL of your PayFlow Payroll Engine — a local address or private server URL.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {field("Payroll Engine URL", "engine_url", { placeholder: "http://localhost:8743" })}
              {field("Engine API Key (optional)", "engine_api_key")}
              <div className="flex justify-end gap-2">
                {canManageEngine && <Button onClick={testConnection} disabled={checking} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" /> Save & Test</Button>}
                {canManage && <Button onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Save</Button>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-base">Business Profile</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field("Company Name", "name")}
              {field("Trading Name", "trading_name")}
              {field("Registration Number", "registration_number")}
              {field("Industry", "industry")}
              <div className="sm:col-span-2">{field("Address", "address")}</div>
              {field("Province", "province")}
              {field("Contact Person", "contact_person")}
              {field("Email", "email", { type: "email" })}
              {field("Phone", "phone")}
              {field("PAYE Reference", "paye_reference")}
              {field("UIF Reference", "uif_reference")}
              {field("SDL Number", "sdl_number")}
              {field("Financial Year Start", "financial_year_start", { type: "date" })}
              <div className="sm:col-span-2 flex justify-end">{canManage && <Button onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Save Changes</Button>}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Payroll Settings</CardTitle>
              <CardDescription>Defaults applied to new payroll periods.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Payroll Frequency</Label>
                <Select value={form.payroll_frequency} onValueChange={(v) => set("payroll_frequency", v)} disabled={!canManage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {field("Default Pay Date (day)", "default_pay_date", { type: "number" })}
              {field("Default Working Hours / week", "default_working_hours", { type: "number" })}
              {field("Default Overtime Rate (x)", "default_overtime_rate", { type: "number" })}
              <div className="sm:col-span-2 flex justify-end">{canManage && <Button onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Save Changes</Button>}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> Roles & Permissions</CardTitle>
              <CardDescription>Your current role: {ROLES[role] || role}. Role-based access is enforced in the UI; server-side validation applies when the Payroll Engine is connected.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="p-3 text-left">Role</th><th className="p-3 text-left">Capabilities</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(ROLES).map(([key, label]) => (
                      <tr key={key} className="border-t border-border">
                        <td className="p-3 font-medium text-foreground">{label}{key === role && <span className="ml-2 text-xs text-primary">(you)</span>}</td>
                        <td className="p-3 text-muted-foreground">
                          {key === "business_owner" && "Full access to all modules and settings."}
                          {key === "payroll_admin" && "Run, review and approve payroll; manage employees."}
                          {key === "hr_admin" && "Manage employees and documents."}
                          {key === "manager" && "View employees and reports."}
                          {key === "accountant" && "Run and approve payroll; view compliance and audit."}
                          {key === "employee" && "View own payslips only."}
                          {key === "system_admin" && "Full system administration."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}