import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function run() {
  console.time('Generate');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Ucapkan halo dalam bahasa Indonesia.',
  });
  console.timeEnd('Generate');
  console.log(response.text);
}

run();
