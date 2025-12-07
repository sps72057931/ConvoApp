const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mammoth = require("mammoth");
const htmlPdf = require("html-pdf-node");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS for production
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all for now
      }
    },
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create folders if not exist
const uploadsDir = path.join(__dirname, "uploads");
const filesDir = path.join(__dirname, "files");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10485760, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".doc" && ext !== ".docx") {
      return cb(new Error("Only .doc and .docx files are allowed"));
    }
    cb(null, true);
  },
});

// Convert file route
app.post("/convertFile", upload.single("file"), async (req, res) => {
  let inputPath = null;
  let outputPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    inputPath = req.file.path;
    const fileNameWithoutExt = path.parse(req.file.originalname).name;
    outputPath = path.join(filesDir, `${fileNameWithoutExt}.pdf`);

    console.log("Converting file:", req.file.originalname);
    console.log("Input path:", inputPath);
    console.log("Output path:", outputPath);

    // Convert DOCX to HTML using mammoth
    const result = await mammoth.convertToHtml({ path: inputPath });
    const html = result.value;

    if (!html || html.trim() === "") {
      throw new Error("Failed to extract content from document");
    }

    // Enhanced HTML with better styling
    const styledHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          p { margin-bottom: 12px; }
          h1, h2, h3, h4, h5, h6 { margin-top: 20px; margin-bottom: 10px; }
          img { max-width: 100%; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          table td, table th { border: 1px solid #ddd; padding: 8px; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    // Convert HTML to PDF
    const options = {
      format: "A4",
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
      printBackground: true,
      preferCSSPageSize: true,
    };

    const file = { content: styledHtml };
    const pdfBuffer = await htmlPdf.generatePdf(file, options);

    // Write PDF to file
    fs.writeFileSync(outputPath, pdfBuffer);

    console.log("Conversion successful");

    // Send file to client
    res.download(outputPath, `${fileNameWithoutExt}.pdf`, (downloadErr) => {
      // Cleanup files after download
      if (downloadErr) {
        console.error("Download error:", downloadErr);
      }

      // Delete uploaded file
      if (inputPath && fs.existsSync(inputPath)) {
        try {
          fs.unlinkSync(inputPath);
        } catch (e) {
          console.error(e);
        }
      }

      // Delete converted file
      if (outputPath && fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (e) {
          console.error(e);
        }
      }
    });
  } catch (error) {
    console.error("Conversion error:", error);

    // Cleanup on error
    if (inputPath && fs.existsSync(inputPath)) {
      try {
        fs.unlinkSync(inputPath);
      } catch (e) {
        console.error(e);
      }
    }
    if (outputPath && fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {
        console.error(e);
      }
    }

    return res.status(500).json({
      message: "Error converting document to PDF",
      error: error.message,
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "Word to PDF Converter API is running!",
    environment: process.env.NODE_ENV || "development",
    version: "2.0.0",
  });
});

// Error handlers
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File is too large. Maximum size is 10MB",
      });
    }
    return res.status(400).json({ message: error.message });
  }
  next(error);
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Allowed origin: ${process.env.CLIENT_URL || "localhost"}`);
});
