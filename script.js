// Audio Transcription & Analysis App
class AudioTranscriptionApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.transcriptData = null;
        
        this.initializeElements();
        this.bindEvents();
        this.checkBrowserSupport();
    }

    initializeElements() {
        // Recording controls
        this.startButton = document.getElementById('startRecording');
        this.stopButton = document.getElementById('stopRecording');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.consentMessage = document.getElementById('consentMessage');
        this.processingMessage = document.getElementById('processingMessage');

        // Transcript sections
        this.transcriptSection = document.getElementById('transcriptSection');
        this.importantContent = document.getElementById('importantContent');
        this.noiseContent = document.getElementById('noiseContent');
        this.uncertainContent = document.getElementById('uncertainContent');

        // Save section
        this.saveSection = document.getElementById('saveSection');
        this.agentType = document.getElementById('agentType');
        this.saveButton = document.getElementById('saveButton');
        this.saveConfirmation = document.getElementById('saveConfirmation');
        this.saveFilename = document.getElementById('saveFilename');

        // Reset section
        this.resetSection = document.getElementById('resetSection');
        this.resetButton = document.getElementById('resetButton');
    }

    bindEvents() {
        this.startButton.addEventListener('click', () => this.startRecording());
        this.stopButton.addEventListener('click', () => this.stopRecording());
        this.saveButton.addEventListener('click', () => this.saveImportantContent());
        this.resetButton.addEventListener('click', () => this.resetApp());
    }

    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Sorry, your browser does not support audio recording. Please use Chrome or Firefox.');
            this.startButton.disabled = true;
        }
    }

    async startRecording() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });

            // Initialize MediaRecorder
            const options = { mimeType: 'audio/webm' };
            this.mediaRecorder = new MediaRecorder(stream, options);
            this.audioChunks = [];

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingStop();
            };

            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;

            // Update UI
            this.updateRecordingUI(true);
            
            // Play beep sound
            this.playBeep();

        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Could not access microphone. Please check permissions and try again.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Stop all media tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Update UI
            this.updateRecordingUI(false);
            this.showProcessingMessage(true);
        }
    }

    updateRecordingUI(recording) {
        if (recording) {
            this.startButton.classList.add('hidden');
            this.stopButton.classList.remove('hidden');
            this.recordingIndicator.classList.remove('hidden');
            this.consentMessage.classList.remove('hidden');
        } else {
            this.startButton.classList.remove('hidden');
            this.stopButton.classList.add('hidden');
            this.recordingIndicator.classList.add('hidden');
            this.consentMessage.classList.add('hidden');
        }
    }

    showProcessingMessage(show) {
        if (show) {
            this.processingMessage.classList.remove('hidden');
        } else {
            this.processingMessage.classList.add('hidden');
        }
    }

    playBeep() {
        // Create a simple beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }

    async handleRecordingStop() {
        // Create audio blob
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Upload and process
        await this.uploadAndTranscribe(audioBlob);
    }

    async uploadAndTranscribe(audioBlob) {
        try {
            // Create FormData
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            // Upload to server
            const response = await fetch('/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            this.transcriptData = result;

            // Display results
            this.displayTranscriptResults(result);
            this.showProcessingMessage(false);

        } catch (error) {
            console.error('Error uploading audio:', error);
            this.showProcessingMessage(false);
            alert('Error processing audio. Please try again.');
        }
    }

    displayTranscriptResults(data) {
        // Show transcript section
        this.transcriptSection.classList.remove('hidden');

        // Display important content
        this.displayContentList(this.importantContent, data.important || [], 'important');

        // Display noise content
        this.displayContentList(this.noiseContent, data.noise || [], 'noise');

        // Display uncertain content with controls
        this.displayUncertainContent(data.uncertain || []);

        // Show save section if there's important content
        if ((data.important && data.important.length > 0) || (data.uncertain && data.uncertain.length > 0)) {
            this.saveSection.classList.remove('hidden');
        }

        // Show reset section
        this.resetSection.classList.remove('hidden');
    }

    displayContentList(container, items, type) {
        container.innerHTML = '';
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; font-style: italic;">No content in this category</p>';
            return;
        }

        items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'content-item';
            itemDiv.textContent = item;
            itemDiv.dataset.type = type;
            itemDiv.dataset.index = index;
            container.appendChild(itemDiv);
        });
    }

    displayUncertainContent(items) {
        this.uncertainContent.innerHTML = '';
        
        if (items.length === 0) {
            this.uncertainContent.innerHTML = '<p style="color: #6c757d; font-style: italic;">No uncertain content to review</p>';
            return;
        }

        items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'content-item uncertain-item';
            
            itemDiv.innerHTML = `
                <div class="uncertain-text">${item}</div>
                <div class="uncertain-controls">
                    <label>
                        <input type="radio" name="uncertain_${index}" value="important">
                        Important
                    </label>
                    <label>
                        <input type="radio" name="uncertain_${index}" value="noise">
                        Noise
                    </label>
                </div>
            `;
            
            itemDiv.dataset.index = index;
            this.uncertainContent.appendChild(itemDiv);
        });
    }

    getImportantContent() {
        const important = [...(this.transcriptData.important || [])];
        
        // Add confirmed uncertain items
        const uncertainItems = this.uncertainContent.querySelectorAll('.uncertain-item');
        uncertainItems.forEach((item, index) => {
            const radioButtons = item.querySelectorAll('input[type="radio"]');
            const checkedRadio = Array.from(radioButtons).find(radio => radio.checked);
            
            if (checkedRadio && checkedRadio.value === 'important') {
                const text = item.querySelector('.uncertain-text').textContent;
                important.push(text);
            }
        });

        return important;
    }

    async saveImportantContent() {
        const importantContent = this.getImportantContent();
        
        if (importantContent.length === 0) {
            alert('No important content to save. Please mark some items as important first.');
            return;
        }

        const agentType = this.agentType.value;
        
        try {
            const response = await fetch('/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: importantContent,
                    agentType: agentType,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            
            // Show confirmation
            this.saveConfirmation.classList.remove('hidden');
            this.saveFilename.textContent = `File saved as: ${result.filename}`;
            
            // Save user feedback
            await this.saveFeedback();

        } catch (error) {
            console.error('Error saving content:', error);
            alert('Error saving content. Please try again.');
        }
    }

    async saveFeedback() {
        const feedback = {
            timestamp: new Date().toISOString(),
            original: this.transcriptData,
            userChoices: {}
        };

        // Capture user choices for uncertain items
        const uncertainItems = this.uncertainContent.querySelectorAll('.uncertain-item');
        uncertainItems.forEach((item, index) => {
            const radioButtons = item.querySelectorAll('input[type="radio"]');
            const checkedRadio = Array.from(radioButtons).find(radio => radio.checked);
            
            if (checkedRadio) {
                const text = item.querySelector('.uncertain-text').textContent;
                feedback.userChoices[text] = checkedRadio.value;
            }
        });

        try {
            await fetch('/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(feedback)
            });
        } catch (error) {
            console.error('Error saving feedback:', error);
            // Don't show error to user for feedback saving
        }
    }

    resetApp() {
        // Reset all state
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.transcriptData = null;

        // Reset UI
        this.updateRecordingUI(false);
        this.showProcessingMessage(false);
        this.transcriptSection.classList.add('hidden');
        this.saveSection.classList.add('hidden');
        this.resetSection.classList.add('hidden');
        this.saveConfirmation.classList.add('hidden');

        // Clear content
        this.importantContent.innerHTML = '';
        this.noiseContent.innerHTML = '';
        this.uncertainContent.innerHTML = '';
        this.saveFilename.textContent = '';

        // Reset form
        this.agentType.selectedIndex = 0;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AudioTranscriptionApp();
});

// Service Worker for offline functionality (optional enhancement)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
} 