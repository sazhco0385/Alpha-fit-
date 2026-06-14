import { useEffect, useState } from "react";
import { X, Share, Plus, Smartphone, Download } from "lucide-react";

const STORAGE_KEY = "af_a2hs_dismissed";

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && !window.MSStream;
}

function isAndroid() {
  if (typeof window === "undefined") return false;
  return /android/i.test(window.navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

export default function A2HSPrompt() {
  const [open, setOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Android: capture beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS or Android-without-prompt: show manual instructions after delay
    if (isIos() || isAndroid()) {
      const t = setTimeout(() => setOpen(true), 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
  };

  const triggerNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      dismiss();
    }
    setDeferredPrompt(null);
  };

  if (!open) return null;

  const ios = isIos();
  const android = isAndroid();

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur p-4" onClick={dismiss}>
      <div
        className="af-card w-full max-w-md p-6 clip-corner-tl-br relative tracing-border"
        onClick={(e) => e.stopPropagation()}
        data-testid="a2hs-prompt"
      >
        <button onClick={dismiss} className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-gray-500 hover:text-[#00BFFF]" data-testid="a2hs-close-btn" aria-label="Schliessen">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-14 h-14 hex-shield flex items-center justify-center pulse-glow" style={{ background: "linear-gradient(180deg, #00E5FF, #1E90FF)" }}>
            <div className="absolute inset-[2px] hex-shield bg-black flex items-center justify-center">
              <Smartphone size={22} className="text-[#00E5FF]" style={{ filter: "drop-shadow(0 0 8px rgba(0,229,255,0.9))" }} />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#00BFFF] uppercase tracking-[0.3em] font-chakra">PRO TIPP</div>
            <div className="font-teko text-3xl chrome-text leading-none">Als App installieren</div>
          </div>
        </div>

        <p className="text-gray-300 font-chakra text-sm leading-relaxed mb-4">
          Installiere <span className="text-[#00BFFF]">alpha-fit</span> auf deinem Handy —
          läuft im Fullscreen, ohne Browser-Adressleiste, wie eine echte App.
        </p>

        {deferredPrompt ? (
          <>
            <button onClick={triggerNativeInstall} className="btn-primary w-full flex items-center justify-center gap-2 mt-2" data-testid="a2hs-install-btn">
              <Download size={18} /> JETZT INSTALLIEREN
            </button>
            <p className="text-xs text-gray-500 font-chakra text-center mt-3">
              Du wirst gefragt ob du alpha-fit installieren möchtest.
            </p>
          </>
        ) : ios ? (
          <ol className="space-y-3 text-sm font-chakra text-gray-200">
            <li className="flex items-start gap-3" data-testid="a2hs-step-1">
              <span className="w-7 h-7 border border-[#00BFFF] text-[#00BFFF] font-teko text-base flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div>
                Tippe auf das <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0A0A10] border border-[#1A1A24] mx-1">
                  <Share size={14} className="text-[#00BFFF]" /> <span className="text-xs">Teilen</span>
                </span> Symbol unten in Safari
              </div>
            </li>
            <li className="flex items-start gap-3" data-testid="a2hs-step-2">
              <span className="w-7 h-7 border border-[#00BFFF] text-[#00BFFF] font-teko text-base flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div>
                Wähle <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0A0A10] border border-[#1A1A24] mx-1">
                  <Plus size={14} className="text-[#00BFFF]" /> <span className="text-xs">Zum Home-Bildschirm</span>
                </span>
              </div>
            </li>
            <li className="flex items-start gap-3" data-testid="a2hs-step-3">
              <span className="w-7 h-7 border border-[#00BFFF] text-[#00BFFF] font-teko text-base flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div>Bestätige mit <span className="text-[#00BFFF] font-bold">"Hinzufügen"</span> — fertig.</div>
            </li>
          </ol>
        ) : android ? (
          <ol className="space-y-3 text-sm font-chakra text-gray-200">
            <li className="flex items-start gap-3" data-testid="a2hs-step-1">
              <span className="w-7 h-7 border border-[#00BFFF] text-[#00BFFF] font-teko text-base flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div>Tippe oben rechts auf die <span className="text-[#00BFFF] font-bold">⋮ drei Punkte</span> in Chrome</div>
            </li>
            <li className="flex items-start gap-3" data-testid="a2hs-step-2">
              <span className="w-7 h-7 border border-[#00BFFF] text-[#00BFFF] font-teko text-base flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div>Wähle <span className="text-[#00BFFF] font-bold">"App installieren"</span> oder <span className="text-[#00BFFF] font-bold">"Zum Startbildschirm hinzufügen"</span></div>
            </li>
            <li className="flex items-start gap-3" data-testid="a2hs-step-3">
              <span className="w-7 h-7 border border-[#00BFFF] text-[#00BFFF] font-teko text-base flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div>Bestätige mit <span className="text-[#00BFFF] font-bold">"Installieren"</span> — fertig.</div>
            </li>
          </ol>
        ) : null}

        <button onClick={dismiss} className="btn-outline w-full mt-6" data-testid="a2hs-got-it-btn">
          ALLES KLAR
        </button>
        <button onClick={dismiss} className="block mx-auto mt-3 text-gray-500 hover:text-gray-300 text-xs font-chakra uppercase tracking-widest" data-testid="a2hs-dismiss-btn">
          Nicht mehr zeigen
        </button>
      </div>
    </div>
  );
}
