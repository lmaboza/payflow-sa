import { useState } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useBusiness } from "@/lib/useBusiness";
import { canNav, ROLES } from "@/lib/permissions";
import EngineStatusBadge from "@/components/EngineStatusBadge";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Calculator, Users, ReceiptText, BarChart3, ShieldCheck,
  FolderClosed, Settings as SettingsIcon, ScrollText, Menu, X, LogOut
} from "lucide-react";

const NAV = [
  { key: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard },
  { key: "payroll", label: "Payroll", to: "/payroll", icon: Calculator },
  { key: "employees", label: "Employees", to: "/employees", icon: Users },
  { key: "payslips", label: "Payslips", to: "/payslips", icon: ReceiptText },
  { key: "reports", label: "Reports", to: "/reports", icon: BarChart3 },
  { key: "compliance", label: "Compliance", to: "/compliance", icon: ShieldCheck },
  { key: "documents", label: "Documents", to: "/documents", icon: FolderClosed },
  { key: "settings", label: "Settings", to: "/settings", icon: SettingsIcon },
  { key: "audit", label: "Audit Log", to: "/audit", icon: ScrollText }
];

export default function Layout() {
  const { user, business, loading } = useBusiness();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
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

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading text-base font-bold">
          P
        </div>
        <div className="leading-tight">
          <div className="font-heading text-sm font-semibold tracking-tight text-foreground">PayFlow SA</div>
          <div className="text-[11px] text-muted-foreground">Payroll Platform</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-3">
        {navItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.to === "/"}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`
            }
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground">
            {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-foreground">{user?.full_name || user?.email}</div>
            <div className="truncate text-[11px] text-muted-foreground">{ROLES[role] || role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-card lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card lg:hidden">
            {SidebarContent}
          </aside>
        </>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-sm font-semibold text-foreground">
              {business?.trading_name || business?.name || "PayFlow SA"}
            </div>
            <div className="hidden text-[11px] text-muted-foreground sm:block">
              {business?.registration_number ? `Reg: ${business.registration_number}` : "South African Payroll"}
            </div>
          </div>
          <EngineStatusBadge businessId={business?.id} />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}