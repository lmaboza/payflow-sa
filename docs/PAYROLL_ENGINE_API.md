# PayFlow Payroll Engine — API Specification

This document defines the contract between **PayFlow SA** (the Base44-hosted management
app) and the standalone **PayFlow Payroll Engine** (.NET solution). The Base44 app never
performs payroll calculations itself; it proxies all engine operations through the
`payrollEngine` backend function. The engine is configured per-business via
**Settings → Payroll Engine URL** + API key (stored in the Business entity).

## 1. Conventions

- **Base URL**: the value in `Business.engine_url` (e.g. `https://payflow-engine.example.com`).
- **Authentication**: `Authorization: Bearer <Business.engine_api_key>` on every request.
- **Content-Type**: `application/json`.
- **Mock mode**: when `engine_url` is `mock` or `https://mock`, the Base44 proxy returns
  locally-computed results using SARS 2025/26 tables (see `base44/shared/mockEngine.ts`).
  The real .NET engine MUST reproduce these formulas exactly so the switch is transparent.
- **Response envelope**: every endpoint returns `{ "status": "ok", ... }` on success or
  `{ "error": "...", "status": "engine_error" }` on failure (HTTP >= 400).

## 2. Endpoints

### GET `/api/v1/health`
Engine health check. Must respond within ~8s.

**Response 200**
```json
{
  "status": "connected",
  "engine": "PayFlow Payroll Engine",
  "version": "1.0.0",
  "database": "connected",
  "tax_year": "2025/2026",
  "tax_tables": "SARS 2025/26",
  "timestamp": "2026-08-12T19:05:00Z"
}
```

### POST `/api/v1/payroll/validate`
Pre-flight validation of employee data before calculation.

**Request**
```json
{
  "business_id": "string",
  "period": { "name": "August 2026", "start": "2026-08-01", "end": "2026-08-31" },
  "employees": [
    {
      "id": "emp-uuid",
      "employee_number": "EMP001",
      "first_name": "Thabo",
      "last_name": "Mokoena",
      "date_of_birth": "1990-04-12",
      "basic_salary": 25000,
      "allowances": 0,
      "uif_status": "contributing",
      "sdl_status": "liable",
      "eti_eligible": false,
      "email": "thabo@example.com"
    }
  ]
}
```

**Response**
```json
{
  "status": "ok",
  "valid_count": 24,
  "error_count": 1,
  "results": [
    { "employee_id": "emp-uuid", "employee_number": "EMP001", "valid": true, "errors": [] },
    { "employee_id": "emp-uuid2", "employee_number": "EMP02", "valid": false, "errors": ["Invalid email"] }
  ]
}
```

### POST `/api/v1/payroll/calculate`
Full payroll calculation for a period.

**Request**: same body shape as `/validate`.

**Response**
```json
{
  "status": "ok",
  "period": "August 2026",
  "employee_count": 24,
  "totals": { "gross": 612000, "paye": 98450, "uif": 6120, "sdl": 6120, "eti": 0, "net": 501930 },
  "line_items": [
    {
      "employee_id": "emp-uuid",
      "employee_number": "EMP001",
      "employee_name": "Thabo Mokoena",
      "basic_salary": 25000, "allowances": 0, "overtime": 0, "bonus": 0,
      "gross_pay": 25000, "paye": 3592.75, "uif": 177.12, "sdl": 250, "eti": 0,
      "other_deductions": 0, "net_pay": 21230.13, "status": "ok", "exceptions": []
    }
  ]
}
```

### POST `/api/v1/payroll/approve`
Locks a calculated payroll run.

**Request**
```json
{ "payroll_run_id": "run-uuid", "business_id": "string", "totals": { "gross": 612000, "paye": 98450, "uif": 6120, "sdl": 6120, "net": 501930 } }
```

**Response**
```json
{ "status": "ok", "payroll_run_id": "run-uuid", "approved": true, "approved_at": "2026-08-12T19:05:00Z", "totals": {} }
```

### POST `/api/v1/payslip/generate`
Generate a single payslip for an employee in a period.

**Request**
```json
{
  "business_id": "string",
  "payroll_run_id": "run-uuid",
  "period_start": "2026-08-01", "period_end": "2026-08-31", "pay_date": "2026-08-31",
  "employee": { "id": "emp-uuid", "employee_number": "EMP001", "first_name": "Thabo", "last_name": "Mokoena", "date_of_birth": "1990-04-12", "basic_salary": 25000, "allowances": 0, "overtime": 0, "bonus": 0, "deductions": 0, "uif_status": "contributing", "sdl_status": "liable", "eti_eligible": false }
}
```

