import { useState } from "react";
import {
  Bell, Plus, ChevronRight, Home, Folder, MoreHorizontal,
  Play, Upload, FilePlus, CheckCircle2, XCircle, Loader2,
  ChevronDown, ScanSearch, Cpu, ArrowLeft, Camera, FileText,
  Clock, Zap, RefreshCw, BarChart2, DollarSign, Users,
  Building2, MessageSquare, AlertTriangle, Settings,
  MapPin, Package, X, Search,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Screen = "home" | "projects" | "detail" | "ai" | "chat" | "more";
type RunStatus = "success" | "failed" | "pending";
type MatchQuality = "high" | "medium" | "low";

interface Run {
  id: string; date: string; status: RunStatus; durationMs: number;
  itemsDetected: number; matchQuality: MatchQuality;
  retryCount: number; timeout: boolean; parsePath: string;
  pipeline: string; tokensUsed: number;
}

// ── Shared visual constants ────────────────────────────────────────────────────

const APP_BG = "#090E0B";
const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" };
const CARD_GREEN = { background: "rgba(62,168,90,0.08)", border: "1px solid rgba(62,168,90,0.18)" };
const CARD_AMBER = { background: "rgba(200,134,60,0.1)", border: "1px solid rgba(200,134,60,0.2)" };
const CARD_RED = { background: "rgba(192,64,46,0.1)", border: "1px solid rgba(192,64,46,0.2)" };

const TEXT = "#EDE8DD";
const TEXT_DIM = "rgba(237,232,221,0.5)";
const GREEN = "#4DB871";
const AMBER = "#C8863C";
const RED = "#C0402E";

// ── Mock data ──────────────────────────────────────────────────────────────────

const RUNS: Run[] = [
  { id: "run-001", date: "Dziś, 14:32", status: "success", durationMs: 9100, itemsDetected: 47, matchQuality: "high", retryCount: 0, timeout: false, parsePath: "vision", pipeline: "ocr-v3 → llm-extract → validate", tokensUsed: 2841 },
  { id: "run-002", date: "Dziś, 11:08", status: "success", durationMs: 155000, itemsDetected: 31, matchQuality: "medium", retryCount: 1, timeout: false, parsePath: "text", pipeline: "text-split → llm-extract → validate", tokensUsed: 1920 },
  { id: "run-003", date: "Wczoraj, 18:55", status: "failed", durationMs: 61000, itemsDetected: 0, matchQuality: "low", retryCount: 3, timeout: true, parsePath: "vision", pipeline: "ocr-v3 → llm-extract", tokensUsed: 488 },
  { id: "run-004", date: "Wczoraj, 09:12", status: "success", durationMs: 23400, itemsDetected: 63, matchQuality: "high", retryCount: 0, timeout: false, parsePath: "vision", pipeline: "ocr-v3 → llm-extract → validate", tokensUsed: 3312 },
  { id: "run-005", date: "3 kwi, 16:40", status: "pending", durationMs: 0, itemsDetected: 0, matchQuality: "low", retryCount: 0, timeout: false, parsePath: "—", pipeline: "queued", tokensUsed: 0 },
];

const PROJECTS = [
  { id: "p1", code: "ZLP-048", name: "Renovacja biura", client: "MMO Artis", status: "W toku", timeAgo: "15h", value: "18 400 zł", color: GREEN },
  { id: "p2", code: "ZLP-045", name: "Modernizacja kuchni", client: "Core-BUD", status: "Oferta", timeAgo: "2d", value: "9 200 zł", color: AMBER },
  { id: "p3", code: "ZLP-042", name: "Apartament Wola", client: "Jan Kowalski", status: "Gotowy", timeAgo: "5d", value: "32 100 zł", color: GREEN },
  { id: "p4", code: "ZLP-040", name: "Biuro Śródmieście", client: "Biuro MDA", status: "Do akceptacji", timeAgo: "1w", value: "14 700 zł", color: AMBER },
];

const ACTIVITY = [
  { icon: Building2, label: "Modernizacja kuchni", sub: "Core-BUD · Wysłano ofertę", time: "2h", color: GREEN },
  { icon: MapPin, label: "Biuro MDA", sub: "Dodano zdjęcia", time: "5h", color: AMBER },
  { icon: FileText, label: "Apartament Wola", sub: "Kosztorys zaktualizowany", time: "1d", color: GREEN },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  if (!ms) return "—";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60000), s = Math.round((ms % 60000) / 1000);
  return s ? `${m}m ${s}s` : `${m}m`;
}

