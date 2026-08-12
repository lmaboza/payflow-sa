import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Provides the current authenticated user and their active business.
// business_id and app_role are persisted on the user via base44.auth.updateMe.
export function useBusiness() {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      if (me.business_id) {
        try {
          const b = await base44.entities.Business.get(me.business_id);
          setBusiness(b);
        } catch (e) {
          setBusiness(null);
        }
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshBusiness = useCallback(async () => {
    if (user?.business_id) {
      try {
        const b = await base44.entities.Business.get(user.business_id);
        setBusiness(b);
      } catch (e) {
        setBusiness(null);
      }
    }
  }, [user]);

  return { user, business, loading, refreshBusiness, reload: load };
}