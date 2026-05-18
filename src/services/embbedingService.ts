import { ContentEmbedding, GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

export class EmbeddingService {
  public static async generateEmbedding(
    text: string[],
  ): Promise<ContentEmbedding[]> {
    try {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
          outputDimensionality: 1536,
          taskType: "RETRIEVAL_DOCUMENT",
        },
      });

      if (!response.embeddings || response.embeddings.length === 0) {
        throw new Error("Embedding values missing from API response output.");
      }

      console.log(
        "[EmbeddingService - generateEmbedding] response.embeddings: ",
        response.embeddings,
      );

      return response.embeddings || [];
    } catch (error: any) {
      console.error(
        "[EmbeddingService - generateEmbedding] Error:",
        error.message,
      );
      throw error;
    }
  }
}
