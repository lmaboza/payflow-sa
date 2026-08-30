import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isMock, mockHealth, mockValidate, mockCalculate, mockApprove, mockPayslip, mockCompliance } from '../../shared/mockEngine.ts';

const ENDPOINTS = {
  health: '/api/v1/health',
  validate: '/api/v1/payroll/validate',
  calculate: '/api/v1/payroll/calculate',
  approve: '/api/v1/payroll/approve',
  payslip: '/api/v1/payslip/generate',
  compliance: '/api/v1/compliance'
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, business_id, data } = body || {};
    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    // Resolve engine config from the business record (stored in DB, not secrets)
    let engineUrl = null;
    let engineKey = null;
    if (business_id) {
      try {
        const business = await base44.asServiceRole.entities.Business.get(business_id);
        if (business) {
          engineUrl = business.engine_url;
          engineKey = business.engine_api_key;
        }
      } catch (e) {
        // business not found / not accessible
      }
    }

    const headers = { 'Content-Type': 'application/json' };
    if (engineKey) headers['Authorization'] = `Bearer ${engineKey}`;

    if (action === 'health') {
      if (isMock(engineUrl)) {
        return Response.json(mockHealth());
      }
      if (!engineUrl) {
        return Response.json({
          status: 'offline',
          reason: 'not_configured',
          message: 'Payroll Engine URL is not configured. Set it under Settings → Payroll Engine.'
        });
      }
      try {
        const res = await fetch(`${engineUrl}${ENDPOINTS.health}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) {
          return Response.json({ status: 'offline', reason: 'http_error', code: res.status, message: `Engine returned HTTP ${res.status}` });
        }
        const json = await res.json();
        // The real .NET engine reports status: "healthy"; the mock reports "connected".
        // Normalize any healthy response to "connected" so the app treats a live engine as online.
        const ok = ['healthy', 'connected', 'ok'].includes(json.status);
        return Response.json({ ...json, status: ok ? 'connected' : (json.status || 'offline') });
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

    if (isMock(engineUrl)) {
      const mock = { health: mockHealth, validate: mockValidate, calculate: mockCalculate, approve: mockApprove, payslip: mockPayslip, compliance: mockCompliance }[action];
      if (!mock) return Response.json({ error: `unknown action: ${action}` }, { status: 400 });
      return Response.json(mock(data));
    }

    const path = ENDPOINTS[action];
    if (!path) return Response.json({ error: `unknown action: ${action}` }, { status: 400 });

    try {
      const res = await fetch(`${engineUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data || {}),
        signal: AbortSignal.timeout(30000)
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!res.ok) {
        return Response.json({ status: 'engine_error', code: res.status, ...json }, { status: 502 });
      }
      return Response.json({ status: 'ok', ...json });
    } catch (e) {
      return Response.json({
        status: 'offline',
        reason: 'unreachable',
        message: 'PayFlow Payroll Engine is unavailable: ' + e.message
      }, { status: 503 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}