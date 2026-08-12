export function payrollStatusMeta(status) {
  const map = {
    draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
    validating: { label: "Validating", cls: "bg-blue-50 text-blue-600" },
    validation_failed: { label: "Validation Failed", cls: "bg-rose-50 text-rose-600" },
    calculated: { label: "Calculated", cls: "bg-indigo-50 text-indigo-600" },
    review_required: { label: "Review Required", cls: "bg-amber-50 text-amber-600" },
    approved: { label: "Approved", cls: "bg-violet-50 text-violet-600" },
    completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-600" },
    locked: { label: "Locked", cls: "bg-slate-200 text-slate-500" }
  };
  return map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
}

export function complianceStatusMeta(status) {
  const map = {
    compliant: { label: "Compliant", cls: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
    action_required: { label: "Action Required", cls: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
    overdue: { label: "Overdue", cls: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
    pending: { label: "Pending", cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" }
  };
  return map[status] || { label: status, cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
}

export function payrollHealth(run) {
  if (!run) return { label: "No Payroll", cls: "bg-slate-100 text-slate-500", dot: "bg-slate-400" };
  const bad = ["validation_failed", "review_required"];
  const ok = ["calculated", "approved", "completed", "locked"];
  if (bad.includes(run.status)) return { label: "Action Required", cls: "bg-amber-50 text-amber-600", dot: "bg-amber-500" };
  if (ok.includes(run.status)) return { label: "Payroll Ready", cls: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" };
  return { label: "In Progress", cls: "bg-blue-50 text-blue-600", dot: "bg-blue-500" };
}