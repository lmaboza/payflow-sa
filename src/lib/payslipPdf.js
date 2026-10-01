import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { formatZAR, formatDate } from "@/lib/format";

// Payslip PDF service.
// Uses ONLY authoritative stored payroll values (Payslip + PayrollLineItem + Employee).
// Never recalculates PAYE/UIF/SDL. Generates a PDF in the browser (jsPDF), uploads it
// to PRIVATE storage, persists a PayslipDocument record, and serves downloads via
// short-lived signed URLs. Ownership is enforced by RLS on Payslip + PayslipDocument.

const MIME = "application/pdf";

// Intl en-ZA emits a non-breaking space (U+00A0) which jsPDF's core fonts can't render.
function money(n) {
  return formatZAR(Number(n) || 0).replace(/\u00A0/g, " ");
}

function mask(v, keep = 4) {
  if (!v) return "—";
  const s = String(v);
  if (s.length <= keep) return s;
  return "•".repeat(Math.min(8, s.length - keep)) + s.slice(-keep);
}

function fileNameFor(employee, payslip) {
  const num = (employee?.employee_number || "EMP").replace(/[^A-Za-z0-9]/g, "");
  const ym = payslip?.pay_period_start ? String(payslip.pay_period_start).slice(0, 7) : "period";
  return `PayFlow_Payslip_${num}_${ym}.pdf`;
}

function periodLabel(payslip) {
  if (!payslip) return "—";
  return `${formatDate(payslip.pay_period_start)} – ${formatDate(payslip.pay_period_end)}`;
}

