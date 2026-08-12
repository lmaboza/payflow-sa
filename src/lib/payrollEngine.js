import { base44 } from "@/api/base44Client";

// Frontend API service abstraction. The frontend never embeds payroll calculation logic;
// all payroll engine interactions go through the backend proxy function which calls the
// external PayFlow Payroll Engine API at the URL configured per business.

export async function engineHealth(businessId) {
  const res = await base44.functions.invoke("payrollEngine", {
    action: "health",
    business_id: businessId
  });
  return res.data;
}

export async function validatePayroll(businessId, data) {
  const res = await base44.functions.invoke("payrollEngine", {
    action: "validate",
    business_id: businessId,
    data
  });
  return res.data;
}

export async function calculatePayroll(businessId, data) {
  const res = await base44.functions.invoke("payrollEngine", {
    action: "calculate",
    business_id: businessId,
    data
  });
  return res.data;
}

export async function approvePayroll(businessId, data) {
  const res = await base44.functions.invoke("payrollEngine", {
    action: "approve",
    business_id: businessId,
    data
  });
  return res.data;
}

export async function generatePayslip(businessId, data) {
  const res = await base44.functions.invoke("payrollEngine", {
    action: "payslip",
    business_id: businessId,
    data
  });
  return res.data;
}

export async function fetchCompliance(businessId, data) {
  const res = await base44.functions.invoke("payrollEngine", {
    action: "compliance",
    business_id: businessId,
    data
  });
  return res.data;
}