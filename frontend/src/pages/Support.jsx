import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { toast } from "sonner";
import { Mail, Send, MessageCircle, CheckCircle2, Clock, Loader2, AlertCircle } from "lucide-react";

const CATEGORIES = [
  { v: "general", l: "Allgemein" },
  { v: "billing", l: "Zahlung / Abo" },
  { v: "bug", l: "Bug / Fehler" },
  { v: "feature", l: "Feature-Wunsch" },
  { v: "account", l: "Account / Login" },
];

export default function Support() {
  const [form, setForm] = useState({ subject: "", message: "", category: "general" });
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [supportEmail, setSupportEmail] = useState("support@alpha-fit.fitness");

  const load = async () => {
    try {
      const { data } = await api.get("/support/my-tickets");
      setTickets(data.tickets || []);
      if (data.support_email) setSupportEmail(data.support_email);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error("Betreff und Nachricht erforderlich");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/support/ticket", form);
      toast.success("Support-Anfrage gesendet! Wir melden uns per Email.");
      setForm({ subject: "", message: "", category: "general" });
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Senden");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <MessageCircle size={28} className="text-[#00BFFF]" style={{ filter: "drop-shadow(0 0 12px rgba(0,191,255,0.6))" }} />
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text">SUPPORT</h1>
      </div>

      {/* Direct contact */}
      <div className="af-card p-4 sm:p-5 mb-6 clip-corner-tl-br" data-testid="support-direct-contact">
        <div className="flex items-start gap-3">
          <Mail size={20} className="text-[#00BFFF] mt-1 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-[#00BFFF] uppercase tracking-widest font-chakra">DIREKT-KONTAKT</div>
            <div className="font-teko text-xl chrome-text mt-1">Schreib uns eine Email</div>
            <a href={`mailto:${supportEmail}`} className="text-[#00E5FF] underline font-chakra text-sm break-all" data-testid="support-email-link">
              {supportEmail}
            </a>
            <p className="text-gray-500 text-xs font-chakra mt-2">
              Antwortzeit normalerweise innerhalb 24 Stunden.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="af-card p-4 sm:p-6 clip-corner-tl-br mb-6">
        <div className="font-teko text-2xl chrome-text mb-4">Anfrage senden</div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest font-chakra mb-2">Kategorie</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setForm({ ...form, category: c.v })}
                  className={`px-3 py-2 text-xs font-chakra uppercase tracking-widest transition border ${
                    form.category === c.v
                      ? "border-[#00BFFF] text-[#00BFFF] glow-box"
                      : "border-[#1A1A24] text-gray-400 hover:border-[#00BFFF]/40"
                  }`}
                  data-testid={`support-cat-${c.v}`}
                >
                  {c.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest font-chakra mb-2">Betreff</label>
            <input
              className="af-input"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              maxLength={200}
              placeholder="Kurz beschreiben..."
              required
              data-testid="support-subject"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest font-chakra mb-2">Nachricht</label>
            <textarea
              className="af-input min-h-[150px] resize-y"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              maxLength={5000}
              placeholder="Was können wir für dich tun?"
              required
              data-testid="support-message"
            />
            <div className="text-[10px] text-gray-500 font-chakra mt-1 text-right">{form.message.length}/5000</div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2" data-testid="support-submit-btn">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            ANFRAGE SENDEN
          </button>
        </form>
      </div>

      {/* My tickets */}
      {tickets.length > 0 && (
        <div className="af-card p-4 sm:p-6 clip-corner-tl-br">
          <div className="font-teko text-2xl chrome-text mb-4">Deine Anfragen ({tickets.length})</div>
          <div className="space-y-3">
            {tickets.map((t) => (
              <TicketItem key={t.id} ticket={t} />
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}

function TicketItem({ ticket }) {
  const statusConfig = {
    open: { icon: Clock, color: "#FF9800", label: "OFFEN" },
    in_progress: { icon: AlertCircle, color: "#00BFFF", label: "IN BEARBEITUNG" },
    resolved: { icon: CheckCircle2, color: "#00FF7F", label: "GELÖST" },
  };
  const s = statusConfig[ticket.status] || statusConfig.open;
  const SIcon = s.icon;
  return (
    <div className="bg-[#0A0A10] border border-[#1A1A24] p-3 sm:p-4" data-testid={`my-ticket-${ticket.id}`}>
      <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
        <div className="font-teko text-lg chrome-text break-words flex-1 min-w-0">{ticket.subject}</div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-chakra uppercase tracking-widest flex-shrink-0" style={{ color: s.color, borderColor: s.color, border: `1px solid ${s.color}` }}>
          <SIcon size={12} /> {s.label}
        </span>
      </div>
      <div className="text-xs text-gray-500 font-chakra mb-2">{ticket.category} · {ticket.created_at?.slice(0, 16).replace("T", " ")}</div>
      <div className="text-sm text-gray-300 font-chakra whitespace-pre-wrap">{ticket.message}</div>
      {ticket.admin_reply && (
        <div className="mt-3 pt-3 border-t border-[#1A1A24]">
          <div className="text-[10px] text-[#00BFFF] uppercase tracking-widest font-chakra mb-1">ANTWORT VOM SUPPORT</div>
          <div className="text-sm text-gray-200 font-chakra whitespace-pre-wrap">{ticket.admin_reply}</div>
        </div>
      )}
    </div>
  );
}
