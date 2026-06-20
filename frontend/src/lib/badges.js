/**
 * Frontend mirror of the badge taxonomy from backend/routers/sessions.py.
 * Used by Progress page to render the full collection (earned + locked).
 */

export const BADGE_WORKOUTS = [
  { threshold: 1,    id: "first_workout",  title: "Erstes Blut",         description: "1 Training" },
  { threshold: 3,    id: "warm_up",        title: "Aufgewärmt",          description: "3 Trainings" },
  { threshold: 5,    id: "five_workouts",  title: "5er Streak",          description: "5 Trainings" },
  { threshold: 10,   id: "ten_workouts",   title: "Eisenwille",          description: "10 Trainings" },
  { threshold: 15,   id: "fifteen",        title: "Stahlhart",           description: "15 Trainings" },
  { threshold: 25,   id: "warrior",        title: "Krieger",             description: "25 Trainings" },
  { threshold: 40,   id: "granite",        title: "Granit",              description: "40 Trainings" },
  { threshold: 50,   id: "alpha",          title: "Alpha",               description: "50 Trainings" },
  { threshold: 75,   id: "titan",          title: "Titan",               description: "75 Trainings" },
  { threshold: 100,  id: "centurion",      title: "Zenturio",            description: "100 Trainings" },
  { threshold: 150,  id: "spartan",        title: "Spartaner",           description: "150 Trainings" },
  { threshold: 200,  id: "olympian",       title: "Olympier",            description: "200 Trainings" },
  { threshold: 300,  id: "demigod",        title: "Halbgott",            description: "300 Trainings" },
  { threshold: 365,  id: "year_warrior",   title: "Jahres-Krieger",      description: "365 Trainings" },
  { threshold: 500,  id: "immortal",       title: "Unsterblich",         description: "500 Trainings" },
  { threshold: 750,  id: "myth",           title: "Mythos",              description: "750 Trainings" },
  { threshold: 1000, id: "legend",         title: "Legende",             description: "1000 Trainings" },
];

export const BADGE_STREAKS = [
  { threshold: 3,   id: "streak_3",   title: "3-Tage Streak",      description: "3 Tage in Folge" },
  { threshold: 7,   id: "streak_7",   title: "Wochen-Krieger",     description: "7 Tage in Folge" },
  { threshold: 14,  id: "streak_14",  title: "Zwei-Wochen Fokus",  description: "14 Tage in Folge" },
  { threshold: 30,  id: "streak_30",  title: "Monats-Beast",       description: "30 Tage in Folge" },
  { threshold: 60,  id: "streak_60",  title: "Konsistenz-King",    description: "60 Tage in Folge" },
  { threshold: 100, id: "streak_100", title: "Eiserne Disziplin",  description: "100 Tage in Folge" },
];

export const BADGE_VOLUMES = [
  { threshold: 10000,   id: "vol_10t",  title: "10 Tonnen Club",  description: "10.000 kg" },
  { threshold: 50000,   id: "vol_50t",  title: "50 Tonnen Club",  description: "50.000 kg" },
  { threshold: 100000,  id: "vol_100t", title: "100 Tonnen Club", description: "100.000 kg" },
  { threshold: 250000,  id: "vol_250t", title: "Quarter Million", description: "250.000 kg" },
  { threshold: 500000,  id: "vol_500t", title: "Halbe Million",   description: "500.000 kg" },
  { threshold: 1000000, id: "vol_1m",   title: "Millionär",       description: "1.000.000 kg" },
];

/** Returns next locked badge in a category given current value, or null if all earned. */
export function nextBadge(category, currentValue, earnedIds = []) {
  const list = { workouts: BADGE_WORKOUTS, streaks: BADGE_STREAKS, volumes: BADGE_VOLUMES }[category] || [];
  return list.find((b) => !earnedIds.includes(b.id) && currentValue < b.threshold) || null;
}
