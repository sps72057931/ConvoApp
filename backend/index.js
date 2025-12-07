const express = require("express");
const multer = require("multer");
const cors = require("cors");
const docxToPDF = require("docx-pdf");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

app.use(cors());

// Create folders if not exist
const uploadsDir = path.join(__dirname, "uploads");
const filesDir = path.join(__dirname, "files");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir);

// Multer file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Convert file route
app.post("/convertFile", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    // Remove .docx extension & add .pdf
    const fileNameWithoutExt = req.file.originalname.replace(
      path.extname(req.file.originalname),
      ""
    );
    const outputPath = path.join(filesDir, `${fileNameWithoutExt}.pdf`);

    docxToPDF(req.file.path, outputPath, (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({
          message: "Error converting DOCX to PDF",
        });
      }

      res.download(outputPath, (err) => {
        if (err) console.log("Download error:", err);
        console.log("File downloaded successfully");
      });
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