// ── StatusBar ──────────────────────────────────────────────────────────────────

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1 flex-shrink-0 select-none">
      <span style={{ color: TEXT, fontSize: "0.9rem", fontWeight: 600 }}>09:41</span>
      <div className="flex items-center gap-1">
        {/* Signal bars */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
          <rect x="0" y="8" width="3" height="4" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="4.5" y="5.5" width="3" height="6.5" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="9" y="3" width="3" height="9" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="13.5" y="0" width="3" height="12" rx="1" fill="white" fillOpacity="0.35"/>
        </svg>
        <span style={{ color: TEXT, fontSize: "0.7rem", fontWeight: 600 }}>5G</span>
        {/* Battery */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="white" strokeOpacity="0.5"/>
          <rect x="22" y="3.5" width="2.5" height="5" rx="1" fill="white" fillOpacity="0.5"/>
          <rect x="1.5" y="1.5" width="17" height="9" rx="1.5" fill="white" fillOpacity="0.85"/>
        </svg>
      </div>
    </div>
  );
}

// ── BottomNav ──────────────────────────────────────────────────────────────────

function BottomNav({ active, onNavigate }: { active: Screen; onNavigate: (s: Screen) => void }) {
  const left = [
    { id: "home" as Screen, icon: Home, label: "Start" },
    { id: "projects" as Screen, icon: Folder, label: "Projekty" },
  ];
  const right = [
    { id: "ai" as Screen, icon: Cpu, label: "AI" },
    { id: "more" as Screen, icon: MoreHorizontal, label: "Więcej" },
  ];
  return (
    <div className="flex-shrink-0" style={{ background: "rgba(9,14,11,0.97)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-around px-2 pt-2 pb-6">
        {left.map((item) => (
          <button key={item.id} onClick={() => onNavigate(item.id)} className="flex flex-col items-center gap-1 w-16 py-1 rounded-xl transition-all">
            <item.icon className="w-5 h-5 transition-colors" style={{ color: active === item.id ? GREEN : "rgba(237,232,221,0.35)" }} />
            <span style={{ fontSize: "0.65rem", color: active === item.id ? GREEN : "rgba(237,232,221,0.35)", fontWeight: active === item.id ? 600 : 400 }}>{item.label}</span>
          </button>
        ))}
        {/* FAB */}
        <button
          onClick={() => onNavigate("ai")}
          className="flex items-center justify-center w-14 h-14 rounded-full -mt-5 transition-transform active:scale-95"
          style={{ background: "linear-gradient(145deg, #4DB871, #2A7A45)", boxShadow: "0 8px 24px rgba(62,168,90,0.45)" }}
        >
          <Plus className="w-7 h-7 text-white" />
        </button>
        {right.map((item) => (
          <button key={item.id} onClick={() => onNavigate(item.id)} className="flex flex-col items-center gap-1 w-16 py-1 rounded-xl transition-all">
            <item.icon className="w-5 h-5 transition-colors" style={{ color: active === item.id ? GREEN : "rgba(237,232,221,0.35)" }} />
            <span style={{ fontSize: "0.65rem", color: active === item.id ? GREEN : "rgba(237,232,221,0.35)", fontWeight: active === item.id ? 600 : 400 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── HomeScreen ─────────────────────────────────────────────────────────────────

function HomeScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="h-full overflow-y-auto" style={{ paddingBottom: 8 }}>
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-2 pb-4">
        <div>
          <p style={{ color: TEXT_DIM, fontSize: "0.8rem" }}>Dziś</p>
          <h1 style={{ color: TEXT, fontWeight: 700, fontSize: "1.35rem", lineHeight: 1.2 }}>Dzień dobry, Dariusz</h1>
          <p style={{ color: TEXT_DIM, fontSize: "0.78rem", marginTop: 2 }}>Twój LoftDesk jest gotowy <span style={{ color: GREEN }}>•</span></p>
        </div>
        <button className="mt-1 relative" onClick={() => {}}>
          <Bell className="w-6 h-6" style={{ color: "rgba(237,232,221,0.7)" }} />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: RED }} />
        </button>
      </div>

      {/* Hero money card */}
      <div className="mx-5 rounded-2xl p-5 mb-4 overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, #0E2A1A 0%, #163C24 60%, #0A1E12 100%)", border: "1px solid rgba(62,168,90,0.2)" }}>
        {/* Subtle glow */}
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(62,168,90,0.15) 0%, transparent 70%)" }} />
        <p style={{ color: "rgba(237,232,221,0.55)", fontSize: "0.78rem", marginBottom: 2 }}>Totaj</p>
        <p style={{ color: TEXT, fontWeight: 800, fontSize: "2.1rem", lineHeight: 1, letterSpacing: "-0.02em" }}>24 700 zł</p>
        <div className="flex items-center gap-2 mt-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(200,134,60,0.25)", color: AMBER }}>3 nowe</span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(192,64,46,0.25)", color: "#E05A4A" }}>2 pilne</span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(237,232,221,0.1)", color: TEXT_DIM }}>3 do akceptacji</span>
          <ChevronRight className="w-4 h-4 ml-auto" style={{ color: TEXT_DIM }} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mx-5 mb-5">
        {[
          { icon: Plus, label: "Nowy projekt", sub: "Stwórz", color: GREEN },
          { icon: FileText, label: "Nowa wycena", sub: "Wygeneruj", color: AMBER },
        ].map((a) => (
          <button key={a.label} onClick={() => {}}
            className="flex items-center gap-3 p-4 rounded-2xl text-left transition-opacity active:opacity-70"
            style={CARD}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${a.color}18`, border: `1px solid ${a.color}30` }}>
              <a.icon className="w-4 h-4" style={{ color: a.color }} />
            </div>
            <div>
              <p style={{ color: TEXT, fontSize: "0.82rem", fontWeight: 600 }}>{a.label}</p>
              <p style={{ color: TEXT_DIM, fontSize: "0.7rem" }}>{a.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Recent activity */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-3">
          <span style={{ color: TEXT, fontWeight: 600, fontSize: "0.95rem" }}>Ostatnia aktywność</span>
          <button onClick={() => onNavigate("projects")} style={{ color: GREEN, fontSize: "0.75rem", fontWeight: 500 }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          {ACTIVITY.map((a, i) => (
            <div key={a.label} className="flex items-center gap-3 px-4 py-3.5 active:opacity-70 transition-opacity"
              style={{ borderBottom: i < ACTIVITY.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${a.color}15`, border: `1px solid ${a.color}25` }}>
                <a.icon className="w-4 h-4" style={{ color: a.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: TEXT, fontSize: "0.84rem", fontWeight: 500 }}>{a.label}</p>
                <p style={{ color: TEXT_DIM, fontSize: "0.73rem", marginTop: 1 }}>{a.sub}</p>
              </div>
              <span style={{ color: TEXT_DIM, fontSize: "0.7rem", flexShrink: 0 }}>{a.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-2.5 mx-5 mt-4">
        {[
          { label: "Projekty", value: "24", icon: Folder },
          { label: "Klienci", value: "138", icon: Users },
          { label: "Przychód", value: "42.8k", icon: DollarSign },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-3 text-center" style={CARD}>
            <s.icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: TEXT_DIM }} />
            <p style={{ color: TEXT, fontWeight: 700, fontSize: "1rem" }}>{s.value}</p>
            <p style={{ color: TEXT_DIM, fontSize: "0.65rem", marginTop: 1 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ProjectsScreen ─────────────────────────────────────────────────────────────

function ProjectsScreen({ onDetail }: { onDetail: (id: string) => void }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 pt-2 pb-4 flex items-center justify-between">
        <h1 style={{ color: TEXT, fontWeight: 700, fontSize: "1.35rem" }}>Projekty</h1>
        <div className="flex gap-2">
          <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={CARD}>
            <Search className="w-4 h-4" style={{ color: TEXT_DIM }} />
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-5 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {["Wszystkie", "W toku", "Oferta", "Do akceptacji", "Gotowy"].map((f, i) => (
          <span key={f} className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0"
            style={i === 0
              ? { background: GREEN, color: "#fff", fontWeight: 600 }
              : { ...CARD, color: TEXT_DIM }}>
            {f}
          </span>
        ))}
      </div>

      <div className="px-5 space-y-3 pb-4">
        {PROJECTS.map((p) => (
          <button key={p.id} onClick={() => onDetail(p.id)}
            className="w-full text-left rounded-2xl p-4 transition-opacity active:opacity-70" style={CARD}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{ color: TEXT_DIM, fontSize: "0.7rem", fontFamily: "monospace" }}>{p.code}</span>
                  <span className="w-1 h-1 rounded-full" style={{ background: TEXT_DIM }} />
                  <span style={{ color: TEXT_DIM, fontSize: "0.7rem" }}>{p.timeAgo}</span>
                </div>
                <p style={{ color: TEXT, fontWeight: 600, fontSize: "0.95rem" }}>{p.name}</p>
                <p style={{ color: TEXT_DIM, fontSize: "0.78rem", marginTop: 1 }}>{p.client}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: `${p.color}18`, color: p.color }}>{p.status}</span>
                <span style={{ color: TEXT, fontWeight: 700, fontSize: "0.9rem" }}>{p.value}</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1 rounded-full mt-2" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full" style={{ width: p.status === "Gotowy" ? "100%" : p.status === "W toku" ? "60%" : p.status === "Oferta" ? "35%" : "80%", background: p.color }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ProjectDetailScreen ────────────────────────────────────────────────────────

function ProjectDetailScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-2 pb-4">
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={CARD}>
          <ArrowLeft className="w-4 h-4" style={{ color: TEXT }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 style={{ color: TEXT, fontWeight: 700, fontSize: "1.2rem", lineHeight: 1.2 }}>Renovacja biura</h1>
          <p style={{ color: TEXT_DIM, fontSize: "0.75rem" }}>MMO Artis · 15h · <span style={{ color: GREEN }}>●</span></p>
        </div>
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold font-mono" style={{ background: "rgba(200,134,60,0.15)", color: AMBER }}>ZLP-048</span>
      </div>

      {/* Hero image */}
      <div className="mx-5 rounded-2xl overflow-hidden mb-4" style={{ height: 160 }}>
        <img
          src="https://images.unsplash.com/photo-1662379940109-1026a0dcfe95?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBpbnRlcmlvciUyMHJlbm92YXRpb24lMjBsb2Z0fGVufDF8fHx8MTc3NTQxMTgzN3ww&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Renovacja biura"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mx-5 mb-3">
        <button className="flex items-center justify-center gap-2 py-3 rounded-2xl transition-opacity active:opacity-70"
          style={{ background: GREEN, color: "#fff" }}>
          <FileText className="w-4 h-4" />
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Nowa wycena</span>
        </button>
        <button className="flex items-center justify-center gap-2 py-3 rounded-2xl transition-opacity active:opacity-70"
          style={CARD}>
          <DollarSign className="w-4 h-4" style={{ color: TEXT_DIM }} />
          <span style={{ fontSize: "0.85rem", fontWeight: 500, color: TEXT }}>Dodaj koszt</span>
        </button>
      </div>

      {/* Napisz do klienta */}
      <button className="mx-5 w-[calc(100%-40px)] flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-4 transition-opacity active:opacity-70" style={CARD}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(62,168,90,0.15)" }}>
          <MessageSquare className="w-4 h-4" style={{ color: GREEN }} />
        </div>
        <span style={{ color: TEXT, fontSize: "0.875rem", fontWeight: 500, flex: 1, textAlign: "left" }}>Napisz do klienta</span>
        <ChevronRight className="w-4 h-4" style={{ color: TEXT_DIM }} />
      </button>

      {/* Dokumenty section */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-3">
          <span style={{ color: TEXT, fontWeight: 600, fontSize: "0.95rem" }}>Dokumenty</span>
          <button style={{ color: GREEN, fontSize: "0.75rem", fontWeight: 500 }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          {[
            { icon: FileText, label: "2 do akceptacji", badge: "Sprawdź", badgeColor: AMBER, badgeBg: "rgba(200,134,60,0.2)" },
            { icon: Camera, label: "Zdjęcia", count: "18", badgeColor: TEXT_DIM },
            { icon: Package, label: "Koszty", badge: "Uzupełnij", badgeColor: GREEN, badgeBg: "rgba(62,168,90,0.15)" },
          ].map((d, i) => (
            <div key={d.label} className="flex items-center gap-3 px-4 py-3.5 active:opacity-70 transition-opacity"
              style={{ borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <d.icon className="w-4 h-4" style={{ color: TEXT_DIM }} />
              </div>
              <span style={{ color: TEXT, fontSize: "0.875rem", flex: 1 }}>{d.label}</span>
              {d.badge && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: d.badgeBg, color: d.badgeColor }}>{d.badge}</span>
              )}
              {d.count && (
                <div className="flex items-center gap-1">
                  <span style={{ color: TEXT_DIM, fontSize: "0.875rem" }}>{d.count}</span>
                  <ChevronRight className="w-4 h-4" style={{ color: TEXT_DIM }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AIAnalysisScreen ───────────────────────────────────────────────────────────

function AIAnalysisScreen() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const runs = showEmpty ? [] : RUNS;
  const successCount = RUNS.filter((r) => r.status === "success").length;
  const successRate = Math.round((successCount / RUNS.length) * 100);

  function StatusBadge({ s }: { s: RunStatus }) {
    const map = {
      success: { label: "Sukces", color: "#4ADE80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.2)", Icon: CheckCircle2 },
      failed: { label: "Błąd", color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)", Icon: XCircle },
      pending: { label: "Oczekuje", color: "rgba(237,232,221,0.5)", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", Icon: Loader2 },
    }[s];
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{ background: map.bg, color: map.color, border: `1px solid ${map.border}` }}>
        <map.Icon className={`w-3 h-3 ${s === "pending" ? "animate-spin" : ""}`} />
        {map.label}
      </span>
    );
  }

  function QualityDots({ q }: { q: MatchQuality }) {
    const val = { high: 3, medium: 2, low: 1 }[q];
    const color = { high: GREEN, medium: AMBER, low: "rgba(237,232,221,0.25)" }[q];
    return (
      <div className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className="w-1.5 rounded-sm" style={{ height: 4 + i * 3, background: i <= val ? color : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-2 pb-1">
        <div className="flex items-center justify-between mb-0.5">
          <h1 style={{ color: TEXT, fontWeight: 700, fontSize: "1.35rem" }}>AI Analiza</h1>
          <button onClick={() => setShowEmpty((v) => !v)}
            className="px-3 py-1.5 rounded-xl text-xs" style={{ ...CARD, color: TEXT_DIM }}>
            {showEmpty ? "Pokaż dane" : "Pusty stan"}
          </button>
        </div>
        <p style={{ color: TEXT_DIM, fontSize: "0.78rem" }}>Skanowanie dokumentów i planów pięter</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2.5 px-5 mt-4 mb-4">
        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-opacity active:opacity-70"
          style={{ background: GREEN, color: "#fff" }}>
          <Play className="w-4 h-4" />
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Uruchom</span>
        </button>
        <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl transition-opacity active:opacity-70" style={CARD}>
          <Upload className="w-4 h-4" style={{ color: TEXT_DIM }} />
          <span style={{ fontSize: "0.85rem", color: TEXT }}>Plik</span>
        </button>
        <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl transition-opacity active:opacity-70" style={CARD}>
          <FilePlus className="w-4 h-4" style={{ color: TEXT_DIM }} />
          <span style={{ fontSize: "0.85rem", color: TEXT }}>Draft</span>
        </button>
      </div>

      {/* Stats row */}
      {!showEmpty && (
        <div className="grid grid-cols-3 gap-2.5 px-5 mb-4">
          {[
            { label: "Uruchomień", value: RUNS.length, icon: RefreshCw, color: GREEN },
            { label: "Skuteczność", value: `${successRate}%`, icon: Zap, color: "#4ADE80" },
            { label: "Śr. czas", value: "35s", icon: Clock, color: AMBER },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-3 flex flex-col items-center" style={CARD}>
              <s.icon className="w-4 h-4 mb-1.5" style={{ color: s.color, opacity: 0.75 }} />
              <p style={{ color: TEXT, fontWeight: 700, fontSize: "1rem" }}>{s.value}</p>
              <p style={{ color: TEXT_DIM, fontSize: "0.62rem", marginTop: 1, textAlign: "center" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Runs list */}
      <div className="px-5 pb-4">
        {runs.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl p-8 flex flex-col items-center text-center" style={CARD}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <ScanSearch className="w-8 h-8" style={{ color: TEXT_DIM }} />
            </div>
            <p style={{ color: TEXT, fontWeight: 600, fontSize: "1rem", marginBottom: 6 }}>Brak analiz</p>
            <p style={{ color: TEXT_DIM, fontSize: "0.8rem", lineHeight: 1.6, marginBottom: 20 }}>
              Uruchom pierwszą analizę AI, aby skanować dokumenty i wykrywać elementy nieruchomości.
            </p>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
              style={{ background: GREEN, color: "#fff" }}
              onClick={() => setShowEmpty(false)}>
              <Play className="w-4 h-4" />
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Uruchom pierwszą analizę</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {runs.map((run) => {
              const isExpanded = expandedId === run.id;
              return (
                <div key={run.id} className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                  {/* Main row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : run.id)}
                    className="w-full text-left px-4 py-3.5 transition-opacity active:opacity-70"
                    style={{ background: isExpanded ? "rgba(62,168,90,0.06)" : "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-center gap-3 mb-2">
                      <StatusBadge s={run.status} />
                      <span style={{ color: TEXT_DIM, fontSize: "0.72rem", flex: 1 }}>{run.date}</span>
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_DIM }} />
                        : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_DIM }} />
                      }
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" style={{ color: TEXT_DIM }} />
                        <span style={{ color: TEXT, fontSize: "0.8rem" }}>{fmt(run.durationMs)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" style={{ color: TEXT_DIM }} />
                        <span style={{ color: TEXT, fontSize: "0.8rem" }}>{run.status === "pending" ? "—" : `${run.itemsDetected} el.`}</span>
                      </div>
                      {run.status !== "pending" && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <QualityDots q={run.matchQuality} />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Debug panel */}
                  {isExpanded && (
                    <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
                      <p style={{ color: TEXT_DIM, fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Szczegóły techniczne</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ["Retry count", run.retryCount],
                          ["Timeout", run.timeout ? "Tak" : "Nie"],
                          ["Parse path", run.parsePath],
                          ["Tokeny", run.tokensUsed || "—"],
                        ].map(([k, v]) => (
                          <div key={String(k)}>
                            <p style={{ color: TEXT_DIM, fontSize: "0.68rem" }}>{k}</p>
                            <p style={{ color: TEXT, fontSize: "0.78rem", fontFamily: "monospace", fontWeight: 500 }}>{String(v)}</p>
                          </div>
                        ))}
                        <div className="col-span-2">
                          <p style={{ color: TEXT_DIM, fontSize: "0.68rem" }}>Pipeline</p>
                          <p style={{ color: TEXT, fontSize: "0.73rem", fontFamily: "monospace" }}>{run.pipeline}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!showEmpty && (
          <p className="mt-3 text-center" style={{ color: TEXT_DIM, fontSize: "0.72rem" }}>
            Dotknij wiersz, aby zobaczyć szczegóły techniczne
          </p>
        )}
      </div>
    </div>
  );
}

// ── ChatScreen ─────────────────────────────────────────────────────────────────

function ChatScreen() {
  const chats = [
    { name: "MMO Artis", last: "Dziękujemy za ofertę, sprawdzimy...", time: "14:32", unread: 2, avatar: "MA" },
    { name: "Core-BUD", last: "Kiedy możemy spodziewać się kosztorysu?", time: "11:05", unread: 0, avatar: "CB" },
    { name: "Jan Kowalski", last: "Świetna robota, polecamy dalej!", time: "Wt", unread: 0, avatar: "JK" },
    { name: "Biuro MDA", last: "Przesyłam zdjęcia z inspekcji", time: "Pn", unread: 5, avatar: "MDA" },
  ];
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 pt-2 pb-4">
        <h1 style={{ color: TEXT, fontWeight: 700, fontSize: "1.35rem" }}>Wiadomości</h1>
      </div>
      {/* Search */}
      <div className="mx-5 mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl" style={CARD}>
        <Search className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_DIM }} />
        <span style={{ color: TEXT_DIM, fontSize: "0.875rem" }}>Szukaj wiadomości...</span>
      </div>
      <div className="px-5 space-y-2">
        {chats.map((c) => (
          <button key={c.name} className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-opacity active:opacity-70" style={CARD}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(62,168,90,0.15)", border: "1px solid rgba(62,168,90,0.2)" }}>
              <span style={{ color: GREEN, fontSize: "0.65rem", fontWeight: 700 }}>{c.avatar}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span style={{ color: TEXT, fontWeight: 600, fontSize: "0.875rem" }}>{c.name}</span>
                <span style={{ color: TEXT_DIM, fontSize: "0.7rem" }}>{c.time}</span>
              </div>
              <p className="truncate" style={{ color: TEXT_DIM, fontSize: "0.78rem" }}>{c.last}</p>
            </div>
            {c.unread > 0 && (
              <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: GREEN }}>
                <span style={{ color: "#fff", fontSize: "0.6rem", fontWeight: 700 }}>{c.unread}</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── MoreScreen ─────────────────────────────────────────────────────────────────

function MoreScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 pt-2 pb-4">
        <h1 style={{ color: TEXT, fontWeight: 700, fontSize: "1.35rem" }}>Więcej</h1>
      </div>
      {/* Grid tiles */}
      <div className="grid grid-cols-2 gap-3 px-5 mb-5">
        {[
          { icon: Users, label: "Twoi Klienci", color: GREEN },
          { icon: Building2, label: "Twoja firma", color: AMBER },
        ].map((t) => (
          <button key={t.label} className="flex flex-col items-center justify-center gap-3 py-6 rounded-2xl transition-opacity active:opacity-70" style={CARD}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${t.color}15`, border: `1px solid ${t.color}25` }}>
              <t.icon className="w-6 h-6" style={{ color: t.color }} />
            </div>
            <span style={{ color: TEXT, fontWeight: 600, fontSize: "0.875rem" }}>{t.label}</span>
          </button>
        ))}
      </div>
      {/* List items */}
      <div className="px-5 rounded-2xl overflow-hidden mx-0 space-y-2 pb-4">
        {[
          { icon: FileText, label: "Twoje dokumenty", sub: "Znajdź wszystkie aktywa...", badge: null, onPress: null },
          { icon: Package, label: "Kosztorysy & wyceny", sub: "Zarządzaj budżetem", badge: "8", onPress: null },
          { icon: Cpu, label: "AI Analiza", sub: "Skanuj dokumenty AI", badge: null, onPress: () => onNavigate("ai") },
          { icon: AlertTriangle, label: "Do akceptacji", sub: "Oczekuje na Twój podpis", badge: "3", onPress: null },
          { icon: Settings, label: "Ustawienia", sub: "Konto, powiadomienia", badge: null, onPress: null },
        ].map((item) => (
          <button key={item.label} onClick={item.onPress ?? undefined}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-opacity active:opacity-70" style={CARD}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)" }}>
              <item.icon className="w-4 h-4" style={{ color: TEXT_DIM }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: TEXT, fontSize: "0.875rem", fontWeight: 500 }}>{item.label}</p>
              <p className="truncate" style={{ color: TEXT_DIM, fontSize: "0.72rem", marginTop: 1 }}>{item.sub}</p>
            </div>
            {item.badge ? (
              <span className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: AMBER }}>
                <span style={{ color: "#fff", fontSize: "0.6rem", fontWeight: 700 }}>{item.badge}</span>
              </span>
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_DIM }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function MobileLoftDesk() {
  const [screen, setScreen] = useState<Screen>("home");
  const [prevScreen, setPrevScreen] = useState<Screen | null>(null);

  function navigateTo(s: Screen) {
    setPrevScreen(screen);
    setScreen(s);
  }

  function goDetail() {
    setPrevScreen(screen);
    setScreen("detail");
  }

  function goBack() {
    setScreen(prevScreen ?? "projects");
    setPrevScreen(null);
  }

  return (
    /* Page background */
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#04090600" }}>
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(62,168,90,0.08) 0%, #050A07 60%)" }}
      >
        {/* Phone frame */}
        <div
          className="relative flex flex-col overflow-hidden"
          style={{
            width: "min(390px, 100vw)",
            height: "min(844px, 100dvh)",
            background: APP_BG,
            borderRadius: "min(44px, 0px)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <StatusBar />

          {/* Screen content */}
          <div className="flex-1 overflow-hidden">
            {screen === "home" && <HomeScreen onNavigate={navigateTo} />}
            {screen === "projects" && <ProjectsScreen onDetail={goDetail} />}
            {screen === "detail" && <ProjectDetailScreen onBack={goBack} />}
            {screen === "ai" && <AIAnalysisScreen />}
            {screen === "chat" && <ChatScreen />}
            {screen === "more" && <MoreScreen onNavigate={navigateTo} />}
          </div>

          <BottomNav active={screen === "detail" ? "projects" : screen} onNavigate={navigateTo} />
        </div>
      </div>
    </div>
  );
}
