import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

export class EmbeddingService {
  public static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
          outputDimensionality: 1536,
        },
      });

      if (!response.embeddings || response.embeddings.length === 0) {
        throw new Error("Embedding values missing from API response output.");
      }

      console.log(
        "[EmbeddingService - generateEmbedding] response.embeddings: ",
        response.embeddings,
      );

      return response.embeddings[0]?.values || [];
    } catch (error: any) {
      console.error("[EmbeddingService - generateEmbedding] Error:", error.message);
      throw error;
    }
  }
}
