/**
 * BriAI Comedy Agent Frontend
 * Simple interface for OpenAI Agents SDK realtime sessions
 */

class BriAIClient {
    constructor() {
        this.isConnected = false;
        this.isConnecting = false;
        this.mediaStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;

        // WebSocket connection
        this.ws = null;
        this.isRecording = false;

        // Audio playback queue
        this.audioQueue = [];
        this.isPlayingAudio = false;
        this.currentAudioTime = 0;

        // Connection recovery
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 1000; // Start with 1 second
        this.reconnectTimer = null;
        this.connectionId = null;

        // Connection health monitoring
        this.heartbeatInterval = null;
        this.lastHeartbeat = null;
        this.heartbeatTimeout = 30000; // 30 seconds

        // Audio processing states
        this.isListening = false;
        this.isProcessing = false;
        this.isSpeaking = false;
        this.isGeneratingResponse = false;

        // Audio buffer tracking
        this.audioBufferStartTime = null;
        this.minAudioDuration = 150; // Minimum 150ms of audio before committing
        
        // Prevent duplicate responses
        this.lastResponseTime = 0;
        this.responseDebounceMs = 500; // Minimum time between responses
        
        // Track last transcripts to prevent duplicates
        this.lastUserTranscript = '';
        this.lastAssistantTranscript = '';
        this.lastSystemMessage = '';
        this.lastAssistantTime = 0;
        this.lastSystemTime = 0;
        


        // Token tracking
        this.tokenStats = {
            tokensIn: 0,
            tokensOut: 0,
            totalTokens: 0,
            sessionCost: 0,
            sessionStart: Date.now()
        };

        // OpenAI Realtime API pricing (per 1M tokens)
        this.pricing = {
            input: 5.00,   // $5.00 per 1M input tokens
            output: 20.00  // $20.00 per 1M output tokens
        };

        // UI elements
        this.connectBtn = document.getElementById('connect-btn');
        this.disconnectBtn = document.getElementById('disconnect-btn');
        this.connectionStatus = document.getElementById('connection-status');
        this.transcriptionLog = document.getElementById('transcription-log');
        this.clearLogBtn = document.getElementById('clear-log-btn');
        this.errorMessage = document.getElementById('error-message');
        this.retryBtn = document.getElementById('retry-btn');
        this.audioStatus = document.getElementById('audio-status');

        this.initializeEventListeners();
        this.logDebug('BriAI Client initialized');
    }

