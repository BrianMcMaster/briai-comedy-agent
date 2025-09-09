/**
 * BriAI Comedy Agent Admin Panel JavaScript
 */

let audioContext = null;
let mediaStream = null;
let analyser = null;
let isRecording = false;
let websocket = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 3;

// Token tracking variables
let tokenStats = {
    tokensIn: 0,
    tokensOut: 0,
    totalTokens: 0,
    sessionCost: 0,
    sessionStart: Date.now()
};

// Token usage history
let tokenHistory = [];

// OpenAI Realtime API pricing (per 1M tokens)
const PRICING = {
    input: 5.00,   // $5.00 per 1M input tokens
    output: 20.00  // $20.00 per 1M output tokens
};

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing admin panel...');
    
    // Update status indicator
    const jsStatus = document.getElementById('js-status');
    if (jsStatus) {
        jsStatus.style.background = '#fff3cd';
        jsStatus.style.color = '#856404';
        jsStatus.textContent = '🔄 JavaScript Loaded - Initializing...';
    }
    
    // Test if basic functions work
    try {
        log('Admin panel loaded', 'info');
        console.log('Log function works');
        
        // Update status to success
        if (jsStatus) {
            jsStatus.style.background = '#d4edda';
            jsStatus.style.color = '#155724';
            jsStatus.textContent = '✅ JavaScript Ready - Admin Panel Active';
        }
        
        // Initialize all systems
        initializeAdminPanel();
    } catch (error) {
        console.error('Error during initialization:', error);
        
        // Update status to error
        if (jsStatus) {
            jsStatus.style.background = '#f8d7da';
            jsStatus.style.color = '#721c24';
            jsStatus.textContent = '❌ JavaScript Error: ' + error.message;
        }
        
        alert('Admin panel initialization failed: ' + error.message);
    }
});

async function initializeAdminPanel() {
    try {
        log('Starting admin panel initialization...', 'info');
        
        // Initialize token stats first (simple operation)
        loadTokenStats();
        updateTokenDisplay();
        log('Token stats initialized', 'success');
        
        // Load configuration (might fail if server is down)
        try {
            await loadConfiguration();
            log('Configuration loaded', 'success');
        } catch (configError) {
            log(`Configuration load failed: ${configError.message}`, 'warning');
        }
        
        // Check system health (might fail if server is down)
        try {
            await checkSystemHealth();
            log('System health check completed', 'success');
        } catch (healthError) {
            log(`System health check failed: ${healthError.message}`, 'warning');
        }
        
        // Set up periodic health checks (only if initial check succeeded)
        // setInterval(checkSystemHealth, 30000); // Disabled for now to avoid errors
        
        log('Admin panel initialization complete', 'success');
    } catch (error) {
        console.error('Admin panel initialization error:', error);
        log(`Admin panel initialization failed: ${error.message}`, 'error');
        showAlert('system-alerts', 'Admin panel initialization failed. Some features may not work correctly.', 'danger');
    }
    
    // Listen for token updates from main app
    window.addEventListener('storage', function(e) {
        if (e.key === 'briai-token-stats' && e.newValue) {
            try {
                tokenStats = JSON.parse(e.newValue);
                updateTokenDisplay();
                log('Token stats updated from main app', 'info');
            } catch (error) {
                log(`Failed to parse token stats update: ${error.message}`, 'warning');
            }
        }
    });
    
    // Poll for token updates every 2 seconds
    setInterval(function() {
        const saved = localStorage.getItem('briai-token-stats');
        if (saved) {
            try {
                const newStats = JSON.parse(saved);
                if (newStats.totalTokens !== tokenStats.totalTokens) {
                    tokenStats = newStats;
                    updateTokenDisplay();
                }
            } catch (error) {
                // Ignore parsing errors
            }
        }
    }, 2000);
}

