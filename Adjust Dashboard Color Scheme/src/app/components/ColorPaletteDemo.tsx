import { Moon, Sun, Home, TrendingUp, Users, FileText, Bell, Settings, ChevronRight, ArrowUpRight, Check } from "lucide-react";

interface Props {
  dark: boolean;
  onToggleDark: () => void;
}

export function ColorPaletteDemo({ dark, onToggleDark }: Props) {
  return (
    <div className="min-h-screen bg-background">
      {/* TOP NAV */}
      <header className="bg-card border-b border-border px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive flex items-center justify-center">
            <span className="text-white text-sm" style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>LD</span>
          </div>
          <span className="text-foreground" style={{ fontWeight: 600, fontSize: "1.1rem", letterSpacing: "-0.01em" }}>LoftDesk</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm hidden md:block">Podgląd palety kolorów</span>
          <button
            onClick={onToggleDark}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="text-sm">{dark ? "Jasny" : "Ciemny"}</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">

        {/* HERO — kolorystyka psychologiczna */}
        <section>
          <h2 className="text-foreground mb-2" style={{ fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>Psychologia kolorów</h2>
          <h1 className="text-foreground mb-8" style={{ fontWeight: 700, fontSize: "1.75rem" }}>Paleta LoftDesk</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                name: "Leśna Zieleń",
                hex: "#1A5C32",
                var: "--primary",
                bg: "bg-primary",
                text: "text-primary-foreground",
                tag: "PRIMARY",
                desc: "Wzrost · Zaufanie · Dobrobyt",
                reason: "Psychologicznie zieleń buduje zaufanie i kojarzy się z inwestycją, naturą oraz rozwojem — idealna dla platformy nieruchomości.",
              },
              {
                name: "Ciepły Krem",
                hex: "#F5F0E8",
                var: "--background",
                bg: "bg-secondary",
                text: "text-secondary-foreground",
                tag: "BACKGROUND",
                desc: "Dom · Komfort · Przytulność",
                reason: "Krem redukuje zmęczenie oczu i natychmiast wywołuje skojarzenia z domem, bezpieczeństwem i ciepłem wnętrza.",
              },
              {
                name: "Bursztyn Loftowy",
                hex: "#B8742A",
                var: "--accent",
                bg: "bg-accent",
                text: "text-accent-foreground",
                tag: "ACCENT",
                desc: "Luksus · Ciepło · Premium",
                reason: "Barwa drzewna i złocista buduje skojarzenia z premium, nawiązuje do drewnianego wykończenia loftów i uzupełnia zieleń.",
              },
              {
                name: "Ceglana Czerwień",
                hex: "#A83228",
                var: "--destructive",
                bg: "bg-destructive",
                text: "text-destructive-foreground",
                tag: "BRAND / ALERT",
                desc: "Energia · Cegła · Tożsamość",
                reason: "Nawiązanie do ceglanych ścian loftów, używana jako kolor logo i ostrzeżeń — wyróżniający akcent pełen charakteru.",
              },
            ].map((c) => (
              <div key={c.name} className="rounded-xl overflow-hidden border border-border shadow-sm flex flex-col">
                <div className={`${c.bg} ${c.text} p-6 flex flex-col gap-1`} style={{ minHeight: 120 }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", opacity: 0.75 }}>{c.tag}</span>
                  <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{c.name}</span>
                  <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{c.hex}</span>
                </div>
                <div className="bg-card p-4 flex-1">
                  <p className="text-muted-foreground" style={{ fontSize: "0.78rem", lineHeight: 1.55 }}>
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{c.desc}</span>
                    <br />{c.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MOCK DASHBOARD */}
        <section>
          <h2 className="text-foreground mb-6" style={{ fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>Podgląd w kontekście UI</h2>

          <div className="flex rounded-xl overflow-hidden border border-border shadow-lg" style={{ minHeight: 520 }}>

            {/* SIDEBAR */}
            <aside className="bg-sidebar w-56 flex-shrink-0 flex flex-col border-r border-sidebar-border">
              <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border">
                <div className="w-8 h-8 rounded-lg bg-destructive flex items-center justify-center flex-shrink-0">
                  <span className="text-white" style={{ fontWeight: 700, fontSize: "0.7rem" }}>LD</span>
                </div>
                <span className="text-sidebar-foreground" style={{ fontWeight: 600, fontSize: "0.9rem" }}>LoftDesk</span>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1">
                {[
                  { icon: Home, label: "Tablica", active: true },
                  { icon: FileText, label: "Kosztorysy", active: false },
                  { icon: Users, label: "Klienci", active: false },
                  { icon: TrendingUp, label: "Raporty", active: false },
                  { icon: Bell, label: "Powiadomienia", active: false },
                ].map((item) => (
                  <button
                    key={item.label}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      item.active
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span style={{ fontSize: "0.875rem", fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="px-3 py-4 border-t border-sidebar-border">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
                  <Settings className="w-4 h-4" />
                  <span style={{ fontSize: "0.875rem" }}>Ustawienia</span>
                </button>
              </div>
            </aside>

            {/* MAIN */}
            <main className="flex-1 bg-background overflow-auto">
              {/* Hero Banner */}
              <div className="bg-accent p-8 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #1A5C32 0%, #2D7A48 100%)" }}>
                <div>
                  <p className="text-white/70" style={{ fontSize: "0.8rem", marginBottom: 4 }}>Witaj z powrotem</p>
                  <h2 className="text-white" style={{ fontWeight: 700, fontSize: "1.35rem" }}>Dzień dobry, Tomasz 👋</h2>
                  <p className="text-white/80 mt-1" style={{ fontSize: "0.85rem" }}>Masz 3 nowe zapytania ofertowe</p>
                </div>
                <button className="px-5 py-2.5 rounded-lg bg-white text-primary hover:bg-secondary transition-colors" style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                  Sprawdź kosztorysy
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* STATS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Projekty aktywne", value: "24", change: "+3", up: true },
                    { label: "Klienci łącznie", value: "138", change: "+12", up: true },
                    { label: "Przychód / mies.", value: "42 800 zł", change: "+8%", up: true },
                    { label: "Otwarte sprawy", value: "7", change: "-2", up: false },
                  ].map((s) => (
                    <div key={s.label} className="bg-card rounded-xl p-4 border border-border">
                      <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{s.label}</p>
                      <p className="text-foreground mt-1" style={{ fontWeight: 700, fontSize: "1.25rem" }}>{s.value}</p>
                      <p className={`mt-1 flex items-center gap-1 ${s.up ? "text-primary" : "text-destructive"}`} style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                        <ArrowUpRight className="w-3 h-3" style={{ transform: s.up ? "" : "rotate(90deg)" }} />
                        {s.change} vs poprzedni miesiąc
                      </p>
                    </div>
                  ))}
                </div>

                {/* TWO PANELS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Recent */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h3 className="text-foreground mb-4" style={{ fontWeight: 600, fontSize: "0.95rem" }}>Ostatnie projekty</h3>
                    <div className="space-y-3">
                      {[
                        { name: "Loft Mokotów 12a", status: "W toku", color: "bg-primary" },
                        { name: "Apartament Wola", status: "Oferta", color: "bg-accent" },
                        { name: "Biuro Śródmieście", status: "Gotowy", color: "bg-chart-3" },
                      ].map((p) => (
                        <div key={p.name} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                          <div className={`w-2 h-2 rounded-full ${p.color}`} />
                          <span className="text-foreground flex-1" style={{ fontSize: "0.875rem" }}>{p.name}</span>
                          <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{p.status}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="bg-card rounded-xl border border-border p-5 flex flex-col justify-between">
                    <div>
                      <h3 className="text-foreground mb-2" style={{ fontWeight: 600, fontSize: "0.95rem" }}>Nowy kosztorys</h3>
                      <p className="text-muted-foreground" style={{ fontSize: "0.83rem", lineHeight: 1.5 }}>Stwórz szczegółowy kosztorys dla klienta w kilka minut dzięki naszym szablonom.</p>
                      <ul className="mt-3 space-y-1.5">
                        {["Szablony dla każdego projektu", "Automatyczna wycena materiałów", "Eksport do PDF"].map((f) => (
                          <li key={f} className="flex items-center gap-2 text-foreground" style={{ fontSize: "0.8rem" }}>
                            <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex gap-3 mt-5">
                      <button className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity" style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                        Utwórz kosztorys
                      </button>
                      <button className="flex-1 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors" style={{ fontSize: "0.85rem" }}>
                        Przeglądaj szablony
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </section>

        {/* TOKENY */}
        <section>
          <h2 className="text-foreground mb-6" style={{ fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>Wszystkie tokeny kolorów</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "background", bg: "bg-background", border: true },
              { label: "foreground", bg: "bg-foreground" },
              { label: "card", bg: "bg-card", border: true },
              { label: "primary", bg: "bg-primary" },
              { label: "primary-fg", bg: "bg-primary-foreground", border: true },
              { label: "secondary", bg: "bg-secondary", border: true },
              { label: "muted", bg: "bg-muted", border: true },
              { label: "muted-fg", bg: "bg-muted-foreground" },
              { label: "accent", bg: "bg-accent" },
              { label: "destructive", bg: "bg-destructive" },
              { label: "sidebar", bg: "bg-sidebar", border: true },
              { label: "sidebar-accent", bg: "bg-sidebar-accent", border: true },
              { label: "chart-1", bg: "bg-chart-1" },
              { label: "chart-2", bg: "bg-chart-2" },
              { label: "chart-3", bg: "bg-chart-3" },
              { label: "chart-4", bg: "bg-chart-4" },
              { label: "chart-5", bg: "bg-chart-5" },
              { label: "border", bg: "bg-border", border: true },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 ${t.bg} ${t.border ? "border border-border" : ""}`} />
                <span className="text-muted-foreground" style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{t.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* UZASADNIENIE */}
        <section className="bg-card rounded-xl border border-border p-8">
          <h2 className="text-foreground mb-5" style={{ fontWeight: 700, fontSize: "1.1rem" }}>Uzasadnienie psychologiczne palety</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "🌿",
                title: "Zaufanie przez Zieleń",
                desc: "Leśna zieleń (#1A5C32) to kolor kojarzy się z naturą, wzrostem i finansami. Badania pokazują, że zieleń buduje zaufanie i poczucie stabilności — kluczowe dla platformy zarządzającej nieruchomościami.",
              },
              {
                icon: "🏠",
                title: "Ciepło przez Krem",
                desc: "Kremowe tło (#F5F0E8) wywołuje podświadome skojarzenia z domem, ciepłem i przyjęciem. Zmniejsza zmęczenie wzroku przy długiej pracy i nadaje interfejsowi organiczny, nieagresywny charakter.",
              },
              {
                icon: "✨",
                title: "Premium przez Bursztyn",
                desc: "Bursztynowo-karmelowy akcent (#B8742A) nawiązuje do naturalnego drewna loftowych wnętrz. W psychologii kolorów złoto-brąz sygnalizuje prestiż, solidność i jakość rzemiosła.",
              },
            ].map((c) => (
              <div key={c.title}>
                <div className="text-2xl mb-3">{c.icon}</div>
                <h3 className="text-foreground mb-2" style={{ fontWeight: 600, fontSize: "0.95rem" }}>{c.title}</h3>
                <p className="text-muted-foreground" style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
