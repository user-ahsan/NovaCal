"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@novacal/ui/card";
import { Badge } from "@novacal/ui/badge";
import { ScrollArea } from "@novacal/ui/scroll-area";
import { Server, Database, HardDrive, Terminal } from "lucide-react";

// ─── Types ───

interface SystemInfo {
  version: string;
  uptime: string;
  postgres: {
    poolStatus: "healthy" | "degraded" | "down";
    poolSize: number;
    activeConnections: number;
    idleConnections: number;
  };
  redis: {
    status: "healthy" | "degraded" | "down";
    usedMemory: string;
    peakMemory: string;
    hitRate: string;
  };
}

// ─── Status Badge ───

function ServiceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    healthy: { label: "Healthy", className: "bg-[--success]/10 text-[--success] border-none" },
    degraded: { label: "Degraded", className: "bg-yellow-500/10 text-yellow-500 border-none" },
    down: { label: "Down", className: "bg-[--destructive]/10 text-[--destructive] border-none" },
  };
  const s = map[status] ?? { label: status, className: "bg-[--surface-elevated] text-[--text-muted]" };
  return <Badge className={s.className}>{s.label}</Badge>;
}

// ─── Section Card ───

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[--text-secondary]">{label}</span>
      <span className="text-sm font-mono text-[--text-primary]">{value}</span>
    </div>
  );
}

// ─── Component ───

export default function AdminSystemPage() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sysRes, logsRes] = await Promise.all([
          fetch("/api/v1/admin/system"),
          fetch("/api/v1/admin/system/logs?lines=100"),
        ]);
        const sysData = await sysRes.json();
        const logsData = await logsRes.json();
        setSystemInfo(sysData);
        setLogs(logsData.lines ?? []);
      } catch {
        // Fallback demo data for development
        setSystemInfo({
          version: "0.0.1",
          uptime: "—",
          postgres: { poolStatus: "healthy", poolSize: 20, activeConnections: 3, idleConnections: 15 },
          redis: { status: "healthy", usedMemory: "—", peakMemory: "—", hitRate: "—" },
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-[--radius-lg] bg-[--surface-elevated]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">System</h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Diagnostics and infrastructure overview.
        </p>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Version & Uptime */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Server size={16} className="text-[--text-muted]" />
            <CardTitle className="text-sm font-medium">Server</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Version" value={systemInfo?.version ?? "—"} />
            <InfoRow label="Uptime" value={systemInfo?.uptime ?? "—"} />
          </CardContent>
        </Card>

        {/* PostgreSQL */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-[--text-muted]" />
              <CardTitle className="text-sm font-medium">PostgreSQL</CardTitle>
            </div>
            <ServiceBadge status={systemInfo?.postgres.poolStatus ?? "down"} />
          </CardHeader>
          <CardContent>
            <InfoRow label="Pool Size" value={systemInfo?.postgres.poolSize ?? "—"} />
            <InfoRow label="Active Connections" value={systemInfo?.postgres.activeConnections ?? "—"} />
            <InfoRow label="Idle Connections" value={systemInfo?.postgres.idleConnections ?? "—"} />
          </CardContent>
        </Card>

        {/* Redis */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-[--text-muted]" />
              <CardTitle className="text-sm font-medium">Redis</CardTitle>
            </div>
            <ServiceBadge status={systemInfo?.redis.status ?? "down"} />
          </CardHeader>
          <CardContent>
            <InfoRow label="Used Memory" value={systemInfo?.redis.usedMemory ?? "—"} />
            <InfoRow label="Peak Memory" value={systemInfo?.redis.peakMemory ?? "—"} />
            <InfoRow label="Hit Rate" value={systemInfo?.redis.hitRate ?? "—"} />
          </CardContent>
        </Card>
      </div>

      {/* Logs viewer */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Terminal size={16} className="text-[--text-muted]" />
          <CardTitle className="text-sm font-medium">Logs (last 100 lines)</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 w-full">
            <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-[--text-secondary]">
              {logs.length > 0
                ? logs.join("\n")
                : "[no logs available]"}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