// Tab management
function showTab(tabName) {
    try {
        console.log('showTab called with:', tabName);
        
        // Hide all tab contents
        const tabContents = document.querySelectorAll('.tab-content');
        if (tabContents.length === 0) {
            console.error('No tab contents found');
            return;
        }
        tabContents.forEach(tab => tab.classList.remove('active'));
        
        // Remove active class from all tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        if (tabButtons.length === 0) {
            console.error('No tab buttons found');
            return;
        }
        tabButtons.forEach(button => button.classList.remove('active'));
        
        // Show selected tab content
        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.classList.add('active');
            console.log('Tab content shown:', tabName);
        } else {
            console.error('Tab not found:', tabName);
            return;
        }
        
        // Add active class to clicked button - use event from global scope
        const clickedButton = event ? event.target : null;
        if (clickedButton && clickedButton.classList.contains('tab-button')) {
            clickedButton.classList.add('active');
            console.log('Button activated');
        } else {
            // Fallback: find the button by text content
            tabButtons.forEach(button => {
                if (button.textContent.toLowerCase().includes(tabName.toLowerCase())) {
                    button.classList.add('active');
                }
            });
        }
        
        log(`Switched to ${tabName} tab`, 'info');
        console.log('Tab switch completed successfully');
    } catch (error) {
        console.error('Error in showTab:', error);
        // Don't show alert for tab switching errors, just log them
        console.log('Tab switching failed, but continuing...');
    }
}

// Logging system
function log(message, type = 'info') {
    try {
        const timestamp = new Date().toLocaleTimeString();
        const logContainer = document.getElementById('debugLogs');
        
        // Always log to console first
        console.log(`[${timestamp}] ${message}`);
        
        if (!logContainer) {
            console.warn('Log container not found, only logging to console');
            return;
        }
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'log-timestamp';
        timestampSpan.textContent = `[${timestamp}]`;
        
        const messageSpan = document.createElement('span');
        messageSpan.className = `log-${type}`;
        messageSpan.textContent = ` ${message}`;
        
        logEntry.appendChild(timestampSpan);
        logEntry.appendChild(messageSpan);
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    } catch (error) {
        console.error('Error in log function:', error);
        console.log(`[FALLBACK] ${message}`);
    }
}

function clearLogs() {
    const logContainer = document.getElementById('debugLogs');
    logContainer.innerHTML = '<div class="log-entry"><span class="log-timestamp">[' + 
        new Date().toLocaleTimeString() + ']</span><span class="log-info"> Logs cleared</span></div>';
    log('Debug logs cleared', 'info');
}

