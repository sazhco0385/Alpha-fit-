import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { ArrowLeft } from "lucide-react";

const COMPANY = {
  name: "Sky-Networks UG",
  owner: "Sascha Lübke",
  street: "Friedastraße 7",
  city: "24937 Flensburg",
  country: "Deutschland",
  vat: "Umsatzsteuer-ID: folgt",
  email: "sazhco0385@gmail.com",
};

export function Impressum() {
  const navigate = useNavigate();
  return (
    <LegalShell title="IMPRESSUM" onBack={() => navigate(-1)}>
      <Section title="Angaben gemäß § 5 TMG">
        <p className="font-bold chrome-text">{COMPANY.name}</p>
        <p>Inhaber: {COMPANY.owner}</p>
        <p>{COMPANY.street}</p>
        <p>{COMPANY.city}</p>
        <p>{COMPANY.country}</p>
      </Section>

      <Section title="Kontakt">
        <p>E-Mail: {COMPANY.email}</p>
      </Section>

      <Section title="Umsatzsteuer-ID">
        <p>{COMPANY.vat}</p>
      </Section>

      <Section title="Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV">
        <p>{COMPANY.owner}</p>
        <p>{COMPANY.street}, {COMPANY.city}</p>
      </Section>

      <Section title="Streitschlichtung">
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer" className="text-[#00BFFF] underline">
            https://ec.europa.eu/consumers/odr
          </a>.
        </p>
        <p className="mt-2">
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Section>

      <Section title="Haftung für Inhalte">
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
          Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
          überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        </p>
      </Section>

      <Section title="Urheberrecht">
        <p>
          Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die
          Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen
          der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
        </p>
      </Section>
    </LegalShell>
  );
}

export function AGB() {
  const navigate = useNavigate();
  return (
    <LegalShell title="ALLGEMEINE GESCHÄFTSBEDINGUNGEN" onBack={() => navigate(-1)}>
      <Section title="§ 1 Geltungsbereich">
        <p>
          Diese Allgemeinen Geschäftsbedingungen (nachfolgend "AGB") gelten für sämtliche Verträge, die ein Verbraucher oder Unternehmer
          (nachfolgend "Kunde") mit der {COMPANY.name}, Inhaber {COMPANY.owner}, {COMPANY.street}, {COMPANY.city}
          (nachfolgend "Anbieter") über die App und Webseite "alpha-fit" abschließt.
        </p>
      </Section>

      <Section title="§ 2 Vertragsgegenstand">
        <p>
          Der Anbieter stellt dem Kunden eine digitale Fitness-Plattform mit KI-gestützter Trainingsplanung, Fortschrittsverfolgung,
          Coach-Chat und weiteren Funktionen zur Verfügung. Der konkrete Funktionsumfang ergibt sich aus der jeweils aktuellen
          Leistungsbeschreibung in der App.
        </p>
      </Section>

      <Section title="§ 3 Vertragsschluss">
        <p>
          Mit der Registrierung in der App gibt der Kunde ein verbindliches Angebot zum Abschluss eines Nutzungsvertrages ab.
          Der Vertrag kommt durch die Freischaltung des Accounts durch den Anbieter zustande.
        </p>
      </Section>

      <Section title="§ 4 Premium-Mitgliedschaft & Preise">
        <ul className="list-disc list-inside space-y-1">
          <li>Premium 1 Monat: 9,99 € / Monat</li>
          <li>Premium 3 Monate: 19,99 € / 3 Monate</li>
          <li>Premium 1 Jahr: 69,99 € / Jahr</li>
        </ul>
        <p className="mt-3">
          Alle Preise sind Endpreise inkl. der gesetzlichen Umsatzsteuer. Die Abrechnung erfolgt jeweils im Voraus für den gewählten
          Zeitraum über unseren Zahlungsdienstleister Stripe Payments Europe, Ltd.
        </p>
      </Section>

      <Section title="§ 5 Kostenlose Testphase (7 Tage Trial)">
        <p>
          Beim Abschluss einer Premium-Mitgliedschaft erhält der Kunde eine kostenlose Testphase von 7 Tagen. Während dieser Zeit kann
          der Kunde alle Premium-Funktionen nutzen, ohne dass eine Zahlung erfolgt. Wird die Mitgliedschaft nicht innerhalb der
          Testphase gekündigt, beginnt automatisch der kostenpflichtige Abrechnungszeitraum.
        </p>
      </Section>

      <Section title="§ 6 Laufzeit & Kündigung">
        <p>
          Die Premium-Mitgliedschaft verlängert sich automatisch um die gewählte Laufzeit, sofern sie nicht spätestens 24 Stunden vor
          Ablauf des aktuellen Abrechnungszeitraums über das Kundenkonto oder per E-Mail an {COMPANY.email} gekündigt wird.
          Eine Kündigung der kostenlosen Testphase ist jederzeit innerhalb der 7 Tage möglich.
        </p>
      </Section>

      <Section title="§ 7 Widerrufsrecht für Verbraucher">
        <p>
          Verbraucher haben grundsätzlich ein 14-tägiges Widerrufsrecht. Dieses erlischt vorzeitig, wenn der Anbieter mit der Ausführung
          des Vertrages begonnen hat, nachdem der Kunde ausdrücklich zugestimmt und seine Kenntnis vom Erlöschen des Widerrufsrechts
          bestätigt hat. Mit dem Beginn der Nutzung der Premium-Funktionen während der Testphase erklärt sich der Kunde damit ausdrücklich
          einverstanden.
        </p>
      </Section>

      <Section title="§ 8 Pflichten des Kunden">
        <p>
          Der Kunde verpflichtet sich, seine Zugangsdaten geheim zu halten und nicht an Dritte weiterzugeben. Er ist für alle Aktivitäten
          verantwortlich, die unter seinem Account erfolgen. Die Trainingsempfehlungen ersetzen keine ärztliche Beratung. Bei
          gesundheitlichen Vorerkrankungen ist vor Trainingsbeginn ein Arzt zu konsultieren.
        </p>
      </Section>

      <Section title="§ 9 Haftung">
        <p>
          Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit. Für leichte Fahrlässigkeit haftet der Anbieter nur bei
          Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, vertragstypischen Schaden. Die Haftung für
          mittelbare Schäden, insbesondere entgangenen Gewinn, ist ausgeschlossen, soweit gesetzlich zulässig.
        </p>
      </Section>

      <Section title="§ 10 Datenschutz">
        <p>
          Die personenbezogenen Daten des Kunden werden ausschließlich zur Vertragserfüllung verarbeitet. Details ergeben sich aus der
          Datenschutzerklärung.
        </p>
      </Section>

      <Section title="§ 11 Schlussbestimmungen">
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Gerichtsstand ist, soweit gesetzlich
          zulässig, der Sitz des Anbieters. Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, berührt dies die
          Wirksamkeit der übrigen Bestimmungen nicht.
        </p>
      </Section>

      <p className="text-gray-500 text-xs font-chakra mt-8">Stand: Februar 2026</p>
    </LegalShell>
  );
}

export function Datenschutz() {
  const navigate = useNavigate();
  return (
    <LegalShell title="DATENSCHUTZERKLÄRUNG" onBack={() => navigate(-1)}>
      <Section title="1. Verantwortlicher">
        <p>Verantwortlicher im Sinne der DSGVO ist:</p>
        <p className="mt-2 font-bold chrome-text">{COMPANY.name}</p>
        <p>Inhaber: {COMPANY.owner}</p>
        <p>{COMPANY.street}</p>
        <p>{COMPANY.city}</p>
        <p>E-Mail: {COMPANY.email}</p>
      </Section>

      <Section title="2. Erhebung und Verarbeitung personenbezogener Daten">
        <p>
          Bei der Nutzung von alpha-fit verarbeiten wir folgende personenbezogene Daten:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li><strong>Account-Daten:</strong> Name, E-Mail-Adresse, Passwort (verschlüsselt mit bcrypt)</li>
          <li><strong>Profil-Daten:</strong> Geschlecht, Alter, Größe, Gewicht, Trainingsziel, Erfahrungslevel, Equipment, Verletzungen</li>
          <li><strong>Trainingsdaten:</strong> Trainingspläne, durchgeführte Übungen, Gewichte, Wiederholungen, Trainingsdauer, Fortschritt</li>
          <li><strong>Zahlungsdaten:</strong> Werden ausschließlich von Stripe verarbeitet (siehe Punkt 5)</li>
          <li><strong>Nutzungsdaten:</strong> IP-Adresse, Browser-Typ, Zugriffszeiten (zum Schutz vor Missbrauch)</li>
        </ul>
      </Section>

      <Section title="3. Rechtsgrundlage der Verarbeitung">
        <p>
          Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) für die Bereitstellung der App-Funktionen,
          Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) für die Sicherheit und Optimierung sowie Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)
          soweit du dieser ausdrücklich zugestimmt hast.
        </p>
      </Section>

      <Section title="4. KI-gestützter Trainings-Coach (OpenAI / Emergent)">
        <p>
          Zur Erstellung und Anpassung deines Trainingsplans sowie für den Coach-Chat nutzen wir KI-Modelle (OpenAI GPT-5.2) über die
          Emergent-Plattform als Vermittler. Hierbei werden folgende Daten an die KI übermittelt:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Dein Profil (Ziel, Erfahrung, Alter, Geschlecht, Größe, Gewicht, Tage/Woche, Equipment, Verletzungen)</li>
          <li>Deine Trainings-Performance (Gewichte, Wiederholungen der letzten Sessions)</li>
          <li>Inhalte, die du im Coach-Chat eingibst</li>
        </ul>
        <p className="mt-2">
          Die Übermittlung erfolgt verschlüsselt. OpenAI und Emergent verarbeiten die Daten ausschließlich zur Erbringung der angeforderten
          Leistung. Es findet keine Übermittlung deines vollen Namens oder deiner E-Mail an die KI statt. Anbieter:
          OpenAI Ireland Ltd. (Dublin, Irland), Emergent (USA).
        </p>
      </Section>

      <Section title="5. Zahlungsabwicklung über Stripe">
        <p>
          Für die Abwicklung der Premium-Mitgliedschaft nutzen wir Stripe Payments Europe, Ltd. (Dublin, Irland). Wir selbst speichern
          keine Kreditkarten- oder Bankdaten. Die Daten werden ausschließlich an Stripe übermittelt und dort gemäß deren Datenschutzerklärung
          verarbeitet:{" "}
          <a href="https://stripe.com/de/privacy" target="_blank" rel="noreferrer" className="text-[#00BFFF] underline">
            stripe.com/de/privacy
          </a>.
        </p>
        <p className="mt-2">
          Stripe ist zertifiziert nach dem EU-US Data Privacy Framework. Wir speichern lediglich eine Stripe-Customer-ID und
          Zahlungsstatus (initiated, paid) zur Vertragsabwicklung.
        </p>
      </Section>

      <Section title="6. Hosting & Speicherung">
        <p>
          Die App und alle Nutzerdaten werden auf Servern innerhalb der EU gehostet (verschlüsselte MongoDB-Datenbank). Die Speicherdauer
          richtet sich nach dem Bestehen deines Accounts. Nach Kontolöschung werden alle personenbezogenen Daten innerhalb von 30 Tagen
          unwiderruflich gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen (z.B. § 257 HGB für Rechnungsdaten:
          10 Jahre).
        </p>
      </Section>

      <Section title="7. Cookies & lokaler Speicher">
        <p>
          alpha-fit verwendet lediglich technisch notwendigen lokalen Speicher (localStorage) zur Aufbewahrung deines Login-Tokens.
          Es werden keine Tracking-Cookies oder Werbe-Cookies gesetzt.
        </p>
      </Section>

      <Section title="8. Deine Rechte (Art. 15-22 DSGVO)">
        <p>Du hast das Recht auf:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li><strong>Auskunft</strong> über die zu deiner Person gespeicherten Daten (Art. 15)</li>
          <li><strong>Berichtigung</strong> unrichtiger Daten (Art. 16)</li>
          <li><strong>Löschung</strong> deiner Daten ("Recht auf Vergessenwerden", Art. 17)</li>
          <li><strong>Einschränkung der Verarbeitung</strong> (Art. 18)</li>
          <li><strong>Datenübertragbarkeit</strong> in einem strukturierten Format (Art. 20)</li>
          <li><strong>Widerspruch</strong> gegen die Verarbeitung (Art. 21)</li>
          <li><strong>Beschwerde</strong> bei einer Datenschutz-Aufsichtsbehörde (Art. 77)</li>
        </ul>
        <p className="mt-2">
          Zur Ausübung deiner Rechte wende dich an: {COMPANY.email}
        </p>
      </Section>

      <Section title="9. Datensicherheit">
        <p>
          Wir nutzen HTTPS/TLS-Verschlüsselung für alle Datenübertragungen. Passwörter werden ausschließlich als bcrypt-Hash gespeichert.
          JWT-Tokens sind signiert und haben eine begrenzte Gültigkeit von 30 Tagen.
        </p>
      </Section>

      <Section title="10. Änderungen dieser Erklärung">
        <p>
          Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte Rechtslagen oder Funktionsänderungen anzupassen.
          Die jeweils aktuelle Version ist in der App abrufbar.
        </p>
      </Section>

      <p className="text-gray-500 text-xs font-chakra mt-8">Stand: Februar 2026</p>
    </LegalShell>
  );
}

function LegalShell({ title, children, onBack }) {
  return (
    <div className="min-h-screen bg-black text-white relative">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-radial-blue" />

      <header className="relative z-10 max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/"><Logo size={36} /></Link>
        <button onClick={onBack} className="text-gray-400 hover:text-[#00BFFF] flex items-center gap-2 font-chakra text-sm uppercase tracking-widest" data-testid="legal-back-btn">
          <ArrowLeft size={16} /> ZURÜCK
        </button>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-teko text-5xl md:text-6xl chrome-text mb-8">{title}</h1>
        <div className="af-card p-6 md:p-10 clip-corner-tl-br font-chakra text-gray-300 leading-relaxed space-y-2">
          {children}
        </div>
        <div className="mt-8 text-center">
          <Link to="/" className="text-[#00BFFF] font-chakra uppercase tracking-widest text-xs hover:text-[#00E5FF] glow-text-soft" data-testid="legal-home-link">
            ← ZUR STARTSEITE
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="font-teko text-2xl tracking-wide electric-text glow-text-soft mb-2">{title}</h2>
      <div className="space-y-2 text-gray-300">{children}</div>
    </section>
  );
}
