import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import PRCard from "../components/PRCard";
import { useAuth } from "../lib/auth";
import { Trophy, Loader2, Crown, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function PersonalRecords() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("best"); // best | history

  useEffect(() => {
    api.get("/personal-records")
      .then(({ data }) => setData(data))
      .catch(() => toast.error("Konnte PRs nicht laden"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout><div className="text-center py-12 text-[#00BFFF]"><Loader2 size={28} className="inline animate-spin mr-2" />Lade...</div></Layout>;

  const counts = data?.rarity_counts || { bronze: 0, silver: 0, gold: 0, mythic: 0 };
  const total = data?.total_prs || 0;
  const list = view === "best" ? (data?.best_per_exercise || []) : (data?.history || []);

  return (
    <Layout>
      <div className="mb-5">
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text flex items-center gap-2">
          <Trophy className="text-[#FFD700]" size={28} style={{filter: "drop-shadow(0 0 12px #FFD70088)"}} /> PR ZIMMER
        </h1>
        <p className="prose-af font-chakra text-sm mt-1">Deine Personal Records. Tap auf eine Card, teile sie.</p>
      </div>

      {/* Rarity summary */}
      <div className="grid grid-cols-4 gap-2 mb-5" data-testid="rarity-counts">
        <RarityChip label="Bronze" count={counts.bronze} color="#CD7F32" />
        <RarityChip label="Silber" count={counts.silver} color="#C0C0C0" />
        <RarityChip label="Gold"   count={counts.gold}   color="#FFD700" />
        <RarityChip label="Mythic" count={counts.mythic} color="#FF1744" />
      </div>

      {/* View toggle */}
      <div className="flex gap-1 mb-5 border-b border-[#1A1A24]">
        <TabBtn active={view === "best"} onClick={() => setView("best")} testid="tab-best">
          Beste pro Übung <span className="ml-1 text-[10px] text-gray-400">({data?.best_per_exercise?.length || 0})</span>
        </TabBtn>
        <TabBtn active={view === "history"} onClick={() => setView("history")} testid="tab-history">
          Verlauf <span className="ml-1 text-[10px] text-gray-400">({total})</span>
        </TabBtn>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 px-4" data-testid="pr-empty">
          <Trophy size={48} className="mx-auto text-gray-600 mb-3" />
          <div className="font-teko text-2xl chrome-text mb-1">Noch keine PRs</div>
          <p className="prose-af font-chakra text-sm">Absolviere ein Training und logge deine Sätze — wir tracken automatisch deine Bestleistungen.</p>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-6 mb-8" data-testid="pr-list">
          {list.map((pr) => (
            <PRCard key={pr.id} pr={pr} userName={user?.name} />
          ))}
        </div>
      )}
    </Layout>
  );
}

function RarityChip({ label, count, color }) {
  return (
    <div className="af-card p-2 text-center" data-testid={`rarity-${label.toLowerCase()}`}>
      <div className="font-teko text-2xl" style={{ color, filter: `drop-shadow(0 0 8px ${color}88)` }}>{count}</div>
      <div className="text-[9px] uppercase tracking-widest text-gray-500">{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`px-3 py-2 font-teko text-base tracking-wide transition border-b-2 ${
        active ? "border-[#FFD700] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}
