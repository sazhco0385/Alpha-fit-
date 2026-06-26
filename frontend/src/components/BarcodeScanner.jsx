import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Loader2, ScanLine, Keyboard } from "lucide-react";
import api from "../lib/api";
import { toast } from "sonner";

/**
 * BarcodeScanner — opens the device camera and detects EAN/UPC barcodes.
 * On detection: looks up Open Food Facts → calls onFound(product) with all macros.
 *
 * Falls back to a manual-input field when camera is unavailable.
 */
export default function BarcodeScanner({ onFound, onClose }) {
  const [mode, setMode] = useState("camera"); // "camera" | "manual"
  const [manualEan, setManualEan] = useState("");
  const [looking, setLooking] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const scannerRef = useRef(null);
  const containerId = "alpha-barcode-reader";

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const lookup = async (ean) => {
    setLooking(true);
    try {
      const { data } = await api.get(`/nutrition/barcode/${ean}`);
      toast.success(`Gefunden: ${data.food_name}`);
      onFound(data);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Produkt konnte nicht geladen werden";
      toast.error(msg);
      setLooking(false);
    }
  };

  // Start camera scanner
  useEffect(() => {
    if (mode !== "camera") return;
    let stopped = false;
    const start = async () => {
      try {
        const html5 = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = html5;
        await html5.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.4,
            disableFlip: true,
          },
          async (decodedText) => {
            if (stopped) return;
            stopped = true;
            try { await html5.stop(); } catch { /* ignore */ }
            await lookup(decodedText.trim());
          },
          () => { /* per-frame failure callback (silenced) */ }
        );
      } catch (e) {
        setCameraError(e?.message || "Kamera nicht verfügbar");
        setMode("manual");
      }
    };
    start();
    return () => {
      stopped = true;
      const s = scannerRef.current;
      if (s) {
        try {
          // Html5Qrcode.getState() === 2 means SCANNING; only then can we stop
          if (typeof s.getState === "function" && s.getState() === 2) {
            s.stop().catch(() => {}).finally(() => {
              try { s.clear(); } catch { /* ignore */ }
            });
          } else {
            try { s.clear(); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
    };
  }, [mode]);

  const submitManual = async (e) => {
    e?.preventDefault();
    const ean = manualEan.replace(/\D/g, "");
    if (ean.length < 6) {
      toast.error("Bitte mindestens 6 Ziffern eingeben");
      return;
    }
    await lookup(ean);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/95 backdrop-blur-md p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#03030A] border-t-2 sm:border border-[#00BFFF]/40 sm:border-[#1A1A24] p-5 sm:p-6 max-w-lg w-full h-full sm:h-auto overflow-y-auto sm:clip-corner-tl-br sm:my-4 rounded-t-2xl sm:rounded-none" data-testid="barcode-scanner-modal">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="min-w-0">
            <div className="text-[10px] text-[#00BFFF] uppercase tracking-widest font-chakra">BARCODE SCANNER</div>
            <div className="font-teko text-2xl sm:text-3xl chrome-text mt-1">Produkt scannen</div>
            <div className="text-xs text-gray-500 font-chakra mt-1">EAN / UPC · 2 Mio. Produkte aus Open Food Facts</div>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-gray-500 hover:text-[#00BFFF] flex-shrink-0" data-testid="barcode-close-btn">
            <X size={20} />
          </button>
        </div>

        {mode === "camera" && (
          <div className="relative" data-testid="barcode-camera-view">
            <div id={containerId} className="w-full bg-black overflow-hidden border border-[#1A1A24]" style={{ minHeight: 280 }} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-[260px] h-[160px] border-2 border-[#00BFFF] relative" style={{ boxShadow: "0 0 30px rgba(0,191,255,0.5)" }}>
                <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-[#00BFFF] animate-pulse" />
                <ScanLine size={20} className="absolute -top-7 left-1/2 -translate-x-1/2 text-[#00BFFF]" />
              </div>
            </div>
            {cameraError && (
              <div className="mt-2 text-xs text-red-400 font-chakra">{cameraError}</div>
            )}
            <div className="text-[11px] text-gray-500 font-chakra mt-3 text-center">
              Halte den Barcode in den blauen Rahmen
            </div>
          </div>
        )}

        {mode === "manual" && (
          <form onSubmit={submitManual} className="space-y-3" data-testid="barcode-manual-form">
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra">Barcode (manuell)</label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={manualEan}
              onChange={(e) => setManualEan(e.target.value)}
              placeholder="z.B. 3017620422003"
              className="af-input font-chakra text-center tracking-widest"
              style={{ fontSize: "18px", minHeight: 48 }}
              data-testid="barcode-manual-input"
            />
            <button
              type="submit"
              disabled={looking || manualEan.replace(/\D/g, "").length < 6}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="barcode-manual-submit"
            >
              {looking ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
              {looking ? "SUCHE..." : "PRODUKT NACHSCHLAGEN"}
            </button>
          </form>
        )}

        <div className="flex gap-2 mt-4">
          {mode === "camera" ? (
            <button
              type="button"
              onClick={() => setMode("manual")}
              className="btn-outline flex-1 flex items-center justify-center gap-2"
              data-testid="barcode-switch-manual"
            >
              <Keyboard size={14} /> MANUELL EINGEBEN
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setCameraError(""); setMode("camera"); }}
              className="btn-outline flex-1 flex items-center justify-center gap-2"
              data-testid="barcode-switch-camera"
            >
              <ScanLine size={14} /> KAMERA NUTZEN
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-outline flex-1">
            ABBRECHEN
          </button>
        </div>

        {looking && (
          <div className="mt-3 flex items-center justify-center gap-2 text-[#00BFFF] font-chakra text-sm" data-testid="barcode-looking">
            <Loader2 size={14} className="animate-spin" /> Suche in Open Food Facts…
          </div>
        )}
      </div>
    </div>
  );
}
