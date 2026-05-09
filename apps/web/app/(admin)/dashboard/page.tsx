"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@novacal/ui/card";
import { Users, Calendar, Building2, Wifi, Database, HardDrive, Activity } from "lucide-react";

// ─── Types ───

interface GlobalMetrics {
  totalUsers: number;
  totalEvents: number;
  totalWorkspaces: number;
  activeWsConnections: number;
  dbSize: string;
  redisMemory: string;
  requestsPerMinute: number;
}

// ─── Metric Card Component ───

function MetricCard({
  title,
  value,
  icon: Icon,
  accent = false,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-[--primary-accent]/30" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[--text-secondary]">{title}</CardTitle>
        <Icon
          size={18}
          className={accent ? "text-[--primary-accent]" : "text-[--text-muted]"}
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-[--text-primary]">{value}</div>
      </CardContent>
    </Card>
  );
}

// ─── Component ───

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/v1/admin/metrics");
        const data = await res.json();
        setMetrics(data);
      } catch {
        // Use fallback demo data for development
        setMetrics({
          totalUsers: 0,
          totalEvents: 0,
          totalWorkspaces: 0,
          activeWsConnections: 0,
          dbSize: "—",
          redisMemory: "—",
          requestsPerMinute: 0,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  // Skeleton loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-[--radius-lg] bg-[--surface-elevated]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Dashboard</h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Global instance metrics at a glance.
        </p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={metrics?.totalUsers ?? "—"}
          icon={Users}
        />
        <MetricCard
          title="Total Events"
          value={metrics?.totalEvents ?? "—"}
          icon={Calendar}
        />
        <MetricCard
          title="Workspaces"
          value={metrics?.totalWorkspaces ?? "—"}
          icon={Building2}
        />
        <MetricCard
          title="Active WS Connections"
          value={metrics?.activeWsConnections ?? "—"}
          icon={Wifi}
          accent
        />
        <MetricCard
          title="Database Size"
          value={metrics?.dbSize ?? "—"}
          icon={Database}
        />
        <MetricCard
          title="Redis Memory"
          value={metrics?.redisMemory ?? "—"}
          icon={HardDrive}
        />
        <MetricCard
          title="Requests / min"
          value={metrics?.requestsPerMinute ?? "—"}
          icon={Activity}
        />
      </div>
    </div>
  );
}
