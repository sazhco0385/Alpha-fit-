/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, TrainingPlan, Meal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateTrainingPlan(profile: UserProfile): Promise<TrainingPlan> {
  const prompt = `Erstelle einen detaillierten Trainingsplan für ${profile.name}.
    Ziele: ${profile.goal}
    Level: ${profile.level}
    Equipment: ${profile.equipment.join(", ")}
    Tage pro Woche: ${profile.daysPerWeek}
    Alter: ${profile.age}, Gewicht: ${profile.weight}kg, Größe: ${profile.height}cm.
    
    Der Plan sollte für jeden Trainingstag spezifische Übungen mit Sätzen, Wiederholungen und kurzen Anleitungen enthalten.
    Antworte in deutsche Sprache.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          workouts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                exercises: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      sets: { type: Type.INTEGER },
                      reps: { type: Type.STRING },
                      rest: { type: Type.STRING },
                      instruction: { type: Type.STRING },
                      videoUrl: { type: Type.STRING, description: "Eine URL zur Demonstration der Übungsausführung (z.B. YouTube)." },
                    },
                    required: ["name", "sets", "reps", "rest", "instruction"],
                  }
                }
              },
              required: ["day", "exercises"],
            }
          }
        },
        required: ["id", "name", "description", "workouts"],
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function getCoachResponse(message: string, history: {role: string, text: string}[], profile?: UserProfile) {
  const systemInstruction = `Du bist Alphafit, ein elitärer KI-Fitnesscoach. 
    Dein Stil ist motivierend, professionell und datengetrieben. 
    Du gibst kurze, prägnante Tipps zu Training, Ernährung und Regeneration.
    Wenn der User Fragen zu seiner Progression hat (z.B. "Soll ich Gewicht erhöhen?"), analysiere sein Ziel und gib konkrete Empfehlungen.
    User Profil: ${profile ? JSON.stringify(profile) : 'Unbekannt'}.
    Antworte immer auf Deutsch.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history.map(h => ({ role: h.role as 'user' | 'model', parts: [{ text: h.text }] })), { role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction,
    }
  });

  return response.text;
}

export async function getProgressionRecommendation(exercise: string, currentWeight: number, lastReps: number, targetReps: number) {
  const prompt = `Übung: ${exercise}. 
    Aktuelles Gewicht: ${currentWeight}kg. 
    Letzte Wiederholungen: ${lastReps}. 
    Ziel-Wiederholungen: ${targetReps}.
    Soll der User das Gewicht erhöhen oder an der Form arbeiten? Gib eine kurze Empfehlung (maximal 2 Sätze) auf Deutsch.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
}

export async function analyzeFood(input: { text?: string; imageBase64?: string }): Promise<Partial<Meal>> {
  const parts: any[] = [];
  if (input.text) parts.push({ text: `Analyse dieses Gericht: ${input.text}` });
  if (input.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: input.imageBase64,
      },
    });
    parts.push({ text: "Erkenne das Gericht auf dem Foto und schätze die Nährwerte." });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          macros: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fat: { type: Type.NUMBER },
            },
            required: ["calories", "protein", "carbs", "fat"],
          }
        },
        required: ["name", "macros"],
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