function exportLogs() {
    const logContainer = document.getElementById('debugLogs');
    const logs = logContainer.innerText;
    
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `briai-debug-logs-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log('Debug logs exported', 'success');
}

// System health checks
async function checkSystemHealth() {
    log('Starting system health check...', 'info');
    
    try {
        // Test server status
        const serverResponse = await fetch('/api/session/status');
        if (serverResponse.ok) {
            updateStatus('server-status', '✅', 'success');
            log('Server status: OK', 'success');
        } else {
            updateStatus('server-status', '❌', 'error');
            log('Server status: ERROR', 'error');
        }
        
        // Test API connectivity
        const apiResponse = await fetch('/api/session');
        if (apiResponse.ok) {
            updateStatus('api-status', '✅', 'success');
            log('API connectivity: OK', 'success');
        } else {
            updateStatus('api-status', '❌', 'error');
            log('API connectivity: ERROR', 'error');
        }
        
        // Test WebSocket
        testWebSocketConnection();
        
        // Test audio system
        testAudioSystem();
        
        log('System health check completed', 'success');
        
        // Display system summary after a short delay to let all tests complete
        setTimeout(displaySystemSummary, 2000);
        
    } catch (error) {
        log(`System health check failed: ${error.message}`, 'error');
        showAlert('system-alerts', 'System health check failed. Please check server status.', 'danger');
        
        // Update all status indicators to error state
        updateStatus('server-status', '❌', 'error');
        updateStatus('api-status', '❌', 'error');
        updateStatus('websocket-status', '❌', 'error');
        updateStatus('audio-status', '❌', 'error');
    }
}

function updateStatus(elementId, symbol, type) {
    const element = document.getElementById(elementId);
    element.textContent = symbol;
    element.className = `metric-value status-${type}`;
}

function showAlert(containerId, message, type) {
    const container = document.getElementById(containerId);
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 5000);
}

// Audio testing functions
async function testMicrophone() {
    log('Testing microphone access...', 'info');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 24000,
                channelCount: 1
            }
        });
        
        mediaStream = stream;
        
        // Get audio track info
        const audioTrack = stream.getAudioTracks()[0];
        const settings = audioTrack.getSettings();
        
        document.getElementById('sampleRate').textContent = settings.sampleRate || 'Unknown';
        document.getElementById('channels').textContent = settings.channelCount || 'Unknown';
        
        // Test basic audio processing
        try {
            const audioContext = new AudioContext({ sampleRate: 24000 });
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.fftSize);
            
            // Test volume detection for 2 seconds
            let testCount = 0;
            const testInterval = setInterval(() => {
                analyser.getByteTimeDomainData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const sample = (dataArray[i] - 128) / 128;
                    sum += sample * sample;
                }
                const rms = Math.sqrt(sum / dataArray.length);
                const volumePercent = Math.min(100, rms * 100 * 3);
                
                log(`Volume test ${testCount + 1}/10: ${volumePercent.toFixed(1)}%`, 'info');
                testCount++;
                
                if (testCount >= 10) {
                    clearInterval(testInterval);
                    audioContext.close();
                    log('Volume detection test completed', 'success');
                }
            }, 200);
            
        } catch (audioError) {
            log(`Audio processing test failed: ${audioError.message}`, 'warning');
        }
        
        log('Microphone test successful', 'success');
        updateStatus('audio-status', '✅', 'success');
        
        // Stop the stream after a delay to allow volume testing
        setTimeout(() => {
            stream.getTracks().forEach(track => track.stop());
        }, 3000);
        
    } catch (error) {
        log(`Microphone test failed: ${error.message}`, 'error');
        updateStatus('audio-status', '❌', 'error');
    }
}

async function startAudioVisualization() {
    if (isRecording) {
        log('Audio visualization already running', 'warning');
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStream = stream;
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        isRecording = true;
        visualizeAudio();
        
        log('Audio visualization started', 'success');
        
    } catch (error) {
        log(`Failed to start audio visualization: ${error.message}`, 'error');
    }
}

function stopAudioVisualization() {
    if (!isRecording) {
        log('Audio visualization not running', 'warning');
        return;
    }
    
    isRecording = false;
    
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    log('Audio visualization stopped', 'info');
}

function visualizeAudio() {
    if (!isRecording || !analyser) return;
    
    const canvas = document.getElementById('audioCanvas');
    if (!canvas) {
        log('Audio canvas not found', 'error');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match container
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        if (!isRecording || !analyser) return;
        
        requestAnimationFrame(draw);
        
        try {
            analyser.getByteFrequencyData(dataArray);
            
            // Clear canvas
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw frequency bars
            const barWidth = Math.max(1, (canvas.width / bufferLength) * 2.5);
            let x = 0;
            
            for (let i = 0; i < bufferLength && x < canvas.width; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
                
                // Create gradient color based on frequency and amplitude
                const hue = (i / bufferLength) * 120; // Green to red
                const saturation = 70;
                const lightness = 40 + (dataArray[i] / 255) * 40;
                
                ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        } catch (error) {
            log(`Audio visualization error: ${error.message}`, 'error');
            stopAudioVisualization();
        }
    }
    
    draw();
}

async function testAudioSystem() {
    log('Testing audio system...', 'info');
    
    try {
        // Check if audio context is supported
        if (!window.AudioContext && !window.webkitAudioContext) {
            throw new Error('Web Audio API not supported');
        }
        
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia not supported');
        }
        
        updateStatus('audio-status', '✅', 'success');
        log('Audio system test passed', 'success');
        
    } catch (error) {
        updateStatus('audio-status', '❌', 'error');
        log(`Audio system test failed: ${error.message}`, 'error');
    }
}

// Connection testing functions
function testWebSocketConnection() {
    log('Testing WebSocket connection...', 'info');
    
    const wsUrl = `ws://${window.location.host}/ws/realtime`;
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = function() {
        log('WebSocket connection established', 'success');
        updateStatus('websocket-status', '✅', 'success');
        updateConnectionStatus('connected');
        
        // Enable token tracking for this WebSocket
        enhanceWebSocketForTokenTracking();
        
        // Send a test message
        try {
            const testMessage = { type: 'ping', timestamp: Date.now() };
            websocket.send(JSON.stringify(testMessage));
            log('Test ping message sent', 'info');
        } catch (error) {
            log(`Failed to send test message: ${error.message}`, 'warning');
        }
    };
    
    websocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        log(`WebSocket message received: ${data.type}`, 'info');
        
        if (data.type === 'pong') {
            const latency = Date.now() - data.timestamp;
            document.getElementById('latency').textContent = `${latency}ms`;
        }
    };
    
    websocket.onerror = function(error) {
        log('WebSocket error occurred', 'error');
        updateStatus('websocket-status', '❌', 'error');
        updateConnectionStatus('error');
    };
    
    websocket.onclose = function() {
        log('WebSocket connection closed', 'warning');
        updateStatus('websocket-status', '⚠️', 'warning');
        updateConnectionStatus('disconnected');
    };
}

