import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import {
  isPushSupported, getPushPermission, subscribePush, unsubscribePush,
  getCurrentSubscription, updatePushSettings, sendTestPush,
} from "../lib/push";
import { Bell, BellOff, Loader2, Check, X, Send, AlertTriangle, Settings as Cog, Flame, Calendar, BarChart3, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { isSoundEnabled, setSoundEnabled, playRestOverChime } from "../lib/sound";

const DEFAULT_TRIGGERS = { workout_reminder: true, streak_protect: true, weekly_review: true };

export default function Settings() {
  const navigate = useNavigate();
  const [supported] = useState(isPushSupported());
  const [permission, setPermission] = useState("default");
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState(null);                 // current browser sub
  const [serverSub, setServerSub] = useState(null);     // backend subscription for this endpoint
  const [triggers, setTriggers] = useState(DEFAULT_TRIGGERS);
  const [reminderTime, setReminderTime] = useState("18:00");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testing, setTesting] = useState(false);
  const [soundOn, setSoundOnState] = useState(isSoundEnabled());

  const toggleSound = (v) => {
    setSoundEnabled(v);
    setSoundOnState(v);
    if (v) playRestOverChime();
    toast.success(v ? "Sound aktiviert" : "Sound deaktiviert");
  };

  useEffect(() => {
    (async () => {
      if (!supported) return;
      setPermission(await getPushPermission());
      const s = await getCurrentSubscription();
      setSub(s);
      if (s) {
        try {
          const { data } = await api.get("/notifications/settings");
          const match = (data.subscriptions || []).find((x) => x.endpoint === s.endpoint);
          if (match) {
            setServerSub(match);
            setTriggers({ ...DEFAULT_TRIGGERS, ...(match.triggers || {}) });
            setReminderTime(match.reminder_time || "18:00");
          }
        } catch {}
      }
    })();
  }, [supported]);

  const enable = async () => {
    setBusy(true);
    try {
      await subscribePush({ triggers, reminderTime });
      const s = await getCurrentSubscription();
      setSub(s);
      setPermission("granted");
      toast.success("Push aktiviert");
    } catch (err) {
      toast.error(err?.message || "Push konnte nicht aktiviert werden");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unsubscribePush();
      setSub(null);
      setServerSub(null);
      toast.success("Push deaktiviert");
    } catch (err) {
      toast.error(err?.message || "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const savePrefs = async () => {
    if (!sub) return;
    setSavingPrefs(true);
    try {
      await updatePushSettings({ endpoint: sub.endpoint, triggers, reminderTime });
      toast.success("Einstellungen gespeichert");
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSavingPrefs(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const { data } = await api.post("/notifications/test", {
        title: "🛡️ AlphaFit Test",
        body: "Push funktioniert. Werde alpha.",
      });
      if ((data.sent || 0) > 0) toast.success(`Test gesendet (${data.sent}/${data.subscriptions})`);
      else toast.error("Push konnte nicht zugestellt werden");
    } catch {
      toast.error("Fehler beim Test-Push");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Layout>
      <div className="mb-5 sm:mb-6 flex items-center gap-3">
        <Cog size={28} className="text-[#00BFFF]" style={{ filter: "drop-shadow(0 0 12px rgba(0,191,255,0.6))" }} />
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text">EINSTELLUNGEN</h1>
      </div>

      {/* Sound block */}
      <div className="af-card p-5 sm:p-6 clip-corner-tl-br mb-5 sm:mb-6" data-testid="settings-sound">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-3">
            {soundOn ? <Volume2 size={20} className="text-[#00BFFF]" /> : <VolumeX size={20} className="text-gray-500" />}
            <h2 className="font-teko text-2xl sm:text-3xl chrome-text">SOUND</h2>
          </div>
        </div>
        <p className="prose-af font-chakra mb-3">
          Akustische Signale beim Workout: Countdown-Pieps in den letzten 3 Sekunden der Pause,
          und ein Gong wenn die Pause vorbei ist.
        </p>
        <button
          onClick={() => toggleSound(!soundOn)}
          className={`w-full flex items-center gap-3 p-3 border transition text-left ${
            soundOn ? "border-[#00BFFF] bg-[#00BFFF]/5" : "border-[#1A1A24] hover:border-[#00BFFF]/40"
          }`}
          data-testid="toggle-sound"
        >
          <div className={`w-9 h-9 flex items-center justify-center border ${soundOn ? "border-[#00BFFF] text-[#00BFFF]" : "border-[#1A1A24] text-gray-500"}`}>
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-teko text-lg tracking-wide text-white">Pause-Ende Ton</div>
            <div className="text-[10px] text-gray-400 font-chakra">Beep auf 3-2-1 + Gong bei 0 + leichte Vibration</div>
          </div>
          <div className={`w-10 h-6 flex-shrink-0 relative transition ${soundOn ? "bg-[#00BFFF]" : "bg-[#1A1A24]"}`} style={{ borderRadius: "999px" }}>
            <div className="absolute top-0.5 w-5 h-5 bg-white transition-all" style={{ borderRadius: "999px", left: soundOn ? "calc(100% - 22px)" : "2px" }} />
          </div>
        </button>
      </div>

      {/* Notifications block */}
      <div className="af-card p-5 sm:p-6 clip-corner-tl-br mb-5 sm:mb-6" data-testid="settings-push">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-[#00BFFF]" />
            <h2 className="font-teko text-2xl sm:text-3xl chrome-text">PUSH-BENACHRICHTIGUNGEN</h2>
          </div>
          {sub && (
            <span className="text-[10px] text-green-400 border border-green-400/40 px-2 py-0.5 font-chakra uppercase tracking-widest" data-testid="push-status-active">
              <Check size={10} className="inline mr-1" /> AKTIV
            </span>
          )}
        </div>

        {!supported && (
          <div className="border border-orange-500/40 bg-orange-500/5 p-3 mt-3 flex gap-3 items-start" data-testid="push-unsupported">
            <AlertTriangle size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="prose-af font-chakra text-sm">
              Push wird auf diesem Browser/Gerät nicht unterstützt.
              iOS Safari: nur iOS 16.4+ als zur Home-Bildschirm-installierte App.
            </div>
          </div>
        )}

        {supported && (
          <>
            <p className="prose-af font-chakra mb-4">
              Wir senden dir Trainings-Erinnerungen, Streak-Warnungen & dein Wochen-Review.
              Nur die Trigger, die du aktivierst.
            </p>

            {!sub ? (
              <button
                onClick={enable}
                disabled={busy || permission === "denied"}
                className="btn-primary inline-flex items-center gap-2"
                data-testid="push-enable-btn"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                PUSH AKTIVIEREN
              </button>
            ) : (
              <>
                {/* Triggers */}
                <div className="space-y-2 mb-4" data-testid="push-triggers">
                  <TriggerToggle
                    icon={Calendar}
                    title="Workout-Erinnerung"
                    desc="Tägliche Erinnerung zur gewählten Uhrzeit"
                    enabled={triggers.workout_reminder}
                    onToggle={(v) => setTriggers((p) => ({ ...p, workout_reminder: v }))}
                    testid="toggle-workout-reminder"
                  />
                  <TriggerToggle
                    icon={Flame}
                    title="Streak-Schutz"
                    desc="Warnung 20:00 wenn heute noch kein Workout"
                    enabled={triggers.streak_protect}
                    onToggle={(v) => setTriggers((p) => ({ ...p, streak_protect: v }))}
                    testid="toggle-streak-protect"
                  />
                  <TriggerToggle
                    icon={BarChart3}
                    title="Wochen-Review"
                    desc="Sonntag 18:00 Mini-Zusammenfassung"
                    enabled={triggers.weekly_review}
                    onToggle={(v) => setTriggers((p) => ({ ...p, weekly_review: v }))}
                    testid="toggle-weekly-review"
                  />
                </div>

                {/* Time picker for workout reminder */}
                <div className="mb-4">
                  <label className="text-[10px] text-gray-400 uppercase tracking-widest font-chakra block mb-1">
                    Erinnerungs-Uhrzeit
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    disabled={!triggers.workout_reminder}
                    className="af-input w-32"
                    data-testid="push-reminder-time"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={savePrefs} disabled={savingPrefs} className="btn-primary inline-flex items-center gap-2" data-testid="push-save-btn">
                    {savingPrefs ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} SPEICHERN
                  </button>
                  <button onClick={test} disabled={testing} className="btn-outline inline-flex items-center gap-2" data-testid="push-test-btn">
                    {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} TEST SENDEN
                  </button>
                  <button onClick={disable} disabled={busy} className="btn-outline inline-flex items-center gap-2 text-red-400 border-red-400/40 hover:border-red-400" data-testid="push-disable-btn">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} />} DEAKTIVIEREN
                  </button>
                </div>
              </>
            )}

            {permission === "denied" && (
              <div className="border border-red-500/40 bg-red-500/5 p-3 mt-3 flex gap-3 items-start">
                <X size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="prose-af font-chakra text-sm">
                  Browser-Berechtigung verweigert. Bitte in den Browser-Einstellungen
                  Push für diese Seite erlauben.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Back link */}
      <button onClick={() => navigate("/dashboard")} className="btn-outline">ZURÜCK ZUM DASHBOARD</button>
    </Layout>
  );
}

function TriggerToggle({ icon: Icon, title, desc, enabled, onToggle, testid }) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={`w-full flex items-center gap-3 p-3 border transition text-left ${
        enabled ? "border-[#00BFFF] bg-[#00BFFF]/5" : "border-[#1A1A24] hover:border-[#00BFFF]/40"
      }`}
      data-testid={testid}
    >
      <div className={`w-9 h-9 flex items-center justify-center border ${enabled ? "border-[#00BFFF] text-[#00BFFF]" : "border-[#1A1A24] text-gray-500"}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-teko text-lg tracking-wide text-white">{title}</div>
        <div className="text-[10px] text-gray-400 font-chakra">{desc}</div>
      </div>
      <div className={`w-10 h-6 flex-shrink-0 relative transition ${enabled ? "bg-[#00BFFF]" : "bg-[#1A1A24]"}`} style={{ borderRadius: "999px" }}>
        <div
          className="absolute top-0.5 w-5 h-5 bg-white transition-all"
          style={{ borderRadius: "999px", left: enabled ? "calc(100% - 22px)" : "2px" }}
        />
      </div>
    </button>
  );
}
