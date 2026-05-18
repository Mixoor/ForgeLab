import { db } from "../database";
import { GoogleGenAI } from "@google/genai";
import { EmbeddingService } from "./embbedingService";

const ai = new GoogleGenAI({});

export class ContentGenerationService {

  public static async generateAnyDocumentContent(
    moduleId: string,
    lessonTitle: string,
    lessonOrderIndex: number,
  ): Promise<{ lessonId: string; assessmentId: string }> {
    // 1. Retrieve parent structural context node parameters
    const targetModule = await db.module.findUnique({
      where: { id: moduleId },
      include: { blueprint: true },
    });

    if (!targetModule) throw new Error("Target module node not found.");

    const queryMatch = targetModule.summary.match(/\[Query:\s*(.*?)\s*\]/);
    const moduleQuery = queryMatch ? queryMatch[1] : targetModule.title;
    const combinedQuery = `${moduleQuery} - ${lessonTitle}`;

    // 2. Perform your standard pgvector RAG context assembly
    const queryVector = await EmbeddingService.generateEmbedding(combinedQuery);
    const vectorString = `[${queryVector.join(",")}]`;

    const matchingChunks: any[] = await db.$queryRawUnsafe(
      `
      SELECT kc."contentText"
      FROM knowledge_chunks kc
      WHERE kc."sourceId" = $1 AND kc."hasEmbedding" = true
      ORDER BY kc.embedding <=> $2::vector
      LIMIT 12;
    `,
      targetModule.blueprint.sourceId,
      vectorString,
    );

    const contextText = matchingChunks
      .map((c) => c.contentText)
      .join("\n\n---\n\n");

    // 3. Document-Agnostic System Prompt Refactoring
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: `You are an adaptive corporate instructional designer and educator. Your objective is to compile deep educational content optimized for the target audience persona profile defined below.

---
ENVIRONMENT DETAILS:
- Target Learner Profile: "${targetModule.blueprint.personaDescription}"
- Main Theme/Topic: "${targetModule.title}"
- Current Chapter/Lesson Target: "${lessonTitle}" (Lesson #${lessonOrderIndex} in chronological sequencing)
- Core Concepts to Enforce: ${JSON.stringify(targetModule.keyConcepts)}
---

---
SOURCE DOCUMENTATION REFERENCE MATERIAL (Use this strictly as the source of truth):
${contextText}
---

TASK DIRECTIONS:
1. **Write the Chapter (contentMarkdown):** Write a comprehensive, standalone lesson layout using rich Markdown. Match the nature of the documentation: 
   - If it is highly technical code/IT specs, provide deep implementation blueprints and syntax architecture blocks.
   - If it is an HR/Onboarding/Operations document, focus on institutional procedural clarity, case scenarios, structural guidelines, and workforce compliance principles.

2. **Design the Assessment (assessment):** Formulate an evaluation challenge that matches the subject matter:
   - For Technical/IT material: Provide a 'CODE_SNIPPET' error-correction challenge.
   - For HR/Management material: Provide a 'SITUATION_SIMULATION' case study or 'MULTIPLE_CHOICE' application scenario to evaluate real-world workplace decision making.
   
Structure the properties payload object to store choices, correctness parameters, template states, or rubric guidelines natively.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            contentMarkdown: { type: "STRING" },
            assessment: {
              type: "OBJECT",
              properties: {
                type: { type: "STRING" }, // Can naturally return "CODE_SNIPPET", "MULTIPLE_CHOICE", or "SITUATION_SIMULATION"
                questionText: { type: "STRING" },
                properties: {
                  type: "OBJECT",
                  properties: {
                    // Universal properties mapping parameters that fit both tech and non-tech structures dynamically
                    options: { type: "ARRAY", items: { type: "STRING" } },
                    correctAnswers: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                    },
                    codeTemplate: { type: "STRING" }, // Left blank or null for non-tech files
                    situationalContext: { type: "STRING" }, // Populated for behavioral/HR simulation trees
                  },
                },
              },
              required: ["type", "questionText", "properties"],
            },
          },
          required: ["contentMarkdown", "assessment"],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || "{}");

    // 4. Atomic Write Commit down into your data schemas layer
    return await db.$transaction(async (tx) => {
      const newLesson = await tx.lesson.create({
        data: {
          moduleId: targetModule.id,
          contentMarkdown: parsedJson.contentMarkdown,
          status: "INDEXED",
        },
      });

      const newAssessment = await tx.assessment.create({
        data: {
          moduleId: targetModule.id,
          type: parsedJson.assessment.type, // Maps perfectly to your database enum type mapping parameters
          questionText: parsedJson.assessment.questionText,
          properties: parsedJson.assessment.properties,
        },
      });

      return {
        lessonId: newLesson.id,
        assessmentId: newAssessment.id,
      };
    });
  }
}
