import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { toast } from "sonner";
import { Trash2, Crown, Euro, Users, Calendar, TrendingUp, Loader2, Shield, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [premiumModal, setPremiumModal] = useState(null);
  const [premiumDays, setPremiumDays] = useState(30);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: m }] = await Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/members"),
    ]);
    setStats(s);
    setMembers(m.members);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteMember = async (id, name) => {
    if (!window.confirm(`Mitglied "${name}" wirklich löschen?`)) return;
    try {
      await api.delete(`/admin/members/${id}`);
      toast.success("Gelöscht");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const unlockPremium = async () => {
    if (!premiumModal) return;
    try {
      await api.post("/admin/members/premium", { user_id: premiumModal.id, days: Number(premiumDays) });
      toast.success(`Premium für ${premiumDays} Tage aktiviert`);
      setPremiumModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const revokePremium = async (id) => {
    if (!window.confirm("Premium entziehen?")) return;
    try {
      await api.post("/admin/members/revoke-premium", { user_id: id });
      toast.success("Premium entzogen");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  if (loading) {
    return <Layout><div className="text-center py-12 text-[#00BFFF]"><Loader2 size={24} className="animate-spin mx-auto" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Shield size={28} className="text-[#00BFFF]" style={{ filter: "drop-shadow(0 0 12px rgba(0,191,255,0.6))" }} />
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text">ADMIN CONTROL</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatBlock icon={Euro} label="Heute Umsatz" value={`${(stats.revenue_today || 0).toFixed(2)} €`} sub={`${stats.revenue_today_count} Käufe`} testid="stat-revenue-today" />
        <StatBlock icon={Calendar} label="Monat Umsatz" value={`${(stats.revenue_month || 0).toFixed(2)} €`} sub={`${stats.revenue_month_count} Käufe`} testid="stat-revenue-month" />
        <StatBlock icon={TrendingUp} label="Gesamt Umsatz" value={`${(stats.revenue_total || 0).toFixed(2)} €`} sub={`${stats.revenue_total_count} Käufe`} testid="stat-revenue-total" highlight />
        <StatBlock icon={Users} label="Mitglieder" value={stats.total_users} sub={`${stats.premium_users} Premium`} testid="stat-members" />
      </div>

      {/* Daily revenue chart */}
      <div className="af-card p-6 mb-8 clip-corner-tl-br">
        <div className="font-teko text-2xl chrome-text mb-4">UMSATZ (letzte 30 Tage)</div>
        {(stats.daily_revenue || []).length === 0 ? (
          <div className="text-gray-500 font-chakra text-sm py-8 text-center">Noch keine Umsätze.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[...stats.daily_revenue].reverse()}>
              <CartesianGrid stroke="#1A1A24" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#606070" style={{ fontFamily: "Chakra Petch", fontSize: 11 }} />
              <YAxis stroke="#606070" style={{ fontFamily: "Chakra Petch", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#000", border: "1px solid #00BFFF", color: "#fff" }} />
              <Bar dataKey="total" fill="#00BFFF" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Members */}
      <div className="af-card p-4 sm:p-6 clip-corner-tl-br">
        <div className="font-teko text-xl sm:text-2xl chrome-text mb-4">MITGLIEDER ({members.length})</div>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-xs sm:text-sm font-chakra min-w-[600px]">
            <thead>
              <tr className="text-gray-500 uppercase tracking-widest text-xs border-b border-[#1A1A24]">
                <th className="text-left py-3 px-2">Name</th>
                <th className="text-left py-3 px-2">Email</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-left py-3 px-2 hidden md:table-cell">Erstellt</th>
                <th className="text-right py-3 px-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-[#1A1A24] hover:bg-[#0A0A10] transition" data-testid={`member-row-${m.id}`}>
                  <td className="py-3 px-2 font-teko text-lg tracking-wide">{m.name} {m.is_admin && <span className="text-[#FFD700] text-xs">★ADMIN</span>}</td>
                  <td className="py-3 px-2 text-gray-300">{m.email}</td>
                  <td className="py-3 px-2">
                    {m.is_premium ? (
                      <span className="inline-flex items-center gap-1 text-[#00BFFF] font-teko tracking-wider text-sm"><Crown size={12} /> PREMIUM</span>
                    ) : (
                      <span className="text-gray-600 text-xs font-teko tracking-widest">FREE</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-gray-500 text-xs hidden md:table-cell">{(m.created_at || "").slice(0, 10)}</td>
                  <td className="py-3 px-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setPremiumModal(m)} className="w-11 h-11 flex items-center justify-center text-[#00BFFF] hover:bg-[#00BFFF]/10 transition" title="Premium freischalten" data-testid={`grant-premium-${m.id}`}>
                        <Crown size={18} />
                      </button>
                      {m.is_premium && (
                        <button onClick={() => revokePremium(m.id)} className="w-11 h-11 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 transition" title="Premium entziehen" data-testid={`revoke-premium-${m.id}`}>
                          <X size={18} />
                        </button>
                      )}
                      {!m.is_admin && (
                        <button onClick={() => deleteMember(m.id, m.name)} className="w-11 h-11 flex items-center justify-center text-[#FF3B30] hover:bg-red-500/10 transition" title="Löschen" data-testid={`delete-member-${m.id}`}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Premium modal */}
      {premiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur p-4" onClick={() => setPremiumModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="af-card p-6 max-w-md w-full clip-corner-tl-br" data-testid="premium-modal">
            <div className="font-teko text-3xl chrome-text mb-2">PREMIUM FREISCHALTEN</div>
            <div className="text-gray-500 font-chakra text-sm mb-4">{premiumModal.name} · {premiumModal.email}</div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest font-chakra mb-2">Tage</label>
            <input type="number" value={premiumDays} onChange={(e) => setPremiumDays(e.target.value)} className="af-input" data-testid="premium-days-input" />
            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setPremiumModal(null)} className="btn-outline">ABBRECHEN</button>
              <button onClick={unlockPremium} className="btn-primary" data-testid="confirm-grant-premium">FREISCHALTEN</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function StatBlock({ icon: Icon, label, value, sub, highlight, testid }) {
  return (
    <div className={`af-card p-4 clip-corner-tl-br ${highlight ? "glow-box border-[#00BFFF]" : ""}`} data-testid={testid}>
      <Icon size={18} className="text-[#00BFFF]" />
      <div className="font-teko text-3xl chrome-text mt-2 tracking-wide">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-[0.25em] font-chakra mt-1">{label}</div>
      {sub && <div className="text-[10px] text-[#00BFFF] font-chakra mt-1">{sub}</div>}
    </div>
  );
}
