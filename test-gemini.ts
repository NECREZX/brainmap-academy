import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "AIzaSyDR2rbC8LWSXhCxzNFs6LKD4XFSs-z5EQg" });

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
