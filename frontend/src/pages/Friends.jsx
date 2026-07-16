import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Search, UserPlus, Users, Check, X, Loader2, Flame, Crown, Trash2, Swords, ChevronRight, Trophy } from "lucide-react";
import { toast } from "sonner";

export default function Friends() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("friends"); // friends | incoming | outgoing | search
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/friends/list");
      setData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/friends/search?q=${encodeURIComponent(q)}`);
        setSearchResults(data.results || []);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const setItemBusy = (key, v) => setBusy((b) => ({ ...b, [key]: v }));

  const sendRequest = async (uid, name) => {
    setItemBusy(`req-${uid}`, true);
    try {
      await api.post("/friends/request", { to_user_id: uid });
      toast.success(`Anfrage an ${name} gesendet`);
      // Update search result inline
      setSearchResults((rs) => rs.map((r) => r.id === uid ? { ...r, request_status: "outgoing_pending" } : r));
      load(); // refresh counts
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Anfrage fehlgeschlagen");
    } finally {
      setItemBusy(`req-${uid}`, false);
    }
  };

  const acceptRequest = async (reqId, name) => {
    setItemBusy(`acc-${reqId}`, true);
    try {
      await api.post("/friends/accept", { request_id: reqId });
      toast.success(`Du bist jetzt mit ${name} befreundet`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler");
    } finally {
      setItemBusy(`acc-${reqId}`, false);
    }
  };

  const declineRequest = async (reqId) => {
    setItemBusy(`dec-${reqId}`, true);
    try {
      await api.post("/friends/decline", { request_id: reqId });
      toast.success("Abgelehnt");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler");
    } finally {
      setItemBusy(`dec-${reqId}`, false);
    }
  };

  const cancelRequest = async (reqId) => {
    setItemBusy(`can-${reqId}`, true);
    try {
      await api.post("/friends/cancel", { request_id: reqId });
      toast.success("Anfrage zurückgezogen");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler");
    } finally {
      setItemBusy(`can-${reqId}`, false);
    }
  };

  const unfriend = async (uid, name) => {
    if (!window.confirm(`${name} wirklich entfreunden?`)) return;
    setItemBusy(`unf-${uid}`, true);
    try {
      await api.delete(`/friends/${uid}`);
      toast.success(`${name} entfreundet`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler");
    } finally {
      setItemBusy(`unf-${uid}`, false);
    }
  };

  if (loading) {
    return <Layout><div className="text-center py-12 text-[#00BFFF] font-teko text-2xl"><Loader2 size={32} className="inline animate-spin mr-2" /> Lade...</div></Layout>;
  }

  const counts = data?.counts || { friends: 0, incoming: 0, outgoing: 0 };

  return (
    <Layout>
      <div className="mb-5">
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text">FREUNDE</h1>
        <p className="prose-af font-chakra text-sm mt-1">Train zusammen. Tracke zusammen. Sieg zusammen.</p>
      </div>

      {/* Challenges + Leaderboard CTAs */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => navigate("/challenges")}
          className="af-card p-3 flex items-center gap-2 hover:border-[#00BFFF]/60 group transition text-left"
          data-testid="goto-challenges-cta"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#00BFFF]/30 to-[#1A1A24] flex items-center justify-center flex-shrink-0">
            <Swords size={18} className="text-[#00BFFF]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-teko text-base chrome-text leading-tight">CHALLENGES</div>
            <div className="text-[10px] text-gray-400 font-chakra leading-tight">Hetz die Crew</div>
          </div>
          <ChevronRight size={14} className="text-gray-500 group-hover:text-[#00BFFF] flex-shrink-0" />
        </button>
        <button
          onClick={() => navigate("/leaderboard")}
          className="af-card p-3 flex items-center gap-2 hover:border-[#00BFFF]/60 group transition text-left"
          data-testid="goto-leaderboard-cta"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FFD700]/30 to-[#1A1A24] flex items-center justify-center flex-shrink-0">
            <Trophy size={18} className="text-[#FFD700]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-teko text-base chrome-text leading-tight">RANGLISTE</div>
            <div className="text-[10px] text-gray-400 font-chakra leading-tight">Wer ist oben?</div>
          </div>
          <ChevronRight size={14} className="text-gray-500 group-hover:text-[#00BFFF] flex-shrink-0" />
        </button>
      </div>

      {/* Search bar */}
      <div className="af-card p-4 mb-5" data-testid="friends-search-card">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-[#00BFFF] flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setTab("search"); }}
            placeholder="Suche User per Name (min. 2 Zeichen)..."
            className="af-input flex-1 bg-transparent text-white"
            data-testid="friends-search-input"
          />
          {searching && <Loader2 size={16} className="animate-spin text-[#00BFFF]" />}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 mb-5 border-b border-[#1A1A24]" data-testid="friends-tabs">
        <TabBtn active={tab === "friends"} onClick={() => setTab("friends")} testid="tab-friends">
          <Users size={14} className="inline mr-1" /> Freunde
          <span className="ml-1 text-[10px] text-[#00BFFF]">({counts.friends})</span>
        </TabBtn>
        <TabBtn active={tab === "incoming"} onClick={() => setTab("incoming")} testid="tab-incoming">
          Anfragen
          {counts.incoming > 0 && <span className="ml-1 inline-block bg-[#00BFFF] text-black rounded-full px-1.5 text-[10px] font-bold">{counts.incoming}</span>}
        </TabBtn>
        <TabBtn active={tab === "outgoing"} onClick={() => setTab("outgoing")} testid="tab-outgoing">
          Gesendet
          {counts.outgoing > 0 && <span className="ml-1 text-[10px] text-gray-400">({counts.outgoing})</span>}
        </TabBtn>
        {query.trim().length >= 2 && (
          <TabBtn active={tab === "search"} onClick={() => setTab("search")} testid="tab-search">
            Suche
          </TabBtn>
        )}
      </div>

      {/* === SEARCH RESULTS === */}
      {tab === "search" && (
        <div className="space-y-2" data-testid="search-results">
          {searchResults.length === 0 && !searching && (
            <div className="text-center py-8 text-gray-500 font-chakra text-sm">
              {query.trim().length < 2 ? "Tippe mindestens 2 Zeichen ein" : "Niemand gefunden"}
            </div>
          )}
          {searchResults.map((r) => (
            <UserRow key={r.id} user={r} testid={`search-${r.id}`}>
              {r.request_status === "friend" ? (
                <span className="text-[#00BFFF] font-teko text-sm">FREUND</span>
              ) : r.request_status === "outgoing_pending" ? (
                <span className="text-gray-400 font-chakra text-xs">Gesendet</span>
              ) : r.request_status === "incoming_pending" ? (
                <span className="text-yellow-400 font-chakra text-xs">Anfrage eingegangen</span>
              ) : (
                <button
                  onClick={() => sendRequest(r.id, r.name)}
                  disabled={busy[`req-${r.id}`]}
                  className="btn-outline text-xs flex items-center gap-1.5 disabled:opacity-40"
                  data-testid={`add-${r.id}`}
                >
                  {busy[`req-${r.id}`] ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} ANFRAGE
                </button>
              )}
            </UserRow>
          ))}
        </div>
      )}

      {/* === FRIENDS LIST === */}
      {tab === "friends" && (
        <div className="space-y-2" data-testid="friends-list">
          {data?.friends?.length === 0 && (
            <div className="text-center py-12 px-4">
              <Users size={48} className="mx-auto text-gray-600 mb-3" />
              <div className="font-teko text-2xl chrome-text mb-1">Noch keine Freunde</div>
              <p className="prose-af font-chakra text-sm">Suche oben nach einem Namen und schick die erste Anfrage.</p>
            </div>
          )}
          {data?.friends?.map((f) => (
            <UserRow key={f.id} user={f} testid={`friend-${f.id}`}>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-teko text-lg electric-text">{f.workouts_30d}</div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest">30d Workouts</div>
                </div>
                <button
                  onClick={() => unfriend(f.id, f.name)}
                  disabled={busy[`unf-${f.id}`]}
                  className="text-red-400 hover:text-red-300 p-1 disabled:opacity-40"
                  data-testid={`unfriend-${f.id}`}
                  title="Entfreunden"
                >
                  {busy[`unf-${f.id}`] ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </UserRow>
          ))}
        </div>
      )}

      {/* === INCOMING REQUESTS === */}
      {tab === "incoming" && (
        <div className="space-y-2" data-testid="incoming-list">
          {data?.incoming_requests?.length === 0 && (
            <div className="text-center py-12 text-gray-500 font-chakra text-sm">Keine offenen Anfragen.</div>
          )}
          {data?.incoming_requests?.map((r) => (
            <UserRow
              key={r.id}
              user={{ id: r.from_user_id, name: r.from_user_name, is_premium: false }}
              testid={`incoming-${r.id}`}
            >
              <div className="flex gap-2">
                <button
                  onClick={() => acceptRequest(r.id, r.from_user_name)}
                  disabled={busy[`acc-${r.id}`]}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                  data-testid={`accept-${r.id}`}
                >
                  {busy[`acc-${r.id}`] ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} OK
                </button>
                <button
                  onClick={() => declineRequest(r.id)}
                  disabled={busy[`dec-${r.id}`]}
                  className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1 text-red-400 border-red-400/40"
                  data-testid={`decline-${r.id}`}
                >
                  {busy[`dec-${r.id}`] ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} NEIN
                </button>
              </div>
            </UserRow>
          ))}
        </div>
      )}

      {/* === OUTGOING REQUESTS === */}
      {tab === "outgoing" && (
        <div className="space-y-2" data-testid="outgoing-list">
          {data?.outgoing_requests?.length === 0 && (
            <div className="text-center py-12 text-gray-500 font-chakra text-sm">Du hast keine Anfragen versendet.</div>
          )}
          {data?.outgoing_requests?.map((r) => (
            <UserRow
              key={r.id}
              user={{ id: r.to_user_id, name: r.to_user_name, is_premium: false }}
              testid={`outgoing-${r.id}`}
            >
              <button
                onClick={() => cancelRequest(r.id)}
                disabled={busy[`can-${r.id}`]}
                className="btn-outline text-xs flex items-center gap-1 text-red-400 border-red-400/40"
                data-testid={`cancel-${r.id}`}
              >
                {busy[`can-${r.id}`] ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} ZURÜCKZIEHEN
              </button>
            </UserRow>
          ))}
        </div>
      )}
    </Layout>
  );
}

function TabBtn({ active, onClick, children, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`px-3 py-2 font-teko text-base tracking-wide transition border-b-2 ${
        active ? "border-[#00BFFF] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function UserRow({ user, testid, children }) {
  return (
    <div
      className="af-card p-3 flex items-center gap-3 hover:border-[#00BFFF]/40 transition"
      data-testid={testid}
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00BFFF]/30 to-[#1A1A24] flex items-center justify-center font-teko text-lg chrome-text flex-shrink-0">
        {(user.name || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-teko text-lg chrome-text truncate flex items-center gap-1.5">
          {user.name || "Unknown"}
          {user.is_premium && <Crown size={12} className="text-[#FFD700] flex-shrink-0" />}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
