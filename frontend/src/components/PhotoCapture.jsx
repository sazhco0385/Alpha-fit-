import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Camera, RotateCw, Check, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

/**
 * PhotoCapture — opens device camera with live "Gym Light" filter, pose silhouette overlay,
 * captures a JPEG with the same filter baked-in (Canvas), uploads to /progress-photos.
 *
 * Filter style: high contrast + warm highlights + deeper shadows to make muscle definition pop.
 */

const POSES = [
  { v: "front", l: "Front" },
  { v: "side", l: "Seite" },
  { v: "back", l: "Rücken" },
  { v: "free", l: "Frei" },
];

// CSS filter applied to <video> preview AND to <canvas> on capture (must match!)
const GYM_FILTER = "contrast(1.32) brightness(1.04) saturate(1.18) sepia(0.06)";

export default function PhotoCapture({ onSaved, onClose, defaultPose = "front", weightKg = null }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [pose, setPose] = useState(defaultPose);
  const [facingMode, setFacingMode] = useState("user"); // front cam by default for selfies
  const [showGuide, setShowGuide] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      // Tear down any previous stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        setError(e?.message || "Kamera nicht verfügbar. Erlaube den Zugriff in deinen Browser-Einstellungen.");
      }
    };
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  const capture = async () => {
    if (busy) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      toast.error("Kamera lädt noch …");
      return;
    }
    setBusy(true);
    try {
      // Native dimensions for max sharpness, downscale longest side to ~1280 to keep payload small
      const vw = video.videoWidth, vh = video.videoHeight;
      const longest = Math.max(vw, vh);
      const targetLong = 1280;
      const scale = longest > targetLong ? targetLong / longest : 1;
      const cw = Math.round(vw * scale), ch = Math.round(vh * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext("2d");
      // Apply same filter on canvas so the saved photo matches the preview
      ctx.filter = GYM_FILTER;
      // Mirror the image when using front-cam to match preview
      if (facingMode === "user") {
        ctx.translate(cw, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, cw, ch);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      const { data } = await api.post("/progress-photos", {
        image_base64: dataUrl,
        pose,
        weight_kg: weightKg,
      });
      toast.success("Foto gespeichert 📸");
      if (onSaved) onSaved(data.photo);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Foto konnte nicht gespeichert werden");
    } finally {
      setBusy(false);
    }
  };

  return createPortal((
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" data-testid="photo-capture-modal">
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-black/70 backdrop-blur-sm border-b border-[#1A1A24]">
        <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-gray-300 hover:text-white" data-testid="capture-close-btn">
          <X size={22} />
        </button>
        <div className="font-teko text-lg sm:text-xl tracking-widest chrome-text">PROGRESS FOTO</div>
        <button
          onClick={() => setShowGuide((s) => !s)}
          className="w-11 h-11 flex items-center justify-center text-gray-300 hover:text-[#FF4500]"
          title="Pose-Silhouette ein/aus"
          data-testid="capture-toggle-guide"
        >
          {showGuide ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
      </div>

      {/* Pose tabs */}
      <div className="grid grid-cols-4 gap-1.5 p-2 bg-black/70" data-testid="pose-selector">
        {POSES.map((p) => (
          <button
            key={p.v}
            onClick={() => setPose(p.v)}
            className={`py-2 text-[11px] font-chakra uppercase tracking-widest border transition ${
              pose === p.v ? "border-[#FF4500] text-[#FF4500] bg-[#FF4500]/10" : "border-[#1A1A24] text-gray-400"
            }`}
            data-testid={`pose-${p.v}`}
          >
            {p.l}
          </button>
        ))}
      </div>

      {/* Camera viewport */}
      <div className="relative flex-1 overflow-hidden bg-black flex items-center justify-center">
        {error ? (
          <div className="px-6 text-center text-red-400 font-chakra text-sm">{error}</div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{
                filter: GYM_FILTER,
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
              }}
              data-testid="capture-video"
            />
            {/* Vignette + grain overlay for the studio mood */}
            <div className="pointer-events-none absolute inset-0" style={{
              background: "radial-gradient(circle at 50% 40%, transparent 35%, rgba(0,0,0,0.55) 100%)",
              mixBlendMode: "multiply",
            }} />
            {/* Pose silhouette guide */}
            {showGuide && <PoseGuide pose={pose} />}
            {/* Gym-light hint */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] font-chakra uppercase tracking-widest">
              <span className="px-2 py-1 bg-black/60 border border-[#FFD700]/40 text-[#FFD700]">GYM LIGHT • AN</span>
              <span className="px-2 py-1 bg-black/60 border border-[#1A1A24] text-gray-300">{POSES.find((p) => p.v === pose)?.l}</span>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-sm p-4 pb-6 border-t border-[#1A1A24]">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
            className="w-12 h-12 flex items-center justify-center rounded-full border border-[#1A1A24] text-gray-300 hover:text-[#FF4500]"
            disabled={busy}
            data-testid="capture-flip-btn"
            title="Kamera wechseln"
          >
            <RotateCw size={20} />
          </button>

          <button
            onClick={capture}
            disabled={busy || !!error}
            className="w-20 h-20 rounded-full border-4 border-[#FF4500] bg-[#FF4500]/10 hover:bg-[#FF4500]/20 disabled:opacity-50 flex items-center justify-center transition"
            style={{ boxShadow: "0 0 30px rgba(255,69,0,0.4)" }}
            data-testid="capture-shutter-btn"
          >
            {busy ? <Loader2 size={28} className="animate-spin text-[#FF4500]" /> : <Camera size={28} className="text-[#FF4500]" />}
          </button>

          <div className="w-12 h-12" /> {/* placeholder for symmetry */}
        </div>
      </div>
    </div>
  ), document.body);
}

// Simple SVG silhouette guides per pose
function PoseGuide({ pose }) {
  const common = {
    className: "pointer-events-none absolute inset-0 w-full h-full text-[#FF4500]/30 mix-blend-screen",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 200 360",
    preserveAspectRatio: "xMidYMid meet",
  };
  if (pose === "side") {
    return (
      <svg {...common}>
        <ellipse cx="105" cy="50" rx="14" ry="18" />
        <path d="M105 68 C110 90, 112 110, 110 135 C108 150, 105 170, 102 195 L98 240 L96 290 L94 340" />
        <path d="M110 90 C115 92, 122 102, 124 118 L122 138 L118 158" />
        <path d="M102 195 L96 240 L94 290 L92 340" />
      </svg>
    );
  }
  if (pose === "back") {
    return (
      <svg {...common}>
        <circle cx="100" cy="50" r="18" />
        <path d="M82 70 L70 110 L74 160 L82 195 L82 250 L80 330" />
        <path d="M118 70 L130 110 L126 160 L118 195 L118 250 L120 330" />
        <path d="M82 195 L118 195" />
        <path d="M70 110 L52 165" />
        <path d="M130 110 L148 165" />
      </svg>
    );
  }
  // front (and free)
  return (
    <svg {...common}>
      <circle cx="100" cy="50" r="18" />
      <path d="M82 70 L70 105 L62 160 L70 200" />
      <path d="M118 70 L130 105 L138 160 L130 200" />
      <path d="M82 70 L118 70" />
      <path d="M82 70 L82 195 L75 255 L72 330" />
      <path d="M118 70 L118 195 L125 255 L128 330" />
      <path d="M82 195 L118 195" />
    </svg>
  );
}
