import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import speech from '@google-cloud/speech';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google Speech-to-Text client
let speechClient = null;
if (process.env.GOOGLE_SPEECH_API_KEY) {
  speechClient = new speech.SpeechClient({
    apiKey: process.env.GOOGLE_SPEECH_API_KEY
  });
  console.log('✅ Google Speech-to-Text API configured');
} else {
  console.warn('⚠️  GOOGLE_SPEECH_API_KEY not found in environment variables');
}

// Initialize Google Gemini API client (Free Tier)
let geminiModel = null;
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Use gemini-1.5-flash for free tier (faster and free)
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  console.log('✅ Google Gemini API configured (using free tier model: gemini-1.5-flash)');
} else {
  console.warn('⚠️  GEMINI_API_KEY not found in environment variables');
}

// Free tier limits to prevent unexpected costs
const MAX_TRANSCRIPT_LENGTH = 100000; // characters (~25k words)
const MAX_TRANSCRIPT_WORDS = 25000; // words

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
      transcribe: 'POST /api/transcribe',
      structureNotes: 'POST /api/structure-notes',
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

// Transcription endpoint
app.post('/api/transcribe', async (req, res) => {
  const { filename } = req.body;
  let filePath = null;

  try {
    console.log('\n🎙️  Starting transcription process...');

    // Validate Speech API client
    if (!speechClient) {
      console.error('❌ Speech API not configured');
      return res.status(500).json({
        error: true,
        message: 'Speech-to-Text API is not configured. Please add GOOGLE_SPEECH_API_KEY to your environment variables.'
      });
    }

    // Validate filename provided
    if (!filename) {
      console.error('❌ No filename provided');
      return res.status(400).json({
        error: true,
        message: 'Filename is required. Please provide the filename of the uploaded audio file.'
      });
    }

    // Construct file path
    filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filename}`);
      return res.status(404).json({
        error: true,
        message: `Audio file '${filename}' not found. Please upload the file first.`,
        filename: filename
      });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📁 File: ${filename} (${fileSizeMB} MB)`);

    // Validate audio file
    const fileExtension = path.extname(filename).toLowerCase();
    const validExtensions = ['.webm', '.wav', '.mp3', '.ogg', '.opus'];
    if (!validExtensions.includes(fileExtension)) {
      console.error(`❌ Invalid file type: ${fileExtension}`);
      return res.status(400).json({
        error: true,
        message: `Invalid audio file type '${fileExtension}'. Supported formats: ${validExtensions.join(', ')}`
      });
    }

    // Read audio file
    console.log('📖 Reading audio file...');
    const audioBytes = fs.readFileSync(filePath);

    // Determine audio encoding based on file extension
    let encoding = 'LINEAR16';
    if (fileExtension === '.webm') {
      encoding = 'WEBM_OPUS';
    } else if (fileExtension === '.mp3') {
      encoding = 'MP3';
    } else if (fileExtension === '.ogg' || fileExtension === '.opus') {
      encoding = 'OGG_OPUS';
    }

    console.log(`🔧 Audio encoding: ${encoding}`);

    // Configure Speech-to-Text request
    const audio = {
      content: audioBytes.toString('base64'),
    };

    const config = {
      encoding: encoding,
      sampleRateHertz: 48000, // Default for web recordings
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
      model: 'default',
      useEnhanced: true,
    };

    const request = {
      audio: audio,
      config: config,
    };

    // Send to Google Speech-to-Text API
    console.log('🚀 Sending audio to Google Speech-to-Text API...');
    const startTime = Date.now();

    const [response] = await speechClient.recognize(request);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Transcription completed in ${duration}s`);

    // Extract transcription results
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    if (!transcription || transcription.trim().length === 0) {
      console.warn('⚠️  No speech detected in audio');
      return res.status(200).json({
        success: true,
        message: 'No speech detected in the audio file',
        transcript: '',
        wordCount: 0,
        confidence: 0,
        processingTime: duration
      });
    }

    // Calculate average confidence
    const confidences = response.results
      .map(result => result.alternatives[0].confidence || 0)
      .filter(conf => conf > 0);

    const avgConfidence = confidences.length > 0
      ? (confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length * 100).toFixed(2)
      : 0;

    const wordCount = transcription.split(/\s+/).filter(word => word.length > 0).length;

    console.log(`📝 Transcript length: ${transcription.length} characters, ${wordCount} words`);
    console.log(`🎯 Average confidence: ${avgConfidence}%`);

    // Delete the audio file after successful transcription
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted audio file: ${filename}`);
    } catch (deleteError) {
      console.error(`⚠️  Failed to delete audio file: ${deleteError.message}`);
      // Don't fail the request if deletion fails
    }

    // Return successful response
    res.status(200).json({
      success: true,
      message: 'Audio transcribed successfully',
      transcript: transcription,
      wordCount: wordCount,
      confidence: parseFloat(avgConfidence),
      processingTime: duration,
      filename: filename
    });

  } catch (error) {
    console.error('❌ Transcription error:', error);

    // Clean up file on error if it exists
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Cleaned up file after error: ${filename}`);
      } catch (deleteError) {
        console.error(`⚠️  Failed to cleanup file: ${deleteError.message}`);
      }
    }

    // Handle specific error types
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        error: true,
        message: 'Audio file not found on server'
      });
    }

    if (error.message && error.message.includes('API key')) {
      return res.status(401).json({
        error: true,
        message: 'Invalid or missing Google Speech API key. Please check your GOOGLE_SPEECH_API_KEY environment variable.'
      });
    }

    if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
      return res.status(400).json({
        error: true,
        message: 'Invalid audio format or corrupted audio file. Please ensure the audio is in a supported format.',
        details: error.message
      });
    }

    if (error.code === 8 || error.code === 'RESOURCE_EXHAUSTED') {
      return res.status(429).json({
        error: true,
        message: 'API quota exceeded. Please try again later or check your Google Cloud quota.'
      });
    }

    if (error.code === 14 || error.code === 'UNAVAILABLE') {
      return res.status(503).json({
        error: true,
        message: 'Google Speech-to-Text service is temporarily unavailable. Please try again.'
      });
    }

    // Generic error response
    res.status(500).json({
      error: true,
      message: 'Failed to transcribe audio',
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// Structure notes endpoint using Gemini AI
app.post('/api/structure-notes', async (req, res) => {
  const { transcript } = req.body;

  try {
    console.log('\n📝 Starting note structuring process...');

    // Validate Gemini API client
    if (!geminiModel) {
      console.error('❌ Gemini API not configured');
      return res.status(500).json({
        error: true,
        message: 'Gemini AI is not configured. Please add GEMINI_API_KEY to your environment variables.'
      });
    }

    // Validate transcript provided
    if (!transcript) {
      console.error('❌ No transcript provided');
      return res.status(400).json({
        error: true,
        message: 'Transcript is required. Please provide the transcript text to structure.'
      });
    }

    // Validate transcript is a string
    if (typeof transcript !== 'string') {
      console.error('❌ Invalid transcript format');
      return res.status(400).json({
        error: true,
        message: 'Transcript must be a string.'
      });
    }

    // Check free tier limits to prevent unexpected costs
    const transcriptLength = transcript.length;
    const transcriptWords = transcript.split(/\s+/).filter(word => word.length > 0).length;

    console.log(`📊 Transcript stats: ${transcriptLength} characters, ${transcriptWords} words`);

    if (transcriptLength > MAX_TRANSCRIPT_LENGTH) {
      console.error(`❌ Transcript too long: ${transcriptLength} characters (max: ${MAX_TRANSCRIPT_LENGTH})`);
      return res.status(400).json({
        error: true,
        message: `Transcript is too long (${transcriptLength} characters). Maximum allowed is ${MAX_TRANSCRIPT_LENGTH} characters to stay within free tier limits.`,
        currentLength: transcriptLength,
        maxLength: MAX_TRANSCRIPT_LENGTH
      });
    }

    if (transcriptWords > MAX_TRANSCRIPT_WORDS) {
      console.error(`❌ Transcript too long: ${transcriptWords} words (max: ${MAX_TRANSCRIPT_WORDS})`);
      return res.status(400).json({
        error: true,
        message: `Transcript is too long (${transcriptWords} words). Maximum allowed is ${MAX_TRANSCRIPT_WORDS} words to stay within free tier limits.`,
        currentWords: transcriptWords,
        maxWords: MAX_TRANSCRIPT_WORDS
      });
    }

    // Check if transcript is too short
    if (transcriptWords < 10) {
      console.warn('⚠️  Transcript is very short');
      return res.status(400).json({
        error: true,
        message: 'Transcript is too short (less than 10 words). Please provide a longer transcript.'
      });
    }

    // Create detailed prompt for Gemini
    const prompt = `You are an expert note-taker and educational content organizer. Your task is to transform the following lecture transcript into well-structured, organized notes.

Please create notes that include:

1. **Main Title**: A clear, descriptive title for the lecture based on the content
2. **Overview/Summary**: A brief 2-3 sentence overview of what the lecture covers
3. **Main Sections**: Organize the content into logical sections with clear headers
4. **Bullet Points**: Use bullet points to highlight key concepts, important facts, and main ideas
5. **Key Takeaways**: A dedicated section at the end listing 3-5 key takeaways
6. **Formatting**: Use proper markdown formatting with headers (##, ###), bullet points (-), and emphasis (**bold** for important terms)

Make the notes clear, concise, and easy to study from. Focus on the most important information and maintain logical flow.

Here is the transcript:

${transcript}

Please provide the structured notes now:`;

    console.log('🚀 Sending transcript to Gemini AI...');
    const startTime = Date.now();

    // Generate content using Gemini
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const structuredNotes = response.text();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Note structuring completed in ${duration}s`);

    // Validate response
    if (!structuredNotes || structuredNotes.trim().length === 0) {
      console.error('❌ Empty response from Gemini');
      return res.status(500).json({
        error: true,
        message: 'Failed to generate structured notes. Received empty response from Gemini AI.'
      });
    }

    const notesWordCount = structuredNotes.split(/\s+/).filter(word => word.length > 0).length;
    const notesCharCount = structuredNotes.length;

    console.log(`📄 Generated notes: ${notesCharCount} characters, ${notesWordCount} words`);

    // Return successful response
    res.status(200).json({
      success: true,
      message: 'Notes structured successfully',
      notes: structuredNotes,
      metadata: {
        inputWords: transcriptWords,
        inputCharacters: transcriptLength,
        outputWords: notesWordCount,
        outputCharacters: notesCharCount,
        processingTime: duration,
        model: 'gemini-1.5-flash'
      }
    });

  } catch (error) {
    console.error('❌ Note structuring error:', error);

    // Handle specific Gemini API errors
    if (error.message && error.message.includes('API_KEY_INVALID')) {
      return res.status(401).json({
        error: true,
        message: 'Invalid Gemini API key. Please check your GEMINI_API_KEY environment variable.'
      });
    }

    if (error.message && error.message.includes('quota')) {
      return res.status(429).json({
        error: true,
        message: 'API quota exceeded. Please try again later or check your Google AI quota.'
      });
    }

    if (error.message && error.message.includes('SAFETY')) {
      return res.status(400).json({
        error: true,
        message: 'Content was blocked by safety filters. Please ensure the transcript contains appropriate content.'
      });
    }

    if (error.message && error.message.includes('rate limit')) {
      return res.status(429).json({
        error: true,
        message: 'Rate limit exceeded. Please wait a moment and try again.'
      });
    }

    // Generic error response
    res.status(500).json({
      error: true,
      message: 'Failed to structure notes',
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
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