**Response**
```json
{
  "status": "ok",
  "employee_number": "EMP001", "employee_name": "Thabo Mokoena",
  "pay_period_start": "2026-08-01", "pay_period_end": "2026-08-31", "pay_date": "2026-08-31",
  "earnings": { "basic": 25000, "allowances": 0, "overtime": 0, "bonus": 0, "gross": 25000 },
  "deductions": { "paye": 3592.75, "uif": 177.12, "other": 0, "total": 3769.87 },
  "net_pay": 21230.13,
  "ytd": { "gross": 25000, "paye": 3592.75, "uif": 177.12 },
  "employer_contributions": { "uif": 177.12, "sdl": 250, "eti": 0 }
}
```

### POST `/api/v1/compliance`
Compliance summary (EMP201, IRP5, deadlines) for a period.

**Request**
```json
{
  "business_id": "string",
  "period": { "name": "August 2026" },
  "totals": { "gross": 612000, "paye": 98450, "uif": 6120, "sdl": 6120, "eti": 0 },
  "employees": [{ "employee_number": "EMP001", "basic_salary": 25000, "date_of_birth": "1990-04-12" }]
}
```

**Response**
```json
{
  "status": "ok",
  "period": { "name": "August 2026" },
  "emp201": { "paye": 98450, "uif_employee": 6120, "uif_employer": 6120, "sdl": 6120, "eti": 0, "total_payable": 116890 },
  "irp5": [{ "employee_number": "EMP001", "gross": 25000, "paye": 3592.75, "uif": 177.12 }],
  "deadlines": [
    { "type": "EMP201", "due_date": "2026-08-31", "description": "Monthly PAYE/UIF/SDL declaration" },
    { "type": "EMP501", "due_date": "2026-05-29", "description": "Annual reconciliation" }
  ]
}
```

## 3. Tax Rules Implemented (SARS 2025/26)

These formulas live in `base44/shared/mockEngine.ts` and MUST be reproduced identically
in the .NET `PayFlow.PayrollEngine` project.

### PAYE (monthly)
Annual taxable income × bracket rate − rebate, divided by 12.

| Band (annual)          | Rate | Base      |
|------------------------|------|-----------|
| 0 – 237,000            | 18%  | 0         |
| 237,001 – 370,500      | 26%  | 42,660    |
| 370,501 – 512,800      | 31%  | 77,334    |
| 512,801 – 673,000      | 36%  | 121,467   |
| 673,001 – 857,900      | 39%  | 179,019   |
| 857,901 – 1,817,000    | 41%  | 251,253   |
| 1,817,001 +            | 45%  | 644,847   |

Rebates: primary R17,235; +R9,444 if age ≥ 65; +R3,145 if age ≥ 75.

### UIF
1% of remuneration, capped at the UIF ceiling (R17,712/month → max R177.12).
Employee 1% + employer 1%. Exempt/ceased employees: R0.

### SDL
1% of remuneration, paid by employer, no ceiling. Exempt employees: R0.

### ETI
Eligible employees aged 18–29 earning ≤ R6,500/month.
- First 12 months: 50% of remuneration up to R1,000; flat R1,000 (R1,001–R4,000); R500 (R4,001–R5,000); R0 above.
- After 12 months: 25% of remuneration up to R500.

## 4. .NET Solution Mapping

| Engine endpoint          | .NET project                              |
|--------------------------|-------------------------------------------|
| `/health`                | `PayFlow.Api/Controllers/HealthController` |
| `/payroll/validate`      | `PayFlow.Application/Payroll/Validate`     |
| `/payroll/calculate`     | `PayFlow.PayrollEngine/Calculators`        |
| `/payroll/approve`       | `PayFlow.Application/Payroll/Approve`     |
| `/payslip/generate`      | `PayFlow.Application/Payslips`            |
| `/compliance`            | `PayFlow.Compliance/EMP201` + `IRP5`      |

The `PayFlow.Contracts` project should contain DTOs matching the request/response
shapes above so the API and application layers share one source of truth.

## 5. Testing the Integration from PayFlow SA

1. In **Settings → Payroll Engine**, set the URL to `mock` and save.
2. Go to **Payroll**, create a period, and run Validate → Calculate → Review → Approve.
3. Totals, line items, and payslips will be produced by the mock engine using real
   SARS 2025/26 formulas.
4. Once the .NET engine is deployed, replace `mock` with its real URL and API key —
   no app changes required.