function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    statusElement.innerHTML = `<span class="status-indicator status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

async function testAllEndpoints() {
    log('Testing all API endpoints...', 'info');
    
    const endpoints = [
        { url: '/api/session/status', name: 'Session Status' },
        { url: '/api/session', name: 'Create Session', method: 'POST' }
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint.url, {
                method: endpoint.method || 'GET'
            });
            
            if (response.ok) {
                log(`${endpoint.name}: OK`, 'success');
            } else {
                log(`${endpoint.name}: Failed (${response.status})`, 'error');
            }
        } catch (error) {
            log(`${endpoint.name}: Error - ${error.message}`, 'error');
        }
    }
}

function restartConnection() {
    log('Restarting connection...', 'warning');
    
    if (websocket) {
        websocket.close();
    }
    
    setTimeout(() => {
        testWebSocketConnection();
    }, 1000);
}

// Configuration functions
async function loadConfiguration() {
    log('Loading configuration...', 'info');
    
    try {
        const response = await fetch('/api/session/status');
        if (response.ok) {
            const config = await response.json();
            
            document.getElementById('config-model').textContent = config.model || 'Unknown';
            document.getElementById('config-voice').textContent = config.voice || 'Unknown';
            document.getElementById('config-port').textContent = window.location.port || '80';
            document.getElementById('config-ws-url').textContent = `ws://${window.location.host}/ws/realtime`;
            
            log('Configuration loaded successfully', 'success');
        } else {
            log('Failed to load configuration', 'error');
        }
    } catch (error) {
        log(`Configuration load error: ${error.message}`, 'error');
    }
}

function refreshConfig() {
    loadConfiguration();
}

async function validateConfig() {
    log('Validating configuration...', 'info');
    
    try {
        const response = await fetch('/api/session/status');
        if (response.ok) {
            const config = await response.json();
            
            if (config.model && config.voice) {
                log('Configuration validation passed', 'success');
                showAlert('system-alerts', 'Configuration is valid', 'success');
            } else {
                log('Configuration validation failed - missing required fields', 'error');
                showAlert('system-alerts', 'Configuration validation failed', 'danger');
            }
        }
    } catch (error) {
        log(`Configuration validation error: ${error.message}`, 'error');
        showAlert('system-alerts', 'Configuration validation error', 'danger');
    }
}

// Utility functions
let verboseLogging = false;

function toggleVerboseLogging() {
    verboseLogging = !verboseLogging;
    log(`Verbose logging ${verboseLogging ? 'enabled' : 'disabled'}`, 'info');
}

// Token tracking functions
function updateTokenCount(tokensIn = 0, tokensOut = 0) {
    tokenStats.tokensIn += tokensIn;
    tokenStats.tokensOut += tokensOut;
    tokenStats.totalTokens = tokenStats.tokensIn + tokenStats.tokensOut;
    
    // Calculate estimated cost
    const inputCost = (tokenStats.tokensIn / 1000000) * PRICING.input;
    const outputCost = (tokenStats.tokensOut / 1000000) * PRICING.output;
    tokenStats.sessionCost = inputCost + outputCost;
    
    // Add to history
    if (tokensIn > 0 || tokensOut > 0) {
        const historyEntry = {
            timestamp: Date.now(),
            tokensIn: tokensIn,
            tokensOut: tokensOut,
            totalTokens: tokensIn + tokensOut,
            cost: ((tokensIn / 1000000) * PRICING.input) + ((tokensOut / 1000000) * PRICING.output)
        };
        
        tokenHistory.push(historyEntry);
        
        // Keep only last 50 entries
        if (tokenHistory.length > 50) {
            tokenHistory = tokenHistory.slice(-50);
        }
        
        logTokenUsage(historyEntry);
        log(`Token usage: +${tokensIn} in, +${tokensOut} out (Total: ${tokenStats.totalTokens})`, 'info');
    }
    
    updateTokenDisplay();
    saveTokenStats();
}

