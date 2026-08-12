export function formatZAR(n) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2
  }).format(Number(n) || 0);
}

export function formatNumber(n) {
  return new Intl.NumberFormat("en-ZA").format(Number(n) || 0);
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-ZA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}