// ---- PDF construction (A4, mm) ----
export function buildPayslipPdf(payslip, employee, business, lineItem) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = 210;
  const M = 14; // margin
  const CW = W - M * 2; // content width

  const NAVY = [16, 25, 44];
  const EMERALD = [16, 185, 129];
  const EMERALD_SOFT = [232, 248, 242];
  const BORDER = [221, 231, 228];
  const DARK = [15, 23, 42];
  const MUTED = [100, 116, 139];
  const ROSE = [190, 60, 60];

  const empName = employee ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim() : "—";
  const employerName = business?.trading_name || business?.name || "—";

  // ---- Header band ----
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 26, "F");
  // emerald accent stripe
  doc.setFillColor(...EMERALD);
  doc.rect(0, 26, W, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("PayFlow SA", M, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("EMPLOYEE PAYSLIP", M, 17);
  doc.setTextColor(180, 195, 210);
  doc.text("Employee Self-Service", M, 21);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(employerName, W - M, 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 195, 210);
  if (business?.registration_number) doc.text(`Reg: ${business.registration_number}`, W - M, 16, { align: "right" });
  if (business?.paye_reference) doc.text(`PAYE: ${business.paye_reference}`, W - M, 20, { align: "right" });

  // ---- Employer / Employee details ----
  let y = 34;
  const colW = CW / 2 - 3;
  const label = (x, yy, text) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(text.toUpperCase(), x, yy);
  };
  const line = (x, yy, text) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(text || "—", x, yy);
  };

  label(M, y, "Employer");
  y += 5;
  line(M, y, employerName);
  y += 4.5;
  if (business?.registration_number) { line(M, y, `Reg No: ${business.registration_number}`); y += 4.5; }
  if (business?.paye_reference) { line(M, y, `PAYE Ref: ${business.paye_reference}`); y += 4.5; }
  if (business?.uif_reference) { line(M, y, `UIF Ref: ${business.uif_reference}`); y += 4.5; }
  if (business?.address) { line(M, y, business.address); y += 4.5; }

  let yr = 34;
  label(M + colW + 6, yr, "Employee");
  yr += 5;
  line(M + colW + 6, yr, empName);
  yr += 4.5;
  if (employee?.employee_number) { line(M + colW + 6, yr, `Emp No: ${employee.employee_number}`); yr += 4.5; }
  if (employee?.tax_number) { line(M + colW + 6, yr, `Tax No: ${mask(employee.tax_number)}`); yr += 4.5; }
  if (employee?.email) { line(M + colW + 6, yr, employee.email); yr += 4.5; }
  if (employee?.department_id) { line(M + colW + 6, yr, `Dept: ${employee.department_id}`); yr += 4.5; }

  y = Math.max(y, yr) + 2;

  // ---- Period band ----
  doc.setFillColor(...EMERALD_SOFT);
  doc.rect(M, y, CW, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  doc.text(`Pay Period: ${periodLabel(payslip)}`, M + 3, y + 6.3);
  doc.text(`Pay Date: ${formatDate(payslip?.pay_date)}`, M + CW - 3, y + 6.3, { align: "right" });
  y += 16;

  // ---- Pay summary: Gross / Deductions / Net ----
  const totalDeductions = (Number(payslip.paye) || 0) + (Number(payslip.uif) || 0) + (Number(payslip.other_deductions) || 0);
  const boxW = (CW - 8) / 3;
  const drawBox = (x, labelTxt, val, opts = {}) => {
    doc.setDrawColor(...BORDER);
    doc.setFillColor(opts.fill ? opts.fill : 255, 255, 255);
    doc.rect(x, y, boxW, 22, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(labelTxt.toUpperCase(), x + 4, y + 6);
    doc.setFontSize(opts.big ? 13 : 11);
    doc.setTextColor(...(opts.color || DARK));
    doc.text(val, x + 4, y + 15);
  };
  drawBox(M, "Gross Pay", money(payslip.gross_salary));
  drawBox(M + boxW + 4, "Deductions", `-${money(totalDeductions)}`, { color: ROSE });
  drawBox(M + (boxW + 4) * 2, "Net Pay", money(payslip.net_salary), { fill: NAVY[0], color: EMERALD, big: true });
  // Net box navy fill override
  doc.setFillColor(...NAVY);
  doc.rect(M + (boxW + 4) * 2, y, boxW, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(180, 195, 210);
  doc.text("NET PAY", M + (boxW + 4) * 2 + 4, y + 6);
  doc.setFontSize(13);
  doc.setTextColor(...EMERALD);
  doc.text(money(payslip.net_salary), M + (boxW + 4) * 2 + 4, y + 15);
  y += 30;

  // ---- Section helper ----
  const sectionTitle = (yy, text) => {
    doc.setFillColor(...EMERALD);
    doc.rect(M, yy, 2, 4.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(text, M + 4, yy + 3.6);
    doc.setDrawColor(...BORDER);
    doc.line(M, yy + 6, M + CW, yy + 6);
    return yy + 10;
  };
  const dataRow = (yy, labelTxt, val, opts = {}) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...(opts.muted ? MUTED : DARK));
    doc.text(labelTxt, M + 2, yy);
    doc.setFont("helvetica", opts.strong ? "bold" : "normal");
    doc.setTextColor(...(opts.color || DARK));
    doc.text(val, M + CW - 2, yy, { align: "right" });
    return yy + 5.2;
  };

  // ---- Earnings ----
  const earnings = [
    { label: "Basic / Cash Salary", amount: payslip.basic_salary },
    { label: "Overtime", amount: payslip.overtime },
    { label: "Bonus", amount: payslip.bonus },
    { label: "Allowances", amount: payslip.allowances }
  ].filter((e) => Number(e.amount) > 0);
  y = sectionTitle(y, "Earnings");
  if (!earnings.length) { doc.setTextColor(...MUTED); doc.setFontSize(8); doc.text("No earnings recorded.", M + 2, y); y += 5; }
  earnings.forEach((e) => { y = dataRow(y, e.label, money(e.amount)); });
  y = dataRow(y, "Total Earnings", money(payslip.gross_salary), { strong: true });
  y += 4;

  // ---- Deductions ----
  const deductions = [
    { label: "PAYE", amount: payslip.paye },
    { label: "UIF", amount: payslip.uif },
    { label: "Other Deductions", amount: payslip.other_deductions }
  ].filter((d) => Number(d.amount) > 0);
  y = sectionTitle(y, "Deductions");
  if (!deductions.length) { doc.setTextColor(...MUTED); doc.setFontSize(8); doc.text("No deductions recorded.", M + 2, y); y += 5; }
  deductions.forEach((d) => { y = dataRow(y, d.label, `-${money(d.amount)}`, { color: ROSE }); });
  y = dataRow(y, "Total Deductions", `-${money(totalDeductions)}`, { strong: true, color: ROSE });
  y += 4;

  // ---- Employer Contributions ----
  const employerUif = Number(payslip.uif) || 0;
  const employerSdl = Number(lineItem?.sdl) || 0;
  const employerRetirement = Number(employee?.retirement_contribution) || 0;
  const employerMedical = Number(employee?.medical_aid) || 0;
  const totalEmployer = employerUif + employerSdl + employerRetirement + employerMedical;
  y = sectionTitle(y, "Employer Contributions");
  y = dataRow(y, "Employer UIF", money(employerUif));
  y = dataRow(y, "SDL (Skills Development Levy)", money(employerSdl), { muted: !employerSdl });
  if (employerRetirement) y = dataRow(y, "Retirement Contribution", money(employerRetirement));
  if (employerMedical) y = dataRow(y, "Medical Contribution", money(employerMedical));
  y = dataRow(y, "Total Employer Contributions", money(totalEmployer), { strong: true });
  y += 4;

  // ---- Cost to Company ----
  const ctc = (Number(payslip.gross_salary) || 0) + totalEmployer;
  doc.setFillColor(...NAVY);
  doc.rect(M, y, CW, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 210);
  doc.text("COST TO COMPANY", M + 4, y + 5.5);
  doc.setFontSize(12);
  doc.setTextColor(...EMERALD);
  doc.text(money(ctc), M + CW - 4, y + 9.5, { align: "right" });
  y += 20;

  // ---- Year to Date (engine values only) ----
  const hasYtd = payslip.ytd_gross || payslip.ytd_paye || payslip.ytd_uif;
  if (hasYtd) {
    y = sectionTitle(y, "Year to Date");
    y = dataRow(y, "YTD Gross / Taxable Earnings", money(payslip.ytd_gross));
    y = dataRow(y, "YTD Tax Paid (PAYE)", money(payslip.ytd_paye));
    y = dataRow(y, "YTD UIF", money(payslip.ytd_uif));
    y += 4;
  }

  // ---- Footer ----
  const fy = 287;
  doc.setDrawColor(...BORDER);
  doc.line(M, fy - 4, M + CW, fy - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  const ref = (payslip?.id || "").slice(-8).toUpperCase();
  doc.text(`Generated by PayFlow SA · ${formatDate(new Date())} · Reference: PF-${ref}`, M, fy);

  return doc;
}

// ---- Document record + storage ----
async function getExistingDoc(payslipId) {
  const res = await base44.entities.PayslipDocument.filter({ payslip_id: payslipId }, "-created_date", 1);
  return res?.[0] || null;
}

async function fetchLineItem(payslip) {
  if (!payslip?.payroll_run_id || !payslip?.employee_id) return null;
  try {
    const res = await base44.entities.PayrollLineItem.filter(
      { payroll_run_id: payslip.payroll_run_id, employee_id: payslip.employee_id }, "-created_date", 1
    );
    return res?.[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Ensures a stored payslip PDF exists (generates once, then reuses).
 * Returns { ok, status, message }.
 *  - status: "available" | "generating" | "failed" | "error"
 */
export async function ensurePayslipPdf({ payslip, employee, business, lineItem }) {
  if (!payslip?.id) return { ok: false, status: "error", message: "Payslip is missing." };

  // 1. Reuse an available document
  let doc = await getExistingDoc(payslip.id);
  if (doc?.generation_status === "available" && doc.file_uri) {
    return { ok: true, status: "available", doc };
  }
  if (doc?.generation_status === "generating") {
    return { ok: false, status: "generating", message: "Your payslip PDF is being prepared." };
  }

  // 2. Mark generating (reuse a failed record, or create one)
  const li = lineItem || await fetchLineItem(payslip);
  const business_id = employee?.business_id || business?.id || payslip.business_id;
  const file_name = fileNameFor(employee, payslip);
  const pay_period = periodLabel(payslip);

  const baseRecord = {
    business_id,
    employee_id: employee?.id || payslip.employee_id,
    payroll_run_id: payslip.payroll_run_id,
    payslip_id: payslip.id,
    pay_period,
    file_name,
    mime_type: MIME,
    generation_status: "generating",
    generated_at: new Date().toISOString()
  };

  try {
    if (doc?.id) {
      doc = await base44.entities.PayslipDocument.update(doc.id, {
        generation_status: "generating",
        generation_error: "",
        generated_at: new Date().toISOString()
      });
    } else {
      doc = await base44.entities.PayslipDocument.create(baseRecord);
    }

    // 3. Generate the PDF (authoritative stored values only)
    const pdfDoc = buildPayslipPdf(payslip, employee, business, li);
    const blob = pdfDoc.output("blob");
    const file = new File([blob], file_name, { type: MIME });

    // 4. Upload to PRIVATE storage
    const up = await base44.integrations.Core.UploadPrivateFile({ file });
    const file_uri = up?.file_uri;
    if (!file_uri) throw new Error("Storage upload returned no file reference.");

    // 5. Mark available
    doc = await base44.entities.PayslipDocument.update(doc.id, {
      file_uri,
      file_size: blob.size || 0,
      generation_status: "available",
      generation_error: "",
      generated_at: new Date().toISOString()
    });
    return { ok: true, status: "available", doc };
  } catch (e) {
    // 6. Mark failed — payslip & payroll remain untouched
    console.error("[PayFlow payslipPdf] generation failed", e);
    if (doc?.id) {
      try {
        await base44.entities.PayslipDocument.update(doc.id, {
          generation_status: "failed",
          generation_error: (e?.message || String(e)).slice(0, 500)
        });
      } catch (_) {}
    }
    return { ok: false, status: "failed", message: "We couldn't generate this payslip PDF." };
  }
}

/** Returns a short-lived signed download URL for a stored payslip PDF. */
export async function getPayslipPdfSignedUrl(fileUri) {
  const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 300 });
  return res?.signed_url;
}

/**
 * Full download flow for the employee/admin PDF button.
 * Reuses a stored PDF when available; generates once if needed.
 */
export async function downloadPayslipPdf({ payslip, employee, business, lineItem }) {
  const result = await ensurePayslipPdf({ payslip, employee, business, lineItem });

  if (result.status === "generating") {
    return { ok: false, status: "generating", message: result.message };
  }
  if (result.status === "failed") {
    return { ok: false, status: "failed", message: result.message || "We couldn't generate this payslip PDF." };
  }
  if (result.status === "error") {
    return { ok: false, status: "error", message: result.message || "Unable to generate your payslip PDF." };
  }

  // available — open a short-lived signed URL
  try {
    const signed = await getPayslipPdfSignedUrl(result.doc.file_uri);
    if (!signed) throw new Error("No signed URL returned.");
    window.open(signed, "_blank");
    return { ok: true, status: "available" };
  } catch (e) {
    return { ok: false, status: "error", message: "Unable to open your payslip PDF." };
  }
}

/**
 * Best-effort batch generation of payslip PDFs for every payslip in a completed run.
 * Called from the employer Complete flow. Failure-isolated: never affects payroll.
 * Returns { generated, failed }.
 */
export async function generatePayslipPdfsForRun(payrollRunId, businessId) {
  const payslips = await base44.entities.Payslip.filter({ payroll_run_id: payrollRunId }, "-pay_date", 500);
  if (!payslips?.length) return { generated: 0, failed: 0 };
  const business = businessId ? await base44.entities.Business.get(businessId).catch(() => null) : null;
  const employees = await base44.entities.Employee.filter({ business_id: businessId, status: "active" }, "-created_date", 500).catch(() => []);
  const empMap = new Map((employees || []).map((e) => [e.id, e]));
  let generated = 0, failed = 0;
  for (const p of payslips) {
    const emp = empMap.get(p.employee_id) || null;
    try {
      const r = await ensurePayslipPdf({ payslip: p, employee: emp, business });
      if (r.status === "available") generated++; else failed++;
    } catch (e) {
      console.error("[PayFlow] payslip PDF failed", p.id, e);
      failed++;
    }
  }
  return { generated, failed };
}

/** WhatsApp share uses the SAME stored document (secure link, no financial figures). */
export async function sharePayslipPdfViaWhatsApp({ payslip, employee, business }) {
  const result = await ensurePayslipPdf({ payslip, employee, business });
  const period = periodLabel(payslip);
  if (result.status === "available") {
    const msg = encodeURIComponent(`Hi, my PayFlow SA payslip for ${period} is available. I'll share it securely through the app.`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
    return { ok: true, status: "available" };
  }
  // Not available — share a non-sensitive notice
  const msg = encodeURIComponent(`Hi, my PayFlow SA payslip for ${period} is being prepared. I'll share it securely through the app.`);
  window.open(`https://wa.me/?text=${msg}`, "_blank");
  return result;
}