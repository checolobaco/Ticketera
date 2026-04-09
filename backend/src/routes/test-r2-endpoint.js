const express = require('express');
const router = express.Router();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');

// Configurar multer para memoria
const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Configurar R2 client
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// POST /api/test-r2/upload
// Sube un archivo a R2 y devuelve la URL pública
router.post('/upload', uploadFile.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Falta archivo (field: file)' });
    }

    const bucket = process.env.R2_BUCKET;
    const publicBase = process.env.R2_PUBLIC_BASE_URL;

    if (!bucket || !publicBase) {
      return res.status(500).json({ error: 'Variables R2 no configuradas' });
    }

    const filename = Date.now() + '-' + req.file.originalname;
    const key = `test/${filename}`;

    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }));

    const url = `${publicBase}/${key}`;

    return res.status(201).json({
      ok: true,
      file: {
        originalName: req.file.originalname,
        size: req.file.size,
        key,
        url
      }
    });
  } catch (err) {
    console.error('R2 Upload Error:', err);
    return res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// POST /api/test-r2/upload-text
// Sube texto plano a R2
router.post('/upload-text', express.json(), async (req, res) => {
  try {
    const { text, filename } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Falta "text"' });
    }

    const bucket = process.env.R2_BUCKET;
    const publicBase = process.env.R2_PUBLIC_BASE_URL;

    if (!bucket || !publicBase) {
      return res.status(500).json({ error: 'Variables R2 no configuradas' });
    }

    const fname = filename || `test-${Date.now()}.txt`;
    const key = `test/${fname}`;

    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(text),
      ContentType: 'text/plain'
    }));

    const url = `${publicBase}/${key}`;

    return res.status(201).json({
      ok: true,
      key,
      url
    });
  } catch (err) {
    console.error('R2 Text Upload Error:', err);
    return res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

module.exports = router;
