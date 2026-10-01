import { useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useEmployee } from "@/lib/useEmployee";
import { base44 } from "@/api/base44Client";
import {
  Home, ReceiptText, CalendarDays, FileText, User, Wallet,
  ShieldCheck, MessageSquare, Bell, LogOut, Menu, X
} from "lucide-react";

const SIDEBAR_NAV = [
  { label: "Dashboard", to: "/portal", icon: Home, end: true },
  { label: "Payslips", to: "/portal/payslips", icon: ReceiptText },
  { label: "Leave", to: "/portal/leave", icon: CalendarDays },
  { label: "Tax Documents", to: "/portal/tax-documents", icon: FileText },
  { label: "Claims", to: "/portal/claims", icon: Wallet },
  { label: "Documents", to: "/portal/documents", icon: FileText },
  { label: "My Details", to: "/portal/profile", icon: User },
  { label: "Payroll Queries", to: "/portal/queries", icon: MessageSquare },
  { label: "Notifications", to: "/portal/notifications", icon: Bell }
];

const BOTTOM_NAV = [
  { label: "Home", to: "/portal", icon: Home, end: true },
  { label: "Payslips", to: "/portal/payslips", icon: ReceiptText },
  { label: "Leave", to: "/portal/leave", icon: CalendarDays },
  { label: "Docs", to: "/portal/documents", icon: FileText },
  { label: "Profile", to: "/portal/profile", icon: User }
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
        <ShieldCheck style={{ width: 18, height: 18 }} />
      </div>
      <div className="leading-tight">
        <div className="font-heading text-sm font-semibold tracking-tight text-white">PayFlow SA</div>
        <div className="text-[11px] text-slate-400">My Pay</div>
      </div>
    </div>
  );
}

export default function EmployeeLayout() {
  const { user, employee, business, loading, error } = useEmployee();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error === "not_linked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <User style={{ width: 26, height: 26 }} />
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">Account not linked</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your user account isn't linked to an employee record yet. Please ask your payroll administrator to activate your self-service access.
          </p>
          <button
            onClick={() => base44.auth.logout()}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = () => base44.auth.logout();
  const fullName = employee ? `${employee.first_name} ${employee.last_name}` : user?.full_name || user?.email;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-slate-900 lg:flex">
        <div className="flex h-16 items-center px-5"><Logo /></div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {SIDEBAR_NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-emerald-500/10 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400" />}
                  <item.icon className="shrink-0" style={{ width: 18, height: 18 }} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
              {fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">{fullName}</div>
              <div className="truncate text-[11px] text-slate-400">{business?.trading_name || business?.name || "Employee"}</div>
            </div>
            <button onClick={handleLogout} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 lg:hidden">
            <button className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-16 items-center px-5"><Logo /></div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {SIDEBAR_NAV.map((item) => (
                <NavLink key={item.label} to={item.to} end={item.end} onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? "bg-emerald-500/10 text-white" : "text-slate-400 hover:bg-slate-800"}`
                  }>
                  <item.icon style={{ width: 18, height: 18 }} /> {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </>
      )}

      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <ShieldCheck style={{ width: 15, height: 15 }} />
            </div>
            <span className="font-heading text-sm font-semibold text-foreground">My Pay</span>
          </div>
          <div className="flex-1" />
          <Link to="/portal/notifications" className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
            <Bell className="h-5 w-5" />
          </Link>
        </header>

        {/* Desktop top bar */}
        <header className="sticky top-0 z-30 hidden h-16 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur-md lg:flex">
          <div className="leading-tight">
            <div className="font-heading text-sm font-semibold text-foreground">{business?.trading_name || business?.name || "PayFlow SA"}</div>
            <div className="text-[11px] text-muted-foreground">Employee Self-Service</div>
          </div>
          <div className="flex-1" />
          <Link to="/portal/notifications" className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Bell style={{ width: 18, height: 18 }} />
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {fullName?.charAt(0).toUpperCase()}
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-card/95 backdrop-blur-md lg:hidden">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.label} to={item.to} end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-emerald-600" : "text-muted-foreground"
              }`
            }>
            <item.icon style={{ width: 20, height: 20 }} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}