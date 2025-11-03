import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - only accept audio files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'audio/webm',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/opus'
  ];

  const allowedExtensions = ['.webm', '.wav', '.mp3', '.ogg', '.opus'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio files (webm, wav, mp3, ogg) are allowed.'), false);
  }
};

// Configure multer with size limits (50MB max)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB in bytes
  }
});

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - allow requests from Vite dev server
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'lecture-to-notes-api'
  });
});

// API routes placeholder
app.get('/api', (req, res) => {
  res.json({
    message: 'Lecture to Notes API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      uploadAudio: 'POST /api/upload-audio',
    }
  });
});

// Audio upload endpoint
app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'No audio file provided. Please upload an audio file.'
      });
    }

    // File uploaded successfully
    const fileInfo = {
      success: true,
      message: 'Audio file uploaded successfully',
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        sizeInMB: (req.file.size / (1024 * 1024)).toFixed(2),
        mimetype: req.file.mimetype,
        uploadedAt: new Date().toISOString()
      }
    };

    console.log(`✅ File uploaded: ${req.file.filename} (${fileInfo.file.sizeInMB} MB)`);

    res.status(200).json(fileInfo);

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to process uploaded file',
      details: error.message
    });
  }
});

// 404 handler - must be after all routes
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    path: req.path
  });
});

// Error handling middleware - must be last
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);

  // Handle Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: true,
        message: 'File too large. Maximum file size is 50MB.',
        code: err.code
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: true,
        message: 'Unexpected field in file upload. Please use "audio" as the field name.',
        code: err.code
      });
    }
    // Other multer errors
    return res.status(400).json({
      error: true,
      message: err.message,
      code: err.code
    });
  }

  // Handle file type validation errors
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: true,
      message: err.message
    });
  }

  // Generic error handling
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: true,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 CORS enabled for: http://localhost:5173\n`);
});

export default app;