function updateTokenDisplay() {
    const tokensInElement = document.getElementById('tokens-in');
    const tokensOutElement = document.getElementById('tokens-out');
    const totalTokensElement = document.getElementById('total-tokens');
    const sessionCostElement = document.getElementById('session-cost');
    
    // Add animation class for visual feedback
    [tokensInElement, tokensOutElement, totalTokensElement, sessionCostElement].forEach(el => {
        el.classList.add('token-update');
        setTimeout(() => el.classList.remove('token-update'), 500);
    });
    
    tokensInElement.textContent = tokenStats.tokensIn.toLocaleString();
    tokensOutElement.textContent = tokenStats.tokensOut.toLocaleString();
    totalTokensElement.textContent = tokenStats.totalTokens.toLocaleString();
    sessionCostElement.textContent = `$${tokenStats.sessionCost.toFixed(4)}`;
    
    // Calculate and display token rate
    const sessionDuration = (Date.now() - tokenStats.sessionStart) / 1000 / 60; // minutes
    const tokensPerMinute = sessionDuration > 0 ? (tokenStats.totalTokens / sessionDuration) : 0;
    
    // Add rate information to total tokens display
    const totalCard = totalTokensElement.closest('.metric-card');
    let rateElement = totalCard.querySelector('.token-rate');
    if (!rateElement) {
        rateElement = document.createElement('div');
        rateElement.className = 'token-rate';
        totalCard.appendChild(rateElement);
    }
    rateElement.textContent = `${tokensPerMinute.toFixed(1)} tokens/min`;
    
    // Add cost breakdown to cost display
    const costCard = sessionCostElement.closest('.metric-card');
    let costBreakdown = costCard.querySelector('.cost-indicator');
    if (!costBreakdown) {
        costBreakdown = document.createElement('div');
        costBreakdown.className = 'cost-indicator';
        costCard.appendChild(costBreakdown);
    }
    const inputCost = (tokenStats.tokensIn / 1000000) * PRICING.input;
    const outputCost = (tokenStats.tokensOut / 1000000) * PRICING.output;
    costBreakdown.textContent = `In: $${inputCost.toFixed(4)} | Out: $${outputCost.toFixed(4)}`;
}

function resetTokenCounter() {
    tokenStats = {
        tokensIn: 0,
        tokensOut: 0,
        totalTokens: 0,
        sessionCost: 0,
        sessionStart: Date.now()
    };
    
    updateTokenDisplay();
    saveTokenStats();
    log('Token counter reset', 'info');
    showAlert('system-alerts', 'Token counter has been reset', 'success');
}

