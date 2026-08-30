import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/useBusiness";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";
import { formatZAR } from "@/lib/format";
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, FileUp
} from "lucide-react";

const FIELDS = ["employee_number", "first_name", "last_name", "id_number", "email", "mobile", "employment_date", "employment_type", "basic_salary", "pay_frequency", "tax_number"];

function validateRow(row, existingNumbers) {
  const errors = [];
  if (!row.first_name?.trim()) errors.push("Missing first name");
  if (!row.last_name?.trim()) errors.push("Missing last name");
  if (!row.employee_number?.toString().trim()) errors.push("Missing employee number");
  else if (existingNumbers.has(row.employee_number.toString().trim())) errors.push("Duplicate employee number");
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("Invalid email");
  if (row.basic_salary !== undefined && row.basic_salary !== "" && isNaN(Number(row.basic_salary))) errors.push("Invalid salary");
  if (row.employment_date && isNaN(new Date(row.employment_date).getTime())) errors.push("Invalid date");
  return errors;
}

function splitCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur); cur = "";
    } else if (ch === "\n") {
      row.push(cur); rows.push(row); row = []; cur = "";
    } else if (ch !== "\r") {
      cur += ch;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseCSV(text) {
  const rows = splitCSV(text);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((values) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (values[idx] ?? "").trim(); });
    return obj;
  });
}

function pick(row, ...keys) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

const VALID_EMPLOYMENT_TYPES = ["permanent", "fixed_term", "casual", "contractor"];
function normalizeEmploymentType(v) {
  const lower = (v || "").toLowerCase().replace(/[\s-]+/g, "_");
  return VALID_EMPLOYMENT_TYPES.includes(lower) ? lower : "permanent";
}

// Maps a raw CSV row (camelCase or snake_case headers) to Employee entity fields.
function mapRow(row) {
  return {
    employee_number: pick(row, "employeeNumber", "employee_number"),
    first_name: pick(row, "firstName", "first_name"),
    last_name: pick(row, "lastName", "last_name"),
    email: pick(row, "email", "Email"),
    mobile: pick(row, "mobile", "phone", "Phone"),
    id_number: pick(row, "idNumber", "id_number", "idNumberMasked"),
    employment_date: pick(row, "effectiveFrom", "employment_date", "startDate", "hireDate"),
    employment_type: normalizeEmploymentType(pick(row, "employmentType", "employment_type", "employmentStatus")),
    basic_salary: pick(row, "monthlyTaxableRemuneration", "monthly_taxable_remuneration", "basic_salary", "basicSalary", "salary"),
    pay_frequency: "monthly",
    tax_number: pick(row, "taxNumberMasked", "tax_number", "taxNumber"),
    deductions: pick(row, "otherEmployeeDeductions", "deductions")
  };
}

