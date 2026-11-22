import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3e3;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
async function translateBatchWithRetry(ai, targetLanguage, items, attempt = 0) {
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: JSON.stringify({
        targetLanguage,
        items
      }),
      config: {
        systemInstruction: 'You are a professional e-commerce localization engine for "MJMA 3D World" (a 3D-printed dental training models and precision tools store). Translate EVERY single item text completely and naturally into the requested targetLanguage, including full product descriptions and customer reviews. Rules: 1) Keep "MJMA 3D World", "@dr_mjma", emails, phone numbers, and URLs untouched. 2) Keep interpolation placeholders like {count}, {currency}, {storeName}, {product}, {amount}, {email} exact and untranslated inside curly braces. 3) Return every id value unchanged and include all input items in translations. 4) Set dir strictly to "rtl" for right-to-left languages (Arabic, Hebrew, Persian, Urdu, Sorani Kurdish, Pashto, etc.) and "ltr" for all others. 5) Set languageCode to the lowercase ISO 639-1 / BCP-47 tag (e.g. "en", "tr", "fr", "de", "es", "ja", "zh", "ru").',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            languageCode: {
              type: Type.STRING,
              description: "BCP-47 language code for the target language."
            },
            dir: {
              type: Type.STRING,
              description: 'Text direction: "rtl" or "ltr".'
            },
            translations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING }
                },
                required: ["id", "text"]
              }
            }
          },
          required: ["languageCode", "dir", "translations"]
        }
      }
    });
    const raw = (response.text ?? "{}").trim();
    const parsed = JSON.parse(raw);
    const normalizedDir = parsed.dir === "rtl" ? "rtl" : "ltr";
    const normalizedCode = typeof parsed.languageCode === "string" && parsed.languageCode.trim() ? parsed.languageCode.trim().toLowerCase() : "en";
    const translations = Array.isArray(parsed.translations) ? parsed.translations : [];
    return {
      languageCode: normalizedCode,
      dir: normalizedDir,
      translations
    };
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err ? Number(err.status) : 0;
    const retriable = status === 429 || status >= 500 || status === 0;
    if (retriable && attempt < 2) {
      const waitMs = 400 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return translateBatchWithRetry(ai, targetLanguage, items, attempt + 1);
    }
    throw err;
  }
}
async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.post("/api/translate", async (req, res) => {
    try {
      const body = req.body;
      const targetLanguage = typeof body?.targetLanguage === "string" ? body.targetLanguage.trim().slice(0, 60) : "";
      if (!targetLanguage) {
        res.status(400).json({ error: "Target language is required." });
        return;
      }
      if (!Array.isArray(body?.items)) {
        res.status(400).json({ error: "Items array is required." });
        return;
      }
      const cleanItems = body.items.slice(0, 180).filter(
        (entry) => typeof entry === "object" && entry !== null && typeof entry.id === "string" && typeof entry.text === "string" && entry.text.trim().length > 0
      ).map((entry) => ({
        id: entry.id.slice(0, 120),
        text: entry.text.slice(0, 2500)
      }));
      if (cleanItems.length === 0) {
        res.json({ languageCode: "en", dir: "ltr", translations: {} });
        return;
      }
      const ai = getGeminiClient();
      const CHUNK_SIZE = 60;
      const chunks = [];
      for (let i = 0; i < cleanItems.length; i += CHUNK_SIZE) {
        chunks.push(cleanItems.slice(i, i + CHUNK_SIZE));
      }
      const batchResults = await Promise.all(
        chunks.map((chunk) => translateBatchWithRetry(ai, targetLanguage, chunk))
      );
      const mergedTranslations = {};
      for (const batch of batchResults) {
        for (const item of batch.translations) {
          if (item && typeof item.id === "string" && typeof item.text === "string") {
            mergedTranslations[item.id] = item.text;
          }
        }
      }
      res.json({
        languageCode: batchResults[0]?.languageCode || "en",
        dir: batchResults[0]?.dir || "ltr",
        translations: mergedTranslations
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Translation request failed.";
      const status = typeof err === "object" && err !== null && "status" in err ? Number(err.status) || 500 : 500;
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: message
      });
    }
  });
  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexHtml = path.join(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build output not found. Run npm run build first.");
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