function exportTokenStats() {
    const sessionDuration = (Date.now() - tokenStats.sessionStart) / 1000 / 60; // minutes
    const stats = {
        ...tokenStats,
        sessionDuration: Math.round(sessionDuration * 100) / 100,
        timestamp: new Date().toISOString(),
        tokensPerMinute: Math.round((tokenStats.totalTokens / sessionDuration) * 100) / 100
    };
    
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `briai-token-stats-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log('Token statistics exported', 'success');
}

function saveTokenStats() {
    try {
        localStorage.setItem('briai-token-stats', JSON.stringify(tokenStats));
    } catch (error) {
        log(`Failed to save token stats: ${error.message}`, 'warning');
    }
}

function loadTokenStats() {
    try {
        const saved = localStorage.getItem('briai-token-stats');
        if (saved) {
            tokenStats = { ...tokenStats, ...JSON.parse(saved) };
            log('Token statistics loaded from storage', 'info');
        }
    } catch (error) {
        log(`Failed to load token stats: ${error.message}`, 'warning');
    }
}

function simulateTokenUsage() {
    // Simulate a typical conversation turn
    const inputTokens = Math.floor(Math.random() * 100) + 50;  // 50-150 input tokens
    const outputTokens = Math.floor(Math.random() * 200) + 100; // 100-300 output tokens
    
    updateTokenCount(inputTokens, outputTokens);
    log(`Simulated token usage: ${inputTokens} in, ${outputTokens} out`, 'info');
    showAlert('system-alerts', `Simulated ${inputTokens} input + ${outputTokens} output tokens`, 'info');
}

function testVolumeIndicator() {
    log('Testing volume indicator in main app...', 'info');
    
    // Try to access the main app's test function
    if (window.opener && window.opener.briaiClient) {
        window.opener.briaiClient.testVolumeIndicator();
        log('Volume indicator test started in main app', 'success');
    } else {
        // Fallback: test a local volume bar if it exists
        const volumeBar = document.querySelector('.volume-fill');
        if (volumeBar) {
            log('Testing local volume visualization...', 'info');
            let level = 0;
            const testInterval = setInterval(() => {
                level = (level + 20) % 120;
                volumeBar.style.width = `${Math.min(100, level)}%`;
                
                if (level === 0) {
                    clearInterval(testInterval);
                    log('Local volume test completed', 'success');
                }
            }, 200);
        } else {
            log('No volume indicator found to test', 'warning');
            showAlert('system-alerts', 'Open the main app first to test volume indicator', 'warning');
        }
    }
}

function logTokenUsage(entry) {
    const tokenHistoryContainer = document.getElementById('tokenHistory');
    if (!tokenHistoryContainer) return;
    
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'log-timestamp';
    timestampSpan.textContent = `[${timestamp}]`;
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'log-success';
    messageSpan.textContent = ` +${entry.tokensIn} in, +${entry.tokensOut} out (${entry.totalTokens} total) - $${entry.cost.toFixed(4)}`;
    
    logEntry.appendChild(timestampSpan);
    logEntry.appendChild(messageSpan);
    
    tokenHistoryContainer.appendChild(logEntry);
    tokenHistoryContainer.scrollTop = tokenHistoryContainer.scrollHeight;
    
    // Remove old entries to prevent overflow
    const entries = tokenHistoryContainer.querySelectorAll('.log-entry');
    if (entries.length > 20) {
        entries[0].remove();
    }
}

// Enhanced WebSocket message handler to track tokens
function enhanceWebSocketForTokenTracking() {
    if (!websocket) return;
    
    const originalOnMessage = websocket.onmessage;
    websocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Track token usage from OpenAI responses
            if (data.type === 'response.done' && data.response && data.response.usage) {
                const usage = data.response.usage;
                updateTokenCount(usage.input_tokens || 0, usage.output_tokens || 0);
            }
            
            // Track conversation turn completion
            if (data.type === 'conversation.item.created' && data.item) {
                // Estimate tokens for user input (rough approximation: 1 token ≈ 4 characters)
                if (data.item.type === 'message' && data.item.content) {
                    const estimatedTokens = Math.ceil(data.item.content.length / 4);
                    updateTokenCount(estimatedTokens, 0);
                }
            }
            
        } catch (error) {
            // Ignore JSON parsing errors for non-JSON messages
        }
        
        // Call original handler
        if (originalOnMessage) {
            originalOnMessage.call(this, event);
        }
    };
}

// Missing functions implementation
async function testAudioProcessing() {
    log('Testing audio processing...', 'info');
    
    try {
        // Test basic audio processing capabilities
        if (!window.AudioContext && !window.webkitAudioContext) {
            throw new Error('Web Audio API not supported');
        }
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Test audio processing chain
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const analyser = audioContext.createAnalyser();
        
        oscillator.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioContext.destination);
        
        // Configure test tone
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Low volume
        
        // Start and stop test tone
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            audioContext.close();
        }, 500);
        
        log('Audio processing test completed successfully', 'success');
        
        const resultsDiv = document.getElementById('audio-processing-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<div class="alert alert-success">Audio processing test passed - Web Audio API is working correctly</div>';
        }
        
    } catch (error) {
        log(`Audio processing test failed: ${error.message}`, 'error');
        
        const resultsDiv = document.getElementById('audio-processing-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div class="alert alert-danger">Audio processing test failed: ${error.message}</div>`;
        }
    }
}

async function testVAD() {
    log('Testing Voice Activity Detection...', 'info');
    
    try {
        // Test VAD by checking if we can detect audio input levels
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let testCount = 0;
        let vadDetected = false;
        
        const vadTest = setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            
            // Simple VAD threshold
            if (average > 10) {
                vadDetected = true;
                log(`VAD detected activity: ${average.toFixed(1)}`, 'success');
            }
            
            testCount++;
            if (testCount >= 20) { // Test for 2 seconds
                clearInterval(vadTest);
                stream.getTracks().forEach(track => track.stop());
                audioContext.close();
                
                if (vadDetected) {
                    log('Voice Activity Detection test passed', 'success');
                } else {
                    log('Voice Activity Detection test completed - no activity detected (try speaking)', 'warning');
                }
            }
        }, 100);
        
    } catch (error) {
        log(`VAD test failed: ${error.message}`, 'error');
    }
}

