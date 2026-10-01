import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children, backgroundImage }) {
  const withBg = Boolean(backgroundImage);
  return (
    <div className={`relative min-h-screen flex items-center justify-center px-4 overflow-hidden ${withBg ? "" : "bg-background"}`}>
      {withBg && (
        <>
          <div
            className="fixed inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundImage})` }}
            aria-hidden="true"
          />
          <div
            className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0b1c38]/85 via-[#0b1c38]/55 to-[#064e3b]/70"
            aria-hidden="true"
          />
        </>
      )}
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className={`text-3xl font-bold tracking-tight ${withBg ? "text-white drop-shadow-sm" : "text-foreground"}`}>{title}</h1>
          {subtitle && <p className={`mt-2 ${withBg ? "text-white/80" : "text-muted-foreground"}`}>{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className={`text-center text-sm mt-6 ${withBg ? "text-white/80" : "text-muted-foreground"}`}>{footer}</p>
        )}
      </div>
    </div>
  );
}