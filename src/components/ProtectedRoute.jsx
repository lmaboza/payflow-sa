import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function ProtectedRoute({ unauthenticatedElement }) {
  const [state, setState] = useState("loading");
  const location = useLocation();

  useEffect(() => {
    let active = true;
    base44.auth.isAuthenticated().then((ok) => {
      if (active) setState(ok ? "authed" : "unauthed");
    });
    return () => { active = false; };
  }, []);

  if (state === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "unauthed") {
    return unauthenticatedElement || <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}