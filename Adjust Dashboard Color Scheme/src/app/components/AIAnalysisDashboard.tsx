import { useState } from "react";
import {
  Play,
  Upload,
  FilePlus,
  ChevronDown,
  ChevronRight,
  Moon,
  Sun,
  Home,
  FileText,
  Users,
  TrendingUp,
  Bell,
  Settings,
  Cpu,
  RefreshCw,
  Zap,
  BarChart2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ScanSearch,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RunStatus = "success" | "failed" | "pending";
type MatchQuality = "high" | "medium" | "low";

interface Run {
  id: string;
  date: string;
  status: RunStatus;
  durationMs: number;
  itemsDetected: number;
  matchQuality: MatchQuality;
  // technical / debug data
  retryCount: number;
  timeout: boolean;
  parsePath: string;
  pipeline: string;
  tokensUsed: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const RUNS: Run[] = [
  {
    id: "run-001",
    date: "2026-04-05 14:32",
    status: "success",
    durationMs: 9100,
    itemsDetected: 47,
    matchQuality: "high",
    retryCount: 0,
    timeout: false,
    parsePath: "vision",
    pipeline: "ocr-v3 → llm-extract → validate",
    tokensUsed: 2841,
  },
  {
    id: "run-002",
    date: "2026-04-05 11:08",
    status: "success",
    durationMs: 155000,
    itemsDetected: 31,
    matchQuality: "medium",
    retryCount: 1,
    timeout: false,
    parsePath: "text",
    pipeline: "text-split → llm-extract → validate",
    tokensUsed: 1920,
  },
  {
    id: "run-003",
    date: "2026-04-04 18:55",
    status: "failed",
    durationMs: 61000,
    itemsDetected: 0,
    matchQuality: "low",
    retryCount: 3,
    timeout: true,
    parsePath: "vision",
    pipeline: "ocr-v3 → llm-extract",
    tokensUsed: 488,
  },
  {
    id: "run-004",
    date: "2026-04-04 09:12",
    status: "success",
    durationMs: 23400,
    itemsDetected: 63,
    matchQuality: "high",
    retryCount: 0,
    timeout: false,
    parsePath: "vision",
    pipeline: "ocr-v3 → llm-extract → validate",
    tokensUsed: 3312,
  },
  {
    id: "run-005",
    date: "2026-04-03 16:40",
    status: "pending",
    durationMs: 0,
    itemsDetected: 0,
    matchQuality: "low",
    retryCount: 0,
    timeout: false,
    parsePath: "—",
    pipeline: "queued",
    tokensUsed: 0,
  },
  {
    id: "run-006",
    date: "2026-04-03 10:05",
    status: "success",
    durationMs: 8300,
    itemsDetected: 29,
    matchQuality: "medium",
    retryCount: 0,
    timeout: false,
    parsePath: "text",
    pipeline: "text-split → llm-extract → validate",
    tokensUsed: 1475,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RunStatus }) {
  const map: Record<RunStatus, { label: string; icon: React.ReactNode; className: string }> = {
    success: {
      label: "Success",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50",
    },
    failed: {
      label: "Failed",
      icon: <XCircle className="w-3.5 h-3.5" />,
      className: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50",
    },
    pending: {
      label: "Pending",
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      className: "bg-secondary text-muted-foreground border border-border",
    },
  };
  const { label, icon, className } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      {icon}
      {label}
    </span>
  );
}

function QualityBadge({ quality }: { quality: MatchQuality }) {
  const map: Record<MatchQuality, { label: string; className: string }> = {
    high: { label: "High", className: "text-primary" },
    medium: { label: "Medium", className: "text-accent" },
    low: { label: "Low", className: "text-muted-foreground" },
  };
  const bars = { high: 3, medium: 2, low: 1 };
  const { label, className } = map[quality];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${className}`}>
      <span className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-1.5 rounded-sm transition-opacity ${
              i <= bars[quality] ? "opacity-100" : "opacity-20"
            } ${quality === "high" ? "bg-primary" : quality === "medium" ? "bg-accent" : "bg-muted-foreground"}`}
            style={{ height: 4 + i * 3 }}
          />
        ))}
      </span>
      {label}
    </span>
  );
}

