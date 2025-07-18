# Audio Transcription & Analysis App

A desktop web application for recording audio, transcribing it with Whisper, analyzing content with LLaMA, and organizing important information with user feedback.

## Features

✅ **Audio Recording**: Click-to-start recording with clear consent messaging  
✅ **Real-time Indicators**: Blinking red dot and recording status  
✅ **AI Transcription**: Local Whisper integration for audio-to-text  
✅ **Smart Categorization**: LLaMA-powered content analysis (Important/Noise/Uncertain)  
✅ **User Feedback**: Mark uncertain content as important or noise  
✅ **Multiple Output Formats**: Meeting notes, reminders, action items, summaries  
✅ **Privacy-First**: No audio storage, local processing only  
✅ **Fine-tuning Data**: Collect user feedback for model improvement  

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp config.example.env .env
# Edit .env with your local model paths and settings
```

### 3. Start the Server

```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

### 4. Open in Browser

Navigate to `http://localhost:3000` in Chrome or Firefox.

## Setup Guide

### Prerequisites

- **Node.js** 16+ 
- **Chrome/Firefox** (for MediaRecorder API support)
- **Local AI Models** (Whisper + LLaMA) - see AI Setup section

### File Structure

```
audio-transcription-app/
├── index.html          # Main web page
├── styles.css          # UI styling
├── script.js           # Frontend JavaScript
├── server.js           # Backend Express server
├── package.json        # Dependencies
├── config.example.env  # Environment template
├── uploads/            # Temporary audio files (auto-created)
├── outputs/            # Saved text files (auto-created)
├── feedback/           # User feedback data (auto-created)
└── README.md           # This file
```

## AI Model Integration

The app is designed to work with **local Whisper and LLaMA models**. Currently includes mock responses for testing.

### Whisper Setup (Audio Transcription)

1. **Install Whisper**:
   ```bash
   pip install openai-whisper
   ```

2. **Update server.js**: Replace the mock `transcribeAudio()` function with:
   ```javascript
   async transcribeAudio(audioFilePath) {
       const { spawn } = require('child_process');
       return new Promise((resolve, reject) => {
           const whisper = spawn('whisper', [audioFilePath, '--output_format', 'txt']);
           let output = '';
           
           whisper.stdout.on('data', (data) => {
               output += data.toString();
           });
           
           whisper.on('close', (code) => {
               if (code === 0) {
                   resolve(output.trim());
               } else {
                   reject(new Error('Whisper transcription failed'));
               }
           });
       });
   }
   ```

### LLaMA Setup (Content Analysis)

1. **Install llama.cpp** or **Ollama**:
   ```bash
   # Using Ollama (recommended)
   curl -fsSL https://ollama.ai/install.sh | sh
   ollama pull llama2
   ```

2. **Start LLaMA API**:
   ```bash
   ollama serve
   ```

3. **Update server.js**: Replace the mock `categorizeContent()` function with:
   ```javascript
   async categorizeContent(transcript) {
       const prompt = `
       Analyze this transcript and categorize each sentence as:
       - Important: Key information, decisions, action items
       - Noise: Filler words, casual conversation
       - Uncertain: Could be either important or noise
       
       Transcript: "${transcript}"
       
       Return JSON: {"important": [], "noise": [], "uncertain": []}
       `;
       
       const response = await fetch('http://localhost:11434/api/generate', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
               model: 'llama2',
               prompt: prompt,
               format: 'json'
           })
       });
       
       const result = await response.json();
       return JSON.parse(result.response);
   }
   ```

## Usage

### Recording Audio

1. **Click "Start Recording"** - Browser will request microphone permission
2. **Consent Message** appears - Ensure all participants consent
3. **Red Dot Blinks** - Indicates active recording
4. **Click "Stop Recording"** - Ends recording and starts processing

### Reviewing Transcription

1. **Important Content** - Automatically categorized key information
2. **Noise Content** - Filtered out unimportant content  
3. **Uncertain Content** - Review and mark as Important or Noise

### Saving Results

1. **Choose Output Format**:
   - Meeting Notes
   - Personal Reminder  
   - Action Items
   - Summary

2. **Click "Save Important Content"** - Creates `.txt` file in `outputs/` folder

### User Feedback

- Your choices for uncertain content are saved to `feedback/` folder
- This data can be used to fine-tune the AI models
- No raw audio is ever stored (privacy-first design)

## API Endpoints

### POST `/transcribe`
Upload audio file for transcription and analysis.

**Request**: `multipart/form-data` with audio file  
**Response**: 
```json
{
  "transcript": "Full transcribed text",
  "important": ["Important sentence 1", "Important sentence 2"],
  "noise": ["Noise sentence 1"],
  "uncertain": ["Uncertain sentence 1"]
}
```

### POST `/save`
Save important content as formatted text file.

**Request**:
```json
{
  "content": ["Important item 1", "Important item 2"],
  "agentType": "meeting-notes",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Response**:
```json
{
  "success": true,
  "filename": "meeting-notes_2024-01-01_12-00-00.txt",
  "path": "outputs/meeting-notes_2024-01-01_12-00-00.txt"
}
```

### POST `/feedback`
Save user feedback for model fine-tuning.

**Request**:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "original": { "important": [], "noise": [], "uncertain": [] },
  "userChoices": { "Uncertain sentence": "important" }
}
```

## Browser Support

- ✅ **Chrome 60+**
- ✅ **Firefox 55+**  
- ❌ **Safari** (MediaRecorder API limited)
- ❌ **Mobile browsers** (not optimized)

## Privacy & Security

🔒 **No Audio Storage**: Raw audio files are deleted immediately after processing  
🔒 **Local Processing**: All AI processing happens on your local machine  
🔒 **User Control**: Clear consent messaging and user-controlled recording  
🔒 **Data Ownership**: All outputs saved locally in your filesystem  

## Development

### Adding New Agent Types

1. **Update HTML**: Add option to `agentType` dropdown in `index.html`
2. **Update Formatter**: Add case to `formatContentByAgent()` in `server.js`

### Customizing AI Prompts

Edit the prompts in the `categorizeContent()` function in `server.js` to adjust how content is categorized.

### Frontend Customization

- **Styling**: Edit `styles.css`
- **UI Logic**: Edit `script.js`
- **Layout**: Edit `index.html`

## Troubleshooting

### Common Issues

**Microphone not working**:
- Check browser permissions
- Ensure you're using HTTPS or localhost
- Try Chrome or Firefox

**AI models not responding**:
- Verify Whisper/LLaMA are installed and running
- Check the API URLs in your `.env` file
- Look at server logs for error messages

**File upload errors**:
- Check file size (50MB limit)
- Ensure uploads/ directory exists and is writable

### Debug Mode

Set `NODE_ENV=development` in `.env` for detailed error messages.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for privacy-conscious audio transcription and analysis.** 