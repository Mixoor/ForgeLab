import { db } from "../database";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

export class DiscoveryService {
  /**
   * Scans a single knowledge source file layout, generates a structured course syllabus,
   * and saves the initial CourseBlueprint and Module shells into PostgreSQL.
   */
  public static async generateInitialBlueprint(
    sourceId: string,
    blueprintTitle: string,
  ): Promise<string> {
    // 1. Fetch layout headers belonging precisely to this unique knowledge source file record
    const structuralChunks = await db.knowledgeChunk.findMany({
      where: {
        sourceId: sourceId,
        category: { in: ["Title", "Heading", "Header", "SectionHeader"] },
      },
      take: 40,
      select: { contentText: true },
    });

    // Fallback: If layout parsing didn't mark structural tags, grab the first 30 chunks sequential data
    let contextText = structuralChunks.map((c) => c.contentText).join("\n");
    if (!contextText.trim()) {
      const fallbackChunks = await db.knowledgeChunk.findMany({
        where: { sourceId: sourceId },
        take: 30,
        select: { contentText: true },
      });
      contextText = fallbackChunks.map((c) => c.contentText).join("\n");
    }

    if (!contextText.trim()) {
      throw new Error(
        "No textual components or index layers found for this source ID.",
      );
    }

    // 2. Direct Gemini to parse the documentation boundaries and output a balanced modular tracks schema
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert technical curriculum designer for Forge Labs.
Review the structural documentation concepts below. Synthesize them into a highly cohesive, chronological syllabus of learning modules.

DOCUMENT SOURCE METADATA FRAGMENTS:
${contextText}

Provide an overarching professional profile description detailing what user persona this course suits, along with a list of discrete modules tracking the chronological order of the material.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            personaDescription: { type: "STRING" },
            modules: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  orderIndex: { type: "INTEGER" },
                  title: { type: "STRING" },
                  summary: { type: "STRING" },
                  keyConcepts: { type: "ARRAY", items: { type: "STRING" } },
                  topicQuery: { type: "STRING" }, // Crucial text query to route to pgvector later
                },
                required: [
                  "orderIndex",
                  "title",
                  "summary",
                  "keyConcepts",
                  "topicQuery",
                ],
              },
            },
          },
          required: ["personaDescription", "modules"],
        },
      },
    });

    const parsedData = JSON.parse(response.text || "{}");

    // 3. Commit Blueprint and empty Module shells atomically inside a Prisma transaction
    const blueprintId = await db.$transaction(async (tx) => {
      const createdBlueprint = await tx.courseBlueprint.create({
        data: {
          sourceId,
          title: blueprintTitle,
          personaDescription: parsedData.personaDescription,
          status: "PENDING", // Outer blueprint marks system generation status state
        },
      });

      // Insert all extracted modules. Note: 'topicQuery' isn't on your schema,
      // so we pass it inside the summary or we can append it as metadata or use it down-the-line.
      const moduleInsertPromises = parsedData.modules.map((mod: any) =>
        tx.module.create({
          data: {
            blueprintId: createdBlueprint.id,
            orderIndex: mod.orderIndex,
            title: mod.title,
            // Storing the unique topicQuery right inside the summary field or a JSON payload
            // so we can access it cleanly when the user clicks 'Forge Lesson'
            summary: `[Query: ${mod.topicQuery}] ${mod.summary}`,
            keyConcepts: mod.keyConcepts,
          },
        }),
      );

      await Promise.all(moduleInsertPromises);
      return createdBlueprint.id;
    });

    return blueprintId;
  }
}
