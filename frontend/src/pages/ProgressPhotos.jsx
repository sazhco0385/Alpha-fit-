import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Layout from "../components/Layout";
import PhotoCapture from "../components/PhotoCapture";
import api from "../lib/api";
import { Camera, Trash2, ChevronLeft, ChevronRight, X, Share2, Loader2, Sparkles, Download } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";

const POSE_LABEL = { front: "Front", side: "Seite", back: "Rücken", free: "Frei" };

export default function ProgressPhotos() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [compare, setCompare] = useState(null);
  const [poseFilter, setPoseFilter] = useState(""); // empty = all
  const [showCompareModal, setShowCompareModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/progress-photos${poseFilter ? `?pose=${poseFilter}` : ""}`);
      setPhotos(data.photos || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [poseFilter]); // eslint-disable-line

  const onSaved = (p) => {
    setCaptureOpen(false);
    setPhotos((prev) => [p, ...prev]);
  };

  const deletePhoto = async (id) => {
    if (!window.confirm("Foto wirklich löschen?")) return;
    await api.delete(`/progress-photos/${id}`);
    setPhotos((prev) => prev.filter((x) => x.id !== id));
    if (lightbox?.id === id) setLightbox(null);
    toast.success("Foto gelöscht");
  };

  const openCompare = async () => {
    try {
      const { data } = await api.get(`/progress-photos/compare${poseFilter ? `?pose=${poseFilter}` : ""}`);
      if (!data.has_comparison) {
        toast.error("Mindestens 2 Fotos nötig für Vergleich");
        return;
      }
      setCompare({ first: data.first, last: data.last });
      setShowCompareModal(true);
    } catch (e) {
      toast.error("Vergleich konnte nicht geladen werden");
    }
  };

  return (
    <Layout>
      <div className="mb-5 sm:mb-6">
        <h1 className="font-teko text-4xl sm:text-5xl chrome-text" data-testid="progress-photos-title">PROGRESS FOTOS</h1>
        <p className="text-xs sm:text-sm text-gray-400 font-chakra mt-1">
          Mit Gym-Light-Filter — wie im Studio fotografiert.
        </p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => setCaptureOpen(true)}
          className="af-card p-5 clip-corner-tl-br hover:glow-box transition tracing-border text-center"
          data-testid="capture-photo-btn"
        >
          <Camera size={32} className="mx-auto text-[#FF4500]" style={{ filter: "drop-shadow(0 0 8px rgba(255,69,0,0.6))" }} />
          <div className="font-teko text-lg sm:text-xl mt-2 chrome-text">FOTO MACHEN</div>
          <div className="text-[10px] text-gray-500 font-chakra mt-1">Studio-Licht aktiv</div>
        </button>
        <button
          onClick={openCompare}
          disabled={photos.length < 2}
          className="af-card p-5 clip-corner-tl-br hover:glow-box transition text-center disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="compare-btn"
        >
          <Sparkles size={32} className="mx-auto text-[#FFD700]" style={{ filter: "drop-shadow(0 0 8px rgba(255,215,0,0.5))" }} />
          <div className="font-teko text-lg sm:text-xl mt-2 chrome-text">VORHER / NACHHER</div>
          <div className="text-[10px] text-gray-500 font-chakra mt-1">Schiebe-Slider</div>
        </button>
      </div>

      {/* Pose filter */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto -mx-1 px-1" data-testid="pose-filter-bar">
        {[{ v: "", l: "Alle" }, ...Object.entries(POSE_LABEL).map(([v, l]) => ({ v, l }))].map((p) => (
          <button
            key={p.v || "all"}
            onClick={() => setPoseFilter(p.v)}
            className={`px-3 py-1.5 text-[11px] font-chakra uppercase tracking-widest border whitespace-nowrap transition ${
              poseFilter === p.v ? "border-[#FF4500] text-[#FF4500] bg-[#FF4500]/10" : "border-[#1A1A24] text-gray-400"
            }`}
            data-testid={`filter-pose-${p.v || "all"}`}
          >
            {p.l}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[#FF4500]" /></div>
      ) : photos.length === 0 ? (
        <div className="af-card p-8 text-center" data-testid="photos-empty">
          <Camera size={36} className="mx-auto text-gray-600 mb-3" />
          <div className="font-teko text-2xl chrome-text">NOCH KEINE FOTOS</div>
          <div className="text-xs text-gray-500 font-chakra mt-1">
            Mach dein erstes Foto — Tag 0 deiner Transformation.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3" data-testid="photos-grid">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setLightbox(p)}
              className="relative aspect-[3/4] bg-[#0A0A10] border border-[#1A1A24] hover:border-[#FF4500]/60 transition overflow-hidden group"
              data-testid={`photo-${p.id}`}
            >
              <img src={p.image_base64.startsWith("data:") ? p.image_base64 : `data:image/jpeg;base64,${p.image_base64}`} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/85 to-transparent">
                <div className="text-[9px] font-chakra text-[#FF4500] uppercase tracking-widest">
                  {POSE_LABEL[p.pose] || p.pose}
                </div>
                <div className="text-[10px] font-chakra text-gray-300">{formatDate(p.created_at)}</div>
                {p.weight_kg && <div className="text-[10px] font-chakra text-gray-400">{p.weight_kg} kg</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {captureOpen && <PhotoCapture onSaved={onSaved} onClose={() => setCaptureOpen(false)} defaultPose={poseFilter || "front"} />}

      {lightbox && (
        <Lightbox
          photo={lightbox}
          onClose={() => setLightbox(null)}
          onDelete={() => deletePhoto(lightbox.id)}
        />
      )}

      {showCompareModal && compare && (
        <CompareSlider
          first={compare.first}
          last={compare.last}
          userName={user?.name || "Athlete"}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </Layout>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" });
  } catch { return ""; }
}

function imgSrc(p) {
  return p.image_base64.startsWith("data:") ? p.image_base64 : `data:image/jpeg;base64,${p.image_base64}`;
}

function Lightbox({ photo, onClose, onDelete }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal((
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" data-testid="photo-lightbox" onClick={onClose}>
      <div className="flex items-center justify-between p-3 sm:p-4 bg-black/70" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-gray-300" data-testid="lightbox-close-btn">
          <X size={22} />
        </button>
        <div className="font-teko text-lg text-[#FF4500]">{POSE_LABEL[photo.pose] || photo.pose}</div>
        <button onClick={onDelete} className="w-11 h-11 flex items-center justify-center text-red-400" data-testid="lightbox-delete-btn">
          <Trash2 size={20} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <img src={imgSrc(photo)} alt="" className="max-w-full max-h-full object-contain" />
      </div>
      <div className="bg-black/80 p-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-gray-300 font-chakra">{formatDate(photo.created_at)}{photo.weight_kg ? ` · ${photo.weight_kg} kg` : ""}</div>
        {photo.note && <div className="text-xs text-gray-500 font-chakra mt-1">{photo.note}</div>}
      </div>
    </div>
  ), document.body);
}

function CompareSlider({ first, last, userName, onClose }) {
  const [pct, setPct] = useState(50);
  const [shareOpen, setShareOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const onMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    setPct(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  };

  const daysBetween = () => {
    try {
      const a = new Date(first.created_at).getTime();
      const b = new Date(last.created_at).getTime();
      return Math.max(0, Math.round((b - a) / 86_400_000));
    } catch { return 0; }
  };

  return createPortal((
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" data-testid="compare-slider-modal">
      <div className="flex items-center justify-between p-3 sm:p-4 bg-black/70">
        <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-gray-300" data-testid="compare-close-btn">
          <X size={22} />
        </button>
        <div className="font-teko text-lg sm:text-xl chrome-text tracking-widest">VORHER / NACHHER</div>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="w-11 h-11 flex items-center justify-center text-[#FF4500] hover:text-[#FF5A1F]"
          data-testid="compare-share-btn"
          title="Teilen"
        >
          <Share2 size={20} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-3 sm:px-6 pb-4 overflow-hidden">
        <div
          ref={containerRef}
          className="relative w-full max-w-md aspect-[3/4] bg-black overflow-hidden select-none touch-none"
          onMouseMove={(e) => onMove(e.clientX)}
          onTouchMove={(e) => e.touches[0] && onMove(e.touches[0].clientX)}
          onMouseDown={(e) => onMove(e.clientX)}
          onTouchStart={(e) => e.touches[0] && onMove(e.touches[0].clientX)}
          data-testid="compare-slider-area"
        >
          <img src={imgSrc(last)} alt="latest" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ clipPath: `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)` }}>
            <img src={imgSrc(first)} alt="first" className="absolute inset-0 w-full h-full object-cover" />
          </div>
          <div className="absolute top-0 bottom-0 w-[2px] bg-[#FF4500]" style={{ left: `${pct}%`, boxShadow: "0 0 20px rgba(255,69,0,0.7)" }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-[#FF4500] rounded-full flex items-center justify-center cursor-grab"
            style={{ left: `${pct}%`, transform: `translate(-50%, -50%)`, boxShadow: "0 0 20px rgba(255,69,0,0.7)" }}
          >
            <ChevronLeft size={14} className="text-black" />
            <ChevronRight size={14} className="text-black" />
          </div>
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 border border-gray-700 text-[10px] font-chakra uppercase tracking-widest text-gray-300">VORHER · {formatDate(first.created_at)}</div>
          <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 border border-[#00FF7F]/60 text-[10px] font-chakra uppercase tracking-widest text-[#00FF7F]">NACHHER · {formatDate(last.created_at)}</div>
        </div>
      </div>
      <div className="bg-black/80 p-4 text-center">
        <div className="text-xs text-gray-400 font-chakra">Schiebe den Regler nach links oder rechts</div>
      </div>

      {shareOpen && (
        <ShareCard
          first={first}
          last={last}
          userName={userName}
          days={daysBetween()}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  ), document.body);
}

function ShareCard({ first, last, userName, days, onClose }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!first || !last) {
    return createPortal((
      <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center" onClick={onClose} data-testid="share-card-modal">
        <div className="text-gray-400 font-chakra">Fotos werden geladen…</div>
      </div>
    ), document.body);
  }

  const weightDelta = (last.weight_kg != null && first.weight_kg != null)
    ? Math.round((last.weight_kg - first.weight_kg) * 10) / 10
    : null;

  const periodLabel = days >= 365
    ? `${Math.floor(days / 365)} Jahr${Math.floor(days / 365) === 1 ? "" : "e"}`
    : days >= 60
    ? `${Math.round(days / 30)} Monate`
    : days >= 14
    ? `${Math.round(days / 7)} Wochen`
    : `${days} Tag${days === 1 ? "" : "e"}`;

  const sharePng = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 3, backgroundColor: "#000000" });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `alpha-fit-progress.png`, { type: "image/png" });
      const text = weightDelta != null
        ? `${periodLabel} Alpha-Fit. ${weightDelta > 0 ? "+" : ""}${weightDelta} kg. Du gegen dein Ich von gestern. 💪`
        : `${periodLabel} Alpha-Fit. Du gegen dein Ich von gestern. 💪`;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Mein Fortschritt @ alpha-fit",
          text,
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "alpha-fit-progress.png";
        a.click();
        toast.success("Vergleich gespeichert!");
      }
    } catch (e) {
      if (e.name !== "AbortError") toast.error("Teilen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const downloadPng = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 3, backgroundColor: "#000000" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "alpha-fit-progress.png";
      a.click();
      toast.success("Bild gespeichert!");
    } catch {
      toast.error("Download fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return createPortal((
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto" data-testid="share-card-modal">
      <button onClick={onClose} className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-gray-300 hover:text-white" data-testid="share-close-btn">
        <X size={24} />
      </button>

      {/* The actual shareable card (rendered visible, used by toPng) */}
      <div className="mb-4 max-w-sm w-full" data-testid="share-card-preview">
        <div
          ref={cardRef}
          className="relative w-full aspect-[4/5] bg-black overflow-hidden"
          style={{
            backgroundImage: "linear-gradient(180deg, #0a0a14 0%, #050508 100%)",
            border: "2px solid rgba(255,69,0,0.4)",
            boxShadow: "inset 0 0 60px rgba(255,69,0,0.15)",
          }}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between z-10" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.85), transparent)" }}>
            <div>
              <div className="text-[10px] tracking-[0.3em] text-[#FFD700] font-bold" style={{ fontFamily: '"Teko", sans-serif' }}>ALPHA<span className="text-[#FF4500]">FIT</span></div>
              <div className="text-[9px] text-gray-400 tracking-widest uppercase">{userName}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[#FF4500] tracking-[0.25em] uppercase font-bold">{periodLabel}</div>
              <div className="text-[8px] text-gray-500 uppercase tracking-widest">Transformation</div>
            </div>
          </div>

          {/* Two photos side by side */}
          <div className="absolute inset-0 grid grid-cols-2 gap-[2px] pt-[58px] pb-[80px]">
            <div className="relative overflow-hidden">
              <img src={imgSrc(first)} alt="before" className="w-full h-full object-cover"  />
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 text-[9px] font-bold tracking-[0.2em] text-gray-300" style={{ fontFamily: '"Chakra Petch", monospace' }}>
                VORHER
              </div>
              {first.weight_kg != null && (
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/80 text-[10px] text-gray-300" style={{ fontFamily: '"Chakra Petch", monospace' }}>
                  {first.weight_kg} kg
                </div>
              )}
            </div>
            <div className="relative overflow-hidden">
              <img src={imgSrc(last)} alt="after" className="w-full h-full object-cover"  />
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#00FF7F]/20 border border-[#00FF7F]/60 text-[9px] font-bold tracking-[0.2em] text-[#00FF7F]" style={{ fontFamily: '"Chakra Petch", monospace' }}>
                NACHHER
              </div>
              {last.weight_kg != null && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-[10px] text-[#00FF7F] font-bold" style={{ fontFamily: '"Chakra Petch", monospace' }}>
                  {last.weight_kg} kg
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-3 z-10 text-center" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.95), transparent)" }}>
            {weightDelta != null && (
              <div className="mb-1">
                <span className="text-2xl font-bold" style={{
                  fontFamily: '"Teko", sans-serif',
                  color: weightDelta < 0 ? "#00FF7F" : weightDelta > 0 ? "#FFD700" : "#ffffff",
                  textShadow: `0 0 20px ${weightDelta < 0 ? "#00FF7F" : weightDelta > 0 ? "#FFD700" : "#fff"}66`,
                }}>
                  {weightDelta > 0 ? "+" : ""}{weightDelta} kg
                </span>
              </div>
            )}
            <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-[#FF4500]" style={{ fontFamily: '"Chakra Petch", monospace' }}>
              alpha-fit.fitness
            </div>
          </div>

          {/* Vignette */}
          <div className="pointer-events-none absolute inset-0" style={{
            background: "radial-gradient(circle at 50% 50%, transparent 50%, rgba(0,0,0,0.5) 100%)",
          }} />
        </div>
      </div>

      <div className="flex gap-2 w-full max-w-sm">
        <button
          onClick={downloadPng}
          disabled={busy}
          className="btn-outline flex-1 flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
          data-testid="share-download-btn"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          BILD SPEICHERN
        </button>
        <button
          onClick={sharePng}
          disabled={busy}
          className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
          data-testid="share-action-btn"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
          TEILEN
        </button>
      </div>

      <div className="text-[10px] text-gray-500 font-chakra mt-3 text-center max-w-xs">
        Teile auf Instagram, WhatsApp oder als Story — automatisch mit Alpha-Fit-Branding.
      </div>
    </div>
  ), document.body);
}
