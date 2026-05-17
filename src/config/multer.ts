import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDirectory = path.join(__dirname, "../../uploads");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];

// Ensure upload path destination exists on the server instance
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    // Sanitize user file strings: remove spaces, add high-precision timestamps
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname.replace(/\s+/g, "_")}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE }, // Cap file sizes at 50MB per upload
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(
        new Error(
          `File extension rejection. Supported extensions: ${ALLOWED_EXTENSIONS.join(", ")}`,
        ),
      );
    }
    cb(null, true);
  },
});

export const unlinkFile = (filePath: string): void => {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Error occurred while deleting file: ${filePath}`, err);
    }
  });
};
