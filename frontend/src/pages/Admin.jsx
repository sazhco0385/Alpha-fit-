import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { toast } from "sonner";
import { Trash2, Crown, Euro, Users, Calendar, TrendingUp, Loader2, Shield, X, Activity, Circle, Zap, UserPlus, CheckCircle2, ShoppingCart, Sparkles, Play } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [online, setOnline] = useState({ online: [], count: 0 });
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [premiumModal, setPremiumModal] = useState(null);
  const [premiumDays, setPremiumDays] = useState(30);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: m }, { data: o }, { data: a }] = await Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/members"),
      api.get("/admin/online"),
      api.get("/admin/activity?limit=50"),
    ]);
    setStats(s);
    setMembers(m.members);
    setOnline(o);
    setActivity(a.events);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Refresh online + activity every 15s
    const id = setInterval(async () => {
      try {
        const [{ data: o }, { data: a }] = await Promise.all([
          api.get("/admin/online"),
          api.get("/admin/activity?limit=50"),
        ]);
        setOnline(o);
        setActivity(a.events);
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, []);

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
        <StatBlock icon={Activity} label="Online jetzt" value={online.count} sub="letzte 5 Min" testid="stat-online" highlight={online.count > 0} />
        <StatBlock icon={Users} label="Mitglieder" value={stats.total_users} sub={`${stats.premium_users} Premium`} testid="stat-members" />
        <StatBlock icon={Euro} label="Heute Umsatz" value={`${(stats.revenue_today || 0).toFixed(2)} €`} sub={`${stats.revenue_today_count} Käufe`} testid="stat-revenue-today" />
        <StatBlock icon={Calendar} label="Monat Umsatz" value={`${(stats.revenue_month || 0).toFixed(2)} €`} sub={`${stats.revenue_month_count} Käufe`} testid="stat-revenue-month" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatBlock icon={TrendingUp} label="Gesamt Umsatz" value={`${(stats.revenue_total || 0).toFixed(2)} €`} sub={`${stats.revenue_total_count} Käufe insgesamt`} testid="stat-revenue-total" highlight />
        <OnlineList online={online} />
      </div>

      {/* Live Activity Feed */}
      <ActivityFeed events={activity} />

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
                  <td className="py-3 px-2 font-teko text-lg tracking-wide">
                    <span className="inline-flex items-center gap-2">
                      <Circle size={8} fill={m.is_online ? "#00FF7F" : "#404050"} className={m.is_online ? "text-[#00FF7F]" : "text-gray-600"} />
                      {m.name} {m.is_admin && <span className="text-[#FFD700] text-xs">★ADMIN</span>}
                    </span>
                  </td>
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

function ActivityFeed({ events }) {
  const config = {
    registered: { icon: UserPlus, color: "#00BFFF", text: (m) => `hat sich registriert` },
    onboarding_completed: { icon: CheckCircle2, color: "#00FF7F", text: (m) => `hat Onboarding abgeschlossen (${m.goal || ""})` },
    workout_started: { icon: Play, color: "#00E5FF", text: (m) => `trainiert gerade Tag ${m.day_index}` },
    workout_completed: { icon: Zap, color: "#FFD700", text: (m) => `hat Training Tag ${m.day_index} abgeschlossen (${m.sets || 0} Sätze)` },
    checkout_started: { icon: ShoppingCart, color: "#FF9800", text: (m) => `hat Checkout gestartet — ${m.plan} (${m.amount}€)` },
    payment_succeeded: { icon: Sparkles, color: "#FFD700", text: (m) => `🎉 PREMIUM GEKAUFT — ${m.plan} (${m.amount}€)` },
  };

  const timeAgo = (iso) => {
    if (!iso) return "";
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `vor ${diff}s`;
    if (diff < 3600) return `vor ${Math.floor(diff/60)}m`;
    if (diff < 86400) return `vor ${Math.floor(diff/3600)}h`;
    return `vor ${Math.floor(diff/86400)}d`;
  };

  return (
    <div className="af-card p-4 sm:p-6 clip-corner-tl-br mb-6 sm:mb-8" data-testid="activity-feed">
      <div className="flex items-center justify-between mb-4">
        <div className="font-teko text-xl sm:text-2xl chrome-text flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF] opacity-75 animate-ping"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00E5FF]"></span>
          </span>
          LIVE AKTIVITÄT
        </div>
        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra">Auto-Update 15s</span>
      </div>

      {events.length === 0 ? (
        <div className="text-gray-500 text-sm font-chakra py-6 text-center">Noch keine Aktivität.</div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {events.map((e) => {
            const cfg = config[e.action];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <div key={e.id} className="flex items-start gap-3 p-2 hover:bg-[#0A0A10] border-b border-[#1A1A24] transition" data-testid={`activity-${e.id}`}>
                <Icon size={16} style={{ color: cfg.color, filter: `drop-shadow(0 0 6px ${cfg.color}99)` }} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-chakra text-sm text-white">
                    <span className="font-bold text-[#00BFFF]">{e.user_name || "User"}</span>{" "}
                    <span className="text-gray-300">{cfg.text(e.metadata || {})}</span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 font-chakra whitespace-nowrap flex-shrink-0 mt-0.5">{timeAgo(e.created_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OnlineList({ online }) {  return (
    <div className="af-card p-4 clip-corner-tl-br" data-testid="online-list">
      <div className="flex items-center justify-between mb-3">
        <div className="font-teko text-xl chrome-text flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {online.count > 0 && <span className="absolute inline-flex h-full w-full rounded-full bg-[#00FF7F] opacity-75 animate-ping"></span>}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${online.count > 0 ? "bg-[#00FF7F]" : "bg-gray-600"}`}></span>
          </span>
          ONLINE JETZT
        </div>
        <span className="font-teko text-xl electric-text glow-text-soft" data-testid="online-count">{online.count}</span>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-2">
        {online.online.length === 0 ? (
          <div className="text-gray-500 text-xs font-chakra py-2">Keiner aktiv gerade.</div>
        ) : (
          online.online.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-sm font-chakra py-1.5 border-b border-[#1A1A24]" data-testid={`online-${u.id}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Circle size={8} fill="#00FF7F" className="text-[#00FF7F] flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-white truncate">{u.name} {u.is_premium && <Crown size={10} className="inline text-[#FFD700]" />}</div>
                  <div className="text-gray-500 text-xs truncate">{u.email}</div>
                </div>
              </div>
              <div className="text-[10px] text-gray-500 font-chakra whitespace-nowrap flex-shrink-0 ml-2">
                {u.minutes_ago === 0 ? "jetzt" : `vor ${u.minutes_ago}m`}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
