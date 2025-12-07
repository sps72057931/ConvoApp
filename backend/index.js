const express = require("express");
const multer = require("multer");
const cors = require("cors");
const docxToPDF = require("docx-pdf");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS for production
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173", // For local development
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create folders if not exist
const uploadsDir = path.join(__dirname, "uploads");
const filesDir = path.join(__dirname, "files");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

// Multer file storage
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
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = process.env.ALLOWED_EXTENSIONS
      ? process.env.ALLOWED_EXTENSIONS.split(",")
      : [".doc", ".docx"];

    if (!allowedExtensions.includes(ext)) {
      return cb(
        new Error(`Only ${allowedExtensions.join(", ")} files are allowed`)
      );
    }
    cb(null, true);
  },
});

// Convert file route
app.post("/convertFile", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const fileNameWithoutExt = path.parse(req.file.originalname).name;
    const outputPath = path.join(filesDir, `${fileNameWithoutExt}.pdf`);

    console.log("Input file:", req.file.path);
    console.log("Output file:", outputPath);

    docxToPDF(req.file.path, outputPath, (err, result) => {
      if (err) {
        console.error("Conversion error:", err);

        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
          message: "Error converting DOCX to PDF",
          error: err.message,
        });
      }

      console.log("Conversion successful:", result);

      if (!fs.existsSync(outputPath)) {
        console.error("Output file not created");

        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
          message: "PDF file was not created",
        });
      }

      res.download(outputPath, `${fileNameWithoutExt}.pdf`, (downloadErr) => {
        if (downloadErr) {
          console.error("Download error:", downloadErr);
        }

        // Cleanup files
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }

        if (downloadErr && !res.headersSent) {
          return res.status(500).json({
            message: "Error downloading file",
          });
        }
      });
    });
  } catch (error) {
    console.error("Server error:", error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Word to PDF Converter API is running!",
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
  });
});

// Handle multer errors
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File is too large. Maximum size is 10MB",
      });
    }
    return res.status(400).json({
      message: error.message,
    });
  }
  next(error);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Allowed origin: ${process.env.CLIENT_URL}`);
  console.log(`Upload directory: ${uploadsDir}`);
  console.log(`Files directory: ${filesDir}`);
});
