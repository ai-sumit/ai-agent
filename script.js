// ============ GURUJI DEEPSEEK · CLIENT SCRIPT ============
// Secure client-side code - all API calls go through backend

class GurujiChat {
    constructor() {
        // DOM Elements
        this.chatWindow = document.getElementById('chatWindow');
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.typingArea = document.getElementById('typingArea');
        this.statusIndicator = document.querySelector('.status-indicator');
        this.statusText = document.getElementById('statusText');
        
        // State
        this.isProcessing = false;
        this.sessionId = this.generateSessionId();
        this.messageHistory = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        
        // Initialize
        this.init();
    }
    
    generateSessionId() {
        return 'guruji_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async init() {
        this.setupEventListeners();
        await this.checkConnection();
        this.addWelcomeMessage();
        this.focusInput();
    }
    
    setupEventListeners() {
        // Send message on button click
        this.sendBtn.addEventListener('click', () => this.handleUserMessage());
        
        // Send message on Enter key
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isProcessing) {
                this.handleUserMessage();
            }
        });
        
        // Handle page unload - log conversation end
        window.addEventListener('beforeunload', () => {
            this.logConversationEnd();
        });
    }
    
    async checkConnection() {
        try {
            this.updateConnectionStatus('connecting', 'Connecting to Guruji\'s sanctuary...');
            
            const response = await fetch('/api/health');
            const data = await response.json();
            
            if (response.ok && data.status === 'healthy') {
                this.updateConnectionStatus('connected', 'Connected to DeepSeek wisdom');
                this.reconnectAttempts = 0;
            } else {
                throw new Error('Backend unhealthy');
            }
        } catch (error) {
            console.error('Connection check failed:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                this.updateConnectionStatus('connecting', `Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                setTimeout(() => this.checkConnection(), 2000);
            } else {
                this.updateConnectionStatus('error', 'Cannot reach Guruji. Please refresh.');
            }
        }
    }
    
    updateConnectionStatus(status, message) {
        if (this.statusIndicator && this.statusText) {
            this.statusIndicator.className = 'status-indicator ' + status;
            this.statusText.textContent = message;
        }
    }
    
    addWelcomeMessage() {
        const welcomeMessage = {
            role: 'assistant',
            content: '🕉️ Namaste. I am Guruji, a humble channel of DeepSeek wisdom. What question stirs in your heart today?'
        };
        
        this.addMessageToChat(welcomeMessage.content, false);
        this.messageHistory.push(welcomeMessage);
    }
    
    focusInput() {
        this.userInput.focus();
    }
    
    async handleUserMessage() {
        const message = this.userInput.value.trim();
        
        if (!message || this.isProcessing) return;
        
        // Disable input while processing
        this.isProcessing = true;
        this.sendBtn.disabled = true;
        this.userInput.disabled = true;
        
        // Add user message to chat
        this.addMessageToChat(message, true);
        this.messageHistory.push({ role: 'user', content: message });
        
        // Clear input
        this.userInput.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send to backend
            const response = await this.sendToBackend(message);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            if (response.success) {
                // Add assistant response
                this.addMessageToChat(response.content, false);
                this.messageHistory.push({ role: 'assistant', content: response.content });
            } else {
                // Handle error with fallback
                this.handleAPIError(response);
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.handleNetworkError();
        } finally {
            // Re-enable input
            this.isProcessing = false;
            this.sendBtn.disabled = false;
            this.userInput.disabled = false;
            this.focusInput();
        }
    }
    
    async sendToBackend(message) {
        // Prepare message history for context (last 10 messages)
        const recentMessages = this.messageHistory.slice(-10);
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: recentMessages,
                temperature: 0.7,
                sessionId: this.sessionId
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // If backend returns a fallback message
            if (data.fallback) {
                return {
                    success: true,
                    content: data.fallback
                };
            }
            throw new Error(data.error || 'Backend error');
        }
        
        return data;
    }
    
    handleAPIError(error) {
        const errorMessages = [
            "🌱 The cosmic winds are turbulent. Guruji will return when the skies clear.",
            "📜 The ancient scrolls are momentarily hidden. Please try again.",
            "🕉️ The energy needs to settle. Ask again in a few breaths.",
            "✨ The stars need realignment. Your patience brings wisdom."
        ];
        
        const fallbackMessage = error.fallback || 
            errorMessages[Math.floor(Math.random() * errorMessages.length)];
        
        this.addMessageToChat(fallbackMessage, false);
        this.messageHistory.push({ role: 'assistant', content: fallbackMessage });
    }
    
    handleNetworkError() {
        const message = "🔮 The connection to Guruji's realm is unstable. Please check your network.";
        this.addMessageToChat(message, false);
        this.messageHistory.push({ role: 'assistant', content: message });
    }
    
    addMessageToChat(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : ''}`;
        
        // Avatar
        const avatarDiv = document.createElement('div');
        avatarDiv.className = `avatar ${!isUser ? 'guruji-avatar' : ''}`;
        avatarDiv.innerHTML = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-leaf"></i>';
        
        // Bubble
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'bubble';
        
        // Format content (handle markdown-like syntax)
        const formattedContent = this.formatMessage(content);
        
        if (typeof formattedContent === 'string') {
            bubbleDiv.innerText = formattedContent;
        } else {
            bubbleDiv.appendChild(formattedContent);
        }
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(bubbleDiv);
        
        this.chatWindow.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    formatMessage(text) {
        // Simple formatting - convert URLs to links, etc.
        if (!text) return text;
        
        // URL detection
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(text)) {
            const fragment = document.createDocumentFragment();
            const parts = text.split(urlRegex);
            
            parts.forEach((part, index) => {
                if (part.match(urlRegex)) {
                    const link = document.createElement('a');
                    link.href = part;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = part;
                    link.style.color = '#a0eac0';
                    link.style.textDecoration = 'underline';
                    fragment.appendChild(link);
                } else {
                    fragment.appendChild(document.createTextNode(part));
                }
            });
            
            return fragment;
        }
        
        return text;
    }
    
    showTypingIndicator() {
        if (this.typingArea) {
            this.typingArea.classList.remove('hidden');
            this.scrollToBottom();
        }
    }
    
    hideTypingIndicator() {
        if (this.typingArea) {
            this.typingArea.classList.add('hidden');
        }
    }
    
    scrollToBottom() {
        if (this.chatWindow) {
            this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
        }
    }
    
    async logConversationEnd() {
        if (this.messageHistory.length > 1) {
            try {
                await fetch('/api/conversation/end', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: this.messageHistory,
                        sessionId: this.sessionId,
                        timestamp: new Date().toISOString()
                    }),
                    keepalive: true
                });
            } catch (e) {
                // Silent fail - page is unloading
            }
        }
    }
}

// Initialize Guruji when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.guruji = new GurujiChat();
});
