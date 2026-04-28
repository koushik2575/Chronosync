import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function summarizeText(text: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Please provide a concise and professional summary of the following notes:\n\n${text}`,
  });
  return response.text || "";
}

export async function extractActionItems(text: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract all action items or tasks from the following text. Format them as a clear markdown list, starting each item with "- [ ]". Do not include any intro or outro text, just the list.\n\n${text}`,
  });
  return response.text || "";
}

export async function generateTaskDescription(title: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Write a brief, professional description (2-3 sentences) for a task titled: "${title}". Be practical and action-oriented. Do not include introductory text.`,
  });
  return response.text || "";
}
