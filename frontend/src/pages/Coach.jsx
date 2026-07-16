import { useEffect, useState, useRef } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import CoachInsights from "../components/CoachInsights";
import { Send, Brain, Dumbbell, Apple, Flame, Target, Heart, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const QUICK_REPLIES = [
  { icon: Dumbbell, text: "Mein Plan ist zu schwer", testid: "qr-too-hard" },
  { icon: Dumbbell, text: "Mein Plan ist zu leicht", testid: "qr-too-easy" },
  { icon: Apple,    text: "Was esse ich für Muskelaufbau?", testid: "qr-nutrition" },
  { icon: Flame,    text: "Mehr Cardio einbauen",          testid: "qr-cardio" },
  { icon: Target,   text: "Wie kann ich Brust besser trainieren?", testid: "qr-chest" },
  { icon: Heart,    text: "Gib mir Motivation.",            testid: "qr-motivation" },
  { icon: RefreshCw, text: "Empfehlung für Rest-Day",       testid: "qr-rest" },
];

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
  }, [messages, loading]);

  const send = async (override) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
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
      <div className="mb-5 sm:mb-6">
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text tracking-wide">KI COACH</h1>
        <p className="text-body-muted font-chakra text-[10px] sm:text-sm uppercase tracking-widest">
          Angetrieben von GPT-5.5 · Alpha Protokoll
        </p>
      </div>

      {/* Proaktive Insights (collapsible auf Coach-Seite, damit Chat sichtbar ist) */}
      <CoachInsights collapsible />

      <div className="af-card flex flex-col h-[60vh] sm:h-[72vh] min-h-[440px] clip-corner-tl-br" data-testid="coach-chat">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 sm:py-12 font-chakra">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-60" style={{ background: "radial-gradient(circle, rgba(255,69,0,0.5), transparent 70%)" }} />
                <img
                  src="/alphafit-helmet.png?v=4"
                  alt="Alpha Coach"
                  className="relative w-20 h-20 mx-auto"
                  style={{ filter: "drop-shadow(0 0 14px rgba(255,69,0,0.7))" }}
                />
              </div>
              <div className="font-teko text-2xl sm:text-3xl chrome-text">ALPHA COACH BEREIT</div>
              <p className="text-body text-sm sm:text-base mt-2 max-w-md mx-auto leading-relaxed">
                Frag mich alles zu Training, Ernährung oder Motivation. Ich kenne deinen Plan & deine Fortschritte.
              </p>

              {/* Quick reply cards */}
              <div className="mt-6 grid sm:grid-cols-2 gap-2 sm:gap-3 max-w-xl mx-auto" data-testid="coach-quick-replies">
                {QUICK_REPLIES.map(({ icon: Icon, text, testid }) => (
                  <button
                    key={text}
                    onClick={() => send(text)}
                    className="group flex items-center gap-3 p-3 border border-[#1A1A24] hover:border-[#FF4500]/60 hover:bg-[#001a2a]/40 transition text-left"
                    data-testid={testid}
                  >
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center border border-[#FF4500]/30 group-hover:border-[#FF4500] transition" style={{ borderRadius: "8px" }}>
                      <Icon size={14} className="text-[#FF4500]" />
                    </div>
                    <span className="text-sm text-body font-chakra group-hover:text-white transition">{text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} text={m.text} index={i} />
          ))}

          {loading && <TypingBubble />}
          <div ref={endRef} />
        </div>

        {/* Quick replies as chips when chat is active */}
        {messages.length > 0 && !loading && (
          <div className="border-t border-[#1A1A24] px-3 sm:px-4 py-2 flex gap-2 overflow-x-auto scrollbar-thin" data-testid="coach-quick-chips">
            {QUICK_REPLIES.slice(0, 4).map(({ text, testid }) => (
              <button
                key={text}
                onClick={() => send(text)}
                className="flex-shrink-0 text-xs px-3 py-1.5 border border-[#FF4500]/30 hover:border-[#FF4500] hover:bg-[#001a2a]/40 transition text-[#FF4500] font-chakra whitespace-nowrap"
                data-testid={`chip-${testid}`}
              >
                {text}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-[#1A1A24] p-3 sm:p-4 flex gap-2 sm:gap-3 items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Nachricht an Alpha Coach..."
            className="af-input flex-1 min-w-0 text-sm sm:text-base"
            data-testid="coach-input"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="btn-primary flex items-center gap-1 sm:gap-2 text-sm flex-shrink-0"
            data-testid="coach-send-btn"
            aria-label="Senden"
          >
            <Send size={14} /> <span className="hidden sm:inline">SEND</span>
          </button>
        </div>
      </div>
    </Layout>
  );
}

function ChatMessage({ role, text, index }) {
  if (role === "user") {
    return (
      <div className="flex gap-2 sm:gap-3 justify-end" data-testid={`coach-msg-${index}`}>
        <div className="max-w-[82%] sm:max-w-[70%] coach-bubble-user font-chakra text-sm whitespace-pre-wrap break-words">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2 sm:gap-3 justify-start" data-testid={`coach-msg-${index}`}>
      <div className="relative w-8 h-8 flex-shrink-0">
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,69,0,0.5), transparent 70%)", filter: "blur(6px)" }} />
        <img
          src="/alphafit-helmet.png?v=4"
          alt="Alpha Coach"
          className="relative w-8 h-8 object-contain"
          style={{ filter: "drop-shadow(0 0 6px rgba(255,69,0,0.6))" }}
        />
      </div>
      <div className="max-w-[82%] sm:max-w-[70%] coach-bubble-ai font-chakra text-sm whitespace-pre-wrap break-words">
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-2 sm:gap-3 justify-start" data-testid="coach-typing">
      <div className="relative w-8 h-8 flex-shrink-0">
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,69,0,0.5), transparent 70%)", filter: "blur(6px)" }} />
        <img
          src="/alphafit-helmet.png?v=4"
          alt="Alpha Coach"
          className="relative w-8 h-8 object-contain"
          style={{ filter: "drop-shadow(0 0 6px rgba(255,69,0,0.6))" }}
        />
      </div>
      <div className="coach-bubble-ai flex items-center gap-2 min-w-[80px]">
        <span className="coach-typing-dot" />
        <span className="coach-typing-dot" />
        <span className="coach-typing-dot" />
      </div>
    </div>
  );
}