function DebugPanel({ run }: { run: Run }) {
  return (
    <div className="mx-4 mb-3 rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      <div>
        <p className="text-foreground font-medium mb-0.5">Retry count</p>
        <p>{run.retryCount}</p>
      </div>
      <div>
        <p className="text-foreground font-medium mb-0.5">Timeout</p>
        <p>{run.timeout ? "Yes" : "No"}</p>
      </div>
      <div>
        <p className="text-foreground font-medium mb-0.5">Parse path</p>
        <p className="font-mono">{run.parsePath}</p>
      </div>
      <div className="sm:col-span-2">
        <p className="text-foreground font-medium mb-0.5">Pipeline</p>
        <p className="font-mono">{run.pipeline}</p>
      </div>
      <div>
        <p className="text-foreground font-medium mb-0.5">Tokens used</p>
        <p>{run.tokensUsed > 0 ? run.tokensUsed.toLocaleString() : "—"}</p>
      </div>
    </div>
  );
}

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-5">
        <ScanSearch className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-foreground mb-2" style={{ fontWeight: 600, fontSize: "1.05rem" }}>
        No analyses yet
      </h3>
      <p className="text-muted-foreground max-w-xs mb-6" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
        AI analysis scans your property documents and floor plans to extract items, detect matches, and generate structured reports.
      </p>
      <button
        onClick={onRun}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        style={{ fontWeight: 600, fontSize: "0.875rem" }}
      >
        <Play className="w-4 h-4" />
        Run your first analysis
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  dark: boolean;
  onToggleDark: () => void;
}

