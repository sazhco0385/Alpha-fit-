/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum FitnessGoal {
  MUSCLE_BUILDING = 'Muskelaufbau',
  WEIGHT_LOSS = 'Gewichtsverlust',
  STRENGTH = 'Kraftsteigerung',
  ENDURANCE = 'Ausdauer',
  HEALTH = 'Allgemeine Gesundheit',
}

export enum ExperienceLevel {
  BEGINNER = 'Anfänger',
  INTERMEDIATE = 'Fortgeschritten',
  ADVANCED = 'Profi',
}

export interface UserProfile {
  name: string;
  age: number;
  weight: number; // in kg
  height: number; // in cm
  goal: FitnessGoal;
  level: ExperienceLevel;
  equipment: string[];
  daysPerWeek: number;
  xp: number;
  level_rank: number;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  instruction: string;
  currentWeight?: number;
  videoUrl?: string;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export enum MealType {
  BREAKFAST = 'Frühstück',
  LUNCH = 'Mittagessen',
  DINNER = 'Abendessen',
  SNACK = 'Snack',
}

export interface Meal {
  id: string;
  name: string;
  timestamp: number;
  type: MealType;
  macros: Macros;
  imageUrl?: string;
  description?: string;
}

export interface ProgressEntry {
  date: string;
  weight: number;
  reps: number;
}

export interface ExerciseHistory {
  exerciseName: string;
  entries: ProgressEntry[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  description: string;
  workouts: {
    day: string;
    exercises: Exercise[];
  }[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
