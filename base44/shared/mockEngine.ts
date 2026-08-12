// PayFlow Mock Payroll Engine
// Implements South African payroll calculations (2025/26 SARS tables) so the
// Base44 app can be tested end-to-end before the real .NET PayFlow.PayrollEngine
// is deployed. Activated when a business's engine_url is "mock" or "https://mock".
//
// The real .NET engine MUST reproduce these contracts and formulas exactly so
// the proxy can switch over transparently.

// ---- SARS 2025/26 PAYE brackets (annual taxable income) ----
const PAYE_BRACKETS = [
  { upTo: 237000, rate: 0.18, base: 0 },
  { upTo: 370500, rate: 0.26, base: 42660 },
  { upTo: 512800, rate: 0.31, base: 77334 },
  { upTo: 673000, rate: 0.36, base: 121467 },
  { upTo: 857900, rate: 0.39, base: 179019 },
  { upTo: 1817000, rate: 0.41, base: 251253 },
  { upTo: Infinity, rate: 0.45, base: 644847 }
];

const REBATES = { primary: 17235, secondary: 9444, tertiary: 3145 };
const UIF_RATE = 0.01;
const UIF_CEILING_MONTHLY = 17712; // 2025 UIF remuneration ceiling
const SDL_RATE = 0.01;
const ETI_MAX_AGE = 29;
const ETI_MIN_AGE = 18;
const ETI_MAX_REMUNERATION = 6500; // monthly

function annualPaye(taxableAnnual, age) {
  let paye = 0;
  for (const b of PAYE_BRACKETS) {
    if (taxableAnnual <= b.upTo) {
      paye = b.base + b.rate * (taxableAnnual - (PAYE_BRACKETS[PAYE_BRACKETS.indexOf(b) - 1]?.upTo || 0));
      break;
    }
  }
  if (taxableAnnual > PAYE_BRACKETS[PAYE_BRACKETS.length - 2].upTo) {
    const top = PAYE_BRACKETS[PAYE_BRACKETS.length - 1];
    paye = top.base + top.rate * (taxableAnnual - PAYE_BRACKETS[PAYE_BRACKETS.length - 2].upTo);
  }
  let rebate = REBATES.primary;
  if (age >= 65) rebate += REBATES.secondary;
  if (age >= 75) rebate += REBATES.tertiary;
  return Math.max(0, paye - rebate);
}

function monthlyPaye(grossMonthly, age) {
  const annual = annualPaye(grossMonthly * 12, age);
  return Math.max(0, annual / 12);
}

function uif(remunerationMonthly) {
  return Math.min(remunerationMonthly, UIF_CEILING_MONTHLY) * UIF_RATE;
}

function sdl(remunerationMonthly) {
  return remunerationMonthly * SDL_RATE;
}

function eti(remunerationMonthly, age, first12Months) {
  if (age < ETI_MIN_AGE || age > ETI_MAX_AGE) return 0;
  if (remunerationMonthly > ETI_MAX_REMUNERATION) return 0;
  if (!first12Months) return Math.min(remunerationMonthly * 0.25, 500);
  if (remunerationMonthly <= 1000) return remunerationMonthly * 0.5;
  if (remunerationMonthly <= 4000) return 1000;
  if (remunerationMonthly <= 5000) return 500;
  return 0;
}