export function AIAnalysisDashboard({ dark, onToggleDark }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const [activeNav, setActiveNav] = useState("AI Analysis");

  const runs = showEmpty ? [] : RUNS;

  const successCount = RUNS.filter((r) => r.status === "success").length;
  const successRate = Math.round((successCount / RUNS.length) * 100);
  const avgDuration =
    Math.round(
      RUNS.filter((r) => r.durationMs > 0).reduce((s, r) => s + r.durationMs, 0) /
        RUNS.filter((r) => r.durationMs > 0).length /
        1000
    );

  const navItems = [
    { icon: Home, label: "Dashboard" },
    { icon: Cpu, label: "AI Analysis" },
    { icon: FileText, label: "Reports" },
    { icon: Users, label: "Clients" },
    { icon: TrendingUp, label: "Analytics" },
    { icon: Bell, label: "Notifications" },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside className="bg-sidebar w-56 flex-shrink-0 flex flex-col border-r border-sidebar-border">
        {/* Logo */}
        <div className="px-5 py-[18px] flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-destructive flex items-center justify-center flex-shrink-0">
            <span className="text-white" style={{ fontWeight: 700, fontSize: "0.7rem", letterSpacing: "-0.01em" }}>LD</span>
          </div>
          <span className="text-sidebar-foreground" style={{ fontWeight: 600, fontSize: "0.9rem" }}>LoftDesk</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.label === activeNav;
            return (
              <button
                key={item.label}
                onClick={() => setActiveNav(item.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span style={{ fontSize: "0.875rem", fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
            <Settings className="w-4 h-4" />
            <span style={{ fontSize: "0.875rem" }}>Settings</span>
          </button>
          {/* Dark toggle */}
          <button
            onClick={onToggleDark}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span style={{ fontSize: "0.875rem" }}>{dark ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="bg-card border-b border-border px-7 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-foreground" style={{ fontWeight: 700, fontSize: "1.2rem", lineHeight: 1.3 }}>AI Analysis</h1>
            <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.8rem" }}>
              Scan documents and floor plans to extract structured property data
            </p>
          </div>
          {/* Demo toggle */}
          <button
            onClick={() => setShowEmpty((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            {showEmpty ? "Show runs" : "Show empty state"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="px-7 py-6 space-y-6 max-w-5xl">

            {/* ── Action bar ── */}
            <div className="flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
                style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                <Play className="w-4 h-4" />
                Run analysis
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                <Upload className="w-4 h-4" />
                Upload file
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                <FilePlus className="w-4 h-4" />
                Create draft
              </button>
            </div>

            {/* ── Summary stats (only when data exists) ── */}
            {!showEmpty && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Total runs",
                    value: RUNS.length,
                    icon: <RefreshCw className="w-4 h-4" />,
                    color: "text-primary",
                  },
                  {
                    label: "Success rate",
                    value: `${successRate}%`,
                    icon: <Zap className="w-4 h-4" />,
                    color: "text-emerald-600 dark:text-emerald-400",
                  },
                  {
                    label: "Avg. duration",
                    value: `${avgDuration}s`,
                    icon: <Clock className="w-4 h-4" />,
                    color: "text-accent",
                  },
                ].map((s) => (
                  <div key={s.label} className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
                    <div className={`${s.color} opacity-70`}>{s.icon}</div>
                    <div>
                      <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{s.label}</p>
                      <p className="text-foreground" style={{ fontWeight: 700, fontSize: "1.2rem", lineHeight: 1.2 }}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Table card ── */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {runs.length === 0 ? (
                <EmptyState onRun={() => setShowEmpty(false)} />
              ) : (
                <>
                  {/* Table header */}
                  <div className="grid gap-4 px-5 py-3 border-b border-border"
                    style={{ gridTemplateColumns: "1.6fr 120px 80px 100px 100px 36px" }}>
                    {["Run date", "Status", "Duration", "Items", "Match quality", ""].map((h) => (
                      <span key={h} className="text-muted-foreground" style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-border">
                    {runs.map((run) => {
                      const expanded = expandedRow === run.id;
                      return (
                        <div key={run.id}>
                          {/* Row */}
                          <div
                            className={`grid gap-4 px-5 py-3.5 items-center cursor-pointer transition-colors ${
                              expanded ? "bg-secondary/40" : "hover:bg-muted/40"
                            }`}
                            style={{ gridTemplateColumns: "1.6fr 120px 80px 100px 100px 36px" }}
                            onClick={() => setExpandedRow(expanded ? null : run.id)}
                          >
                            {/* Date */}
                            <span className="text-foreground" style={{ fontSize: "0.875rem" }}>
                              {run.date}
                              <span className="ml-2 text-muted-foreground font-mono" style={{ fontSize: "0.72rem" }}>
                                #{run.id}
                              </span>
                            </span>

                            {/* Status */}
                            <StatusBadge status={run.status} />

                            {/* Duration */}
                            <span className="text-foreground" style={{ fontSize: "0.875rem", fontVariantNumeric: "tabular-nums" }}>
                              {formatDuration(run.durationMs)}
                            </span>

                            {/* Items detected */}
                            <span className="text-foreground" style={{ fontSize: "0.875rem", fontVariantNumeric: "tabular-nums" }}>
                              {run.status === "pending" ? "—" : run.itemsDetected}
                            </span>

                            {/* Match quality */}
                            {run.status === "pending" ? (
                              <span className="text-muted-foreground" style={{ fontSize: "0.875rem" }}>—</span>
                            ) : (
                              <QualityBadge quality={run.matchQuality} />
                            )}

                            {/* Expand toggle */}
                            <span className="text-muted-foreground flex justify-end">
                              {expanded
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />
                              }
                            </span>
                          </div>

                          {/* Debug panel */}
                          {expanded && <DebugPanel run={run} />}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer note */}
            {!showEmpty && (
              <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
                <BarChart2 className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                Click any row to expand technical details (tokens, pipeline, retries).
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
