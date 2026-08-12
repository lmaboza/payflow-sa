// Role-based access control for PayFlow SA.
// Roles are stored on the user via base44.auth.updateMe({ app_role, business_id }).
// The platform User.role is still used for admin operations (inviting users, etc.)

export const ROLES = {
  business_owner: "Business Owner",
  payroll_admin: "Payroll Administrator",
  hr_admin: "HR Administrator",
  manager: "Manager",
  accountant: "Accountant",
  employee: "Employee",
  system_admin: "System Administrator"
};

const NAV_BY_ROLE = {
  business_owner: ["dashboard", "payroll", "employees", "payslips", "reports", "compliance", "documents", "settings", "audit"],
  payroll_admin: ["dashboard", "payroll", "employees", "payslips", "reports", "compliance", "documents", "audit"],
  hr_admin: ["dashboard", "employees", "documents", "reports"],
  manager: ["dashboard", "employees", "reports"],
  accountant: ["dashboard", "payroll", "payslips", "reports", "compliance"],
  employee: ["dashboard", "payslips"],
  system_admin: ["dashboard", "payroll", "employees", "payslips", "reports", "compliance", "documents", "settings", "audit"]
};

const ACTIONS_BY_ROLE = {
  business_owner: ["run_payroll", "approve_payroll", "complete_payroll", "add_employee", "edit_employee", "archive_employee", "import_employee", "view_sensitive", "manage_settings", "manage_engine", "view_audit"],
  payroll_admin: ["run_payroll", "approve_payroll", "complete_payroll", "add_employee", "edit_employee", "archive_employee", "import_employee", "view_sensitive", "view_audit"],
  hr_admin: ["add_employee", "edit_employee", "archive_employee", "import_employee"],
  manager: ["view_employee"],
  accountant: ["run_payroll", "approve_payroll", "view_sensitive", "view_audit"],
  employee: ["view_own_payslip"],
  system_admin: ["run_payroll", "approve_payroll", "complete_payroll", "add_employee", "edit_employee", "archive_employee", "import_employee", "view_sensitive", "manage_settings", "manage_engine", "view_audit"]
};

export function canNav(role, navKey) {
  const allowed = NAV_BY_ROLE[role] || [];
  return allowed.includes(navKey);
}

export function can(role, action) {
  const allowed = ACTIONS_BY_ROLE[role] || [];
  return allowed.includes(action);
}