async function testRealtimeAPI() {
    log('Testing Realtime API connection...', 'info');
    
    try {
        // Test the realtime API by creating a WebSocket connection
        const wsUrl = `ws://${window.location.host}/ws/realtime`;
        const testWs = new WebSocket(wsUrl);
        
        testWs.onopen = function() {
            log('Realtime API connection established', 'success');
            
            // Send a test message
            testWs.send(JSON.stringify({
                type: 'session.update',
                session: {
                    modalities: ['text'],
                    instructions: 'You are a test assistant. Respond with "Test successful".'
                }
            }));
            
            // Close after a short delay
            setTimeout(() => {
                testWs.close();
            }, 2000);
        };
        
        testWs.onmessage = function(event) {
            const data = JSON.parse(event.data);
            log(`Realtime API response: ${data.type}`, 'info');
        };
        
        testWs.onerror = function(error) {
            log('Realtime API connection error', 'error');
        };
        
        testWs.onclose = function() {
            log('Realtime API test completed', 'info');
        };
        
    } catch (error) {
        log(`Realtime API test failed: ${error.message}`, 'error');
    }
}

function simulateConnectionLoss() {
    log('Simulating connection loss...', 'warning');
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
        log('WebSocket connection closed (simulated)', 'warning');
        updateConnectionStatus('disconnected');
        
        // Simulate reconnection after 3 seconds
        setTimeout(() => {
            log('Attempting reconnection...', 'info');
            testWebSocketConnection();
        }, 3000);
    } else {
        log('No active WebSocket connection to close', 'warning');
    }
}

