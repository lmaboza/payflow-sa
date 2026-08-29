import { useState } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { useBusiness } from "@/lib/useBusiness";
import { canNav, ROLES } from "@/lib/permissions";
import { base44 } from "@/api/base44Client";
import EngineStatusBadge from "@/components/EngineStatusBadge";
import {
  LayoutDashboard, Calculator, Users, ReceiptText, BarChart3, ShieldCheck,
  FolderClosed, Settings as SettingsIcon, ScrollText, Menu, X, LogOut,
  ChevronDown, Bell, HelpCircle, Building2
} from "lucide-react";

const NAV = [
  { key: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard },
  { key: "payroll", label: "Payroll", to: "/payroll", icon: Calculator },
  { key: "employees", label: "Employees", to: "/employees", icon: Users },
  { key: "payslips", label: "Payslips", to: "/payslips", icon: ReceiptText },
  { key: "reports", label: "Reports", to: "/reports", icon: BarChart3 },
  { key: "compliance", label: "Compliance", to: "/compliance", icon: ShieldCheck },
  { key: "documents", label: "Documents", to: "/documents", icon: FolderClosed },
  { key: "audit", label: "Audit Log", to: "/audit", icon: ScrollText },
  { key: "settings", label: "Settings", to: "/settings", icon: SettingsIcon }
];

function Sidebar({ user, role, navItems, onNavigate, onLogout }) {
  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
          <LayoutDashboard style={{ width: 18, height: 18 }} />
        </div>
        <div className="leading-tight">
          <div className="font-heading text-sm font-semibold tracking-tight text-white">PayFlow SA</div>
          <div className="text-[11px] text-slate-400">Payroll Platform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {navItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400" />
                )}
                <item.icon className="shrink-0" style={{ width: 18, height: 18 }} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + business footer */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
            {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-white">{user?.full_name || user?.email}</div>
            <div className="truncate text-[11px] text-slate-400">{ROLES[role] || role}</div>
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, business, loading } = useBusiness();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!business || !business.onboarding_complete) {
    if (location.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  }

  const role = user?.app_role || "business_owner";
  const navItems = NAV.filter((n) => canNav(role, n.key));

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar
          user={user}
          role={role}
          navItems={navItems}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            <button
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar
              user={user}
              role={role}
              navItems={navItems}
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Business selector */}
          <Link
            to="/settings"
            className="group flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Building2 style={{ width: 16, height: 16 }} />
            </div>
            <div className="hidden min-w-0 leading-tight sm:block">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-heading text-sm font-semibold text-foreground">
                  {business?.trading_name || business?.name || "PayFlow SA"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {business?.registration_number ? `Reg: ${business.registration_number}` : "South African Payroll"} <span className="ml-1">🇿🇦</span>
              </div>
            </div>
          </Link>

          <div className="flex-1" />

          <EngineStatusBadge businessId={business?.id} />

          {/* Notifications */}
          <Link
            to="/compliance"
            className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Notifications"
          >
            <Bell style={{ width: 18, height: 18 }} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background" />
          </Link>

          {/* Help */}
          <Link
            to="/settings"
            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:block"
            title="Help"
          >
            <HelpCircle style={{ width: 18, height: 18 }} />
          </Link>

          {/* User avatar */}
          <Link to="/settings" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
          </Link>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}