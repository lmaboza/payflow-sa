import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isMock, mockHealth, mockValidate, mockCalculate, mockApprove, mockPayslip, mockCompliance } from '../../shared/mockEngine.ts';

const API = '/api/v1';

class EngineError extends Error {
  constructor(stage, code, details) {
    super(`${stage}: HTTP ${code}`);
    this.stage = stage;
    this.code = code;
    this.details = details;
  }
}

function jsonHeaders(key) {
  const h = { 'Content-Type': 'application/json' };
  if (key) h['Authorization'] = `Bearer ${key}`;
  return h;
}

async function engineFetch(engineUrl, path, { method = 'GET', body, headers, timeout = 30000 }) {
  const url = `${engineUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { ok: res.ok, status: res.status, json, text };
}

function ageOrDefault(emp) {
  if (emp.age != null && emp.age !== '') {
    const n = Number(emp.age);
    if (!isNaN(n) && n > 0) return n;
  }
  if (emp.date_of_birth) {
    const d = new Date(emp.date_of_birth);
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    if (!isNaN(a) && a > 0) return a;
  }
  return 30;
}

function extractLineItems(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.line_items)) return json.line_items;
  if (Array.isArray(json.lines)) return json.lines;
  if (Array.isArray(json.results)) return json.results;
  if (json.data && Array.isArray(json.data.line_items)) return json.data.line_items;
  if (json.data && Array.isArray(json.data)) return json.data;
  return [];
}

function extractTotals(json) {
  if (!json) return {};
  return json.totals || json.summary || (json.data && json.data.totals) || {};
}

async function persistRunResult(base44, business_id, runId, lineItems, totals) {
  await base44.asServiceRole.entities.PayrollLineItem.deleteMany({ payroll_run_id: runId });
  if (lineItems.length) {
    await base44.asServiceRole.entities.PayrollLineItem.bulkCreate(lineItems.map((it) => ({
      business_id,
      payroll_run_id: runId,
      employee_id: it.employee_id || it.employeeId || '',
      employee_name: it.employee_name || it.name || `${it.firstName || ''} ${it.lastName || ''}`.trim() || it.employeeNumber || '',
      basic_salary: Number(it.basic_salary ?? it.basic ?? it.monthlyTaxableRemuneration) || 0,
      allowances: Number(it.allowances) || 0,
      overtime: Number(it.overtime) || 0,
      bonus: Number(it.bonus) || 0,
      gross_pay: Number(it.gross_pay ?? it.gross ?? it.grossPay) || 0,
      paye: Number(it.paye ?? it.payeAmount) || 0,
      uif: Number(it.uif ?? it.uifAmount) || 0,
      sdl: Number(it.sdl ?? it.sdlAmount) || 0,
      other_deductions: Number(it.other_deductions ?? it.deductions ?? it.otherEmployeeDeductions) || 0,
      net_pay: Number(it.net_pay ?? it.net ?? it.netPay) || 0,
      exceptions: it.exceptions || [],
      status: (it.exceptions && it.exceptions.length) ? 'review' : 'ok'
    })));
  }
  await base44.asServiceRole.entities.PayrollRun.update(runId, {
    status: 'review_required',
    engine_valid: true,
    gross_total: Number(totals.gross) || 0,
    paye_total: Number(totals.paye) || 0,
    uif_total: Number(totals.uif) || 0,
    sdl_total: Number(totals.sdl) || 0,
    net_total: Number(totals.net) || 0,
    employee_count: lineItems.length
  });
}

async function ensureEngineBusiness(base44, business, engineUrl, headers) {
  if (business.engine_business_id) return business.engine_business_id;
  const r = await engineFetch(engineUrl, `${API}/businesses`, {
    method: 'POST',
    body: {
      name: business.name,
      tradingName: business.trading_name,
      registrationNumber: business.registration_number,
      payeReference: business.paye_reference,
      uifReference: business.uif_reference,
      sdlNumber: business.sdl_number,
      payrollFrequency: business.payroll_frequency
    },
    headers
  });
  if (!r.ok) throw new EngineError('business_create', r.status, r.text);
  const id = r.json?.id || r.json?.businessId || r.json?.business_id;
  if (!id) throw new EngineError('business_create', r.status, 'No id returned by engine');
  await base44.asServiceRole.entities.Business.update(business.id, { engine_business_id: id });
  return id;
}

async function ensureEngineEmployee(base44, engineBusinessId, emp, engineUrl, headers) {
  if (emp.engine_employee_id) return emp.engine_employee_id;
  const r = await engineFetch(engineUrl, `${API}/employees`, {
    method: 'POST',
    body: {
      businessId: engineBusinessId,
      employeeNumber: emp.employee_number,
      firstName: emp.first_name,
      lastName: emp.last_name,
      age: ageOrDefault(emp)
    },
    headers
  });
  if (!r.ok) throw new EngineError('employee_create', r.status, r.text);
  const id = r.json?.id || r.json?.employeeId || r.json?.employee_id;
  if (!id) throw new EngineError('employee_create', r.status, 'No id returned by engine');
  await base44.asServiceRole.entities.Employee.update(emp.id, { engine_employee_id: id });
  return id;
}

async function syncCompensation(engineEmployeeId, emp, engineUrl, headers) {
  await engineFetch(engineUrl, `${API}/employees/${engineEmployeeId}/compensation`, {
    method: 'POST',
    body: {
      monthlyTaxableRemuneration: Number(emp.basic_salary) || 0,
      monthlyUifRemuneration: Number(emp.monthly_uif_remuneration) || Number(emp.basic_salary) || 0,
      otherEmployeeDeductions: Number(emp.deductions) || 0,
      effectiveFrom: emp.employment_date || new Date().toISOString().slice(0, 10)
    },
    headers
  });
}

async function syncTaxProfile(engineEmployeeId, emp, engineUrl, headers) {
  await engineFetch(engineUrl, `${API}/employees/${engineEmployeeId}/tax-profile`, {
    method: 'POST',
    body: {
      medicalSchemeMembers: Number(emp.medical_scheme_members) || 0,
      taxNumberMasked: emp.tax_number || 'TEST-****',
      effectiveFrom: emp.employment_date || new Date().toISOString().slice(0, 10)
    },
    headers
  });
}

async function ensureEngineRun(base44, run, engineBusinessId, engineUrl, headers) {
  if (run.engine_payroll_run_id) return run.engine_payroll_run_id;
  const r = await engineFetch(engineUrl, `${API}/payroll/runs`, {
    method: 'POST',
    body: {
      businessId: engineBusinessId,
      periodStart: run.period_start,
      periodEnd: run.period_end,
      payDate: run.pay_date
    },
    headers
  });
  if (!r.ok) throw new EngineError('run_create', r.status, r.text);
  const id = r.json?.id || r.json?.runId || r.json?.payrollRunId || r.json?.payroll_run_id;
  if (!id) throw new EngineError('run_create', r.status, 'No id returned by engine');
  await base44.asServiceRole.entities.PayrollRun.update(run.id, { engine_payroll_run_id: id });
  return id;
}

async function doValidate(base44, business, data, engineUrl, headers) {
  const log = { engineUrl, engine_business_id: business.engine_business_id || null, engine_payroll_run_id: null };
  try {
    const runId = data.payroll_run_id;
    if (!runId) return Response.json({ status: 'engine_error', userMessage: 'Payroll run id is required.' });
    const run = await base44.asServiceRole.entities.PayrollRun.get(runId);
    log.engine_payroll_run_id = run.engine_payroll_run_id || null;

    // 1. Business mapping
    const engineBusinessId = await ensureEngineBusiness(base44, business, engineUrl, headers);
    log.engine_business_id = engineBusinessId;

    // 2-4. Employee mapping + compensation + tax profile
    const employees = await base44.asServiceRole.entities.Employee.filter(
      { business_id: business.id, status: 'active' }, '-created_date', 500
    );
    for (const emp of employees) {
      const eeId = await ensureEngineEmployee(base44, engineBusinessId, emp, engineUrl, headers);
      await syncCompensation(eeId, emp, engineUrl, headers);
      await syncTaxProfile(eeId, emp, engineUrl, headers);
    }

    // 5. Engine payroll run
    const engineRunId = await ensureEngineRun(base44, run, engineBusinessId, engineUrl, headers);
    log.engine_payroll_run_id = engineRunId;

    // 6. Engine-side validation
    const validatePath = `${API}/payroll/${engineRunId}/validate`;
    const r = await engineFetch(engineUrl, validatePath, { method: 'POST', body: {}, headers });
    log.validateUrl = `${engineUrl}${validatePath}`;
    log.validateStatus = r.status;
    log.validateBody = (r.text || '').slice(0, 1000);
    console.log('[PayFlow validate]', log);

    if (!r.ok) {
      return Response.json({
        status: 'engine_error',
        code: r.status,
        userMessage: `Engine validation failed (HTTP ${r.status}).`,
        details: r.json || r.text
      });
    }
    const valid = r.json?.valid === true || r.json?.isValid === true || r.json?.validation?.valid === true;
    await base44.asServiceRole.entities.PayrollRun.update(runId, { engine_valid: valid });
    return Response.json({
      status: 'ok',
      valid,
      summary: r.json?.summary || r.json?.message || '',
      engine_payroll_run_id: engineRunId,
      employee_count: employees.length,
      raw: r.json
    });
  } catch (e) {
    console.error('[PayFlow validate error]', log, e);
    if (e instanceof EngineError) {
      return Response.json({
        status: 'engine_error',
        code: e.code,
        userMessage: `Engine sync failed during ${e.stage} (HTTP ${e.code}).`,
        details: e.details
      });
    }
    return Response.json({ status: 'engine_error', userMessage: 'Validation failed: ' + e.message });
  }
}

async function doCalculate(base44, business, data, engineUrl, headers) {
  const log = {
    engineUrl,
    engine_business_id: business.engine_business_id || null,
    engine_payroll_run_id: null,
    calculateUrl: null,
    httpStatus: null,
    responseBody: null
  };
  try {
    const runId = data.payroll_run_id;
    if (!runId) return Response.json({ status: 'engine_error', userMessage: 'Payroll run id is required.' });
    const run = await base44.asServiceRole.entities.PayrollRun.get(runId);
    log.engine_payroll_run_id = run.engine_payroll_run_id || null;

    if (!run.engine_payroll_run_id) {
      console.log('[PayFlow calculate] missing engine_payroll_run_id', log);
      return Response.json({
        status: 'engine_error',
        code: 409,
        userMessage: 'Payroll has not yet been created in the PayFlow Payroll Engine.'
      });
    }

    const calcPath = `${API}/payroll/${run.engine_payroll_run_id}/calculate`;
    log.calculateUrl = `${engineUrl}${calcPath}`;
    const r = await engineFetch(engineUrl, calcPath, { method: 'POST', body: {}, headers });
    log.httpStatus = r.status;
    log.responseBody = (r.text || '').slice(0, 2000);
    console.log('[PayFlow calculate]', log);

    if (r.status === 404) {
      return Response.json({ status: 'engine_error', code: 404, userMessage: 'Engine payroll run could not be found.' });
    }
    if (r.status === 409) {
      return Response.json({
        status: 'engine_error',
        code: 409,
        userMessage: 'Payroll must be successfully validated by the PayFlow Payroll Engine before calculation.'
      });
    }
    if (!r.ok) {
      return Response.json({
        status: 'engine_error',
        code: r.status,
        userMessage: `Calculation failed (HTTP ${r.status}).`,
        details: r.json || r.text
      });
    }

    // 9. Fetch engine lines and populate using engine-returned values only
    const linesPath = `${API}/payroll/${run.engine_payroll_run_id}/lines`;
    const lr = await engineFetch(engineUrl, linesPath, { method: 'GET', headers });
    console.log('[PayFlow calculate lines]', { url: `${engineUrl}${linesPath}`, status: lr.status });

    const source = (lr.ok && lr.json) ? lr.json : r.json;
    const lineItems = extractLineItems(source);
    const totals = extractTotals(source);

    await persistRunResult(base44, business.id, runId, lineItems, totals);

    return Response.json({
      status: 'ok',
      line_items: lineItems,
      totals,
      employee_count: lineItems.length,
      status_set: 'review_required'
    });
  } catch (e) {
    console.error('[PayFlow calculate error]', log, e);
    return Response.json({ status: 'engine_error', userMessage: 'Calculation failed: ' + e.message });
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, business_id, data = {} } = body || {};
    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    let business = null;
    if (business_id) {
      try { business = await base44.asServiceRole.entities.Business.get(business_id); } catch (e) {}
    }
    const engineUrl = business?.engine_url || null;
    const engineKey = business?.engine_api_key || null;
    const headers = jsonHeaders(engineKey);

    // ---- HEALTH ----
    if (action === 'health') {
      if (isMock(engineUrl)) return Response.json(mockHealth());
      if (!engineUrl) {
        return Response.json({
          status: 'offline',
          reason: 'not_configured',
          message: 'Payroll Engine URL is not configured. Set it under Settings → Payroll Engine.'
        });
      }
      try {
        const r = await engineFetch(engineUrl, `${API}/health`, { headers, timeout: 8000 });
        if (!r.ok) {
          return Response.json({ status: 'offline', reason: 'http_error', code: r.status, message: `Engine returned HTTP ${r.status}` });
        }
        const ok = ['healthy', 'connected', 'ok'].includes(r.json?.status);
        return Response.json({ ...r.json, status: ok ? 'connected' : (r.json?.status || 'offline') });
      } catch (e) {
        console.error('Payroll Engine health check failed:', e);
        return Response.json({ status: 'offline', reason: 'unreachable', message: e.message });
      }
    }

    if (!engineUrl) {
      return Response.json({
        status: 'offline',
        reason: 'not_configured',
        message: 'Payroll Engine URL is not configured. Set it under Settings → Payroll Engine.'
      }, { status: 503 });
    }

    // ---- MOCK MODE ----
    if (isMock(engineUrl)) {
      if (action === 'validate') {
        const runId = data.payroll_run_id;
        const run = runId ? await base44.asServiceRole.entities.PayrollRun.get(runId).catch(() => null) : null;
        const emps = await base44.asServiceRole.entities.Employee.filter({ business_id: business.id, status: 'active' }, '-created_date', 500);
        const enriched = {
          ...data,
          employees: emps,
          period: run ? { name: run.period_name, start: run.period_start, end: run.period_end } : {}
        };
        const out = mockValidate(enriched);
        const mockRunId = runId ? `mock-${runId}` : 'mock-run';
        if (runId) {
          await base44.asServiceRole.entities.PayrollRun.update(runId, { engine_valid: true, engine_payroll_run_id: mockRunId }).catch(() => {});
        }
        return Response.json({ ...out, valid: true, engine_payroll_run_id: mockRunId });
      }
      if (action === 'calculate') {
        const runId = data.payroll_run_id;
        const run = runId ? await base44.asServiceRole.entities.PayrollRun.get(runId).catch(() => null) : null;
        const emps = await base44.asServiceRole.entities.Employee.filter({ business_id: business.id, status: 'active' }, '-created_date', 500);
        const enriched = {
          ...data,
          employees: emps,
          period: run ? { name: run.period_name, start: run.period_start, end: run.period_end, pay_date: run.pay_date } : {}
        };
        const out = mockCalculate(enriched);
        const lineItems = out.line_items || [];
        const totals = out.totals || {};
        if (runId) await persistRunResult(base44, business.id, runId, lineItems, totals);
        return Response.json({ status: 'ok', line_items: lineItems, totals, employee_count: lineItems.length, status_set: 'review_required' });
      }
      const mock = { approve: mockApprove, payslip: mockPayslip, compliance: mockCompliance }[action];
      if (!mock) return Response.json({ error: `unknown action: ${action}` }, { status: 400 });
      return Response.json(mock(data));
    }

    // ---- LIVE ENGINE ----
    if (action === 'validate') return await doValidate(base44, business, data, engineUrl, headers);
    if (action === 'calculate') return await doCalculate(base44, business, data, engineUrl, headers);

    if (action === 'approve') {
      try {
        const runId = data.payroll_run_id;
        const run = runId ? await base44.asServiceRole.entities.PayrollRun.get(runId).catch(() => null) : null;
        if (run?.engine_payroll_run_id) {
          const r = await engineFetch(engineUrl, `${API}/payroll/${run.engine_payroll_run_id}/approve`, {
            method: 'POST',
            body: { totals: data.totals || {} },
            headers
          });
          return Response.json({ status: r.ok ? 'ok' : 'engine_error', code: r.status, ...(r.json || {}) });
        }
        return Response.json({ status: 'ok', approved: true });
      } catch (e) {
        return Response.json({ status: 'engine_error', userMessage: 'Approve failed: ' + e.message });
      }
    }

    if (action === 'payslip' || action === 'compliance') {
      // Endpoints not specified in the current engine contract; best-effort from provided data.
      const mock = action === 'payslip' ? mockPayslip : mockCompliance;
      return Response.json(mock(data));
    }

    return Response.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('[PayFlow handler error]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}