import { Card } from "@/components/ui/card";

function Pulse({ className }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Pulse className="h-8 w-64" />
        <Pulse className="h-4 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-[260px] border-border shadow-card"><div className="p-6"><Pulse className="h-full w-full" /></div></Card>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-[120px] border-border shadow-card"><div className="p-5"><Pulse className="h-full w-full" /></div></Card>
          ))}
        </div>
      </div>
      <div className="mt-8">
        <Pulse className="mb-4 h-4 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-[110px] border-border shadow-card"><div className="p-4"><Pulse className="h-full w-full" /></div></Card>
          ))}
        </div>
      </div>
    </div>
  );
}