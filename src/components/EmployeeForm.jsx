import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

export default function EmployeeForm({ initial, onSubmit, submitLabel = "Save Employee", onCancel }) {
  const [form, setForm] = useState(() => ({
    employee_number: "",
    first_name: "",
    last_name: "",
    id_number: "",
    passport_number: "",
    date_of_birth: "",
    email: "",
    mobile: "",
    address: "",
    employment_date: "",
    termination_date: "",
    employment_type: "permanent",
    department_id: "",
    position_id: "",
    branch_id: "",
    basic_salary: "",
    pay_frequency: "monthly",
    tax_number: "",
    tax_status: "active",
    uif_status: "contributing",
    sdl_status: "liable",
    eti_eligible: false,
    allowances: "",
    deductions: "",
    medical_aid: "",
    retirement_contribution: "",
    ...initial
  }));
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.first_name.trim()) return setError("First name is required.");
    if (!form.last_name.trim()) return setError("Last name is required.");
    if (!form.employee_number.trim()) return setError("Employee number is required.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Email address is not valid.");
    setError("");
    onSubmit({
      ...form,
      basic_salary: Number(form.basic_salary) || 0,
      allowances: Number(form.allowances) || 0,
      deductions: Number(form.deductions) || 0,
      medical_aid: Number(form.medical_aid) || 0,
      retirement_contribution: Number(form.retirement_contribution) || 0
    });
  };

  const field = (label, name, opts = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input value={form[name] ?? ""} onChange={(e) => set(name, e.target.value)} type={opts.type || "text"} placeholder={opts.placeholder || ""} />
    </div>
  );

  const select = (label, name, options) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={form[name]} onValueChange={(v) => set(name, v)}>
        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-8">
      <section>
        <h4 className="mb-4 font-heading text-sm font-semibold text-foreground">Personal Information</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("Employee Number", "employee_number")}
          {field("First Name", "first_name")}
          {field("Last Name", "last_name")}
          {field("ID Number", "id_number")}
          {field("Passport Number", "passport_number")}
          {field("Date of Birth", "date_of_birth", { type: "date" })}
          {field("Email", "email", { type: "email" })}
          {field("Mobile", "mobile")}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label className="text-xs font-medium text-muted-foreground">Residential Address</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-4 font-heading text-sm font-semibold text-foreground">Employment Information</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("Employment Date", "employment_date", { type: "date" })}
          {field("Termination Date", "termination_date", { type: "date" })}
          {select("Employment Type", "employment_type", [
            { value: "permanent", label: "Permanent" },
            { value: "fixed_term", label: "Fixed Term" },
            { value: "casual", label: "Casual" },
            { value: "contractor", label: "Contractor" }
          ])}
          {field("Department", "department_id")}
          {field("Position / Title", "position_id")}
          {field("Branch", "branch_id")}
        </div>
      </section>

      <section>
        <h4 className="mb-4 font-heading text-sm font-semibold text-foreground">Payroll Information</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("Basic Salary (ZAR)", "basic_salary", { type: "number" })}
          {select("Pay Frequency", "pay_frequency", [
            { value: "monthly", label: "Monthly" },
            { value: "weekly", label: "Weekly" },
            { value: "fortnightly", label: "Fortnightly" }
          ])}
          {field("Allowances", "allowances", { type: "number" })}
          {field("Deductions", "deductions", { type: "number" })}
          {field("Medical Aid", "medical_aid", { type: "number" })}
          {field("Retirement Contribution", "retirement_contribution", { type: "number" })}
        </div>
      </section>

      <section>
        <h4 className="mb-4 font-heading text-sm font-semibold text-foreground">Tax Information</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("Tax Number", "tax_number")}
          {select("Tax Status", "tax_status", [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "provisional", label: "Provisional" }
          ])}
          {select("UIF Status", "uif_status", [
            { value: "contributing", label: "Contributing" },
            { value: "exempt", label: "Exempt" },
            { value: "ceased", label: "Ceased" }
          ])}
          {select("SDL Status", "sdl_status", [
            { value: "liable", label: "Liable" },
            { value: "exempt", label: "Exempt" }
          ])}
          <div className="flex items-center gap-2 pt-6">
            <Checkbox id="eti" checked={form.eti_eligible} onCheckedChange={(v) => set("eti_eligible", !!v)} />
            <Label htmlFor="eti" className="text-sm text-foreground">ETI Eligible</Label>
          </div>
        </div>
      </section>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}