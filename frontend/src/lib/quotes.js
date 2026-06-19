// 30 Spartan-style German motivation quotes — rotate daily by day-of-year
const QUOTES = [
  { text: "Der Schmerz von heute ist die Stärke von morgen.", author: "ALPHA PROTOKOLL" },
  { text: "Disziplin schlägt Motivation. Jeden. Einzelnen. Tag.", author: "ALPHA PROTOKOLL" },
  { text: "Schwäche verlässt den Körper. Härte bleibt zurück.", author: "ALPHA PROTOKOLL" },
  { text: "Du wirst nicht müde — du wirst stärker.", author: "ALPHA PROTOKOLL" },
  { text: "Komm zurück mit deinem Schild — oder darauf.", author: "SPARTA" },
  { text: "Ein Krieger wartet nicht auf den richtigen Moment. Er erschafft ihn.", author: "ALPHA PROTOKOLL" },
  { text: "Jede Wiederholung formt deine Legende.", author: "ALPHA PROTOKOLL" },
  { text: "Das letzte Rep ist das erste, das wirklich zählt.", author: "ALPHA PROTOKOLL" },
  { text: "Pausen sind erlaubt. Aufgeben nicht.", author: "ALPHA PROTOKOLL" },
  { text: "Der einzige schlechte Workout ist der, den du nicht machst.", author: "ALPHA PROTOKOLL" },
  { text: "Stahl wird im Feuer geboren. Du im Studio.", author: "ALPHA PROTOKOLL" },
  { text: "Heute leiden. Morgen herrschen.", author: "SPARTA" },
  { text: "Dein Körper ist dein Tempel. Bau ihn aus Granit.", author: "ALPHA PROTOKOLL" },
  { text: "Sei der Alpha, den du in der Welt sehen willst.", author: "ALPHA PROTOKOLL" },
  { text: "Schmerz ist temporär. Stolz ist permanent.", author: "ALPHA PROTOKOLL" },
  { text: "Zwei Optionen: trainieren oder bereuen.", author: "ALPHA PROTOKOLL" },
  { text: "Du bist nur einen Satz vom Helden entfernt.", author: "ALPHA PROTOKOLL" },
  { text: "Hart trainieren. Härter werden.", author: "ALPHA PROTOKOLL" },
  { text: "Die Hantel kennt deinen Namen nicht — also brüll ihn.", author: "ALPHA PROTOKOLL" },
  { text: "Wer schwitzt, blutet weniger im Kampf.", author: "SPARTA" },
  { text: "Geist über Materie. Wille über Last.", author: "ALPHA PROTOKOLL" },
  { text: "Klein angefangen. Groß geworden. Niemals stehengeblieben.", author: "ALPHA PROTOKOLL" },
  { text: "Ein Tag, ein Sieg. 365 Tage, eine Legende.", author: "ALPHA PROTOKOLL" },
  { text: "Aus Eisen kann man eine Krone schmieden.", author: "ALPHA PROTOKOLL" },
  { text: "Ausreden sind Werkzeuge der Inkompetenten.", author: "ALPHA PROTOKOLL" },
  { text: "Der Körper schreit auf. Der Wille flüstert: weiter.", author: "ALPHA PROTOKOLL" },
  { text: "Du wirst nicht in einer Komfortzone zum Alpha.", author: "ALPHA PROTOKOLL" },
  { text: "Schweiß ist die Tinte deiner Geschichte.", author: "ALPHA PROTOKOLL" },
  { text: "Streck dich aus. Lade. Lade nochmal. Wiederhole.", author: "ALPHA PROTOKOLL" },
  { text: "Heute war jemand schwächer als du. Bleib so.", author: "ALPHA PROTOKOLL" },
];

export function getDailyQuote(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[day % QUOTES.length];
}

export default QUOTES;