export default function EmployeeImport() {
  const navigate = useNavigate();
  const { user, business } = useBusiness();
  const { toast } = useToast();
  const [step, setStep] = useState("upload"); // upload | preview | done
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState([]);
  const [existingNumbers, setExistingNumbers] = useState(new Set());
  const [importing, setImporting] = useState(false);

  const parse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (!parsed.length) {
        toast({ variant: "destructive", title: "No rows found", description: "The file appears to be empty." });
        return;
      }
      const existing = await base44.entities.Employee.filter({ business_id: business.id }, "-created_date", 500);
      const existingNumbers = new Set(existing.map((e) => e.employee_number));
      setExistingNumbers(existingNumbers);
      const mapped = parsed.map(mapRow);
      const validated = mapped.map((r) => ({ ...r, _errors: validateRow(r, existingNumbers) }));
      setRows(validated);
      setStep("preview");
    } catch (e) {
      toast({ variant: "destructive", title: "Could not read file", description: e.message });
    } finally {
      setParsing(false);
    }
  };

  const validRows = rows.filter((r) => r._errors.length === 0);
  const invalidRows = rows.filter((r) => r._errors.length > 0);

  const confirmImport = async () => {
    setImporting(true);
    try {
      const records = validRows.map((r) => ({
        business_id: business.id,
        employee_number: String(r.employee_number).trim(),
        first_name: String(r.first_name).trim(),
        last_name: String(r.last_name).trim(),
        id_number: r.id_number || "",
        email: r.email || "",
        mobile: r.mobile || "",
        employment_date: r.employment_date || "",
        employment_type: r.employment_type || "permanent",
        basic_salary: Number(r.basic_salary) || 0,
        pay_frequency: r.pay_frequency || "monthly",
        tax_number: r.tax_number || "",
        deductions: Number(r.deductions) || 0,
        status: "active"
      }));
      await base44.entities.Employee.bulkCreate(records);
      await logAudit(business.id, user, "employees_imported", "Employee", null, null, { count: records.length });
      toast({ title: "Import complete", description: `${records.length} employees imported.` });
      setStep("done");
    } catch (e) {
      toast({ variant: "destructive", title: "Import failed", description: e.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/employees")} className="mb-4 gap-1.5"><ArrowLeft className="h-4 w-4" /> Employees</Button>
      <PageHeader title="Import Employees" subtitle="Upload a CSV or Excel file, validate, and import employees in bulk." />

      {step === "upload" && (
        <Card className="border-border"><CardContent className="p-8">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent"><FileSpreadsheet className="h-7 w-7 text-muted-foreground" /></div>
            <h3 className="font-heading text-base font-semibold">Upload your employee file</h3>
            <p className="mt-1 text-sm text-muted-foreground">CSV or Excel. Accepted columns: employeeNumber/employee_number, firstName/first_name, lastName/last_name, email, monthlyTaxableRemuneration/basic_salary, effectiveFrom/employment_date, taxNumberMasked/tax_number.</p>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-6" />
            <Button onClick={parse} disabled={!file || parsing} className="mt-4 w-full gap-2">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} {parsing ? "Reading file…" : "Upload & Validate"}
            </Button>
          </div>
        </CardContent></Card>
      )}

      {step === "preview" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><span className="text-sm"><strong>{validRows.length}</strong> valid</span></div>
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><span className="text-sm"><strong>{invalidRows.length}</strong> with errors</span></div>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => { setStep("upload"); setRows([]); }}>Start Over</Button>
              <Button onClick={confirmImport} disabled={importing || validRows.length === 0} className="gap-2">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import {validRows.length} Employees</Button>
            </div>
          </div>

          {invalidRows.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              <div className="mb-1 font-medium">{invalidRows.length} record(s) have validation errors and will not be imported.</div>
              <div className="text-xs">Fix these rows in your file and re-upload, or proceed to import only the valid records.</div>
            </div>
          )}

          <Card className="border-border"><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Employee No.</TableHead><TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Email</TableHead><TableHead className="text-right">Salary</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={r._errors.length ? "bg-amber-50/40" : ""}>
                    <TableCell className="text-sm">{r.employee_number || "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{r.first_name} {r.last_name}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{r.email || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{r.basic_salary ? formatZAR(Number(r.basic_salary)) : "—"}</TableCell>
                    <TableCell>{r._errors.length ? <Badge variant="outline" className="border-amber-200 text-amber-600">{r._errors.join(", ")}</Badge> : <Badge variant="outline" className="border-emerald-200 text-emerald-600">Valid</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
      )}

      {step === "done" && (
        <Card className="border-border"><CardContent className="p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50"><CheckCircle2 className="h-7 w-7 text-emerald-600" /></div>
          <h3 className="font-heading text-lg font-semibold">Import complete</h3>
          <p className="mt-1 text-sm text-muted-foreground">{validRows.length} employees were imported successfully.</p>
          <Button onClick={() => navigate("/employees")} className="mt-6">View Employees</Button>
        </CardContent></Card>
      )}
    </div>
  );
}