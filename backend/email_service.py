"""Email service (Resend) - transactional emails for alpha-fit.
Templates use inline CSS (email-client compatible) + alpha-fit royal-gold branding."""
import os
import asyncio
import logging
from typing import Optional, Dict, Any
import resend

logger = logging.getLogger("alphafit")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("RESEND_SENDER_EMAIL", "onboarding@resend.dev")
SENDER_NAME = os.environ.get("RESEND_SENDER_NAME", "alpha-fit")
APP_URL = "https://alpha-fit.fitness"

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


# ===== Generic sender =====
async def send_email(to_email: str, subject: str, html: str, tag: str = "") -> Optional[str]:
    """Non-blocking Resend send. Returns email id or None on failure."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY missing; email skipped")
        return None
    params = {
        "from": f"{SENDER_NAME} <{SENDER_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    if tag:
        params["tags"] = [{"name": "category", "value": tag}]
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return result.get("id") if isinstance(result, dict) else None
    except Exception as e:
        logger.error(f"Resend send failed ({tag}, to={to_email}): {e}")
        return None


# ===== Layout =====
def _layout(title: str, preheader: str, body_html: str, cta_text: str = "", cta_url: str = "", unsub_token: str = "") -> str:
    """Royal-gold branded email layout. All inline CSS, table-based for client compat."""
    cta_block = ""
    if cta_text and cta_url:
        cta_block = f"""
        <tr>
          <td align="center" style="padding: 24px 0 8px;">
            <a href="{cta_url}" style="background: linear-gradient(135deg, #d4af37 0%, #f4d27a 100%); color: #0a0a0a; text-decoration: none; padding: 14px 38px; border-radius: 999px; font-weight: 700; font-size: 15px; letter-spacing: 0.4px; display: inline-block;">
              {cta_text}
            </a>
          </td>
        </tr>
        """

    unsub_link = (
        f'<a href="{APP_URL}/unsubscribe?t={unsub_token}" style="color: #999; text-decoration: underline;">Abbestellen</a>'
        if unsub_token else
        f'<a href="{APP_URL}/settings" style="color: #999; text-decoration: underline;">Email-Einstellungen</a>'
    )

    return f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e9e9e9;">
  <span style="display: none; max-height: 0; overflow: hidden; opacity: 0; visibility: hidden;">{preheader}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background: #121212; border-radius: 18px; border: 1px solid rgba(212, 175, 55, 0.18); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 36px 32px 12px; background: radial-gradient(circle at top, rgba(212,175,55,0.12), transparent 70%);">
              <div style="font-size: 28px; font-weight: 900; letter-spacing: 4px; background: linear-gradient(135deg, #d4af37 0%, #f4d27a 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #d4af37;">ALPHA-FIT</div>
              <div style="font-size: 10px; letter-spacing: 3px; color: rgba(212, 175, 55, 0.6); margin-top: 6px; text-transform: uppercase;">Train Like a King</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 12px 36px 24px; color: #e9e9e9; font-size: 15px; line-height: 1.65;">
              {body_html}
            </td>
          </tr>
          {cta_block}
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 32px 32px; border-top: 1px solid rgba(212, 175, 55, 0.08); color: #6a6a6a; font-size: 12px; line-height: 1.6;">
              <div style="margin-bottom: 6px;">alpha-fit • <a href="{APP_URL}" style="color: #d4af37; text-decoration: none;">alpha-fit.fitness</a></div>
              <div style="opacity: 0.7;">Du erhältst diese Email als alpha-fit Nutzer. <a href="{APP_URL}/settings" style="color: #999; text-decoration: underline;">Einstellungen</a> · {unsub_link}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# ===== Templates =====
def render_welcome(name: str, unsub_token: str = "") -> tuple[str, str]:
    subject = f"Willkommen bei alpha-fit, {name}! 🏆"
    preheader = "Dein 7-Tage-Trial startet jetzt. Hol dir den ersten Workout-Plan."
    body = f"""
      <h1 style="font-size: 22px; font-weight: 800; color: #f4d27a; margin: 0 0 14px;">Willkommen, {name}.</h1>
      <p style="margin: 0 0 14px;">Ab heute trainierst du nicht mehr nach Bauchgefühl — sondern nach Daten, KI und einem System, das Bodybuilder, Athleten und Disziplinierte seit Jahrzehnten benutzen.</p>
      <p style="margin: 0 0 14px;">Dein <strong style="color: #d4af37;">7-Tage Premium-Trial</strong> ist aktiv. In den nächsten Minuten:</p>
      <ul style="margin: 0 0 18px; padding-left: 18px; color: #cfcfcf;">
        <li style="margin-bottom: 6px;">Schließe das Onboarding ab (60 Sekunden)</li>
        <li style="margin-bottom: 6px;">Die KI generiert deinen ersten Trainingsplan</li>
        <li style="margin-bottom: 6px;">Starte direkt mit Tag 1 — heute noch</li>
      </ul>
      <p style="margin: 0; color: #999;">Wir sehen uns im Gym.<br>— Das alpha-fit Team</p>
    """
    return subject, _layout("Willkommen bei alpha-fit", preheader, body, "Jetzt starten", f"{APP_URL}/dashboard", unsub_token)


def render_payment_success(name: str, plan: str, amount: float, currency: str, unsub_token: str = "") -> tuple[str, str]:
    plan_label = {"monthly": "Monatlich", "yearly": "Jährlich", "lifetime": "Lifetime"}.get(plan, plan)
    currency_symbol = "€" if currency.lower() == "eur" else currency.upper()
    subject = "Zahlung erfolgreich — Premium aktiviert ✅"
    preheader = f"Dein alpha-fit Premium ({plan_label}) ist jetzt aktiv."
    body = f"""
      <h1 style="font-size: 22px; font-weight: 800; color: #f4d27a; margin: 0 0 14px;">Premium aktiviert.</h1>
      <p style="margin: 0 0 14px;">Hey {name}, deine Zahlung ist durch. Premium läuft.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.18); border-radius: 12px; margin-bottom: 18px;">
        <tr><td style="padding: 16px 18px;">
          <div style="color: #999; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">Plan</div>
          <div style="color: #f4d27a; font-size: 18px; font-weight: 700;">{plan_label}</div>
          <div style="color: #999; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin: 12px 0 4px;">Betrag</div>
          <div style="color: #e9e9e9; font-size: 18px; font-weight: 700;">{amount:.2f} {currency_symbol}</div>
        </td></tr>
      </table>
      <p style="margin: 0 0 14px;">Du hast jetzt unlimitierten Zugriff auf:</p>
      <ul style="margin: 0 0 18px; padding-left: 18px; color: #cfcfcf;">
        <li style="margin-bottom: 6px;">KI-Trainingspläne (GPT-5.5) inkl. wöchentliche Anpassungen</li>
        <li style="margin-bottom: 6px;">Body-Scan + Form-Check via Vision AI</li>
        <li style="margin-bottom: 6px;">Nutrition Tracking mit Foto-Erkennung</li>
        <li style="margin-bottom: 6px;">Web-Push Notifications + Streak-Schutz</li>
      </ul>
      <p style="margin: 0; color: #999;">Rechnung folgt automatisch von Stripe. Bei Fragen: <a href="mailto:supportalphafit@gmail.com" style="color: #d4af37;">supportalphafit@gmail.com</a></p>
    """
    return subject, _layout("Premium aktiviert", preheader, body, "Zum Dashboard", f"{APP_URL}/dashboard", unsub_token)


def render_trial_ending(name: str, days_left: int, unsub_token: str = "") -> tuple[str, str]:
    subject = f"Noch {days_left} Tag{'e' if days_left > 1 else ''} Trial — verlängere jetzt"
    preheader = "Dein 7-Tage Trial endet bald. Sichere dir Premium dauerhaft."
    body = f"""
      <h1 style="font-size: 22px; font-weight: 800; color: #f4d27a; margin: 0 0 14px;">{days_left} Tag{'e' if days_left > 1 else ''} übrig.</h1>
      <p style="margin: 0 0 14px;">Hey {name}, dein 7-Tage Trial endet in <strong style="color: #d4af37;">{days_left} Tag{'en' if days_left > 1 else ''}</strong>.</p>
      <p style="margin: 0 0 14px;">Wenn du nicht verlängerst, verlierst du Zugriff auf KI-Anpassungen, Body-Scan, Form-Check, Nutrition-Vision und automatische Plan-Updates.</p>
      <p style="margin: 0 0 14px;">Premium ab <strong style="color: #d4af37;">9,99 €/Monat</strong> — kündbar jederzeit, keine Abo-Falle.</p>
      <p style="margin: 0; color: #999;">Du hast diese Woche {{streak_workouts}} Workouts absolviert. Lass den Fortschritt nicht verfallen.</p>
    """
    return subject, _layout("Trial endet bald", preheader, body, "Premium verlängern", f"{APP_URL}/premium", unsub_token)


def render_streak_reminder(name: str, days_since: int, unsub_token: str = "") -> tuple[str, str]:
    subject = f"{name}, seit {days_since} Tagen kein Training 🚨"
    preheader = "Dein Streak ist in Gefahr — komm zurück."
    body = f"""
      <h1 style="font-size: 22px; font-weight: 800; color: #f4d27a; margin: 0 0 14px;">Comeback Time.</h1>
      <p style="margin: 0 0 14px;">{name}, du warst {days_since} Tag{'e' if days_since > 1 else ''} nicht im Training. Champions zeichnen sich nicht durch Talent aus — sondern durch Konsistenz.</p>
      <p style="margin: 0 0 14px;">Heute musst du nicht alles geben. <strong style="color: #d4af37;">Ein Workout. Eine Übung. Ein Set.</strong> Das reicht.</p>
      <p style="margin: 0 0 14px;">Wenn du heute auf den Plan zurückkommst, restart dein KI-Plan automatisch und passt sich an deine aktuelle Form an.</p>
      <p style="margin: 0; color: #999;">Du gegen dein Ich von gestern — sonst niemand.</p>
    """
    return subject, _layout("Comeback Time", preheader, body, "Jetzt trainieren", f"{APP_URL}/dashboard", unsub_token)


def render_weekly_summary(name: str, stats: Dict[str, Any], unsub_token: str = "") -> tuple[str, str]:
    workouts = stats.get("workouts", 0)
    volume = int(stats.get("volume_kg", 0))
    streak = stats.get("streak", 0)
    delta = stats.get("delta_pct", None)
    delta_str = ""
    if delta is not None and delta != 0:
        arrow = "▲" if delta > 0 else "▼"
        color = "#22c55e" if delta > 0 else "#ef4444"
        delta_str = f' <span style="color: {color}; font-size: 13px; font-weight: 600;">{arrow} {abs(delta)}%</span>'

    subject = f"Deine alpha-fit Woche: {workouts} Workouts, {volume:,} kg"
    preheader = f"{workouts} Trainings, {volume} kg Volumen, {streak} Tage Streak."
    body = f"""
      <h1 style="font-size: 22px; font-weight: 800; color: #f4d27a; margin: 0 0 14px;">Wochen-Review.</h1>
      <p style="margin: 0 0 16px;">Hey {name}, hier deine letzten 7 Tage:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
        <tr>
          <td width="33%" align="center" style="padding: 16px 8px; background: rgba(212, 175, 55, 0.06); border: 1px solid rgba(212, 175, 55, 0.18); border-radius: 12px;">
            <div style="font-size: 28px; font-weight: 800; color: #f4d27a;">{workouts}</div>
            <div style="color: #999; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px;">Workouts</div>
          </td>
          <td width="8"></td>
          <td width="33%" align="center" style="padding: 16px 8px; background: rgba(212, 175, 55, 0.06); border: 1px solid rgba(212, 175, 55, 0.18); border-radius: 12px;">
            <div style="font-size: 22px; font-weight: 800; color: #f4d27a;">{volume:,}{delta_str}</div>
            <div style="color: #999; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px;">kg Volumen</div>
          </td>
          <td width="8"></td>
          <td width="33%" align="center" style="padding: 16px 8px; background: rgba(212, 175, 55, 0.06); border: 1px solid rgba(212, 175, 55, 0.18); border-radius: 12px;">
            <div style="font-size: 28px; font-weight: 800; color: #f4d27a;">{streak}</div>
            <div style="color: #999; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px;">Streak</div>
          </td>
        </tr>
      </table>
      <p style="margin: 0; color: #999;">Disziplin schlägt Motivation — jeden Tag.</p>
    """
    return subject, _layout("Wochen-Review", preheader, body, "Insights anschauen", f"{APP_URL}/coach", unsub_token)


def render_winback(name: str, total_workouts: int, total_volume_kg: int, discount_pct: int = 30, unsub_token: str = "") -> tuple[str, str]:
    subject = f"{name}, dein Comeback wartet — {discount_pct}% Rabatt drin"
    preheader = f"{total_workouts} Workouts, {total_volume_kg:,} kg Volumen — komm zurück."
    body = f"""
      <h1 style="font-size: 22px; font-weight: 800; color: #f4d27a; margin: 0 0 14px;">Wir vermissen dich.</h1>
      <p style="margin: 0 0 14px;">Hey {name}, dein Premium ist seit einer Woche abgelaufen. Bevor du verschwindest, schau dir an was du gemacht hast:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
        <tr>
          <td width="48%" align="center" style="padding: 18px 8px; background: rgba(212, 175, 55, 0.06); border: 1px solid rgba(212, 175, 55, 0.18); border-radius: 12px;">
            <div style="font-size: 32px; font-weight: 800; color: #f4d27a;">{total_workouts}</div>
            <div style="color: #999; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px;">Workouts</div>
          </td>
          <td width="4%"></td>
          <td width="48%" align="center" style="padding: 18px 8px; background: rgba(212, 175, 55, 0.06); border: 1px solid rgba(212, 175, 55, 0.18); border-radius: 12px;">
            <div style="font-size: 26px; font-weight: 800; color: #f4d27a;">{total_volume_kg:,}</div>
            <div style="color: #999; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px;">kg bewegt</div>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 14px;">Das war kein Zufall. Das war Arbeit. <strong style="color: #d4af37;">Schmeiß den Fortschritt nicht weg.</strong></p>
      <p style="margin: 0 0 14px;">Komm zurück mit <strong style="color: #d4af37;">{discount_pct}% Rabatt</strong> auf die ersten 3 Monate — einmaliges Angebot, gültig für 7 Tage.</p>
      <p style="margin: 0; color: #999;">Disziplin ist nichts, was du verlierst. Aber sie verlässt dich, wenn du nicht hingehst.</p>
    """
    return subject, _layout("Comeback Offer", preheader, body, f"Premium mit {discount_pct}% holen", f"{APP_URL}/premium?winback=1", unsub_token)



def render_admin_new_signup(user_name: str, user_email: str, total_users: int) -> tuple[str, str]:
    """Internal notification to admin when a new user signs up."""
    subject = f"🎉 Neue Registrierung: {user_name} (#{total_users})"
    preheader = f"{user_email} ist gerade beigetreten."
    body = f"""
      <h1 style="font-size: 22px; font-weight: 800; color: #f4d27a; margin: 0 0 14px;">Neuer User registriert.</h1>
      <p style="margin: 0 0 18px; color: #cfcfcf;">Jemand hat sich gerade bei alpha-fit angemeldet:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.18); border-radius: 12px; margin-bottom: 18px;">
        <tr><td style="padding: 16px 18px;">
          <div style="color: #999; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">Name</div>
          <div style="color: #f4d27a; font-size: 18px; font-weight: 700;">{user_name}</div>
          <div style="color: #999; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin: 12px 0 4px;">E-Mail</div>
          <div style="color: #e9e9e9; font-size: 16px; font-weight: 600;">{user_email}</div>
          <div style="color: #999; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin: 12px 0 4px;">User-Nummer</div>
          <div style="color: #e9e9e9; font-size: 16px; font-weight: 600;">#{total_users} (insgesamt)</div>
        </td></tr>
      </table>
      <p style="margin: 0; color: #999; font-size: 13px;">7-Tage Trial wurde automatisch aktiviert. Du kannst alle User im Admin-Panel verwalten.</p>
    """
    return subject, _layout("Neue Registrierung", preheader, body, "Admin Panel öffnen", f"{APP_URL}/admin", "")
