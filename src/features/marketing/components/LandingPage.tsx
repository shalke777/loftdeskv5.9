import { useState, useRef } from "react";
import { motion, useInView } from "motion/react";
import {
  ArrowRight, Camera, FileText, MessageCircle, LayoutGrid,
  Check, ChevronDown, Zap, ShieldCheck, Clock, FolderOpen,
  Star, Menu, X, Play, Smartphone, Sparkles,
} from "lucide-react";

// ─── Theme ────────────────────────────────────────────────────────────────────

export type Variant = "minimal" | "raw";

const T = {
  minimal: {
    bg: "#090E0B",
    bgAlt: "#0D1510",
    bgSection: "#0B120E",
    accent: "#4DB871",
    accentGlow: "rgba(77,184,113,0.18)",
    warm: "#C8863C",
    text: "#EDE8DD",
    dim: "rgba(237,232,221,0.5)",
    dimMore: "rgba(237,232,221,0.28)",
    card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" },
    cardHover: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" },
    badge: { background: "rgba(77,184,113,0.12)", border: "1px solid rgba(77,184,113,0.22)", color: "#4DB871" },
    r: "16px",
    heroSize: "clamp(2.8rem, 6vw, 5.2rem)",
    sectionTitle: "clamp(2rem, 4vw, 3.2rem)",
    letterSpacing: "-0.03em",
  },
  raw: {
    bg: "#0C0A07",
    bgAlt: "#100E09",
    bgSection: "#0F0D09",
    accent: "#D4924A",
    accentGlow: "rgba(212,146,74,0.18)",
    warm: "#4DB871",
    text: "#F2EDE0",
    dim: "rgba(242,237,224,0.5)",
    dimMore: "rgba(242,237,224,0.28)",
    card: { background: "rgba(212,146,74,0.05)", border: "1px solid rgba(212,146,74,0.13)" },
    cardHover: { background: "rgba(212,146,74,0.09)", border: "1px solid rgba(212,146,74,0.22)" },
    badge: { background: "rgba(212,146,74,0.12)", border: "1px solid rgba(212,146,74,0.25)", color: "#D4924A" },
    r: "6px",
    heroSize: "clamp(3rem, 7vw, 5.8rem)",
    sectionTitle: "clamp(2.2rem, 4.5vw, 3.5rem)",
    letterSpacing: "-0.02em",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.7, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Phone Mockup ─────────────────────────────────────────────────────────────

function PhoneMockup({ t }: { t: typeof T.minimal }) {
  const photos = ["#2A4A35", "#1E3A28", "#335840", "#1A3020", "#2D5238", "#163825"];
  return (
    <div className="relative flex items-center justify-center" style={{ minHeight: 520 }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style={{ width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${t.accentGlow} 0%, transparent 70%)` }} />
      </div>

      <motion.div
        animate={{ y: [-6, 6, -6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-4 top-16 z-10"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-lg"
          style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#25D366" }}>
            <MessageCircle className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p style={{ color: "#EDE8DD", fontSize: "0.68rem", fontWeight: 600 }}>Klient: Kiedy kosztorys?</p>
            <p style={{ color: "rgba(237,232,221,0.45)", fontSize: "0.6rem" }}>WhatsApp · 5min</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [5, -5, 5] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
        className="absolute -right-2 top-28 z-10"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-lg"
          style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.1)" }}>
          <FileText className="w-4 h-4" style={{ color: "#E06E4A" }} />
          <p style={{ color: "#EDE8DD", fontSize: "0.68rem", fontWeight: 500, maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Kosztorys_final_v3.pdf</p>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [-4, 8, -4] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        className="absolute -left-2 bottom-32 z-10"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-lg"
          style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Camera className="w-4 h-4" style={{ color: t.warm }} />
          <p style={{ color: "#EDE8DD", fontSize: "0.68rem" }}>150 zdjęć z telefonu</p>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [7, -3, 7] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="absolute -right-4 bottom-24 z-10"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-lg"
          style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.1)" }}>
          <LayoutGrid className="w-4 h-4" style={{ color: "#4ADE80" }} />
          <p style={{ color: "#EDE8DD", fontSize: "0.68rem" }}>Koszty_Q1.xlsx</p>
        </div>
      </motion.div>

      <div className="relative z-20" style={{ width: 240, height: 480, background: "#0A0F0C", borderRadius: 40, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 32px 64px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)", overflow: "hidden", flexShrink: 0 }}>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 rounded-full" style={{ background: "#000" }} />
        <div className="absolute inset-0 pt-8 px-3 pb-3 flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <span style={{ color: "rgba(237,232,221,0.6)", fontSize: "0.55rem", fontWeight: 600 }}>09:41</span>
            <span style={{ color: "rgba(237,232,221,0.6)", fontSize: "0.55rem" }}>5G ▪︎▪︎▪︎</span>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: "rgba(77,184,113,0.1)", border: "1px solid rgba(77,184,113,0.2)" }}>
            <p style={{ color: "rgba(237,232,221,0.5)", fontSize: "0.55rem" }}>Projekt</p>
            <p style={{ color: "#EDE8DD", fontSize: "0.8rem", fontWeight: 700, lineHeight: 1.2 }}>Renovacja biura</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="px-1.5 py-0.5 rounded-full" style={{ background: "rgba(77,184,113,0.2)", color: "#4DB871", fontSize: "0.5rem", fontWeight: 600 }}>W toku</span>
              <span style={{ color: "rgba(237,232,221,0.45)", fontSize: "0.55rem" }}>MMO Artis</span>
            </div>
          </div>
          <div>
            <p style={{ color: "rgba(237,232,221,0.4)", fontSize: "0.55rem", marginBottom: 4 }}>Zdjęcia projektu</p>
            <div className="grid grid-cols-3 gap-1">
              {photos.map((c, i) => (
                <div key={i} className="rounded-md" style={{ height: 36, background: c }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "rgba(237,232,221,0.4)", fontSize: "0.55rem" }}>Wartość projektu</p>
            <p style={{ color: "#EDE8DD", fontSize: "1rem", fontWeight: 700 }}>18 400 zł</p>
          </div>
          <div className="rounded-xl py-2 flex items-center justify-center" style={{ background: "#4DB871" }}>
            <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 700 }}>Uruchom analizę AI</span>
          </div>
          <div className="flex justify-around pt-1">
            {[FolderOpen, Camera, MessageCircle, FileText].map((Icon, i) => (
              <Icon key={i} className="w-4 h-4" style={{ color: i === 0 ? t.accent : "rgba(237,232,221,0.3)" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({ t, variant, setVariant }: { t: typeof T.minimal; variant: Variant; setVariant: (v: Variant) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: "rgba(9,14,11,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#A83228" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.72rem", letterSpacing: "-0.01em" }}>LD</span>
          </div>
          <span style={{ color: t.text, fontWeight: 700, fontSize: "1rem" }}>LoftDesk</span>
        </div>

        <div className="hidden md:flex items-center gap-1 p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["minimal", "raw"] as Variant[]).map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className="px-3 py-1.5 rounded-md transition-all"
              style={variant === v
                ? { background: t.accent, color: "#fff", fontSize: "0.75rem", fontWeight: 600 }
                : { color: t.dim, fontSize: "0.75rem" }}
            >
              {v === "minimal" ? "A — Minimalistyczny" : "B — Roboczy"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a href="#how" className="hidden md:block" style={{ color: t.dim, fontSize: "0.875rem" }}>Jak to działa</a>
          <a href="/login"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl transition-opacity hover:opacity-90"
            style={{ background: t.accent, color: "#fff", fontSize: "0.875rem", fontWeight: 600, borderRadius: t.r }}>
            Wypróbuj za darmo
            <ArrowRight className="w-4 h-4" />
          </a>
          <button className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" style={{ color: t.text }} /> : <Menu className="w-5 h-5" style={{ color: t.text }} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden px-5 pb-5 space-y-2">
          {(["minimal", "raw"] as Variant[]).map((v) => (
            <button key={v} onClick={() => { setVariant(v); setOpen(false); }}
              className="w-full py-2.5 rounded-xl text-sm"
              style={variant === v ? { background: t.accent, color: "#fff", fontWeight: 600 } : { ...t.card, color: t.dim }}>
              {v === "minimal" ? "A — Minimalistyczny" : "B — Roboczy"}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ t, variant }: { t: typeof T.minimal; variant: Variant }) {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden" style={{ background: t.bg }}>
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, borderRadius: "50%", background: `radial-gradient(ellipse, ${t.accentGlow} 0%, transparent 70%)`, filter: "blur(40px)" }} />
      </div>

      <div className="max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-2 gap-16 items-center w-full">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
              style={{ ...t.badge, fontSize: "0.78rem", fontWeight: 500 }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: t.accent }} />
              Nowe narzędzie dla firm usługowych
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ color: t.text, fontSize: t.heroSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: t.letterSpacing, marginBottom: "1.5rem" }}
          >
            {variant === "minimal"
              ? <>Ogarnij projekty<br /><span style={{ color: t.accent }}>bez chaosu.</span></>
              : <>Wszystko z projektu<br />w <span style={{ color: t.accent }}>jednym miejscu.</span></>
            }
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ color: t.dim, fontSize: "clamp(1rem, 1.5vw, 1.15rem)", lineHeight: 1.65, maxWidth: 480, marginBottom: "2.5rem" }}
          >
            LoftDesk zbiera wszystko co masz rozrzucone — zdjęcia, PDFy, wiadomości, koszty — i pomaga Ci działać szybciej. <strong style={{ color: t.text, fontWeight: 500 }}>Bez uczenia się systemu.</strong>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-3 mb-10"
          >
            <a href="/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 transition-all hover:opacity-90 active:scale-95"
              style={{ background: t.accent, color: "#fff", fontWeight: 700, fontSize: "0.95rem", borderRadius: t.r, boxShadow: `0 8px 24px ${t.accentGlow}` }}>
              Wejdź i zobacz
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#how"
              className="inline-flex items-center gap-2 px-6 py-3.5 transition-all hover:opacity-80"
              style={{ ...t.card, color: t.text, fontWeight: 500, fontSize: "0.95rem", borderRadius: t.r }}>
              <Play className="w-4 h-4" style={{ color: t.accent }} />
              Jak to działa
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-6"
          >
            {[
              { label: "Bez uczenia się" },
              { label: "Działasz od razu" },
              { label: "Mobile-first" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent }} />
                <span style={{ color: t.dim, fontSize: "0.8rem" }}>{f.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center"
        >
          <PhoneMockup t={t} />
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        style={{ color: t.dimMore }}
      >
        <ChevronDown className="w-6 h-6" />
      </motion.div>
    </section>
  );
}

// ─── Problem ──────────────────────────────────────────────────────────────────

function ProblemSection({ t }: { t: typeof T.minimal }) {
  const chaos = [
    { icon: Camera, color: t.warm, title: "Zdjęcia na telefonie", desc: "150 zdjęć. Wiesz które są z którego projektu?" },
    { icon: FileText, color: "#E06E4A", title: "PDFy porozrzucane", desc: "Kosztorys_v3_OSTATECZNY_final2.pdf — znajdź to szybko." },
    { icon: MessageCircle, color: "#25D366", title: "Wiadomości w kilku miejscach", desc: "WhatsApp, SMS, mail, telefon. Ustalenia? Gdzie to było?" },
    { icon: LayoutGrid, color: "#4A9DE0", title: "Koszty w głowie lub w Excelu", desc: "Wiesz mniej więcej ile kosztuje projekt. Mniej więcej." },
  ];
  return (
    <section style={{ background: t.bgAlt, paddingTop: 96, paddingBottom: 96 }}>
      <div className="max-w-6xl mx-auto px-5">
        <FadeUp className="text-center mb-16">
          <p style={{ color: t.accent, fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Brzmi znajomo?</p>
          <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 800, letterSpacing: t.letterSpacing, lineHeight: 1.1 }}>
            Masz wszystko.<br />
            <span style={{ color: t.dim }}>Tylko nie w jednym miejscu.</span>
          </h2>
        </FadeUp>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {chaos.map((item, i) => (
            <FadeUp key={item.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="p-5 h-full flex flex-col gap-4"
                style={{ ...t.card, borderRadius: t.r }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <div>
                  <p style={{ color: t.text, fontWeight: 600, fontSize: "0.9rem", marginBottom: 6 }}>{item.title}</p>
                  <p style={{ color: t.dim, fontSize: "0.82rem", lineHeight: 1.55 }}>{item.desc}</p>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>

        <FadeUp delay={0.4} className="mt-12 text-center">
          <p style={{ color: t.dimMore, fontSize: "1rem" }}>
            Każda firma usługowa przez to przechodzi. <strong style={{ color: t.text }}>Nie musisz.</strong>
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

// ─── Solution ─────────────────────────────────────────────────────────────────

function SolutionSection({ t }: { t: typeof T.minimal }) {
  const items = [
    { label: "Wrzucasz zdjęcia z telefonu" },
    { label: "Dodajesz dokumenty i koszty" },
    { label: "Masz pełny kontekst projektu" },
    { label: "Widzisz co, kiedy i za ile" },
  ];
  return (
    <section style={{ background: t.bg, paddingTop: 96, paddingBottom: 96 }}>
      <div className="max-w-5xl mx-auto px-5">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
              <img
                src="https://images.unsplash.com/photo-1626035136501-a842e9c122b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb250cmFjdG9yJTIwcmV2aWV3aW5nJTIwZG9jdW1lbnRzJTIwcGhvbmUlMjBibHVlcHJpbnR8ZW58MXx8fHwxNzc1NDY2ODQxfDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Contractor reviewing project"
                className="w-full h-full object-cover"
                style={{ filter: "brightness(0.7)" }}
              />
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl" style={{ background: "rgba(9,14,11,0.88)", backdropFilter: "blur(12px)", border: "1px solid rgba(77,184,113,0.2)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(77,184,113,0.2)" }}>
                    <Check className="w-4 h-4" style={{ color: "#4DB871" }} />
                  </div>
                  <div>
                    <p style={{ color: "#EDE8DD", fontSize: "0.82rem", fontWeight: 600 }}>Projekt skompletowany</p>
                    <p style={{ color: "rgba(237,232,221,0.5)", fontSize: "0.72rem" }}>Zdjęcia, kosztorys, decyzje — wszystko na miejscu</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
          <div>
            <FadeUp>
              <p style={{ color: t.accent, fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Rozwiązanie</p>
              <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 800, letterSpacing: t.letterSpacing, lineHeight: 1.1, marginBottom: 20 }}>
                LoftDesk zbiera<br />to w całość.
              </h2>
              <p style={{ color: t.dim, fontSize: "1rem", lineHeight: 1.65, marginBottom: 32 }}>
                Nie ma tu rewolucji. Nie musisz zmieniać tego jak pracujesz. Po prostu masz jedno miejsce, w którym wszystko z projektu ma sens.
              </p>
            </FadeUp>
            <div className="space-y-3">
              {items.map((item, i) => (
                <FadeUp key={item.label} delay={0.1 + i * 0.07}>
                  <div className="flex items-center gap-3 p-4 rounded-xl" style={{ ...t.card, borderRadius: t.r }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${t.accent}20`, border: `1px solid ${t.accent}30` }}>
                      <Check className="w-3 h-3" style={{ color: t.accent }} />
                    </div>
                    <span style={{ color: t.text, fontSize: "0.9rem" }}>{item.label}</span>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorksSection({ t }: { t: typeof T.minimal }) {
  const steps = [
    {
      num: "01",
      title: "Wrzucasz co masz",
      desc: "Zdjęcia z telefonu, PDF z maila, notatka z WhatsAppa. Bez kopiowania, bez przenoszenia, bez systemu.",
      icon: Camera,
    },
    {
      num: "02",
      title: "LoftDesk układa to w projekt",
      desc: "Wszystko dostaje kontekst — kto, co, kiedy, za ile. Historia projektu w jednym widoku.",
      icon: FolderOpen,
    },
    {
      num: "03",
      title: "Działasz szybciej",
      desc: "Wycena gotowa w minutę. Klient dostaje odpowiedź od razu. Koszty nie uciekają.",
      icon: Zap,
    },
  ];
  return (
    <section id="how" style={{ background: t.bgSection, paddingTop: 96, paddingBottom: 96 }}>
      <div className="max-w-6xl mx-auto px-5">
        <FadeUp className="text-center mb-16">
          <p style={{ color: t.accent, fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Jak to działa</p>
          <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 800, letterSpacing: t.letterSpacing, lineHeight: 1.1 }}>
            Trzy kroki.<br /><span style={{ color: t.dim }}>To wszystko.</span>
          </h2>
        </FadeUp>

        <div className="grid md:grid-cols-3 gap-6 relative">
          <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px" style={{ background: `linear-gradient(90deg, transparent, ${t.accent}40, ${t.accent}40, transparent)` }} />

          {steps.map((step, i) => (
            <FadeUp key={step.num} delay={i * 0.12}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className="relative p-7 flex flex-col gap-5"
                style={{ ...t.card, borderRadius: t.r }}
              >
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${t.accent}15`, border: `1px solid ${t.accent}25` }}>
                    <step.icon className="w-5 h-5" style={{ color: t.accent }} />
                  </div>
                  <span style={{ color: t.dimMore, fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{step.num}</span>
                </div>
                <div>
                  <p style={{ color: t.text, fontWeight: 700, fontSize: "1.05rem", marginBottom: 8 }}>{step.title}</p>
                  <p style={{ color: t.dim, fontSize: "0.875rem", lineHeight: 1.65 }}>{step.desc}</p>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Effects ──────────────────────────────────────────────────────────────────

function EffectsSection({ t }: { t: typeof T.minimal }) {
  const effects = [
    { icon: FolderOpen, title: "Mniej chaosu", accent: t.accent, desc: "Nie szukasz informacji po telefonie. Nie dzwonisz do siebie żeby coś przypomnieć.", detail: "Wszystko w jednym projekcie" },
    { icon: Zap, title: "Szybsze decyzje", accent: t.warm, desc: "Masz kontekst na wyciągnięcie ręki. Klient pyta — odpowiadasz od razu.", detail: "Bez szukania" },
    { icon: ShieldCheck, title: "Mniej pomyłek", accent: "#6B9CF5", desc: "Nie zapominasz o kosztach. Każda pozycja jest zapisana. Historia nie znika.", detail: "Pełna historia projektu" },
    { icon: Clock, title: "Więcej kontroli", accent: "#A78BFA", desc: "Nie gubisz ustaleń z klientem. Wiesz co zostało powiedziane i kiedy.", detail: "Chronologia zdarzeń" },
  ];
  return (
    <section style={{ background: t.bg, paddingTop: 96, paddingBottom: 96 }}>
      <div className="max-w-6xl mx-auto px-5">
        <FadeUp className="text-center mb-16">
          <p style={{ color: t.accent, fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Efekty, nie funkcje</p>
          <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 800, letterSpacing: t.letterSpacing, lineHeight: 1.1 }}>
            Co to dla Ciebie<br /><span style={{ color: t.dim }}>naprawdę znaczy.</span>
          </h2>
        </FadeUp>
        <div className="grid sm:grid-cols-2 gap-4">
          {effects.map((e, i) => (
            <FadeUp key={e.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="p-7 flex gap-5"
                style={{ ...t.card, borderRadius: t.r }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${e.accent}15`, border: `1px solid ${e.accent}25` }}>
                  <e.icon className="w-5 h-5" style={{ color: e.accent }} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p style={{ color: t.text, fontWeight: 700, fontSize: "1rem" }}>{e.title}</p>
                    <span className="px-2 py-0.5 rounded-full" style={{ background: `${e.accent}15`, color: e.accent, fontSize: "0.65rem", fontWeight: 600 }}>{e.detail}</span>
                  </div>
                  <p style={{ color: t.dim, fontSize: "0.875rem", lineHeight: 1.6 }}>{e.desc}</p>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Not a System ─────────────────────────────────────────────────────────────

function NotSystemSection({ t, variant }: { t: typeof T.minimal; variant: Variant }) {
  const lines = [
    { text: "Nie musisz się uczyć.", accent: false },
    { text: "Nie zmieniasz sposobu pracy.", accent: false },
    { text: "Po prostu wrzucasz i działasz.", accent: true },
  ];
  const features = [
    { Icon: Smartphone, label: "Zaczyna się od telefonu", sub: "Tak jak Twoja praca" },
    { Icon: Zap, label: "Działa od razu", sub: "Bez konfiguracji, bez onboardingu" },
    { Icon: Sparkles, label: "AI gdzie trzeba", sub: "Bez hype'u, z realną pomocą" },
  ];
  return (
    <section style={{ background: t.bgAlt, paddingTop: 120, paddingBottom: 120, overflow: "hidden" }}>
      <div className="max-w-5xl mx-auto px-5">
        <FadeUp className="mb-12">
          <p style={{ color: t.accent, fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>To nie jest system</p>
        </FadeUp>

        <div className="space-y-4 mb-16">
          {lines.map((line, i) => (
            <FadeUp key={line.text} delay={i * 0.12}>
              <div className="flex items-baseline gap-5 group">
                <span style={{ color: t.dimMore, fontSize: "0.75rem", fontWeight: 600, fontFamily: "monospace", minWidth: 28 }}>0{i + 1}</span>
                <p style={{
                  color: line.accent ? t.accent : t.text,
                  fontSize: variant === "raw" ? "clamp(1.8rem, 4vw, 3.5rem)" : "clamp(1.6rem, 3.5vw, 3rem)",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: t.letterSpacing,
                }}>
                  {line.text}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>

        <FadeUp delay={0.4}>
          <div className="grid sm:grid-cols-3 gap-4">
            {features.map((item) => (
              <div key={item.label} className="p-5 rounded-2xl" style={{ ...t.card, borderRadius: t.r }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${t.accent}15`, border: `1px solid ${t.accent}25` }}>
                  <item.Icon className="w-5 h-5" style={{ color: t.accent }} />
                </div>
                <p style={{ color: t.text, fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>{item.label}</p>
                <p style={{ color: t.dim, fontSize: "0.8rem" }}>{item.sub}</p>
              </div>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function TestimonialsSection({ t }: { t: typeof T.minimal }) {
  const quotes = [
    { text: "W końcu mam wszystko w jednym miejscu. Zajęło mi 10 minut żeby wrzucić pierwszy projekt. Nie wróciłem do Excela.", name: "Tomasz K.", role: "Właściciel firmy remontowej", avatar: "TK" },
    { text: "Myślałem że to kolejny system, który trzeba wdrażać. Okazało sie, że po prostu działa od pierwszego dnia.", name: "Marek W.", role: "Wykonawca, 8 pracowników", avatar: "MW" },
    { text: "Klient pyta, ja odpowiadam w 30 sekund bo mam wszystko pod ręką. Wcześniej szukałem w 4 miejscach.", name: "Dariusz S.", role: "Firma wykończeniowa", avatar: "DS" },
  ];
  return (
    <section style={{ background: t.bg, paddingTop: 96, paddingBottom: 96 }}>
      <div className="max-w-6xl mx-auto px-5">
        <FadeUp className="text-center mb-16">
          <p style={{ color: t.accent, fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Co mówią użytkownicy</p>
          <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 800, letterSpacing: t.letterSpacing }}>Bez marketingu.</h2>
        </FadeUp>
        <div className="grid md:grid-cols-3 gap-5">
          {quotes.map((q, i) => (
            <FadeUp key={q.name} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="p-7 flex flex-col gap-5 h-full"
                style={{ ...t.card, borderRadius: t.r }}
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-current" style={{ color: t.warm }} />
                  ))}
                </div>
                <p style={{ color: t.text, fontSize: "0.9rem", lineHeight: 1.7, flex: 1 }}>"{q.text}"</p>
                <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${t.accent}20`, border: `1px solid ${t.accent}30` }}>
                    <span style={{ color: t.accent, fontSize: "0.65rem", fontWeight: 700 }}>{q.avatar}</span>
                  </div>
                  <div>
                    <p style={{ color: t.text, fontWeight: 600, fontSize: "0.82rem" }}>{q.name}</p>
                    <p style={{ color: t.dim, fontSize: "0.72rem" }}>{q.role}</p>
                  </div>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA({ t, variant }: { t: typeof T.minimal; variant: Variant }) {
  return (
    <section id="cta" style={{ background: t.bgAlt, paddingTop: 120, paddingBottom: 120 }}>
      <div className="max-w-3xl mx-auto px-5 text-center">
        <FadeUp>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
            style={{ ...t.badge, fontSize: "0.78rem", fontWeight: 500 }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />
            Bez karty kredytowej
          </div>
          <h2 style={{ color: t.text, fontSize: variant === "raw" ? "clamp(2.2rem, 5vw, 4.5rem)" : "clamp(2rem, 4.5vw, 4rem)", fontWeight: 800, letterSpacing: t.letterSpacing, lineHeight: 1.1, marginBottom: 20 }}>
            {variant === "minimal"
              ? <>Wejdź i zobacz<br /><span style={{ color: t.accent }}>na swoim projekcie.</span></>
              : <>Spróbuj bez<br /><span style={{ color: t.accent }}>kombinowania.</span></>
            }
          </h2>
          <p style={{ color: t.dim, fontSize: "1.05rem", lineHeight: 1.65, maxWidth: 480, margin: "0 auto 40px" }}>
            Wrzuć jeden projekt. Poczuj jak to działa. Decyzja zajmuje 10 minut.
          </p>
        </FadeUp>

        <FadeUp delay={0.15} className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 transition-all hover:opacity-90 active:scale-95"
            style={{ background: t.accent, color: "#fff", fontWeight: 700, fontSize: "1rem", borderRadius: t.r, boxShadow: `0 12px 32px ${t.accentGlow}` }}>
            Wejdź i zobacz za darmo
            <ArrowRight className="w-5 h-5" />
          </a>
          <a href="#how"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 transition-all hover:opacity-80"
            style={{ ...t.card, color: t.text, fontWeight: 500, fontSize: "1rem", borderRadius: t.r }}>
            Sprawdź jak to działa
          </a>
        </FadeUp>

        <FadeUp delay={0.25} className="mt-10 flex items-center justify-center gap-8 flex-wrap">
          {[
            { icon: ShieldCheck, label: "Bezpieczne dane" },
            { icon: Clock, label: "Start w 5 minut" },
            { icon: Check, label: "Bez zobowiązań" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <item.icon className="w-4 h-4" style={{ color: t.accent }} />
              <span style={{ color: t.dim, fontSize: "0.82rem" }}>{item.label}</span>
            </div>
          ))}
        </FadeUp>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ t }: { t: typeof T.minimal }) {
  return (
    <footer style={{ background: t.bg, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 40, paddingBottom: 40 }}>
      <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#A83228" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.62rem" }}>LD</span>
          </div>
          <span style={{ color: t.dim, fontSize: "0.875rem" }}>LoftDesk · Ogarnij projekty bez chaosu</span>
        </div>
        <div className="flex gap-6">
          {["Prywatność", "Kontakt", "O nas"].map((l) => (
            <a key={l} href="#" style={{ color: t.dimMore, fontSize: "0.8rem" }} className="hover:opacity-80 transition-opacity">{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function LandingPage() {
  const [variant, setVariant] = useState<Variant>("minimal");
  const t = T[variant];

  return (
    <div style={{ background: t.bg, minHeight: "100vh", transition: "background 0.4s ease" }}>
      <Navbar t={t} variant={variant} setVariant={setVariant} />
      <HeroSection t={t} variant={variant} />
      <ProblemSection t={t} />
      <SolutionSection t={t} />
      <HowItWorksSection t={t} />
      <EffectsSection t={t} />
      <NotSystemSection t={t} variant={variant} />
      <TestimonialsSection t={t} />
      <FinalCTA t={t} variant={variant} />
      <Footer t={t} />
    </div>
  );
}