function ageFromDob(dob) {
  if (!dob) return 30;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return isNaN(a) ? 30 : a;
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// ---- Engine actions ----

export function isMock(engineUrl) {
  return engineUrl === 'mock' || engineUrl === 'https://mock';
}

export function mockHealth() {
  return {
    status: 'connected',
    engine: 'PayFlow Mock Engine',
    version: '1.0.0-mock',
    database: 'in-memory',
    tax_year: '2025/2026',
    tax_tables: 'SARS 2025/26',
    timestamp: new Date().toISOString()
  };
}

export function mockValidate(data) {
  const employees = data?.employees || [];
  const results = employees.map((e) => {
    const errors = [];
    if (!e.first_name) errors.push('Missing first name');
    if (!e.last_name) errors.push('Missing last name');
    if (!e.employee_number) errors.push('Missing employee number');
    if (e.basic_salary == null || e.basic_salary < 0) errors.push('Invalid basic salary');
    if (e.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) errors.push('Invalid email');
    return { employee_id: e.id || e.employee_number, employee_number: e.employee_number, valid: errors.length === 0, errors };
  });
  const validCount = results.filter((r) => r.valid).length;
  return {
    status: 'ok',
    valid_count: validCount,
    error_count: results.length - validCount,
    results
  };
}

export function mockCalculate(data) {
  const employees = data?.employees || [];
  const period = data?.period || {};
  let grossTotal = 0, payeTotal = 0, uifTotal = 0, sdlTotal = 0, etiTotal = 0, netTotal = 0;
  const lineItems = employees.map((e) => {
    const basic = Number(e.basic_salary) || 0;
    const allowances = Number(e.allowances) || 0;
    const overtime = Number(e.overtime) || 0;
    const bonus = Number(e.bonus) || 0;
    const otherDeductions = Number(e.deductions) || 0;
    const gross = basic + allowances + overtime + bonus;
    const age = ageFromDob(e.date_of_birth);
    const paye = monthlyPaye(gross, age);
    const uifVal = e.uif_status === 'exempt' || e.uif_status === 'ceased' ? 0 : uif(gross);
    const sdlVal = e.sdl_status === 'exempt' ? 0 : sdl(gross);
    const etiVal = e.eti_eligible ? eti(gross, age, e.eti_first_12_months) : 0;
    const net = gross - paye - uifVal - otherDeductions;
    grossTotal += gross; payeTotal += paye; uifTotal += uifVal; sdlTotal += sdlVal; etiTotal += etiVal; netTotal += net;
    return {
      employee_id: e.id || e.employee_number,
      employee_number: e.employee_number,
      employee_name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
      basic_salary: round2(basic),
      allowances: round2(allowances),
      overtime: round2(overtime),
      bonus: round2(bonus),
      gross_pay: round2(gross),
      paye: round2(paye),
      uif: round2(uifVal),
      sdl: round2(sdlVal),
      eti: round2(etiVal),
      other_deductions: round2(otherDeductions),
      net_pay: round2(net),
      status: 'ok',
      exceptions: []
    };
  });
  return {
    status: 'ok',
    period: period.name || 'Mock Period',
    employee_count: employees.length,
    totals: {
      gross: round2(grossTotal),
      paye: round2(payeTotal),
      uif: round2(uifTotal),
      sdl: round2(sdlTotal),
      eti: round2(etiTotal),
      net: round2(netTotal)
    },
    line_items: lineItems
  };
}

export function mockApprove(data) {
  return {
    status: 'ok',
    payroll_run_id: data?.payroll_run_id || 'mock-run',
    approved: true,
    approved_at: new Date().toISOString(),
    totals: data?.totals || {}
  };
}

export function mockPayslip(data) {
  const e = data?.employee || {};
  const calc = mockCalculate({ employees: [e] });
  const li = calc.line_items[0] || {};
  return {
    status: 'ok',
    employee_number: e.employee_number,
    employee_name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
    pay_period_start: data?.period_start,
    pay_period_end: data?.period_end,
    pay_date: data?.pay_date,
    earnings: { basic: li.basic_salary, allowances: li.allowances, overtime: li.overtime, bonus: li.bonus, gross: li.gross_pay },
    deductions: { paye: li.paye, uif: li.uif, other: li.other_deductions, total: round2(li.paye + li.uif + li.other_deductions) },
    net_pay: li.net_pay,
    ytd: { gross: li.gross_pay, paye: li.paye, uif: li.uif },
    employer_contributions: { uif: round2(li.uif), sdl: li.sdl, eti: li.eti }
  };
}

export function mockCompliance(data) {
  const totals = data?.totals || {};
  return {
    status: 'ok',
    period: data?.period || {},
    emp201: {
      paye: round2(totals.paye || 0),
      uif_employee: round2(totals.uif || 0),
      uif_employer: round2(totals.uif || 0),
      sdl: round2(totals.sdl || 0),
      eti: round2(totals.eti || 0),
      total_payable: round2((totals.paye || 0) + (totals.uif || 0) * 2 + (totals.sdl || 0) - (totals.eti || 0))
    },
    irp5: (data?.employees || []).map((e) => ({
      employee_number: e.employee_number,
      gross: round2(Number(e.basic_salary) || 0),
      paye: round2(monthlyPaye(Number(e.basic_salary) || 0, ageFromDob(e.date_of_birth))),
      uif: round2(uif(Number(e.basic_salary) || 0))
    })),
    deadlines: [
      { type: 'EMP201', due_date: lastDayOfMonth(), description: 'Monthly PAYE/UIF/SDL declaration' },
      { type: 'EMP501', due_date: '2026-05-29', description: 'Annual reconciliation' }
    ]
  };
}

function lastDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}