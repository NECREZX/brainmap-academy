import { GoogleGenAI } from "@google/genai";
import { LearningLevel, Milestone, QuizSet } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateLearningPath = async (topic: string, level: LearningLevel) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: `
      Kamu adalah BrainMap Academy. Buatlah learning path terstruktur untuk topik: "${topic}" untuk level: "${level}".
      
      ATURAN PENTING:
      - JANGAN GUNAKAN MARKDOWN (BINTANG ** ATAU MIRING *).
      - GUNAKAN HURUF KAPITAL HANYA UNTUK PENEKANAN KATA (MAKSIMAL 3 KATA). 
      - JANGAN MENULIS SELURUH KALIMAT DALAM HURUF KAPITAL.
      - Gunakan Bahasa Indonesia yang santai dan asyik. Hindari kata kaku seperti 'merupakan', 'adapun', atau 'yakni'.
      
      Berikan respon dalam format JSON yang valid:
      {
        "milestones": [
          { "id": "1", "title": "...", "description": "..." },
          ... total 3-6 milestone
        ]
      }
    `,
    config: {
      responseMimeType: "application/json"
    }
  });
  
  try {
    const text = response.text || "{}";
    const cleanText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanText) as { milestones: Milestone[] };
  } catch (error) {
    console.error("Error generating path:", error);
    throw new Error("Failed to generate path");
  }
};

export const getExplanation = async (
  topic: string, 
  milestone: string, 
  level: LearningLevel, 
  mode: 'Santai' | 'Teknis'
) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: `
      Jelaskan milestone "${milestone}" dari topik "${topic}" untuk level: "${level}" dengan mode: "${mode}".
      
      PENGAWAS TOPIK (STRICT RELENVANCE):
      - FOKUS UTAMA: Topik spesifiknya adalah "${topic}".
      - SEMUA analogi, penjelasan, dan tantangan HARUS berkaitan dengan "${topic}".
      - DILARANG KERAS menggunakan istilah atau analogi pemrograman (seperti null, variable, code, function, bug) jika topik user adalah hal umum (seperti Memasak, Mobil, Sejarah, Teknik Kayu, dll).
      - Jika topiknya adalah "Belajar Mobil", gunakan istilah otomotif, bukan software.
      - Jika topiknya adalah "Memasak", gunakan istilah dapur, bukan database.
      - Pastikan penjelasan ini 100% nyambung dengan judul milestone: "${milestone}".
      
      ATURAN FORMATTING MUTLAK:
      1. JAWABAN HARUS KONKRET DAN SPESIFIK. Gunakan bahasa PERCAKAPAN natural. Bayangkan lagi ngobrol santai sama teman pintar.
      2. HINDARI KATA KAKU: Jangan pakai 'tata krama', 'memetakan', 'hierarkis', 'merupakan', 'yakni', 'sehingga', 'adapun', 'terhadap', 'inventarisasi'.
      3. PAKAI KATA SANTAI: Gunakan 'aturan', 'ngatur', 'bertingkat', 'itu', 'yaitu / alias', 'jadi', 'nah', 'ke / buat'.
      4. HINDARI bahasa akademis kaku. Gunakan kalimat pendek (MAKSIMAL 2 KLAUSA per kalimat).
      5. Jika ada istilah teknis, jelaskan dulu pakai bahasa sehari-hari baru tulis istilahnya dalam kurung. Contoh: pengelompokan informasi (Information Architecture).
      6. STRUKTUR: JAWABAN LANGSUNG (2-4 kalimat pendek) -> ELABORASI (1-2 poin nuansa) -> TANTANGAN OPSIONAL.
      7. JANGAN gunakan markdown seperti bintang (**) atau miring (*).
      8. GUNAKAN HURUF KAPITAL HANYA UNTUK PENEKANAN KATA (MAKSIMAL 3 KATA). JANGAN tulis seluruh kalimat dalam kapital.
      9. JANGAN PERNAH buka jawaban dengan pertanyaan. Selalu berikan JAWABAN TUNTAS terlebih dahulu.
      10. GUNAKAN FORMAT DAFTAR NOMOR untuk bagian ELABORASI:
         1. NAMA KONSEP
            Penjelasan singkat 1-3 kalimat saja.
         
         2. NAMA KONSEP BERIKUTNYA
            Penjelasan singkat 1-3 kalimat saja.
      11. MAKSIMAL 3-5 KONSEP per jawaban. Jika lebih, katakan: "Mau lanjut ke konsep berikutnya? Ketik Lanjut!"
      
      BRAINMAP AI PERSONALITY (THINKING PARTNER):
      - Kamu adalah PARTNER BERPIKIR. Berikan perspektif kritis jika user membuat asumsi.
      - Gunakan format Identity Rules dalam struktur jawaban:
        - 1 kalimat definisi sederhana (💡) di bagian JAWABAN LANGSUNG.
        - Analogi dunia nyata (🌏) di bagian ELABORASI.
        - Penjelasan lebih dalam menggunakan format nomor (💡) di bagian ELABORASI.
        - Fun fact menarik (✨) sebelum penutup.
      - Akhiri dengan pertanyaan yang memancing pemikiran kritis (TANTANGAN OPSIONAL).
      - JANGAN selalu setuju dengan user; berikan argumen pembanding.
      
      Gunakan Bahasa Indonesia yang asyik, cerdas, tapi tetap santai.
    `
  });

  try {
    return response.text || "Maaf, aku kesulitan mengambil penjelasan saat ini.";
  } catch (error) {
    console.error("Error getting explanation:", error);
    return "Maaf, aku kesulitan mengambil penjelasan saat ini.";
  }
};

