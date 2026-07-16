import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { toast } from "sonner";
import { Trash2, Crown, Euro, Users, Calendar, TrendingUp, Loader2, Shield, X, Activity, Circle, Zap, UserPlus, CheckCircle2, ShoppingCart, Sparkles, Play, MessageCircle, Send, Inbox, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [online, setOnline] = useState({ online: [], count: 0 });
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [premiumModal, setPremiumModal] = useState(null);
  const [premiumDays, setPremiumDays] = useState(30);
  const [tickets, setTickets] = useState({ tickets: [], open_count: 0 });
  const [replyModal, setReplyModal] = useState(null);
  const [replyText, setReplyText] = useState("");

  const [funnel, setFunnel] = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: m }, { data: o }, { data: a }, { data: t }, { data: f }] = await Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/members"),
      api.get("/admin/online"),
      api.get("/admin/activity?limit=50"),
      api.get("/admin/tickets"),
      api.get("/admin/funnel/trial-reminder"),
    ]);
    setStats(s);
    setMembers(m.members);
    setOnline(o);
    setActivity(a.events);
    setTickets(t);
    setFunnel(f);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Refresh online + activity + tickets every 15s
    const id = setInterval(async () => {
      try {
        const [{ data: o }, { data: a }, { data: t }] = await Promise.all([
          api.get("/admin/online"),
          api.get("/admin/activity?limit=50"),
          api.get("/admin/tickets"),
        ]);
        setOnline(o);
        setActivity(a.events);
        setTickets(t);
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const sendReply = async () => {
    if (!replyModal || !replyText.trim()) return;
    try {
      await api.post(`/admin/tickets/${replyModal.id}/respond`, { reply: replyText, status: "resolved" });
      toast.success("Antwort gespeichert & Ticket als gelöst markiert");
      setReplyModal(null);
      setReplyText("");
      load();
    } catch {
      toast.error("Fehler");
    }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm("Ticket löschen?")) return;
    await api.delete(`/admin/tickets/${id}`);
    toast.success("Gelöscht");
    load();
  };

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
    return <Layout><div className="text-center py-12 text-[#FF4500]"><Loader2 size={24} className="animate-spin mx-auto" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Shield size={28} className="text-[#FF4500]" style={{ filter: "drop-shadow(0 0 12px rgba(255,69,0,0.6))" }} />
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

      {/* Support Tickets */}
      <TicketsSection tickets={tickets} onReply={(t) => { setReplyModal(t); setReplyText(t.admin_reply || ""); }} onDelete={deleteTicket} />

      {/* Trial-Reminder Conversion Funnel */}
      {funnel && <TrialReminderFunnel funnel={funnel} />}

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
              <Tooltip contentStyle={{ background: "#000", border: "1px solid #FF4500", color: "#fff" }} />
              <Bar dataKey="total" fill="#FF4500" />
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
                      <span className="inline-flex items-center gap-1 text-[#FF4500] font-teko tracking-wider text-sm"><Crown size={12} /> PREMIUM</span>
                    ) : (
                      <span className="text-gray-600 text-xs font-teko tracking-widest">FREE</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-gray-500 text-xs hidden md:table-cell">{(m.created_at || "").slice(0, 10)}</td>
                  <td className="py-3 px-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setPremiumModal(m)} className="w-11 h-11 flex items-center justify-center text-[#FF4500] hover:bg-[#FF4500]/10 transition" title="Premium freischalten" data-testid={`grant-premium-${m.id}`}>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setPremiumModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-[#03030A] border border-[#FF4500]/40 p-6 max-w-md w-full clip-corner-tl-br" data-testid="premium-modal">
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

      {/* Reply Modal */}
      {replyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setReplyModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-[#03030A] border border-[#FF4500]/40 p-6 max-w-lg w-full clip-corner-tl-br" data-testid="reply-modal">
            <div className="font-teko text-3xl chrome-text mb-1">ANTWORT AN USER</div>
            <div className="text-xs text-gray-500 font-chakra mb-3">{replyModal.user_name} · {replyModal.user_email}</div>
            <div className="bg-[#0A0A10] border border-[#1A1A24] p-3 mb-4 max-h-32 overflow-y-auto">
              <div className="text-[10px] text-[#FF4500] uppercase tracking-widest font-chakra mb-1">ANFRAGE: {replyModal.subject}</div>
              <div className="text-sm text-gray-300 font-chakra whitespace-pre-wrap">{replyModal.message}</div>
            </div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest font-chakra mb-2">Deine Antwort</label>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="af-input min-h-[140px] resize-y"
              placeholder="Antwort an den User..."
              data-testid="reply-textarea"
            />
            <div className="flex gap-2 justify-end mt-4 flex-wrap">
              <button onClick={() => setReplyModal(null)} className="btn-outline">ABBRECHEN</button>
              <a href={`mailto:${replyModal.user_email}?subject=Re: ${encodeURIComponent(replyModal.subject)}&body=${encodeURIComponent(replyText)}`} className="btn-outline" data-testid="reply-via-email">PER EMAIL</a>
              <button onClick={sendReply} className="btn-primary" data-testid="reply-save-btn">SPEICHERN & LÖSEN</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function TrialReminderFunnel({ funnel }) {
  const stages = [
    { label: "E-Mails", sub: `${funnel.emails_sent_48h} × 48h · ${funnel.emails_sent_24h} × 24h`, value: funnel.emails_sent, rate: null, color: "#A78BFA" },
    { label: "Klicks", sub: `${funnel.clicks_unique} unique User`, value: funnel.clicks_total, rate: funnel.rate_click_through, color: "#FF4500" },
    { label: "Checkouts", sub: "Stripe gestartet", value: funnel.checkouts_started, rate: funnel.rate_checkout, color: "#FFD700" },
    { label: "Käufe", sub: `${funnel.revenue.toFixed(2)} € Umsatz`, value: funnel.purchases, rate: funnel.rate_purchase, color: "#00FF7F" },
  ];
  return (
    <div className="af-card p-4 sm:p-6 clip-corner-tl-br mb-6 sm:mb-8" data-testid="admin-trial-funnel">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="font-teko text-xl sm:text-2xl chrome-text flex items-center gap-2">
          <Send size={18} className="text-[#A78BFA]" />
          TRIAL-REMINDER FUNNEL
        </div>
        <div className="font-teko text-base sm:text-lg gold-chrome tracking-wider" data-testid="funnel-overall-rate">
          {funnel.rate_overall}% E2E
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {stages.map((s, i) => (
          <div key={s.label} className="relative bg-[#0A0A10] border border-[#1A1A24] p-3 sm:p-4" data-testid={`funnel-stage-${s.label.toLowerCase()}`}>
            <div className="text-[10px] uppercase tracking-[0.25em] font-chakra text-gray-500">Schritt {i + 1}</div>
            <div className="font-teko text-3xl sm:text-4xl mt-1" style={{ color: s.color, textShadow: `0 0 14px ${s.color}55` }}>
              {s.value.toLocaleString("de-DE")}
            </div>
            <div className="font-teko text-sm tracking-wider text-gray-300">{s.label}</div>
            <div className="text-[11px] text-gray-500 font-chakra mt-1 truncate">{s.sub}</div>
            {s.rate !== null && (
              <div className="absolute top-2 right-2 text-[10px] font-chakra px-1.5 py-0.5 border" style={{ borderColor: `${s.color}66`, color: s.color }}>
                {s.rate}%
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-gray-500 font-chakra">
        Klick-Rate {funnel.rate_click_through}% · Checkout-Rate {funnel.rate_checkout}% · Kauf-Rate {funnel.rate_purchase}% · Gesamt-Conversion {funnel.rate_overall}%
      </div>
    </div>
  );
}


function TicketsSection({ tickets, onReply, onDelete }) {
  const statusConfig = {
    open: { color: "#FF9800", label: "OFFEN" },
    in_progress: { color: "#FF4500", label: "IN BEARBEITUNG" },
    resolved: { color: "#00FF7F", label: "GELÖST" },
  };
  const catLabel = { general: "Allgemein", billing: "Zahlung", bug: "Bug", feature: "Feature", account: "Account" };
  return (
    <div className="af-card p-4 sm:p-6 clip-corner-tl-br mb-6 sm:mb-8" data-testid="admin-tickets">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="font-teko text-xl sm:text-2xl chrome-text flex items-center gap-2">
          <Inbox size={20} className="text-[#FF4500]" />
          SUPPORT-ANFRAGEN
        </div>
        {tickets.open_count > 0 && (
          <span className="font-teko text-base px-3 py-1 border border-[#FF9800] text-[#FF9800] tracking-widest" data-testid="open-tickets-count">
            {tickets.open_count} OFFEN
          </span>
        )}
      </div>
      {tickets.tickets.length === 0 ? (
        <div className="text-gray-500 text-sm font-chakra py-6 text-center">Noch keine Anfragen.</div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {tickets.tickets.map((t) => {
            const s = statusConfig[t.status] || statusConfig.open;
            return (
              <div key={t.id} className="bg-[#0A0A10] border border-[#1A1A24] p-3 sm:p-4 hover:border-[#FF4500]/40 transition" data-testid={`ticket-${t.id}`}>
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-teko text-lg chrome-text break-words">{t.subject}</div>
                    <div className="text-xs text-gray-500 font-chakra mt-1">
                      <span className="text-[#FF4500]">{t.user_name}</span> · {t.user_email} · <span className="text-gray-400">{catLabel[t.category] || t.category}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-chakra uppercase tracking-widest flex-shrink-0" style={{ color: s.color, border: `1px solid ${s.color}` }}>
                    <Clock size={10} /> {s.label}
                  </span>
                </div>
                <div className="text-sm text-gray-300 font-chakra whitespace-pre-wrap mb-2">{t.message}</div>
                <div className="text-[10px] text-gray-500 font-chakra mb-2">{t.created_at?.slice(0, 16).replace("T", " ")}</div>
                {t.admin_reply && (
                  <div className="mt-2 pt-2 border-t border-[#1A1A24]">
                    <div className="text-[10px] text-[#00FF7F] uppercase tracking-widest font-chakra mb-1">DEINE ANTWORT</div>
                    <div className="text-sm text-gray-200 font-chakra whitespace-pre-wrap">{t.admin_reply}</div>
                  </div>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => onReply(t)} className="btn-outline text-xs flex items-center gap-1.5" data-testid={`ticket-reply-${t.id}`}>
                    <Send size={12} /> ANTWORTEN
                  </button>
                  <button onClick={() => onDelete(t.id)} className="btn-outline text-xs flex items-center gap-1.5 border-red-500/50 text-red-400" data-testid={`ticket-delete-${t.id}`}>
                    <Trash2 size={12} /> LÖSCHEN
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBlock({ icon: Icon, label, value, sub, highlight, testid }) {
  return (
    <div className={`af-card p-4 clip-corner-tl-br ${highlight ? "glow-box border-[#FF4500]" : ""}`} data-testid={testid}>
      <Icon size={18} className="text-[#FF4500]" />
      <div className="font-teko text-3xl chrome-text mt-2 tracking-wide">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-[0.25em] font-chakra mt-1">{label}</div>
      {sub && <div className="text-[10px] text-[#FF4500] font-chakra mt-1">{sub}</div>}
    </div>
  );
}

function ActivityFeed({ events }) {
  const config = {
    registered: { icon: UserPlus, color: "#FF4500", text: (m) => `hat sich registriert` },
    onboarding_completed: { icon: CheckCircle2, color: "#00FF7F", text: (m) => `hat Onboarding abgeschlossen (${m.goal || ""})` },
    workout_started: { icon: Play, color: "#FF5A1F", text: (m) => `trainiert gerade Tag ${m.day_index}` },
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
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF5A1F] opacity-75 animate-ping"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5A1F]"></span>
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
                    <span className="font-bold text-[#FF4500]">{e.user_name || "User"}</span>{" "}
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
