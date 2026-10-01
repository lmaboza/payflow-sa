import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Resolves the authenticated app user to their linked Employee record.
// Links by stored employee_id, then by Employee.user_id, then by email match.
// Bootstraps employee_id + business_id on the user so RLS rules can use {{user.data.employee_id}}.
export function useEmployee() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);

      let emp = null;
      if (me.employee_id) {
        emp = await base44.entities.Employee.get(me.employee_id).catch(() => null);
      }
      if (!emp && me.id) {
        const byUser = await base44.entities.Employee.filter({ user_id: me.id }, "-created_date", 1);
        emp = byUser?.[0] || null;
        if (emp) {
          await base44.auth.updateMe({ employee_id: emp.id, business_id: emp.business_id });
        }
      }
      if (!emp && me.email) {
        const byEmail = await base44.entities.Employee.filter({ email: me.email }, "-created_date", 1);
        emp = byEmail?.[0] || null;
        if (emp) {
          await base44.entities.Employee.update(emp.id, { user_id: me.id }).catch(() => {});
          await base44.auth.updateMe({ employee_id: emp.id, business_id: emp.business_id });
        }
      }

      setEmployee(emp);
      if (emp?.business_id) {
        const b = await base44.entities.Business.get(emp.business_id).catch(() => null);
        setBusiness(b);
      }
      if (!emp) setError("not_linked");
    } catch (e) {
      setError(e.message || "auth_error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => { setLoading(true); await load(); }, [load]);
  return { user, employee, business, loading, error, refresh };
}