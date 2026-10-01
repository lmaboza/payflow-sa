import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  ReceiptText, CalendarDays, FileText, Wallet, User, MessageSquare
} from "lucide-react";

const ACTIONS = [
  { label: "View Payslip", to: "/portal/payslips", icon: ReceiptText, desc: "View your latest payslip" },
  { label: "Request Leave", to: "/portal/leave", icon: CalendarDays, desc: "Apply for annual or other leave" },
  { label: "Tax Documents", to: "/portal/tax-documents", icon: FileText, desc: "View IRP5 / tax certificates" },
  { label: "Submit Claim", to: "/portal/claims", icon: Wallet, desc: "Submit reimbursable expenses" },
  { label: "Update Details", to: "/portal/profile", icon: User, desc: "Review your personal information" },
  { label: "Payroll Query", to: "/portal/queries", icon: MessageSquare, desc: "Ask payroll a question" }
];

export default function QuickActions() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ACTIONS.map((a) => (
          <Link key={a.label} to={a.to}>
            <Card className="card-lift group h-full border-border shadow-card hover:border-emerald-200 hover:shadow-card-hover">
              <CardContent className="flex h-full flex-col items-start gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                  <a.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{a.label}</div>
                  <div className="text-[11px] leading-tight text-muted-foreground">{a.desc}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}