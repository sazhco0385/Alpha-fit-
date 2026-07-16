import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { Heart, Copy, Loader2, RefreshCw, Upload, Smartphone, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * AppleHealthCard — Settings card for Apple Health integration.
 * Provides:
 *  1) export.zip upload (one-time backfill of historic weight data)
 *  2) Per-user sync token (for the iOS Shortcut auto-daily-sync)
 *  3) iCloud Shortcut link (pre-built) for one-tap setup
 */
const SHORTCUT_ICLOUD_URL = "https://www.icloud.com/shortcuts/alphafit-health-sync"; // placeholder until owner publishes

export default function AppleHealthCard({ apiBaseUrl }) {
  const [token, setToken] = useState("");
  const [tokenCreated, setTokenCreated] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileRef = useRef(null);

  const loadToken = async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/integrations/apple-health/token");
      setToken(data.token);
      setTokenCreated(data.created_at);
    } catch (e) {
      toast.error("Token konnte nicht geladen werden");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { loadToken(); }, []);

  const rotateToken = async () => {
    if (!window.confirm("Neuen Token erzeugen? Der alte wird sofort ungültig — du musst ihn im Shortcut aktualisieren.")) return;
    setBusy(true);
    try {
      const { data } = await api.post("/integrations/apple-health/token/rotate");
      setToken(data.token);
      setTokenCreated(data.created_at);
      toast.success("Neuer Token erzeugt");
    } catch {
      toast.error("Token-Rotation fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("Token kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip") && !file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Bitte die export.zip aus Apple Health hochladen");
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/integrations/apple-health/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadResult(data);
      toast.success(`${data.imported} Gewichts-Einträge importiert`);
    } catch (e2) {
      toast.error(e2?.response?.data?.detail || "Import fehlgeschlagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const apiUrlBase = apiBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div className="af-card p-5 sm:p-6 clip-corner-tl-br mb-5 sm:mb-6" data-testid="settings-applehealth">
      <div className="flex items-center gap-2 mb-3">
        <Heart size={18} className="text-[#FF3B30]" />
        <h3 className="font-teko text-xl sm:text-2xl tracking-widest chrome-text">APPLE HEALTH</h3>
      </div>
      <p className="text-xs text-gray-400 font-chakra mb-4">
        Importiere dein Gewicht aus der Health-App — einmalig per Export-Datei oder automatisch täglich via iOS-Shortcut.
      </p>

      {/* Bulk export upload */}
      <div className="border border-[#1A1A24] p-3 sm:p-4 mb-4 bg-[#0A0A10]" data-testid="apple-health-upload">
        <div className="flex items-center gap-2 mb-2">
          <Upload size={14} className="text-[#FF4500]" />
          <div className="text-sm font-chakra tracking-wider text-gray-200">EINMAL-IMPORT</div>
        </div>
        <ol className="text-[11px] text-gray-500 font-chakra space-y-1 mb-3 list-decimal pl-4">
          <li>iPhone → Health-App → Profil oben rechts → „Daten exportieren"</li>
          <li>Datei „export.zip" auf dein Gerät teilen</li>
          <li>Hier hochladen — alle Gewichts-Einträge werden importiert (Duplikate übersprungen)</li>
        </ol>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.xml"
          onChange={onUpload}
          className="hidden"
          data-testid="apple-health-upload-input"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-outline text-xs flex items-center gap-2 w-full justify-center disabled:opacity-50"
          data-testid="apple-health-upload-btn"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "VERARBEITE…" : "EXPORT.ZIP HOCHLADEN"}
        </button>
        {uploadResult && (
          <div className="mt-3 flex items-center gap-2 text-[11px] font-chakra" data-testid="apple-health-upload-result">
            <Check size={14} className="text-[#00FF7F]" />
            <span className="text-gray-300">
              <strong className="text-[#00FF7F]">{uploadResult.imported}</strong> importiert ·
              {" "}{uploadResult.skipped_duplicates} Duplikate übersprungen
              {" "}(von {uploadResult.found} gefunden)
            </span>
          </div>
        )}
      </div>

      {/* Shortcut auto-sync */}
      <div className="border border-[#1A1A24] p-3 sm:p-4 bg-[#0A0A10]" data-testid="apple-health-shortcut">
        <div className="flex items-center gap-2 mb-2">
          <Smartphone size={14} className="text-[#FFD700]" />
          <div className="text-sm font-chakra tracking-wider text-gray-200">AUTO-SYNC (iOS SHORTCUT)</div>
        </div>
        <p className="text-[11px] text-gray-500 font-chakra mb-3">
          Tägliche Auto-Synchronisierung deines aktuellen Gewichts aus Apple Health an alpha-fit — kein Export nötig.
        </p>

        {/* Token */}
        <div className="mb-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">DEIN SYNC-TOKEN</div>
          <div className="flex gap-2">
            <input
              value={busy ? "Lade…" : token}
              readOnly
              className="af-input font-chakra flex-1 text-xs min-w-0"
              style={{ fontSize: "12px" }}
              data-testid="apple-health-token"
            />
            <button onClick={copyToken} disabled={busy || !token} className="btn-outline text-xs px-3 shrink-0" data-testid="apple-health-copy-token">
              <Copy size={14} />
            </button>
            <button onClick={rotateToken} disabled={busy} className="btn-outline text-xs px-3 shrink-0" data-testid="apple-health-rotate-token" title="Neuen Token erzeugen">
              <RefreshCw size={14} />
            </button>
          </div>
          {tokenCreated && (
            <div className="text-[10px] text-gray-600 font-chakra mt-1">
              Erstellt: {new Date(tokenCreated).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          )}
        </div>

        {/* Manual Shortcut recipe */}
        <details className="bg-[#03030A] border border-[#1A1A24] p-3" data-testid="apple-health-shortcut-recipe">
          <summary className="text-[11px] font-chakra text-[#FF4500] cursor-pointer">
            🛠 Shortcut selbst bauen (3 Schritte)
          </summary>
          <ol className="text-[11px] text-gray-400 font-chakra space-y-2 mt-3 list-decimal pl-4">
            <li>iPhone → App „Kurzbefehle" → „+" → Aktion „Letztes Gesundheitsdatum suchen" → Kategorie <strong>Körpergewicht</strong></li>
            <li>Aktion „Inhalte vom URL holen" hinzufügen:
              <div className="mt-1 space-y-1 text-[10px] bg-black p-2 border border-[#1A1A24] font-mono break-all">
                <div><span className="text-gray-500">Methode:</span> POST</div>
                <div><span className="text-gray-500">URL:</span> {apiUrlBase}/api/integrations/apple-health/weight</div>
                <div><span className="text-gray-500">Header:</span></div>
                <div className="pl-3">Content-Type: application/json</div>
                <div className="pl-3">X-AlphaFit-Token: <span className="text-[#FFD700]">{token || "(dein-token)"}</span></div>
                <div><span className="text-gray-500">Body (JSON):</span></div>
                <div className="pl-3">{"{ \"weight_kg\": [Magic Variable: Quantity] }"}</div>
              </div>
            </li>
            <li>Im Shortcut „Automation" → täglich um z.B. 07:00 → den Shortcut ausführen lassen</li>
          </ol>
        </details>
      </div>
    </div>
  );
}
