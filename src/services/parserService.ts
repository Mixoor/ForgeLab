import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export interface UnstructuredElement {
  type: string;
  text: string;
  pageNumber: number;
}

export class ParserService {
  public static async parseLayout(
    filePath: string,
  ): Promise<UnstructuredElement[]> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        return reject(
          new Error(`Target processing file missing on disk: ${filePath}`),
        );
      }

      const scriptPath = path.join(
        __dirname,
        //"../external/scripts/document-parser.py",
        //"../external/scripts/recursive-document-parser.py",
        "../external/scripts/recursive-rubost-parser.py",
      );

      console.log(
        `[ParserService] Spawning Python parser for file: ${filePath}`,
      );

      // Spawn python execution pipeline thread
      const pythonProcess = spawn("python3", [scriptPath, filePath]);

      let stdoutData = "";
      let stderrData = "";

      // Collect data chunks streamed from the Python process
      pythonProcess.stdout.on("data", (chunk) => {
        stdoutData += chunk.toString();
      });

      // Capture execution telemetry errors or logging trace notes
      pythonProcess.stderr.on("data", (chunk) => {
        stderrData += chunk.toString();
        console.log(`[ParserService - Python STDERR]: ${chunk.toString()}`);
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(`[Python Engine Crash] Stderr logs: ${stderrData}`);
          return reject(
            new Error(`Python parser script exited with failure code: ${code}`),
          );
        }

        try {
          if (!stdoutData.trim()) {
            return resolve([]);
          }
          const parsedElements: UnstructuredElement[] = JSON.parse(stdoutData);
          resolve(parsedElements);
        } catch (parseError) {
          reject(
            new Error(
              `Failed parsing standard output buffer payload stream to JSON object mappings.`,
            ),
          );
        }
      });
    });
  }
}
