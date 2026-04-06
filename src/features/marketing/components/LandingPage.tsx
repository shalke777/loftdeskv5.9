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

function FadeUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.7, delay }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── Phone Mockup ─────────────────────────────────────────────────────────────

function PhoneMockup({ t }: { t: typeof T.minimal }) {
  const photos = ["#2A4A35", "#1E3A28", "#335840", "#1A3020", "#2D5238", "#163825"];
  return (
    <div className="lp2-phone-wrap">
      <div className="lp2-phone-glow">
        <div style={{ width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${t.accentGlow} 0%, transparent 70%)` }} />
      </div>

      <motion.div
        animate={{ y: [-6, 6, -6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="lp2-float-card lp2-float--tl"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#25D366" }}>
            <MessageCircle style={{ width: 14, height: 14, color: "#fff" }} />
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
        className="lp2-float-card lp2-float--tr"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <FileText style={{ width: 16, height: 16, color: "#E06E4A" }} />
          <p style={{ color: "#EDE8DD", fontSize: "0.68rem", fontWeight: 500, maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Kosztorys_final_v3.pdf</p>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [-4, 8, -4] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        className="lp2-float-card lp2-float--bl"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <Camera style={{ width: 16, height: 16, color: t.warm }} />
          <p style={{ color: "#EDE8DD", fontSize: "0.68rem" }}>150 zdjęć z telefonu</p>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [7, -3, 7] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="lp2-float-card lp2-float--br"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <LayoutGrid style={{ width: 16, height: 16, color: "#4ADE80" }} />
          <p style={{ color: "#EDE8DD", fontSize: "0.68rem" }}>Koszty_Q1.xlsx</p>
        </div>
      </motion.div>

      <div className="lp2-phone" style={{ background: "#0A0F0C", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 32px 64px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)" }}>
        <div className="lp2-phone__notch" />
        <div className="lp2-phone__screen">
          <div className="lp2-phone__status">
            <span style={{ color: "rgba(237,232,221,0.6)", fontSize: "0.55rem", fontWeight: 600 }}>09:41</span>
            <span style={{ color: "rgba(237,232,221,0.6)", fontSize: "0.55rem" }}>5G ▪︎▪︎▪︎</span>
          </div>
          <div style={{ borderRadius: 10, padding: "10px", background: "rgba(77,184,113,0.1)", border: "1px solid rgba(77,184,113,0.2)" }}>
            <p style={{ color: "rgba(237,232,221,0.5)", fontSize: "0.55rem" }}>Projekt</p>
            <p style={{ color: "#EDE8DD", fontSize: "0.8rem", fontWeight: 700, lineHeight: 1.2 }}>Renowacja biura</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span style={{ padding: "2px 6px", borderRadius: 99, background: "rgba(77,184,113,0.2)", color: "#4DB871", fontSize: "0.5rem", fontWeight: 600 }}>W toku</span>
              <span style={{ color: "rgba(237,232,221,0.45)", fontSize: "0.55rem" }}>MMO Artis</span>
            </div>
          </div>
          <div>
            <p style={{ color: "rgba(237,232,221,0.4)", fontSize: "0.55rem", marginBottom: 4 }}>Zdjęcia projektu</p>
            <div className="lp2-phone__grid3">
              {photos.map((c, i) => (
                <div key={i} style={{ height: 36, background: c, borderRadius: 6 }} />
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 10, padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "rgba(237,232,221,0.4)", fontSize: "0.55rem" }}>Wartość projektu</p>
            <p style={{ color: "#EDE8DD", fontSize: "1rem", fontWeight: 700 }}>18 400 zł</p>
          </div>
          <div style={{ borderRadius: 10, padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", background: "#4DB871" }}>
            <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 700 }}>Uruchom analizę AI</span>
          </div>
          <div className="lp2-phone__nav">
            {[FolderOpen, Camera, MessageCircle, FileText].map((Icon, i) => (
              <Icon key={i} style={{ width: 16, height: 16, color: i === 0 ? t.accent : "rgba(237,232,221,0.3)" }} />
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
    <nav className="lp2-nav" style={{ background: "rgba(9,14,11,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="lp2-nav__inner">
        <div className="lp2-logo">
          <div className="lp2-logo__icon" style={{ background: "#A83228" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.72rem", letterSpacing: "-0.01em" }}>LD</span>
          </div>
          <span style={{ color: t.text, fontWeight: 700, fontSize: "1rem" }}>LoftDesk</span>
        </div>

        <div className="lp2-variant-switch" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["minimal", "raw"] as Variant[]).map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className="lp2-variant-btn"
              style={variant === v
                ? { background: t.accent, color: "#fff", fontSize: "0.75rem", fontWeight: 600 }
                : { color: t.dim, fontSize: "0.75rem" }}
            >
              {v === "minimal" ? "A — Minimalistyczny" : "B — Roboczy"}
            </button>
          ))}
        </div>

        <div className="lp2-nav__ctas">
          <a href="#how" className="lp2-nav__link lp2-nav__link--desktop" style={{ color: t.dim, fontSize: "0.875rem" }}>Jak to działa</a>
          <a href="/login"
            className="lp2-nav__cta-btn"
            style={{ background: t.accent, color: "#fff", fontSize: "0.875rem", borderRadius: t.r }}>
            Wypróbuj za darmo
            <ArrowRight style={{ width: 16, height: 16 }} />
          </a>
          <button className="lp2-hamburger" onClick={() => setOpen(!open)}>
            {open ? <X style={{ width: 20, height: 20, color: t.text }} /> : <Menu style={{ width: 20, height: 20, color: t.text }} />}
          </button>
        </div>
      </div>
      <div className={`lp2-mobile-menu${open ? " lp2-mobile-menu--open" : ""}`}>
        {(["minimal", "raw"] as Variant[]).map((v) => (
          <button key={v} onClick={() => { setVariant(v); setOpen(false); }}
            className="lp2-mobile-menu-btn"
            style={variant === v ? { background: t.accent, color: "#fff", fontWeight: 600 } : { ...t.card, color: t.dim }}>
            {v === "minimal" ? "A — Minimalistyczny" : "B — Roboczy"}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ t, variant }: { t: typeof T.minimal; variant: Variant }) {
  return (
    <section className="lp2-hero" style={{ background: t.bg }}>
      <div className="lp2-hero__bg-glow">
        <div style={{ width: 600, height: 400, borderRadius: "50%", background: `radial-gradient(ellipse, ${t.accentGlow} 0%, transparent 70%)`, filter: "blur(40px)" }} />
      </div>

      <div className="lp2-hero__grid">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lp2-badge" style={{ ...t.badge, fontSize: "0.78rem", fontWeight: 500, marginBottom: 32 }}>
              <span className="lp2-badge__dot" style={{ background: t.accent }} />
              Nowe narzędzie dla firm usługowych
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ color: t.text, fontSize: t.heroSize, fontWeight: 900, lineHeight: 1.05, letterSpacing: t.letterSpacing, marginBottom: "1.5rem" }}
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
            className="lp2-hero__ctas"
          >
            <a href="/login"
              className="lp2-btn"
              style={{ background: t.accent, color: "#fff", borderRadius: t.r, boxShadow: `0 8px 24px ${t.accentGlow}` }}>
              Wejdź i zobacz
              <ArrowRight style={{ width: 16, height: 16 }} />
            </a>
            <a href="#how"
              className="lp2-btn lp2-btn--ghost"
              style={{ ...t.card, color: t.text, borderRadius: t.r }}>
              <Play style={{ width: 16, height: 16, color: t.accent }} />
              Jak to działa
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="lp2-checkmarks"
          >
            {[
              { label: "Bez uczenia się" },
              { label: "Działasz od razu" },
              { label: "Mobile-first" },
            ].map((f) => (
              <div key={f.label} className="lp2-check-pill">
                <Check style={{ width: 14, height: 14, flexShrink: 0, color: t.accent }} />
                <span style={{ color: t.dim, fontSize: "0.8rem" }}>{f.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "flex", justifyContent: "center" }}
        >
          <PhoneMockup t={t} />
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="lp2-scroll-cue"
        style={{ color: t.dimMore }}
      >
        <ChevronDown style={{ width: 24, height: 24 }} />
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
    <section className="lp2-section" style={{ background: t.bgAlt }}>
      <div className="lp2-container">
        <FadeUp style={{ textAlign: "center", marginBottom: 64 }}>
          <p className="lp2-overline" style={{ color: t.accent }}>Brzmi znajomo?</p>
          <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 900, letterSpacing: t.letterSpacing, lineHeight: 1.1 }}>
            Masz wszystko.<br />
            <span style={{ color: t.dim }}>Tylko nie w jednym miejscu.</span>
          </h2>
        </FadeUp>

        <div className="lp2-grid-4">
          {chaos.map((item, i) => (
            <FadeUp key={item.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="lp2-card"
                style={{ ...t.card, borderRadius: t.r }}
              >
                <div className="lp2-icon-box lp2-icon-box--md" style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
                  <item.icon style={{ width: 20, height: 20, color: item.color }} />
                </div>
                <div>
                  <p style={{ color: t.text, fontWeight: 600, fontSize: "0.9rem", marginBottom: 6 }}>{item.title}</p>
                  <p style={{ color: t.dim, fontSize: "0.82rem", lineHeight: 1.55 }}>{item.desc}</p>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>

        <FadeUp delay={0.4} style={{ marginTop: 48, textAlign: "center" }}>
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
    <section className="lp2-section" style={{ background: t.bg }}>
      <div className="lp2-container--md">
        <div className="lp2-grid-split">
          <FadeIn>
            <div className="lp2-img-wrap">
              <img
                src="https://images.unsplash.com/photo-1626035136501-a842e9c122b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb250cmFjdG9yJTIwcmV2aWV3aW5nJTIwZG9jdW1lbnRzJTIwcGhvbmUlMjBibHVlcHJpbnR8ZW58MXx8fHwxNzc1NDY2ODQxfDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Contractor reviewing project"
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.7)" }}
              />
              <div className="lp2-img-overlay" style={{ background: "rgba(9,14,11,0.88)", backdropFilter: "blur(12px)", border: "1px solid rgba(77,184,113,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="lp2-icon-box lp2-icon-box--md" style={{ background: "rgba(77,184,113,0.2)" }}>
                    <Check style={{ width: 16, height: 16, color: "#4DB871" }} />
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
              <p className="lp2-overline" style={{ color: t.accent }}>Rozwiązanie</p>
              <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 800, letterSpacing: t.letterSpacing, lineHeight: 1.1, marginBottom: 20 }}>
                LoftDesk zbiera<br />to w całość.
              </h2>
              <p style={{ color: t.dim, fontSize: "1rem", lineHeight: 1.65, marginBottom: 32 }}>
                Nie ma tu rewolucji. Nie musisz zmieniać tego jak pracujesz. Po prostu masz jedno miejsce, w którym wszystko z projektu ma sens.
              </p>
            </FadeUp>
            <div className="lp2-checklist">
              {items.map((item, i) => (
                <FadeUp key={item.label} delay={0.1 + i * 0.07}>
                  <div className="lp2-check-item" style={{ ...t.card, borderRadius: t.r }}>
                    <div className="lp2-icon-circle" style={{ background: `${t.accent}20`, border: `1px solid ${t.accent}30` }}>
                      <Check style={{ width: 12, height: 12, color: t.accent }} />
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
    <section id="how" className="lp2-section" style={{ background: t.bgSection }}>
      <div className="lp2-container">
        <FadeUp style={{ textAlign: "center", marginBottom: 64 }}>
          <p className="lp2-overline" style={{ color: t.accent }}>Jak to działa</p>
          <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 900, letterSpacing: t.letterSpacing, lineHeight: 1.1 }}>
            Trzy kroki.<br /><span style={{ color: t.dim }}>To wszystko.</span>
          </h2>
        </FadeUp>

        <div className="lp2-grid-3">
          <div className="lp2-step-connector" style={{ background: `linear-gradient(90deg, transparent, ${t.accent}40, ${t.accent}40, transparent)` }} />

          {steps.map((step, i) => (
            <FadeUp key={step.num} delay={i * 0.12}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className="lp2-card lp2-card--step"
                style={{ ...t.card, borderRadius: t.r }}
              >
                <div className="lp2-card__header">
                  <div className="lp2-icon-box lp2-icon-box--lg" style={{ background: `${t.accent}15`, border: `1px solid ${t.accent}25` }}>
                    <step.icon style={{ width: 20, height: 20, color: t.accent }} />
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
    <section className="lp2-section" style={{ background: t.bg }}>
      <div className="lp2-container">
        <FadeUp style={{ textAlign: "center", marginBottom: 64 }}>
          <p className="lp2-overline" style={{ color: t.accent }}>Efekty, nie funkcje</p>
          <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 900, letterSpacing: t.letterSpacing, lineHeight: 1.1 }}>
            Co to dla Ciebie<br /><span style={{ color: t.dim }}>naprawdę znaczy.</span>
          </h2>
        </FadeUp>
        <div className="lp2-grid-2">
          {effects.map((e, i) => (
            <FadeUp key={e.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="lp2-card lp2-card--effect"
                style={{ ...t.card, borderRadius: t.r }}
              >
                <div className="lp2-icon-box lp2-icon-box--lg" style={{ background: `${e.accent}15`, border: `1px solid ${e.accent}25` }}>
                  <e.icon style={{ width: 20, height: 20, color: e.accent }} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <p style={{ color: t.text, fontWeight: 700, fontSize: "1rem" }}>{e.title}</p>
                    <span style={{ padding: "2px 8px", borderRadius: 99, background: `${e.accent}15`, color: e.accent, fontSize: "0.65rem", fontWeight: 600 }}>{e.detail}</span>
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
    <section className="lp2-section--lg" style={{ background: t.bgAlt }}>
      <div className="lp2-container--md">
        <FadeUp style={{ marginBottom: 48 }}>
          <p className="lp2-overline" style={{ color: t.accent }}>To nie jest system</p>
        </FadeUp>

        <div className="lp2-statements">
          {lines.map((line, i) => (
            <FadeUp key={line.text} delay={i * 0.12}>
              <div className="lp2-statement">
                <span style={{ color: t.dimMore, fontSize: "0.75rem", fontWeight: 600, fontFamily: "monospace", minWidth: 28 }}>0{i + 1}</span>
                <p style={{
                  color: line.accent ? t.accent : t.text,
                  fontSize: variant === "raw" ? "clamp(1.8rem, 4vw, 3.5rem)" : "clamp(1.6rem, 3.5vw, 3rem)",
                  fontWeight: 900,
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
          <div className="lp2-features-3">
            {features.map((item) => (
              <div key={item.label} className="lp2-feature-card" style={{ ...t.card, borderRadius: t.r }}>
                <div className="lp2-icon-box lp2-icon-box--sm" style={{ background: `${t.accent}15`, border: `1px solid ${t.accent}25`, marginBottom: 12 }}>
                  <item.Icon style={{ width: 20, height: 20, color: t.accent }} />
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
    <section className="lp2-section" style={{ background: t.bg }}>
      <div className="lp2-container">
        <FadeUp style={{ textAlign: "center", marginBottom: 64 }}>
          <p className="lp2-overline" style={{ color: t.accent }}>Co mówią użytkownicy</p>
          <h2 style={{ color: t.text, fontSize: t.sectionTitle, fontWeight: 800, letterSpacing: t.letterSpacing }}>Bez marketingu.</h2>
        </FadeUp>
        <div className="lp2-grid-3">
          {quotes.map((q, i) => (
            <FadeUp key={q.name} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="lp2-card lp2-card--review"
                style={{ ...t.card, borderRadius: t.r }}
              >
                <div className="lp2-stars">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} style={{ width: 16, height: 16, color: t.warm, fill: t.warm }} />
                  ))}
                </div>
                <p style={{ color: t.text, fontSize: "0.9rem", lineHeight: 1.7, flex: 1 }}>"{q.text}"</p>
                <div className="lp2-review-footer">
                  <div className="lp2-avatar" style={{ background: `${t.accent}20`, border: `1px solid ${t.accent}30` }}>
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
    <section id="cta" className="lp2-section--lg" style={{ background: t.bgAlt }}>
      <div className="lp2-container--sm">
        <FadeUp>
          <div className="lp2-badge" style={{ ...t.badge, fontSize: "0.78rem", fontWeight: 500, margin: "0 auto 32px", display: "inline-flex" }}>
            <span className="lp2-badge__dot" style={{ background: t.accent }} />
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

        <FadeUp delay={0.15}>
          <div className="lp2-cta-btns">
            <a href="/login"
              className="lp2-btn"
              style={{ background: t.accent, color: "#fff", borderRadius: t.r, boxShadow: `0 12px 32px ${t.accentGlow}`, justifyContent: "center" }}>
              Wejdź i zobacz za darmo
              <ArrowRight style={{ width: 20, height: 20 }} />
            </a>
            <a href="#how"
              className="lp2-btn lp2-btn--ghost"
              style={{ ...t.card, color: t.text, borderRadius: t.r, justifyContent: "center" }}>
              Sprawdź jak to działa
            </a>
          </div>
        </FadeUp>

        <FadeUp delay={0.25}>
          <div className="lp2-trust">
            {[
              { icon: ShieldCheck, label: "Bezpieczne dane" },
              { icon: Clock, label: "Start w 5 minut" },
              { icon: Check, label: "Bez zobowiązań" },
            ].map((item) => (
              <div key={item.label} className="lp2-trust-item">
                <item.icon style={{ width: 16, height: 16, color: t.accent }} />
                <span style={{ color: t.dim, fontSize: "0.82rem" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ t }: { t: typeof T.minimal }) {
  return (
    <footer className="lp2-footer" style={{ background: t.bg, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="lp2-footer__inner">
        <div className="lp2-footer__logo">
          <div className="lp2-footer__logo-icon" style={{ background: "#A83228" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.62rem" }}>LD</span>
          </div>
          <span style={{ color: t.dim, fontSize: "0.875rem" }}>LoftDesk · Ogarnij projekty bez chaosu</span>
        </div>
        <div className="lp2-footer__links">
          {["Prywatność", "Kontakt", "O nas"].map((l) => (
            <a key={l} href="#" className="lp2-footer__link" style={{ color: t.dimMore, fontSize: "0.8rem" }}>{l}</a>
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
