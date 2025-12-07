require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const docxToPDF = require("docx-pdf");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
};

app.use(cors(corsOptions));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({ storage });

app.post("/convertFile", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const outputPath = path.join(
    __dirname,
    "files",
    `${req.file.originalname}.pdf`
  );

  docxToPDF(req.file.path, outputPath, (err) => {
    if (err) return res.status(500).json({ message: "Conversion error" });

    return res.download(outputPath);
  });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
