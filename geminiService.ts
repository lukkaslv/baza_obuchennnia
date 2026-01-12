
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the Gemini API client with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeContent = async (text: string) => {
  // Use ai.models.generateContent directly with the model name and parameters.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Проанализируй следующий учебный контент и предоставь краткое резюме, 3 ключевых вывода и предложенные теги. Весь ответ должен быть на РУССКОМ ЯЗЫКЕ. Контент: ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "Краткое описание на русском" },
          keyTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Ключевые мысли на русском"
          },
          suggestedTags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Теги на русском"
          },
          title: { type: Type.STRING, description: "Короткий заголовок на русском" }
        },
        required: ["summary", "keyTakeaways", "suggestedTags", "title"]
      }
    }
  });

  // Access the text property directly on the response object.
  return JSON.parse(response.text || '{}');
};
