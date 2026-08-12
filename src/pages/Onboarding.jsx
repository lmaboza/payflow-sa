import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Check, Building2, FileText, Settings as SettingsIcon, Server, ArrowRight, ArrowLeft } from "lucide-react";

const STEPS = [
  { key: "company", title: "Company Details", icon: Building2 },
  { key: "compliance", title: "Compliance & References", icon: FileText },
  { key: "payroll", title: "Payroll Configuration", icon: SettingsIcon },
  { key: "engine", title: "Payroll Engine", icon: Server }
];

const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", trading_name: "", registration_number: "", industry: "", address: "", province: "",
    contact_person: "", email: "", phone: "", paye_reference: "", uif_reference: "", sdl_number: "",
    financial_year_start: "", payroll_frequency: "monthly", default_pay_date: 25,
    default_working_hours: 40, default_overtime_rate: 1.5,
    engine_url: "http://localhost:8743", engine_api_key: ""
  });

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (me.business_id) {
          const b = await base44.entities.Business.get(me.business_id);
          if (b) {
            setForm((f) => ({ ...f, ...b }));
            if (b.onboarding_complete) navigate("/");
          }
        }
      } catch (e) {}
    })();
  }, [navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setSaving(true);
    try {
      const me = await base44.auth.me();
      let businessId = me.business_id;
      const payload = { ...form, onboarding_complete: true };
      if (businessId) {
        await base44.entities.Business.update(businessId, payload);
      } else {
        const created = await base44.entities.Business.create(payload);
        businessId = created.id;
      }
      await base44.auth.updateMe({ business_id: businessId, app_role: me.app_role || "business_owner" });
      toast({ title: "Business onboarded", description: "Welcome to PayFlow SA." });
      navigate("/");
    } catch (e) {
      toast({ variant: "destructive", title: "Could not complete onboarding", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const field = (label, name, opts = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input value={form[name] ?? ""} type={opts.type || "text"} onChange={(e) => set(name, e.target.value)} placeholder={opts.placeholder} />
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900 font-heading text-lg font-bold">P</div>
          <div className="font-heading text-lg font-semibold">PayFlow SA</div>
        </div>
        <div>
          <h2 className="font-heading text-3xl font-semibold leading-tight">South African payroll,<br />engineered for growing businesses.</h2>
          <p className="mt-4 max-w-md text-sm text-slate-300">Set up your business in a few steps. PayFlow connects to your dedicated Payroll Engine for accurate, compliant SARS calculations.</p>
        </div>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} PayFlow SA · SARS compliant payroll</p>
      </div>

      <div className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading text-base font-bold">P</div>
            <span className="font-heading text-base font-semibold">PayFlow SA</span>
          </div>

          <div className="mb-8 flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex flex-1 items-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${i <= step ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={`mx-1 h-0.5 flex-1 rounded ${i < step ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          <Card className="border-border shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <h3 className="font-heading text-xl font-semibold text-foreground">{STEPS[step].title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}</p>

              <div className="mt-6 space-y-4">
                {step === 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {field("Company Name *", "name")}
                    {field("Trading Name", "trading_name")}
                    {field("Registration Number", "registration_number")}
                    {field("Industry", "industry")}
                    <div className="sm:col-span-2">{field("Business Address", "address")}</div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Province</Label>
                      <Select value={form.province} onValueChange={(v) => set("province", v)}>
                        <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                        <SelectContent>{PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {field("Contact Person", "contact_person")}
                    {field("Email", "email", { type: "email" })}
                    {field("Phone", "phone")}
                  </div>
                )}

                {step === 1 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {field("PAYE Reference", "paye_reference")}
                    {field("UIF Reference", "uif_reference")}
                    {field("SDL Number", "sdl_number")}
                    {field("Financial Year Start", "financial_year_start", { type: "date" })}
                    <p className="sm:col-span-2 rounded-lg bg-accent px-3 py-2.5 text-xs text-muted-foreground">
                      These references are used for compliance tracking and SARS submissions (EMP201, EMP501, IRP5).
                    </p>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Payroll Frequency</Label>
                      <Select value={form.payroll_frequency} onValueChange={(v) => set("payroll_frequency", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {field("Default Pay Date (day of month)", "default_pay_date", { type: "number" })}
                    {field("Default Working Hours / week", "default_working_hours", { type: "number" })}
                    {field("Default Overtime Rate (x)", "default_overtime_rate", { type: "number" })}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-accent/50 p-4 text-sm text-muted-foreground">
                      PayFlow SA does not calculate payroll itself. It connects to your <span className="font-medium text-foreground">PayFlow Payroll Engine</span> — a separate installable server (Windows, Linux or Docker). Enter its URL below. You can change this later in Settings.
                    </div>
                    {field("Payroll Engine URL", "engine_url", { placeholder: "http://localhost:8743" })}
                    {field("Engine API Key (optional)", "engine_api_key")}
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <Button variant="ghost" onClick={back} disabled={step === 0}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button onClick={next}>Continue <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                ) : (
                  <Button onClick={finish} disabled={saving || !form.name}>
                    {saving ? "Completing…" : "Complete Setup"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}