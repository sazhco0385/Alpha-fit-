import { useEffect, useState, useRef } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Send, Loader2, Brain, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export default function Coach() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api.get("/coach/chat/history").then(({ data }) => {
      const m = [];
      (data.messages || []).forEach((x) => {
        m.push({ role: "user", text: x.user_text });
        m.push({ role: "ai", text: x.ai_text });
      });
      setMessages(m);
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const { data } = await api.post("/coach/chat", { text });
      setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch (err) {
      toast.error("KI nicht erreichbar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-teko text-5xl chrome-text tracking-wide">KI COACH</h1>
        <p className="text-gray-500 font-chakra text-sm uppercase tracking-widest">Powered by GPT-5.2 · Alpha Protocol</p>
      </div>

      <div className="af-card flex flex-col h-[70vh] clip-corner-tl-br" data-testid="coach-chat">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12 font-chakra">
              <Brain size={48} className="mx-auto text-[#00BFFF] mb-4" style={{ filter: "drop-shadow(0 0 12px rgba(0,191,255,0.6))" }} />
              Frag deinen Alpha Coach alles.
              <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                {["Wie kann ich Brust besser trainieren?", "Was esse ich für Muskelaufbau?", "Gib mir Motivation."].map((q) => (
                  <button key={q} onClick={() => setInput(q)} className="text-xs px-3 py-1 border border-[#00BFFF]/30 hover:border-[#00BFFF] transition text-[#00BFFF] font-chakra" data-testid={`coach-suggestion-${q.slice(0,10)}`}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "ai" && (
                <div className="w-8 h-8 hex-shield flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(180deg, #00E5FF, #1E90FF)" }}>
                  <div className="absolute w-7 h-7 hex-shield bg-black flex items-center justify-center">
                    <Brain size={14} className="text-[#00BFFF]" />
                  </div>
                </div>
              )}
              <div className={`max-w-[75%] p-3 font-chakra text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "border border-[#00BFFF] glow-box bg-[#001a2a] text-white"
                  : "bg-[#0A0A10] border border-[#1A1A24] chrome-text"
              }`} data-testid={`coach-msg-${i}`}>
                {m.text}
              </div>
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-[#0A0A10] border border-[#1A1A24] flex items-center justify-center flex-shrink-0">
                  <UserIcon size={14} className="text-gray-400" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <Loader2 size={20} className="animate-spin text-[#00BFFF]" />
              <span className="text-gray-500 font-chakra text-sm">Alpha Coach denkt nach...</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-[#1A1A24] p-4 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Nachricht an Alpha Coach..."
            className="af-input flex-1"
            data-testid="coach-input"
          />
          <button onClick={send} disabled={loading || !input.trim()} className="btn-primary flex items-center gap-2" data-testid="coach-send-btn">
            <Send size={16} /> SEND
          </button>
        </div>
      </div>
    </Layout>
  );
}