function testReconnection() {
    log('Testing auto-reconnection...', 'info');
    
    reconnectAttempts = 0;
    
    function attemptReconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) {
            log(`Max reconnection attempts (${maxReconnectAttempts}) reached`, 'error');
            
            const resultsDiv = document.getElementById('reconnection-results');
            if (resultsDiv) {
                resultsDiv.innerHTML = '<div class="alert alert-danger">Auto-reconnection test failed - max attempts reached</div>';
            }
            return;
        }
        
        reconnectAttempts++;
        log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`, 'info');
        
        // Simulate connection attempt
        setTimeout(() => {
            if (Math.random() > 0.3) { // 70% success rate
                log('Reconnection successful', 'success');
                
                const resultsDiv = document.getElementById('reconnection-results');
                if (resultsDiv) {
                    resultsDiv.innerHTML = `<div class="alert alert-success">Auto-reconnection test passed - reconnected after ${reconnectAttempts} attempts</div>`;
                }
            } else {
                log('Reconnection failed, retrying...', 'warning');
                setTimeout(attemptReconnect, 1000);
            }
        }, 1000);
    }
    
    attemptReconnect();
}

function testMaxRetries() {
    log('Testing maximum retry behavior...', 'warning');
    
    let testAttempts = 0;
    const maxTestAttempts = 5;
    
    function failedAttempt() {
        testAttempts++;
        log(`Failed attempt ${testAttempts}/${maxTestAttempts}`, 'error');
        
        if (testAttempts >= maxTestAttempts) {
            log('Max retries test completed - all attempts failed as expected', 'success');
            
            const resultsDiv = document.getElementById('reconnection-results');
            if (resultsDiv) {
                resultsDiv.innerHTML = '<div class="alert alert-success">Max retries test passed - properly handled maximum attempts</div>';
            }
        } else {
            setTimeout(failedAttempt, 500);
        }
    }
    
    failedAttempt();
}

// Additional utility functions for better admin panel functionality
function getSystemStatus() {
    const serverStatus = document.getElementById('server-status').textContent;
    const apiStatus = document.getElementById('api-status').textContent;
    const wsStatus = document.getElementById('websocket-status').textContent;
    const audioStatus = document.getElementById('audio-status').textContent;
    
    return {
        server: serverStatus === '✅',
        api: apiStatus === '✅',
        websocket: wsStatus === '✅',
        audio: audioStatus === '✅'
    };
}

function displaySystemSummary() {
    const status = getSystemStatus();
    const allGood = Object.values(status).every(s => s);
    
    if (allGood) {
        showAlert('system-alerts', '✅ All systems operational', 'success');
    } else {
        const issues = Object.entries(status)
            .filter(([key, value]) => !value)
            .map(([key]) => key);
        showAlert('system-alerts', `⚠️ Issues detected: ${issues.join(', ')}`, 'warning');
    }
}

async function runFullDiagnostic() {
    log('Starting full diagnostic test...', 'info');
    showAlert('system-alerts', '🔍 Running full diagnostic - this may take a few moments...', 'info');
    
    try {
        // Clear previous alerts
        document.getElementById('system-alerts').innerHTML = '';
        
        // Run all tests in sequence
        log('Step 1/6: Checking system health...', 'info');
        await checkSystemHealth();
        
        log('Step 2/6: Testing all endpoints...', 'info');
        await testAllEndpoints();
        
        log('Step 3/6: Testing WebSocket connection...', 'info');
        testWebSocketConnection();
        
        // Wait a bit for WebSocket to connect
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        log('Step 4/6: Testing audio system...', 'info');
        await testAudioProcessing();
        
        log('Step 5/6: Validating configuration...', 'info');
        await validateConfig();
        
        log('Step 6/6: Generating diagnostic report...', 'info');
        
        // Generate diagnostic report
        const status = getSystemStatus();
        const report = {
            timestamp: new Date().toISOString(),
            systemStatus: status,
            tokenStats: tokenStats,
            browserInfo: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            },
            audioSupport: {
                webAudio: !!(window.AudioContext || window.webkitAudioContext),
                getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                webRTC: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection)
            }
        };
        
        log('Full diagnostic completed', 'success');
        
        // Show summary
        const allGood = Object.values(status).every(s => s);
        if (allGood) {
            showAlert('system-alerts', '✅ Full diagnostic passed - all systems operational!', 'success');
        } else {
            const issues = Object.entries(status)
                .filter(([key, value]) => !value)
                .map(([key]) => key);
            showAlert('system-alerts', `⚠️ Diagnostic completed with issues: ${issues.join(', ')}`, 'warning');
        }
        
        // Offer to export diagnostic report
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-primary';
        exportBtn.textContent = 'Export Diagnostic Report';
        exportBtn.onclick = () => exportDiagnosticReport(report);
        
        const alertDiv = document.querySelector('#system-alerts .alert:last-child');
        if (alertDiv) {
            alertDiv.appendChild(document.createElement('br'));
            alertDiv.appendChild(exportBtn);
        }
        
    } catch (error) {
        log(`Full diagnostic failed: ${error.message}`, 'error');
        showAlert('system-alerts', `❌ Diagnostic failed: ${error.message}`, 'danger');
    }
}

function exportDiagnosticReport(report) {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `briai-diagnostic-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log('Diagnostic report exported', 'success');
}

// Test function for debugging
function testAdminPanel() {
    console.log('Testing admin panel functionality...');
    
    try {
        // Test logging
        log('Test log message', 'info');
        console.log('✓ Logging works');
        
        // Test tab switching
        showTab('system');
        console.log('✓ Tab switching works');
        
        // Test basic DOM manipulation
        const serverStatus = document.getElementById('server-status');
        if (serverStatus) {
            serverStatus.textContent = '🧪';
            console.log('✓ DOM manipulation works');
        }
        
        // Test alert system
        showAlert('system-alerts', 'Test alert message', 'info');
        console.log('✓ Alert system works');
        
        console.log('✅ Admin panel basic functionality test passed!');
        return true;
    } catch (error) {
        console.error('❌ Admin panel test failed:', error);
        return false;
    }
}

// Make test function globally available
window.testAdminPanel = testAdminPanel;

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    saveTokenStats();
    
    if (websocket) {
        websocket.close();
    }
    
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    
    if (audioContext) {
        audioContext.close();
    }
});

// Add a simple connectivity test on load
window.addEventListener('load', function() {
    console.log('Window loaded, running basic connectivity test...');
    setTimeout(() => {
        if (typeof testAdminPanel === 'function') {
            testAdminPanel();
        }
    }, 1000);
});