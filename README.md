# Lecture to Notes App

A web application that converts lecture audio/video recordings into organized, structured notes using AI-powered speech recognition and natural language processing.

## Overview

This application helps students and professionals transform their lecture recordings into well-organized notes. It uses Google's Speech-to-Text API to transcribe audio content and Google's Gemini AI to intelligently summarize and structure the transcribed content into readable notes.

## Features

- Audio/video file upload and processing
- Real-time speech-to-text transcription
- AI-powered note organization and summarization
- Export notes in multiple formats

## Project Structure

```
lecturetonotesapp/
├── server/          # Backend Express server
├── client/          # Frontend application
├── .env             # Environment variables (create from .env.example)
├── .env.example     # Example environment configuration
├── package.json     # Project dependencies
└── README.md        # Project documentation
```

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Add your API keys to the `.env` file:
   - `GOOGLE_SPEECH_API_KEY`: Get from [Google Cloud Console](https://console.cloud.google.com/)
   - `GEMINI_API_KEY`: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Technologies Used

- **Backend**: Express.js, Node.js
- **APIs**: Google Speech-to-Text API, Google Gemini API
- **Environment Management**: dotenv
- **CORS**: For cross-origin requests

## License

ISC