    initializeEventListeners() {
        this.connectBtn.addEventListener('click', () => this.startConversation());
        this.disconnectBtn.addEventListener('click', () => this.stopConversation());
        this.clearLogBtn.addEventListener('click', () => this.clearTranscriptionLog());

        // Add retry button listener if element exists
        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => this.retryConnection());
        }

        // Handle browser tab visibility changes for connection management
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isConnected) {
                this.logDebug('Tab hidden - maintaining connection');
            } else if (!document.hidden && this.isConnected) {
                this.logDebug('Tab visible - checking connection health');
                this.checkConnectionHealth();
            }
        });

        // Handle network status changes
        window.addEventListener('online', () => {
            this.logDebug('Network connection restored');
            if (!this.isConnected && !this.isConnecting) {
                this.showNetworkRecoveryOption();
            }
        });

        window.addEventListener('offline', () => {
            this.logDebug('Network connection lost');
            this.handleNetworkError();
        });
    }

    async startConversation() {
        if (this.isConnecting || this.isConnected) return;

        try {
            this.setConnectionStatus('connecting');
            this.setAudioStatus('idle');
            this.hideErrorMessage();
            this.logDebug('Starting conversation...');

            // Reset reconnection attempts for new connection
            this.reconnectAttempts = 0;
            
            // Reset duplicate tracking
            this.lastUserTranscript = '';
            this.lastAssistantTranscript = '';
            this.lastSystemMessage = '';
            this.lastAssistantTime = 0;
            this.lastSystemTime = 0;
            this.isGeneratingResponse = false;
            this.lastResponseTime = 0;
            this.processedEvents = new Set();

            // Establish WebSocket connection to proxy
            await this.connectWebSocket();

            // Request microphone access for audio streaming
            await this.requestMicrophoneAccess();

            // Set up audio analysis and streaming
            await this.setupAudioAnalysis();

            this.setConnectionStatus('connected');
            this.setAudioStatus('idle');
            this.logDebug('Conversation started successfully');
            this.logTranscription('System: Conversation started. You can now speak to BriAI!', 'system');

        } catch (error) {
            this.logError('Failed to start conversation', error);
            this.setConnectionStatus('error');
            this.setAudioStatus('error');

            // Provide specific error messages based on error type
            if (error.message.includes('Microphone access denied')) {
                this.showErrorMessage('Microphone access is required for voice conversation. Please allow microphone access and try again.', true);
            } else if (error.message.includes('WebSocket connection failed')) {
                this.showErrorMessage('Unable to connect to the server. Please check your internet connection and try again.', true);
            } else if (error.message.includes('AudioContext')) {
                this.showErrorMessage('Audio system initialization failed. Please refresh the page and try again.', true);
            } else {
                this.showErrorMessage(`Connection failed: ${error.message}. Please try again.`, true);
            }

            this.cleanup();
        }
    }

    async stopConversation() {
        if (!this.isConnected && !this.isConnecting) return;

        this.logDebug('Stopping conversation...');
        this.setConnectionStatus('disconnected');
        this.setAudioStatus('idle');
        this.hideErrorMessage();

        // Cancel any pending reconnection attempts
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Reset reconnection state
        this.reconnectAttempts = 0;

        this.cleanup();
        this.logTranscription('System: Conversation ended.', 'system');
        this.logDebug('Conversation stopped');
    }

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                // Close any existing WebSocket connection first
                if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
                    this.logDebug('Closing existing WebSocket connection');
                    this.ws.close();
                    this.ws = null;
                }
                
                // Determine WebSocket URL
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws/realtime`;

                this.logDebug(`Connecting to WebSocket: ${wsUrl}`);

                // Set connection timeout
                const connectionTimeout = setTimeout(() => {
                    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                        this.ws.close();
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000); // 10 second timeout

                this.ws = new WebSocket(wsUrl);
                this.connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                this.ws.onopen = () => {
                    clearTimeout(connectionTimeout);
                    this.logDebug(`WebSocket connection established: ${this.connectionId}`);
                    this.startHeartbeat();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.logDebug(`[${this.connectionId}] Received: ${data.type}`);
                        this.handleOpenAIEvent(data);
                    } catch (error) {
                        this.logError('Failed to parse WebSocket message', error);
                        // Don't fail the connection for parse errors, just log them
                    }
                };

                this.ws.onerror = (error) => {
                    clearTimeout(connectionTimeout);
                    this.logError('WebSocket error', error);

                    // Provide more specific error messages based on readyState
                    if (this.ws.readyState === WebSocket.CONNECTING) {
                        reject(new Error('WebSocket connection failed - unable to reach server'));
                    } else {
                        reject(new Error('WebSocket connection failed'));
                    }
                };

                this.ws.onclose = (event) => {
                    clearTimeout(connectionTimeout);
                    this.logDebug(`WebSocket closed: ${event.code} - ${event.reason}`);

                    if (this.isConnected || this.isConnecting) {
                        // Handle different close codes with appropriate user feedback
                        if (event.code === 1000) {
                            // Normal closure
                            this.setConnectionStatus('disconnected');
                            this.setAudioStatus('idle');
                            this.logTranscription('System: Connection closed normally.', 'system');
                        } else if (event.code === 1006 || event.code === 1001) {
                            // Abnormal closure or going away - attempt reconnection
                            this.setConnectionStatus('reconnecting');
                            this.setAudioStatus('idle');
                            this.logTranscription('System: Connection lost unexpectedly. Attempting to reconnect...', 'system');
                            this.attemptReconnection();
                        } else if (event.code === 1011) {
                            // Server error
                            this.setConnectionStatus('error');
                            this.setAudioStatus('error');
                            this.showErrorMessage('Server error occurred. Please wait a moment and try reconnecting.', true);
                        } else if (event.code === 1002) {
                            // Protocol error
                            this.setConnectionStatus('error');
                            this.setAudioStatus('error');
                            this.showErrorMessage('Protocol error. Please refresh the page and try again.', true);
                        } else if (event.code === 1003) {
                            // Unsupported data
                            this.setConnectionStatus('error');
                            this.setAudioStatus('error');
                            this.showErrorMessage('Unsupported data format. Please refresh the page and try again.', true);
                        } else if (event.code === 1009) {
                            // Message too big
                            this.setConnectionStatus('error');
                            this.setAudioStatus('error');
                            this.showErrorMessage('Audio data too large. Please try speaking in shorter segments.', false);
                            // Auto-retry after a short delay
                            setTimeout(() => {
                                this.hideErrorMessage();
                                this.setConnectionStatus('disconnected');
                                this.setAudioStatus('idle');
                            }, 3000);
                        } else {
                            // Other error codes
                            this.setConnectionStatus('error');
                            this.setAudioStatus('error');
                            this.showErrorMessage(`Connection failed (Code: ${event.code}). Please try reconnecting.`, true);
                        }

                        // Only cleanup if this wasn't a normal closure during reconnection
                        if (event.code !== 1000 || !this.reconnectTimer) {
                            this.cleanup();
                        }
                    }
                };

            } catch (error) {
                this.logError('Failed to create WebSocket', error);
                reject(error);
            }
        });
    }

    async requestMicrophoneAccess() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 24000, // OpenAI Realtime API expects 24kHz
                    channelCount: 1
                }
            });
            this.logDebug('Microphone access granted');
        } catch (error) {
            throw new Error(`Microphone access denied: ${error.message}`);
        }
    }

    async setupAudioAnalysis() {
        try {
            // Use modern AudioContext (webkitAudioContext is deprecated)
            this.audioContext = new AudioContext({
                sampleRate: 24000
            });

            // Resume audio context if it's suspended (required by some browsers)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                this.logDebug('Audio context resumed');
            }

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();

            // Configure analyser for better volume detection
            this.analyser.fftSize = 1024; // Larger FFT for better resolution
            this.analyser.smoothingTimeConstant = 0.3; // Smooth out rapid changes
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;

            source.connect(this.analyser);

            const bufferLength = this.analyser.fftSize;
            this.dataArray = new Uint8Array(bufferLength);

            // Set up audio processing for sending to backend using modern AudioWorklet
            await this.setupAudioProcessor(source);

            this.startVolumeMonitoring();
            this.logDebug('Audio analysis setup complete');
        } catch (error) {
            this.logError('Failed to setup audio analysis', error);
        }
    }

    async setupAudioProcessor(source) {
        try {
            // Use ScriptProcessorNode directly (more reliable than AudioWorklet)
            this.logDebug('Setting up ScriptProcessorNode for audio processing...');
            this.setupFallbackAudioProcessor(source);

        } catch (error) {
            this.logError('Failed to setup audio processor', error);
        }
    }

    setupFallbackAudioProcessor(source) {
        try {
            // Fallback using ScriptProcessorNode (deprecated but widely supported)
            const bufferSize = 4096;
            const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

            processor.addEventListener('audioprocess', (event) => {
                if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                    return;
                }

                const inputData = event.inputBuffer.getChannelData(0);

                // Check if there's actual audio data
                let hasAudio = false;
                for (let i = 0; i < inputData.length; i++) {
                    if (Math.abs(inputData[i]) > 0.001) {
                        hasAudio = true;
                        break;
                    }
                }

                // Convert Float32Array to Int16Array (PCM16)
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const sample = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                }

                // Convert to base64 for transmission
                const audioData = this.arrayBufferToBase64(pcm16.buffer);

                // Send audio data to OpenAI via WebSocket
                this.sendToOpenAI({
                    type: 'input_audio_buffer.append',
                    audio: audioData
                });

                // Log only when we detect actual speech
                if (hasAudio) {
                    this.logDebug(`Sending audio data to OpenAI: ${audioData.length} bytes (speech detected)`);
                }
            });

            // Connect the processor
            source.connect(processor);
            processor.connect(this.audioContext.destination);

            this.logDebug('Fallback ScriptProcessorNode setup complete - streaming to OpenAI');
            this.isRecording = true;

        } catch (error) {
            this.logError('Failed to setup fallback audio processor', error);
        }
    }

    startVolumeMonitoring() {
        if (!this.analyser || !this.dataArray) {
            this.logDebug('Volume monitoring not available - missing components');
            return;
        }

        const updateVolume = () => {
            if (!this.analyser || !this.isConnected) {
                return;
            }

            try {
                this.analyser.getByteTimeDomainData(this.dataArray);

                // Calculate RMS (Root Mean Square) for audio level detection
                let sum = 0;
                for (let i = 0; i < this.dataArray.length; i++) {
                    const sample = (this.dataArray[i] - 128) / 128; // Convert to -1 to 1 range
                    sum += sample * sample;
                }
                const rms = Math.sqrt(sum / this.dataArray.length);
                const volumePercent = Math.min(100, rms * 100 * 3); // Scale and cap at 100%

                // Continue monitoring if still connected (for internal audio processing)
                if (this.isConnected) {
                    this.animationId = requestAnimationFrame(updateVolume);
                }
            } catch (error) {
                this.logDebug(`Volume monitoring error: ${error.message}`);
            }
        };

        this.logDebug('Starting volume monitoring (internal processing only)');
        updateVolume();
    }

    sendToOpenAI(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    handleOpenAIEvent(event) {
        this.logDebug(`Received event: ${event.type}`);
        
        // Add unique event ID tracking to detect duplicates
        const eventId = `${event.type}_${Date.now()}_${Math.random()}`;
        if (!this.processedEvents) {
            this.processedEvents = new Set();
        }
        
        // For transcript events, use content-based deduplication
        let dedupKey = eventId;
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
            dedupKey = `user_transcript_${event.transcript}`;
        } else if (event.type === 'response.audio_transcript.done') {
            dedupKey = `assistant_transcript_${event.transcript}`;
        }
        
        if (this.processedEvents.has(dedupKey)) {
            this.logDebug(`🚫 Duplicate event detected and skipped: ${event.type}`);
            return;
        }
        this.processedEvents.add(dedupKey);
        
        // Clean up old events (keep last 100)
        if (this.processedEvents.size > 100) {
            const eventsArray = Array.from(this.processedEvents);
            this.processedEvents = new Set(eventsArray.slice(-50));
        }

        switch (event.type) {
            case 'session.created':
                this.logDebug('OpenAI session created');
                // Session is ready, we can start sending audio
                this.logTranscription('System: Session created. Ready for conversation!', 'system');
                break;

            case 'session.updated':
                this.logDebug('OpenAI session updated');
                break;

            case 'conversation.item.input_audio_transcription.completed':
                // Replace the last "[Speaking...]" placeholder with actual transcript
                this.updateLastUserTranscript(event.transcript);
                break;

            case 'conversation.item.input_audio_transcription.failed':
                this.logDebug('Audio transcription failed');
                break;

            case 'response.audio_transcript.delta':
                // Build up the assistant response in real-time
                this.appendAssistantTranscript(event.delta);
                break;

            case 'response.audio_transcript.done':
                // Finalize the assistant transcript
                this.finalizeAssistantTranscript();
                break;

            case 'response.audio.done':
                this.logDebug('Audio response completed');
                // Reset audio timing for next response
                this.currentAudioTime = this.audioContext.currentTime;
                break;

            case 'response.audio.delta':
                // Play audio chunk immediately for real-time playback
                this.setAudioStatus('speaking');
                this.playAudioChunk(event.delta);
                break;

            case 'input_audio_buffer.speech_started':
                this.logDebug('🎤 Speech detection started');
                this.setAudioStatus('listening');
                this.logTranscription('User: [Speaking...]', 'user');
                this.audioBufferStartTime = Date.now();
                break;

            case 'input_audio_buffer.speech_stopped':
                this.logDebug('🎤 Speech detection stopped');

                // Calculate audio duration
                const audioDuration = this.audioBufferStartTime ? Date.now() - this.audioBufferStartTime : 0;
                this.logDebug(`Audio duration: ${audioDuration}ms`);

                // Only commit if we have enough audio and not already generating a response
                if (!this.isGeneratingResponse && audioDuration >= this.minAudioDuration) {
                    this.setAudioStatus('processing');
                    this.sendToOpenAI({
                        type: 'input_audio_buffer.commit'
                    });
                } else if (audioDuration < this.minAudioDuration) {
                    this.logDebug(`⚠️ Audio too short (${audioDuration}ms), skipping commit`);
                    this.setAudioStatus('idle');
                    // Don't log system message for short audio - it creates noise
                } else {
                    this.logDebug('⚠️ Response already in progress, skipping commit');
                    this.setAudioStatus('idle');
                }

                // Reset buffer timing
                this.audioBufferStartTime = null;
                break;

            case 'input_audio_buffer.committed':
                this.logDebug('Audio buffer committed, generating response');
                
                // Prevent duplicate responses with debouncing
                const now = Date.now();
                if (this.isGeneratingResponse || (now - this.lastResponseTime) < this.responseDebounceMs) {
                    this.logDebug('⚠️ Response already in progress or too soon, skipping create');
                    return;
                }
                
                this.isGeneratingResponse = true;
                this.lastResponseTime = now;
                this.logTranscription('System: Processing...', 'system');
                this.sendToOpenAI({
                    type: 'response.create',
                    response: {
                        modalities: ['text', 'audio'],
                        instructions: 'Please respond to the user in your comedic style.'
                    }
                });
                break;

            case 'response.created':
                this.logDebug('Response generation started');
                this.setAudioStatus('generating');
                this.isGeneratingResponse = true;
                break;

            case 'response.done':
                this.logDebug('Response completed');
                this.setAudioStatus('idle');
                this.isGeneratingResponse = false;
                // Reset audio timing for next response
                this.currentAudioTime = this.audioContext.currentTime;

                // Track token usage if available
                if (event.response && event.response.usage) {
                    this.updateTokenCount(event.response.usage.input_tokens || 0, event.response.usage.output_tokens || 0);
                }
                break;

            case 'response.output_item.added':
                this.logDebug('Response item added');
                break;

            case 'response.output_item.done':
                this.logDebug('Response item completed');
                break;

            case 'conversation.item.created':
                this.logDebug('Conversation item created');
                break;

            case 'rate_limits.updated':
                this.logDebug(`Rate limits updated: ${JSON.stringify(event.rate_limits)}`);
                break;

            case 'error':
                this.logError('OpenAI error', event.error);
                this.setAudioStatus('error');

                // Handle specific error types with appropriate user feedback
                if (event.error && event.error.message && event.error.message.includes('Conversation already has an active response')) {
                    this.logDebug('⚠️ Active response error - resetting state');
                    this.isGeneratingResponse = false;
                    this.setAudioStatus('idle');
                    // Don't show error message for this - it's handled internally
                } else if (event.error && event.error.message && event.error.message.includes('buffer too small')) {
                    this.logDebug('⚠️ Audio buffer too small - handled internally');
                    this.setAudioStatus('idle');
                    // Don't log system message for buffer errors - creates duplicate noise
                } else if (event.error && event.error.type === 'server_error') {
                    this.showErrorMessage('OpenAI server error. Attempting to reconnect...', false);
                    this.setConnectionStatus('reconnecting');
                    this.attemptReconnection();
                } else if (event.error && event.error.type === 'rate_limit_exceeded') {
                    this.showErrorMessage('Rate limit exceeded. Please wait a moment before continuing the conversation.', false);
                    // Auto-retry after a delay for rate limits
                    setTimeout(() => {
                        this.hideErrorMessage();
                        this.setAudioStatus('idle');
                    }, 5000);
                } else if (event.error && event.error.type === 'authentication_error') {
                    this.showErrorMessage('Authentication failed. Please refresh the page and try again.', true);
                    this.setConnectionStatus('error');
                } else if (event.error && event.error.type === 'permission_error') {
                    this.showErrorMessage('Permission denied. Please check your account settings.', true);
                    this.setConnectionStatus('error');
                } else if (event.error && event.error.type === 'connection_error') {
                    this.showErrorMessage('Connection to OpenAI lost. Attempting to reconnect...', false);
                    this.setConnectionStatus('reconnecting');
                    this.attemptReconnection();
                } else {
                    const errorMsg = event.error?.message || event.error?.code || 'Unknown error occurred';
                    this.showErrorMessage(`Error: ${errorMsg}. Please try again.`, true);
                }
                break;

            case 'pong':
                this.logDebug('Heartbeat pong received');
                break;

            default:
                this.logDebug(`Unhandled event type: ${event.type}`);
        }
    }

    async playAudioChunk(audioData) {
        try {
            // Ensure audio context is running
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Decode base64 audio data
            const binaryString = atob(audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Convert to Float32Array for Web Audio API
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
            }

            // Create audio buffer
            const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
            audioBuffer.getChannelData(0).set(float32);

            // Add to queue for sequential playback
            this.audioQueue.push({
                buffer: audioBuffer,
                timestamp: this.audioContext.currentTime
            });

            // Start playing if not already playing
            if (!this.isPlayingAudio) {
                this.playNextAudioChunk();
            }

        } catch (error) {
            this.logError('Failed to process audio chunk', error);
        }
    }

    playNextAudioChunk() {
        if (this.audioQueue.length === 0) {
            this.isPlayingAudio = false;
            this.currentAudioTime = this.audioContext.currentTime;
            return;
        }

        this.isPlayingAudio = true;
        const audioItem = this.audioQueue.shift();
        const audioBuffer = audioItem.buffer;

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        // Calculate when to start this chunk for seamless playback
        const startTime = Math.max(this.audioContext.currentTime, this.currentAudioTime);

        // Schedule the next chunk to play when this one ends
        source.onended = () => {
            // Continue playing next chunk immediately for real-time streaming
            this.playNextAudioChunk();
        };

        // Start playback
        source.start(startTime);
        this.currentAudioTime = startTime + audioBuffer.duration;

        this.logDebug(`Playing audio chunk: ${audioBuffer.duration.toFixed(3)}s, queue: ${this.audioQueue.length}`);
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    appendAssistantTranscript(delta) {
        // Find or create the current assistant message element
        let currentElement = this.transcriptionLog.querySelector('.assistant.current');

        if (!currentElement) {
            currentElement = document.createElement('div');
            currentElement.className = 'log-entry assistant current';
            
            // Create elements safely to prevent XSS
            const timestamp = document.createElement('span');
            timestamp.className = 'timestamp';
            timestamp.textContent = this.getTimestamp();
            
            currentElement.appendChild(timestamp);
            
            // Create a text node for the content
            const textNode = document.createTextNode('BriAI: ');
            currentElement.appendChild(textNode);
            
            // Store reference to text content for updates
            currentElement._textContent = 'BriAI: ';
            
            this.transcriptionLog.appendChild(currentElement);
            
            // Remove placeholder if it exists
            const placeholder = this.transcriptionLog.querySelector('.placeholder');
            if (placeholder) {
                placeholder.remove();
            }
        }

        // Append the delta text
        currentElement._textContent += delta;
        
        // Update the display (replace text content after timestamp)
        const timestamp = currentElement.querySelector('.timestamp');
        currentElement.textContent = '';
        currentElement.appendChild(timestamp);
        currentElement.appendChild(document.createTextNode(currentElement._textContent));
        
        this.scrollToBottom(this.transcriptionLog);
    }

    finalizeAssistantTranscript() {
        const currentElement = this.transcriptionLog.querySelector('.assistant.current');
        if (currentElement) {
            currentElement.classList.remove('current');
        }
    }

    updateLastUserTranscript(transcript) {
        // Find the last user entry with "[Speaking...]" and replace it
        const userEntries = this.transcriptionLog.querySelectorAll('.log-entry.user');
        const lastUserEntry = userEntries[userEntries.length - 1];
        
        if (lastUserEntry && lastUserEntry.textContent.includes('[Speaking...]')) {
            // Replace the content while preserving the timestamp
            const timestamp = lastUserEntry.querySelector('.timestamp');
            lastUserEntry.textContent = '';
            lastUserEntry.appendChild(timestamp);
            lastUserEntry.appendChild(document.createTextNode(`User: ${transcript}`));
            
            // Update tracking
            this.lastUserTranscript = `User: ${transcript}`;
        } else {
            // Fallback: create new entry if no placeholder found
            this.logTranscription(`User: ${transcript}`, 'user');
        }
    }

    setConnectionStatus(status) {
        this.connectionStatus.className = `status ${status}`;

        switch (status) {
            case 'connecting':
                this.connectionStatus.textContent = 'Connecting...';
                this.connectBtn.disabled = true;
                this.disconnectBtn.disabled = false;
                this.isConnecting = true;
                this.isConnected = false;
                break;

            case 'connected':
                this.connectionStatus.textContent = 'Connected';
                this.connectBtn.disabled = true;
                this.disconnectBtn.disabled = false;
                this.isConnecting = false;
                this.isConnected = true;
                break;

            case 'disconnected':
                this.connectionStatus.textContent = 'Disconnected';
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = true;
                this.isConnecting = false;
                this.isConnected = false;
                break;

            case 'reconnecting':
                this.connectionStatus.textContent = `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
                this.connectBtn.disabled = true;
                this.disconnectBtn.disabled = false;
                this.isConnecting = true;
                this.isConnected = false;
                break;

            case 'error':
                this.connectionStatus.textContent = 'Connection Error';
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = true;
                this.isConnecting = false;
                this.isConnected = false;
                break;
        }
    }

    setAudioStatus(status) {
        if (!this.audioStatus) return;

        this.audioStatus.className = `audio-status ${status}`;

        switch (status) {
            case 'idle':
                this.audioStatus.textContent = 'Ready';
                break;
            case 'listening':
                this.audioStatus.textContent = 'Listening...';
                break;
            case 'processing':
                this.audioStatus.textContent = 'Processing...';
                break;
            case 'generating':
                this.audioStatus.textContent = 'Generating...';
                break;
            case 'speaking':
                this.audioStatus.textContent = 'Speaking';
                break;
            case 'error':
                this.audioStatus.textContent = 'Audio Error';
                break;
        }
    }

    showErrorMessage(message, showRetry = false) {
        if (!this.errorMessage) return;

        const errorText = this.errorMessage.querySelector('.error-text');
        if (errorText) {
            errorText.textContent = message;
        }

        if (this.retryBtn) {
            this.retryBtn.style.display = showRetry ? 'inline-block' : 'none';
        }

        this.errorMessage.style.display = 'flex';
        this.logError(message);
    }

    hideErrorMessage() {
        if (this.errorMessage) {
            this.errorMessage.style.display = 'none';
        }
    }

    async retryConnection() {
        this.logDebug('Manual retry connection requested');
        this.hideErrorMessage();
        await this.startConversation();
    }

    async attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logError('Maximum reconnection attempts reached');
            this.setConnectionStatus('error');
            this.setAudioStatus('error');
            this.showErrorMessage('Connection lost. Maximum retry attempts reached. Please click "Start Conversation" to try again.', false);
            return;
        }

        this.reconnectAttempts++;
        this.logDebug(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

        // Update status to show reconnection progress
        this.setConnectionStatus('reconnecting');

        // Wait before attempting reconnection (exponential backoff)
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.logDebug(`Waiting ${delay}ms before reconnection attempt`);

        this.reconnectTimer = setTimeout(async () => {
            try {
                this.logDebug('Attempting to reconnect...');

                // Clean up current connection state
                this.cleanup();

                // Try to reconnect
                await this.connectWebSocket();
                await this.requestMicrophoneAccess();
                await this.setupAudioAnalysis();

                // Success - reset reconnection state
                this.reconnectAttempts = 0;
                this.setConnectionStatus('connected');
                this.setAudioStatus('idle');
                this.logTranscription('System: Reconnected successfully!', 'system');
                this.logDebug('Reconnection successful');

            } catch (error) {
                this.logError('Reconnection failed', error);

                // Try again if we haven't reached max attempts
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnection();
                } else {
                    this.setConnectionStatus('error');
                    this.setAudioStatus('error');
                    this.showErrorMessage('Unable to reconnect after multiple attempts. Please check your connection and try again.', true);
                }
            }
        }, delay);
    }

    checkConnectionHealth() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Send a ping to check connection health
            this.sendToOpenAI({
                type: 'ping',
                timestamp: Date.now()
            });
            this.logDebug('Connection health check sent');
        } else if (this.isConnected) {
            this.logDebug('Connection health check failed - WebSocket not open');
            this.setConnectionStatus('reconnecting');
            this.attemptReconnection();
        }
    }

    showNetworkRecoveryOption() {
        if (!this.isConnected && !this.isConnecting) {
            this.showErrorMessage('Network connection restored. Would you like to reconnect?', true);
        }
    }

    handleNetworkError() {
        if (this.isConnected || this.isConnecting) {
            this.setConnectionStatus('error');
            this.setAudioStatus('error');
            this.showErrorMessage('Network connection lost. Please check your internet connection.', false);
            this.cleanup();
        }
    }

    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing heartbeat

        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Send a heartbeat ping
                this.sendToOpenAI({
                    type: 'ping',
                    timestamp: Date.now()
                });
                this.lastHeartbeat = Date.now();
                this.logDebug('Heartbeat sent');
            } else if (this.isConnected) {
                this.logDebug('Heartbeat failed - connection lost');
                this.setConnectionStatus('reconnecting');
                this.attemptReconnection();
            }
        }, this.heartbeatTimeout);

        this.logDebug('Heartbeat monitoring started');
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            this.logDebug('Heartbeat monitoring stopped');
        }
    }

    logTranscription(message, type = 'system') {
        this.logTranscriptionWithTimestamp(message, type, null);
    }

    logTranscriptionWithTimestamp(message, type = 'system', customTimestamp = null) {
        // Only prevent exact duplicates within a short time window (not all messages of same type)
        const now = Date.now();
        const duplicateWindow = 2000; // 2 seconds
        
        if (type === 'assistant' && message === this.lastAssistantTranscript && 
            this.lastAssistantTime && (now - this.lastAssistantTime) < duplicateWindow) {
            this.logDebug('Skipping duplicate assistant transcript');
            return;
        }
        if (type === 'system' && message === this.lastSystemMessage &&
            this.lastSystemTime && (now - this.lastSystemTime) < duplicateWindow) {
            this.logDebug('Skipping duplicate system message');
            return;
        }
        
        // Update last message tracking with timestamps
        if (type === 'user') this.lastUserTranscript = message;
        if (type === 'assistant') {
            this.lastAssistantTranscript = message;
            this.lastAssistantTime = now;
        }
        if (type === 'system') {
            this.lastSystemMessage = message;
            this.lastSystemTime = now;
        }
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        // Create elements safely to prevent XSS
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = customTimestamp ? this.formatTimestamp(customTimestamp) : this.getTimestamp();
        
        entry.appendChild(timestamp);
        entry.appendChild(document.createTextNode(message));

        // Remove placeholder if it exists
        const placeholder = this.transcriptionLog.querySelector('.placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        // For user messages with custom timestamps, insert in chronological order
        if (type === 'user' && customTimestamp) {
            this.insertEntryInChronologicalOrder(entry, customTimestamp);
        } else {
            this.transcriptionLog.appendChild(entry);
        }
        
        this.scrollToBottom(this.transcriptionLog);
    }

    logDebug(message) {
        // Log to console for development
        console.log(`[BriAI] ${message}`);
        
        // Send debug message to admin panel if available
        this.sendDebugToAdmin(message, 'info');
    }

    logError(message, error = null) {
        const errorMessage = error ? `${message}: ${error.message || error}` : message;

        const entry = document.createElement('div');
        entry.className = 'log-entry error';
        
        // Create elements safely to prevent XSS
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = this.getTimestamp();
        
        entry.appendChild(timestamp);
        entry.appendChild(document.createTextNode(`ERROR: ${errorMessage}`));

        // Remove placeholder if it exists
        const placeholder = this.debugLog.querySelector('.placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        this.debugLog.appendChild(entry);
        this.scrollToBottom(this.debugLog);

        // Also log to console for development (safe format string)
        console.error('[BriAI]', errorMessage, error);
    }

    clearTranscriptionLog() {
        this.transcriptionLog.innerHTML = '';
        const placeholder = document.createElement('p');
        placeholder.className = 'placeholder';
        placeholder.textContent = 'Transcription will appear here when conversation starts...';
        this.transcriptionLog.appendChild(placeholder);
    }

    sendDebugToAdmin(message, type = 'info') {
        // Store debug messages in localStorage for admin panel to pick up
        try {
            const debugEntry = {
                timestamp: new Date().toISOString(),
                message: message,
                type: type,
                source: 'main-app'
            };
            
            // Get existing debug messages
            const existingDebug = JSON.parse(localStorage.getItem('briai-debug-messages') || '[]');
            
            // Add new message
            existingDebug.push(debugEntry);
            
            // Keep only last 100 messages to prevent storage overflow
            if (existingDebug.length > 100) {
                existingDebug.splice(0, existingDebug.length - 100);
            }
            
            // Save back to localStorage
            localStorage.setItem('briai-debug-messages', JSON.stringify(existingDebug));
            
            // Trigger storage event for admin panel
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'briai-debug-messages',
                newValue: JSON.stringify(existingDebug)
            }));
        } catch (error) {
            console.warn('Failed to send debug message to admin panel:', error);
        }
    }

    getTimestamp() {
        return new Date().toLocaleTimeString();
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }

    insertEntryInChronologicalOrder(entry, timestamp) {
        const entries = Array.from(this.transcriptionLog.children);
        let insertIndex = entries.length;

        // Find the correct position to insert based on timestamp
        for (let i = entries.length - 1; i >= 0; i--) {
            const existingEntry = entries[i];
            const existingTimestamp = existingEntry.querySelector('.timestamp');
            
            if (existingTimestamp) {
                const existingTime = this.parseTimestamp(existingTimestamp.textContent);
                if (timestamp > existingTime) {
                    insertIndex = i + 1;
                    break;
                }
            }
        }

        if (insertIndex >= entries.length) {
            this.transcriptionLog.appendChild(entry);
        } else {
            this.transcriptionLog.insertBefore(entry, entries[insertIndex]);
        }
    }

    parseTimestamp(timestampText) {
        // Convert timestamp text back to milliseconds for comparison
        // This is a simple approximation - in a real app you'd want more robust parsing
        const now = new Date();
        const today = now.toDateString();
        return new Date(`${today} ${timestampText}`).getTime();
    }



    scrollToBottom(element) {
        element.scrollTop = element.scrollHeight;
    }

    cleanup() {
        this.logDebug('Starting cleanup...');

        // Stop volume monitoring
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Stop recording
        this.isRecording = false;

        // Clear audio queue and stop playback
        this.audioQueue = [];
        this.isPlayingAudio = false;
        this.currentAudioTime = 0;

        // Reset response generation state
        this.isGeneratingResponse = false;

        // Reset audio buffer timing
        this.audioBufferStartTime = null;

        // Cancel any pending reconnection attempts
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Stop heartbeat monitoring
        this.stopHeartbeat();

        // Close WebSocket connection gracefully
        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.close(1000, 'User disconnected');
            }
            this.ws = null;
        }

        // Disconnect audio processor
        if (this.audioProcessor) {
            try {
                this.audioProcessor.disconnect();
                this.audioProcessor = null;
            } catch (error) {
                this.logDebug('Error disconnecting audio processor:', error);
            }
        }

        // Stop media stream tracks
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (error) {
                    this.logDebug('Error stopping media track:', error);
                }
            });
            this.mediaStream = null;
        }

        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try {
                this.audioContext.close();
            } catch (error) {
                this.logDebug('Error closing audio context:', error);
            }
            this.audioContext = null;
        }

        // Reset analyser
        this.analyser = null;
        this.dataArray = null;

        // Reset audio processing states
        this.isListening = false;
        this.isProcessing = false;
        this.isSpeaking = false;

        this.logDebug('Cleanup completed');
    }

    // Token tracking methods
    updateTokenCount(tokensIn = 0, tokensOut = 0) {
        this.tokenStats.tokensIn += tokensIn;
        this.tokenStats.tokensOut += tokensOut;
        this.tokenStats.totalTokens = this.tokenStats.tokensIn + this.tokenStats.tokensOut;

        // Calculate estimated cost
        const inputCost = (this.tokenStats.tokensIn / 1000000) * this.pricing.input;
        const outputCost = (this.tokenStats.tokensOut / 1000000) * this.pricing.output;
        this.tokenStats.sessionCost = inputCost + outputCost;

        // Send token update to admin panel if it exists
        this.broadcastTokenUpdate();

        if (tokensIn > 0 || tokensOut > 0) {
            this.logDebug(`Token usage: +${tokensIn} in, +${tokensOut} out (Total: ${this.tokenStats.totalTokens})`);
        }
    }

    broadcastTokenUpdate() {
        // Send token stats to admin panel via localStorage event
        try {
            localStorage.setItem('briai-token-stats', JSON.stringify(this.tokenStats));
            // Trigger storage event for cross-tab communication
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'briai-token-stats',
                newValue: JSON.stringify(this.tokenStats)
            }));
        } catch (error) {
            this.logDebug(`Failed to broadcast token update: ${error.message}`);
        }
    }

    getTokenStats() {
        return { ...this.tokenStats };
    }


}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.briaiClient = new BriAIClient();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.briaiClient) {
        window.briaiClient.cleanup();
    }
});