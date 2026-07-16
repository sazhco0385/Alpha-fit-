import { useEffect } from "react";
import { X, Youtube, ExternalLink, PlayCircle } from "lucide-react";
import { getExerciseVideoUrl, getExerciseSearchUrl } from "../lib/exerciseVideos";

/**
 * Modal that shows a YouTube embed for a given exercise.
 * If no curated video is mapped, shows a "Search on YouTube" CTA.
 */
export default function ExerciseVideoModal({ exerciseName, muscle, onClose }) {
  const embedUrl = getExerciseVideoUrl(exerciseName);
  const searchUrl = getExerciseSearchUrl(exerciseName);

  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      data-testid="video-modal-backdrop"
    >
      <div
        className="bg-[#05050A] border border-[#FF4500]/40 w-full sm:max-w-3xl sm:rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="video-modal"
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#1A1A24]">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-xs text-[#FF4500] uppercase tracking-widest font-chakra">
              {muscle || "Übung"}
            </div>
            <div className="font-teko text-xl sm:text-2xl chrome-text truncate" data-testid="video-modal-title">
              {exerciseName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 -mr-2"
            data-testid="video-modal-close"
            aria-label="Schließen"
          >
            <X size={22} />
          </button>
        </div>

        {embedUrl ? (
          <div className="relative bg-black" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={embedUrl}
              title={`${exerciseName} Tutorial`}
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              data-testid="video-modal-iframe"
            />
          </div>
        ) : (
          <div className="p-8 text-center" data-testid="video-modal-no-curated">
            <PlayCircle size={48} className="mx-auto text-[#FF4500]/40 mb-3" />
            <div className="font-teko text-xl chrome-text mb-2">Kein kuratiertes Video</div>
            <p className="prose-af font-chakra text-sm mb-5">
              Für diese Übung haben wir noch kein Video. Du kannst direkt auf YouTube suchen.
            </p>
            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2 text-sm"
              data-testid="video-modal-search-yt"
            >
              <Youtube size={16} /> Auf YouTube suchen <ExternalLink size={12} />
            </a>
          </div>
        )}

        {embedUrl && (
          <div className="p-3 sm:p-4 border-t border-[#1A1A24] flex items-center justify-between">
            <div className="text-[10px] sm:text-xs text-gray-500 font-chakra">
              Tutorial via YouTube
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${embedUrl.split("/embed/")[1]?.split("?")[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF4500] hover:text-[#80DFFF] text-xs font-chakra inline-flex items-center gap-1"
              data-testid="video-modal-open-yt"
            >
              In YouTube öffnen <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
