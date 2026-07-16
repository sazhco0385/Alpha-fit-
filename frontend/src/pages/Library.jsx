import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { getAllExercises, getExerciseTips, MUSCLE_GROUPS } from "../lib/exerciseTips";
import { ArrowLeft, BookOpen, Filter, Search, X, ChevronRight, Target } from "lucide-react";

export default function Library() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");

  const all = useMemo(() => getAllExercises(), []);
  const filtered = useMemo(() => {
    let list = all;
    if (activeGroup !== "all") list = list.filter((e) => e.group === activeGroup);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.de?.toLowerCase().includes(q) ||
          e.slug.includes(q.replace(/\s+/g, "-"))
      );
    }
    return list;
  }, [all, search, activeGroup]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      if (!map[e.group]) map[e.group] = [];
      map[e.group].push(e);
    });
    return map;
  }, [filtered]);

  return (
    <Layout>
      <div className="mb-5 sm:mb-6 flex items-center gap-3 flex-wrap">
        <BookOpen size={28} className="text-[#FF4500]" style={{ filter: "drop-shadow(0 0 12px rgba(255,69,0,0.6))" }} />
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text">ÜBUNGS-BIBLIOTHEK</h1>
        <span className="text-[10px] text-[#FF4500] border border-[#FF4500]/50 px-2 py-0.5 font-chakra uppercase tracking-widest">
          {all.length} ÜBUNGEN
        </span>
      </div>
      <p className="text-body font-chakra text-sm sm:text-base mb-5 leading-relaxed max-w-2xl">
        Alle Übungen aus dem AlphaFit-Universum. Mit Tipps zu Ausführung & Sicherheit.
      </p>

      {/* Search bar */}
      <div className="af-card p-3 sm:p-4 mb-4 sm:mb-5 flex items-center gap-3" data-testid="library-search-bar">
        <Search size={18} className="text-[#FF4500] flex-shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Übung suchen (z.B. Bankdrücken, Squat, Brust)..."
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-white font-chakra text-sm sm:text-base placeholder:text-gray-500"
          data-testid="library-search-input"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-gray-500 hover:text-white" aria-label="Suche löschen">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Group filter chips */}
      <div className="flex gap-2 overflow-x-auto mb-5 sm:mb-6 -mx-1 px-1 pb-2" data-testid="library-filters">
        <FilterChip active={activeGroup === "all"} onClick={() => setActiveGroup("all")} label="ALLE" testid="filter-all" />
        {MUSCLE_GROUPS.map((g) => (
          <FilterChip key={g.key} active={activeGroup === g.key} onClick={() => setActiveGroup(g.key)} label={g.label.toUpperCase()} testid={`filter-${g.key}`} />
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="af-card p-8 text-center" data-testid="library-empty">
          <Filter size={32} className="mx-auto text-gray-500 mb-3" />
          <div className="font-teko text-2xl text-gray-400">KEINE TREFFER</div>
          <p className="text-body-muted font-chakra text-sm mt-2">Versuche einen anderen Suchbegriff oder Filter.</p>
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8" data-testid="library-results">
          {MUSCLE_GROUPS.filter((g) => grouped[g.key]?.length).map((g) => (
            <section key={g.key}>
              <h2 className="font-teko text-2xl sm:text-3xl chrome-text mb-3 tracking-wide">{g.label.toUpperCase()}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {grouped[g.key].map((ex) => (
                  <ExerciseCard key={ex.slug} ex={ex} onClick={() => navigate(`/library/${ex.slug}`)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Layout>
  );
}

function FilterChip({ active, onClick, label, testid }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3 sm:px-4 py-1.5 text-xs font-chakra tracking-widest uppercase border transition whitespace-nowrap ${
        active
          ? "bg-[#FF4500]/10 border-[#FF4500] text-[#FF4500] glow-box"
          : "border-[#1A1A24] text-body-muted hover:border-[#FF4500]/40 hover:text-white"
      }`}
      data-testid={testid}
    >
      {label}
    </button>
  );
}

function ExerciseCard({ ex, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group af-card p-3 clip-corner-tl-br hover:glow-box transition text-left flex flex-col"
      data-testid={`library-card-${ex.slug}`}
    >
      <div className="relative w-full aspect-square overflow-hidden border border-[#1A1A24] mb-3">
        <img
          src={`/exercises/${ex.slug}.webp`}
          alt={ex.name}
          onError={(e) => {
            if (!e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = "/exercises/group-full.webp"; }
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%)" }} />
      </div>
      <div className="font-teko text-lg sm:text-xl text-white tracking-wide leading-tight">{ex.name}</div>
      <div className="text-[10px] text-[#FF4500] uppercase tracking-widest font-chakra mt-1 flex items-center gap-1">
        <Target size={10} /> {ex.de}
      </div>
      <div className="mt-2 text-[10px] text-gray-500 font-chakra flex items-center gap-1 group-hover:text-[#FF4500] transition">
        {ex.tips.length} TIPPS <ChevronRight size={10} />
      </div>
    </button>
  );
}

/** Single exercise detail page */
export function LibraryDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const ex = getExerciseTips(slug);

  if (!ex) {
    return (
      <Layout>
        <div className="af-card p-8 text-center">
          <div className="font-teko text-2xl text-gray-400">ÜBUNG NICHT GEFUNDEN</div>
          <button onClick={() => navigate("/library")} className="btn-outline mt-4 inline-flex items-center gap-2">
            <ArrowLeft size={14} /> ZURÜCK
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <button onClick={() => navigate("/library")} className="flex items-center gap-2 text-body-muted hover:text-[#FF4500] mb-4 font-chakra text-sm" data-testid="library-back">
        <ArrowLeft size={14} /> ZURÜCK ZUR BIBLIOTHEK
      </button>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6" data-testid="library-detail">
        {/* Image */}
        <div className="relative w-full aspect-square overflow-hidden af-card clip-corner-tl-br">
          <img
            src={`/exercises/${ex.slug || slug}.webp`}
            alt={ex.name}
            onError={(e) => {
              if (!e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = "/exercises/group-full.webp"; }
            }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.9) 100%)" }} />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="text-[10px] text-[#FF4500] uppercase tracking-widest font-chakra">{ex.de}</div>
            <h1 className="font-teko text-3xl sm:text-5xl chrome-text leading-tight">{ex.name.toUpperCase()}</h1>
          </div>
        </div>

        {/* Tips */}
        <div className="af-card p-5 sm:p-6 clip-corner-tl-br">
          <div className="flex items-center gap-2 mb-3">
            <Target size={18} className="text-[#FF4500]" />
            <h2 className="font-teko text-2xl chrome-text">AUSFÜHRUNGS-TIPPS</h2>
          </div>
          <ul className="space-y-3" data-testid="library-tips">
            {ex.tips.map((tip, i) => (
              <li key={i} className="flex gap-3 items-start" data-testid={`library-tip-${i}`}>
                <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-[#FF4500]/10 border border-[#FF4500]/40 text-[#FF4500] font-teko text-base">
                  {i + 1}
                </span>
                <p className="prose-af font-chakra flex-1">{tip}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Safety disclaimer */}
      <div className="af-card p-4 border-[#FF4500]/30 mb-4">
        <div className="text-[10px] text-[#FF4500] uppercase tracking-widest font-chakra mb-1">SICHERHEITS-HINWEIS</div>
        <p className="prose-af font-chakra text-sm">
          Beginne mit leichtem Gewicht & sauberer Technik. Schmerz {">"} Brennen — bei Schmerzen sofort abbrechen.
          Diese Tipps ersetzen keine professionelle Trainingsberatung.
        </p>
      </div>
    </Layout>
  );
}
