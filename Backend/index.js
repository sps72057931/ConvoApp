require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { fromBuffer } = require("file-type");
const libre = require("libreoffice-convert");

const app = express();
const port = process.env.PORT || 3000;

// Ensure upload + output folders exist
if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");
if (!fs.existsSync("./files")) fs.mkdirSync("./files");

// CORS for production + local
app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:5173"],
    credentials: true,
  })
);

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// Convert DOCX → PDF
app.post("/convertFile", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const inputPath = req.file.path;
    const outputPath = path.join("files", req.file.originalname + ".pdf");

    const fileBuffer = fs.readFileSync(inputPath);

    // Convert to PDF
    libre.convert(fileBuffer, ".pdf", undefined, (err, done) => {
      if (err) {
        console.error(`Conversion error: ${err}`);
        return res.status(500).json({
          message: "Error converting file",
        });
      }

      fs.writeFileSync(outputPath, done);

      res.download(outputPath, () => {
        console.log("PDF downloaded");
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
