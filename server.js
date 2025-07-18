const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
}));
app.use(cors());
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('./', {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Create necessary directories
const createDirectories = async () => {
    const dirs = ['uploads', 'outputs', 'feedback'];
    for (const dir of dirs) {
        await fs.ensureDir(dir);
    }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, `recording_${timestamp}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/m4a'];
        if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio files are allowed.'));
        }
    }
});

// AI Processing Functions (Placeholders for Whisper + LLaMA integration)
class AIProcessor {
    constructor() {
        this.whisperModel = null;
        this.llamaModel = null;
        this.initializeModels();
    }

    async initializeModels() {
        // Initialize real Whisper and LLaMA models
        console.log('Initializing AI models...');
        
        // Use real models
        this.whisperModel = 'whisper';
        this.llamaModel = 'llama3.2:3b';
        
        console.log('AI models ready');
    }

    async transcribeAudio(audioFilePath) {
        try {
            console.log(`Transcribing audio file: ${audioFilePath}`);
            
            // Real Whisper integration
            const { spawn } = require('child_process');
            const fs = require('fs');
            const path = require('path');
            
            return new Promise((resolve, reject) => {
                // Use absolute path for output directory
                const outputDir = path.resolve('./uploads');
                const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
                const expectedTranscriptPath = path.join(outputDir, `${baseName}.txt`);
                
                console.log(`Expected transcript path: ${expectedTranscriptPath}`);
                
                // Convert WebM to WAV first for better Whisper compatibility
                const wavFilePath = path.join(outputDir, `${baseName}.wav`);
                console.log(`Converting ${audioFilePath} to ${wavFilePath}`);
                
                // Use ffmpeg to convert to WAV
                const ffmpegArgs = [
                    '-i', audioFilePath,
                    '-ar', '16000',  // Sample rate 16kHz (good for speech)
                    '-ac', '1',      // Mono channel
                    '-c:a', 'pcm_s16le', // PCM 16-bit format
                    '-y',            // Overwrite output file
                    wavFilePath
                ];
                
                console.log(`Running: ffmpeg ${ffmpegArgs.join(' ')}`);
                
                const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                let ffmpegError = '';
                
                ffmpeg.stderr.on('data', (data) => {
                    ffmpegError += data.toString();
                });
                
                ffmpeg.on('close', (code) => {
                    if (code !== 0) {
                        console.error('FFmpeg conversion failed:', ffmpegError);
                        reject(new Error(`Audio conversion failed: ${ffmpegError}`));
                        return;
                    }
                    
                    console.log('Audio conversion successful, now running Whisper...');
                    
                    // Now run Whisper on the converted WAV file
                    const whisperArgs = [
                        '-m', 'whisper', 
                        wavFilePath,  // Use converted WAV file
                        '--output_format', 'txt', 
                        '--output_dir', outputDir,
                        '--verbose', 'False'
                    ];
                    
                    console.log(`Running: python ${whisperArgs.join(' ')}`);
                    
                    const whisper = spawn('python', whisperArgs);
                    let output = '';
                    let errorOutput = '';
                    
                    whisper.stdout.on('data', (data) => {
                        const text = data.toString();
                        console.log('Whisper stdout:', text);
                        output += text;
                    });
                    
                    whisper.stderr.on('data', (data) => {
                        const text = data.toString();
                        console.log('Whisper stderr:', text);
                        errorOutput += text;
                    });
                    
                    whisper.on('close', (code) => {
                        console.log(`Whisper process exited with code: ${code}`);
                        
                        // Clean up the temporary WAV file
                        try {
                            if (fs.existsSync(wavFilePath)) {
                                fs.unlinkSync(wavFilePath);
                                console.log('Cleaned up temporary WAV file');
                            }
                        } catch (cleanupError) {
                            console.warn('Warning: Could not clean up WAV file:', cleanupError);
                        }
                        
                        if (code === 0) {
                            // Wait a moment for file system to sync
                            setTimeout(() => {
                                try {
                                    // Check if transcript file exists
                                    if (fs.existsSync(expectedTranscriptPath)) {
                                        const transcript = fs.readFileSync(expectedTranscriptPath, 'utf8');
                                        console.log('Successfully read transcript file');
                                        // Clean up the transcript file
                                        fs.unlinkSync(expectedTranscriptPath);
                                        resolve(transcript.trim());
                                    } else {
                                        console.log('Transcript file not found, checking directory contents...');
                                        const files = fs.readdirSync(outputDir);
                                        console.log('Files in upload directory:', files);
                                        
                                        // Look for any .txt file with similar name
                                        const txtFiles = files.filter(f => f.endsWith('.txt') && f.includes(baseName));
                                        if (txtFiles.length > 0) {
                                            const foundFile = path.join(outputDir, txtFiles[0]);
                                            console.log(`Found transcript file: ${foundFile}`);
                                            const transcript = fs.readFileSync(foundFile, 'utf8');
                                            fs.unlinkSync(foundFile);
                                            resolve(transcript.trim());
                                        } else {
                                            // Fallback to stdout output
                                            console.log('No transcript file found, using stdout');
                                            resolve(output.trim() || 'Transcription completed but text not captured');
                                        }
                                    }
                                } catch (readError) {
                                    console.error('Error reading transcript file:', readError);
                                    // Fallback to stdout if file reading fails
                                    resolve(output.trim() || 'Transcription completed but text not captured');
                                }
                            }, 1000); // Wait 1 second for file system
                            
                        } else {
                            console.error('Whisper error output:', errorOutput);
                            reject(new Error(`Whisper transcription failed with code ${code}: ${errorOutput}`));
                        }
                    });
                    
                    whisper.on('error', (error) => {
                        console.error('Failed to start Whisper process:', error);
                        // Clean up WAV file on error
                        try {
                            if (fs.existsSync(wavFilePath)) {
                                fs.unlinkSync(wavFilePath);
                            }
                        } catch (cleanupError) {
                            console.warn('Warning: Could not clean up WAV file on error:', cleanupError);
                        }
                        reject(new Error(`Failed to start Whisper: ${error.message}`));
                    });
                });
                
                ffmpeg.on('error', (error) => {
                    console.error('Failed to start FFmpeg process:', error);
                    reject(new Error(`Failed to start audio conversion: ${error.message}`));
                });
            });
            
        } catch (error) {
            console.error('Transcription error:', error);
            throw new Error('Failed to transcribe audio');
        }
    }

    async categorizeContent(transcript) {
        try {
            console.log('Categorizing content with LLaMA...');
            
            // Real LLaMA integration using Ollama API
            const prompt = `Analyze the following transcript and categorize each sentence or phrase as:
- Important: Key information, decisions, action items, valuable insights, specific data
- Noise: Filler words, casual conversation, unimportant chatter, "um", "uh", weather talk
- Uncertain: Content that could be either important or noise

Transcript: "${transcript}"

You MUST respond with valid JSON in this exact format:
{"important": ["sentence1", "sentence2"], "noise": ["sentence3"], "uncertain": ["sentence4"]}

Do not include any other text, only the JSON response.`;
            
            // Call Ollama API
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3.2:3b',
                    prompt: prompt,
                    stream: false,
                    format: 'json'
                })
            });
            
            if (!response.ok) {
                throw new Error(`LLaMA API error: ${response.status}`);
            }
            
            const ollama_response = await response.json();
            const result = JSON.parse(ollama_response.response);
            
            // Validate the response structure
            if (!result.important || !result.noise || !result.uncertain) {
                console.warn('Invalid LLaMA response structure, using fallback');
                return this.generateMockCategorization(transcript);
            }
            
            return result;
            
        } catch (error) {
            console.error('Categorization error:', error);
            console.log('Falling back to mock categorization...');
            // Fallback to mock categorization if LLaMA fails
            return this.generateMockCategorization(transcript);
        }
    }

    generateMockTranscript() {
        const mockSentences = [
            "Welcome everyone to today's meeting.",
            "Let's start by reviewing the quarterly results.",
            "Our revenue increased by 15% this quarter.",
            "Um, that's really great news for the team.",
            "We need to focus on improving customer satisfaction.",
            "The weather outside is really nice today.",
            "Action item: Schedule follow-up meeting with the client.",
            "Does anyone have any questions?",
            "I think we should also consider expanding to new markets.",
            "Coffee break in 10 minutes.",
            "The project deadline is next Friday.",
            "Remember to submit your reports by end of week."
        ];
        
        return mockSentences.join(' ');
    }

    generateMockCategorization(transcript) {
        // Simple mock categorization based on keywords
        const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        const important = [];
        const noise = [];
        const uncertain = [];
        
        sentences.forEach(sentence => {
            const lower = sentence.toLowerCase();
            
            if (lower.includes('revenue') || lower.includes('action item') || 
                lower.includes('deadline') || lower.includes('results') ||
                lower.includes('focus') || lower.includes('expanding')) {
                important.push(sentence.trim());
            } else if (lower.includes('weather') || lower.includes('coffee') ||
                      lower.includes('um') || lower.includes('really')) {
                noise.push(sentence.trim());
            } else {
                uncertain.push(sentence.trim());
            }
        });
        
        return { important, noise, uncertain };
    }
}

// Initialize AI processor
const aiProcessor = new AIProcessor();

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Transcribe audio endpoint
app.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log(`Received audio file: ${req.file.filename}`);
        
        const audioFilePath = req.file.path;
        
        // Step 1: Transcribe audio with Whisper
        const transcript = await aiProcessor.transcribeAudio(audioFilePath);
        
        // Step 2: Categorize content with LLaMA
        const categorized = await aiProcessor.categorizeContent(transcript);
        
        // Clean up uploaded file (don't store raw audio for privacy)
        await fs.remove(audioFilePath);
        
        // Return categorized results
        res.json({
            transcript: transcript,
            important: categorized.important,
            noise: categorized.noise,
            uncertain: categorized.uncertain,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Transcription error:', error);
        
        // Clean up uploaded file if it exists
        if (req.file && req.file.path) {
            try {
                await fs.remove(req.file.path);
            } catch (cleanupError) {
                console.error('File cleanup error:', cleanupError);
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to process audio', 
            details: error.message 
        });
    }
});

// Save important content endpoint
app.post('/save', async (req, res) => {
    try {
        const { content, agentType, timestamp } = req.body;
        
        if (!content || !Array.isArray(content) || content.length === 0) {
            return res.status(400).json({ error: 'No content provided' });
        }
        
        // Generate filename
        const date = new Date().toISOString().split('T')[0];
        const time = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
        const filename = `${agentType}_${date}_${time}.txt`;
        const filepath = path.join('outputs', filename);
        
        // Format content based on agent type
        let formattedContent = this.formatContentByAgent(content, agentType);
        
        // Save to file
        await fs.writeFile(filepath, formattedContent, 'utf8');
        
        console.log(`Saved content to: ${filename}`);
        
        res.json({
            success: true,
            filename: filename,
            path: filepath,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ 
            error: 'Failed to save content',
            details: error.message 
        });
    }
});

// Save user feedback endpoint
app.post('/feedback', async (req, res) => {
    try {
        const feedback = req.body;
        
        // Generate filename for feedback
        const timestamp = new Date().toISOString();
        const filename = `feedback_${timestamp.replace(/[:.]/g, '-')}.json`;
        const filepath = path.join('feedback', filename);
        
        // Save feedback to JSON file
        await fs.writeFile(filepath, JSON.stringify(feedback, null, 2), 'utf8');
        
        console.log(`Saved feedback to: ${filename}`);
        
        res.json({
            success: true,
            filename: filename,
            timestamp: timestamp
        });
        
    } catch (error) {
        console.error('Feedback save error:', error);
        res.status(500).json({ 
            error: 'Failed to save feedback',
            details: error.message 
        });
    }
});

// Helper function to format content by agent type
function formatContentByAgent(content, agentType) {
    const header = `${agentType.toUpperCase().replace('-', ' ')} - ${new Date().toLocaleDateString()}\n`;
    const separator = '='.repeat(50) + '\n\n';
    
    switch (agentType) {
        case 'meeting-notes':
            return header + separator + 
                   'MEETING NOTES\n\n' +
                   content.map((item, index) => `${index + 1}. ${item}`).join('\n\n') +
                   '\n\n--- End of Notes ---';
                   
        case 'personal-reminder':
            return header + separator + 
                   'PERSONAL REMINDERS\n\n' +
                   content.map((item, index) => `• ${item}`).join('\n') +
                   '\n\n--- Remember to review ---';
                   
        case 'action-items':
            return header + separator + 
                   'ACTION ITEMS\n\n' +
                   content.map((item, index) => `[ ] ${item}`).join('\n') +
                   '\n\n--- Check off when completed ---';
                   
        case 'summary':
            return header + separator + 
                   'SUMMARY\n\n' +
                   content.join('\n\n') +
                   '\n\n--- End of Summary ---';
                   
        default:
            return header + separator + content.join('\n\n');
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
        }
        return res.status(400).json({ error: 'File upload error: ' + error.message });
    }
    
    res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const startServer = async () => {
    try {
        await createDirectories();
        
        app.listen(PORT, () => {
            console.log(`🚀 Audio Transcription Server running on http://localhost:${PORT}`);
            console.log(`📁 Outputs will be saved to: ./outputs/`);
            console.log(`📊 Feedback will be saved to: ./feedback/`);
            console.log(`🎤 Ready to process audio recordings`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    process.exit(0);
});

startServer(); 