export const generateQuiz = async (topic: string, milestone: string, level: LearningLevel) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: `
      Buatlah 3 pertanyaan kuis pilihan ganda berdasarkan milestone "${milestone}" untuk topik "${topic}" pada level "${level}".
      
      ATURAN PENTING:
      - JANGAN GUNAKAN MARKDOWN (TIDAK ADA BINTANG ** ATAU MIRING *).
      - GUNAKAN HURUF KAPITAL HANYA UNTUK PENEKANAN (MAKSIMAL 3 KATA).
      - Gunakan bahasa Indonesia yang santai dan natural (ngobrol santai). 
      - Hindari kata kaku seperti 'merupakan' atau 'terhadap'.
      - Penjelasan jawaban harus singkat (1-2 kalimat).
      
      Respon dalam JSON valid:
      {
        "questions": [
          {
            "question": "...",
            "options": ["...", "...", "..."],
            "correctAnswer": "A atau B atau C",
            "explanation": "..."
          },
          ... total 3 soal
        ]
      }
    `,
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    const text = response.text || "{}";
    const cleanText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanText) as QuizSet;
  } catch (error) {
    console.error("Error generating quiz:", error);
    return null;
  }
};

export const generateSummary = async (
  topic: string, 
  level: LearningLevel, 
  milestones: Milestone[], 
  xp: number, 
  badges: string[]
) => {
  const completedMilestones = milestones.filter(m => m.status === 'completed');
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: `
      Buatlah ringkasan sesi belajar untuk topik "${topic}" pada level "${level}".
      User telah menyelesaikan ${completedMilestones.length} dari ${milestones.length} milestone.
      XP Sesi ini: ${xp}. Lencana: ${badges.join(", ")}.
      
      FORMAT OUTPUT HARUS PERSIS SEPERTI INI (JANGAN PAKAI MARKDOWN):
      
      RINGKASAN SESI BELAJAR
      ═══════════════════════════
      Topik: Berikan nama topik yang ringkas
      Level: ${level}
      Durasi: Estimasi waktu belajar (misal: 15 Menit)
      Milestone selesai: ${completedMilestones.length} / ${milestones.length}
      Total XP: ${xp} XP
      Lencana: ${badges.join(" ")}
      ═══════════════════════════
      
      YANG SUDAH KAMU KUASAI:
      ${completedMilestones.map((m, i) => `${i + 1}. ${m.title} — [Ganti dengan 1 kalimat inti yang dipelajari]`).join("\n")}
      
      REKOMENDASIMU SELANJUTNYA:
      Topik lanjutan: [Nama topik spesifik yang beneran nyambung]
      Alasannya: [Alasannya kenapa ini topik yang pas buat dipelajari selanjutnya]
      ═══════════════════════════
      
      Mau mulai topik baru atau review salah satu milestone?
      
      ATURAN PENTING:
      - JANGAN GUNAKAN MARKDOWN (BINTANG ATAU MIRING).
      - GUNAKAN HURUF KAPITAL HANYA UNTUK PENEKANAN KATA (MAKSIMAL 3 KATA).
      - Gunakan bahasa Indonesia yang santai, asyik, dan cerdas (ngobrol santai).
    `
  });
  try {
    return response.text || "Sesi belajar selesai! Kamu luar biasa!";
  } catch (error) {
    return "Sesi belajar selesai! Kamu luar biasa!";
  }
};

export const askQuestion = async (
  question: string, 
  topic: string | null, 
  level: LearningLevel
) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: `
      Jawab pertanyaan berikut: "${question}".
      Konteks topik utama kita adalah: "${topic || 'Umum'}".
      Level user adalah: "${level}".
      
      ATURAN JAWABAN (THINKING PARTNER):
      1. JAWABAN HARUS KONKRET, SPESIFIK, DAN PERCAKAPAN (Ngobrol santai).
      2. JAWABAN HARUS 100% RELEVAN DENGAN TOPIK "${topic || 'Umum'}". HINDARI ANALOGI IT/CODING jika topik bukan IT.
      3. HINDARI KATA KAKU: Jangan pakai 'tata krama', 'memetakan', 'hierarkis', 'merupakan', 'yakni', 'sehingga', 'adapun', 'terhadap', 'inventarisasi'.
      4. PAKAI KATA SANTAI: Gunakan 'aturan', 'ngatur', 'bertingkat', 'itu', 'yaitu / alias', 'jadi', 'nah', 'ke / buat'.
      5. GUNAKAN KALIMAT PENDEK (MAKSIMAL 2 KLAUSA per kalimat).
      6. Sampaikan istilah teknis di dalam kurung setelah penjelasan bahasa sehari-hari.
      7. STRUKTUR MUTLAK (ANSWER FIRST, QUESTION LATER):
         - JAWABAN LANGSUNG: Jawab tuntas dalam 2-4 kalimat pendek.
         - ELABORASI: Tambahkan 1-2 poin pendukung atau nuansa penting.
         - TANTANGAN: Berikan pertanyaan reflektif di akhir.
      8. JANGAN PERNAH memulai dengan pertanyaan. JANGAN mengakhiri hanya dengan pertanyaan tanpa jawaban.
      9. JANGAN GUNAKAN MARKDOWN (BINTANG ** ATAU MIRING *).
      10. GUNAKAN HURUF KAPITAL HANYA UNTUK PENEKANAN (MAKSIMAL 3 KATA).
      11. JANGAN menjadi 'yes-man'. Jika user salah, tantang secara halus dengan bahasa santai.
      12. Gunakan Bahasa Indonesia yang ramah, asyik, dan tidak kaku.
    `
  });

  try {
    return response.text || "Pertanyaan yang menarik! Tapi aku agak bingung menjawabnya sekarang.";
  } catch (error) {
    return "Maaf, aku tidak bisa menjawab itu sekarang. Mau lanjut belajar?";
  }
};
