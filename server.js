// server.js - Guruji DeepSeek Backend Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============ SECURITY & MIDDLEWARE ============
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// ============ DEEPSEEK API SERVICE ============
class DeepSeekService {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.apiUrl = process.env.DEEPSEEK_API_URL;
        
        if (!this.apiKey) {
            console.error('❌ DEEPSEEK_API_KEY is missing in .env file');
        }
    }

    async generateResponse(messages, temperature = 0.7) {
        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: temperature,
                    max_tokens: 800,
                    top_p: 0.95,
                    frequency_penalty: 0.3,
                    presence_penalty: 0.2,
                    stream: false
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    timeout: 30000 // 30 second timeout
                }
            );

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return {
                    success: true,
                    content: response.data.choices[0].message.content,
                    usage: response.data.usage
                };
            } else {
                throw new Error('Invalid response structure from DeepSeek');
            }
        } catch (error) {
            console.error('DeepSeek API Error:', error.response?.data || error.message);
            
            // Handle specific error types
            if (error.response) {
                switch (error.response.status) {
                    case 401:
                        return {
                            success: false,
                            error: 'Invalid API key. Please check your DeepSeek API key.',
                            code: 'INVALID_API_KEY'
                        };
                    case 429:
                        return {
                            success: false,
                            error: 'Rate limit exceeded. Please try again later.',
                            code: 'RATE_LIMITED'
                        };
                    case 503:
                    case 504:
                        return {
                            success: false,
                            error: 'DeepSeek service is temporarily unavailable.',
                            code: 'SERVICE_UNAVAILABLE'
                        };
                    default:
                        return {
                            success: false,
                            error: `API error: ${error.response.status}`,
                            code: 'API_ERROR'
                        };
                }
            } else if (error.code === 'ECONNABORTED') {
                return {
                    success: false,
                    error: 'Request timeout. The server took too long to respond.',
                    code: 'TIMEOUT'
                };
            } else {
                return {
                    success: false,
                    error: 'Network error. Could not reach DeepSeek API.',
                    code: 'NETWORK_ERROR'
                };
            }
        }
    }
}

const deepseek = new DeepSeekService();

// ============ API ROUTES ============

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Guruji DeepSeek Backend',
        deepseek_api: !!process.env.DEEPSEEK_API_KEY ? 'configured' : 'missing'
    });
});

// Chat completion endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, temperature = 0.7 } = req.body;

        // Validate request
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request format. Expected messages array.',
                code: 'INVALID_REQUEST'
            });
        }

        // Ensure system prompt is present
        let chatMessages = messages;
        const hasSystemPrompt = messages.some(msg => msg.role === 'system');
        
        if (!hasSystemPrompt) {
            chatMessages = [
                {
                    role: 'system',
                    content: 'You are Guruji, a wise, compassionate spiritual teacher. You speak in calm, metaphorical language. Offer profound yet practical wisdom. Keep responses concise (2-4 sentences). Use Sanskrit terms occasionally. You embody patience and ancient wisdom.'
                },
                ...messages
            ];
        }

        // Get response from DeepSeek
        const result = await deepseek.generateResponse(chatMessages, temperature);

        if (result.success) {
            res.json({
                success: true,
                content: result.content,
                usage: result.usage,
                timestamp: new Date().toISOString()
            });
        } else {
            // Add fallback response when API fails
            const fallbackResponses = [
                "🌿 The cosmic connection is momentarily interrupted. Please try again in a moment.",
                "🕉️ I feel the energy shifting. Let us wait a breath before continuing.",
                "📜 The ancient scrolls are being redacted. The sage will return shortly.",
                "✨ The stars need realignment. Guruji will be with you soon."
            ];
            
            res.status(503).json({
                success: false,
                error: result.error,
                code: result.code,
                fallback: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
            });
        }
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Conversation history endpoint (for analytics, optional)
app.post('/api/conversation/end', (req, res) => {
    // In production, you would log this to a database
    const { messages, sessionId } = req.body;
    console.log(`Session ${sessionId} ended with ${messages?.length || 0} messages`);
    res.json({ success: true });
});

// ============ ERROR HANDLING ============
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'SERVER_ERROR'
    });
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║     🕉️  GURUJI DEEPSEEK SERVER  🕉️        ║
    ╠═══════════════════════════════════════════╣
    ║  Status:    🟢 Online                     ║
    ║  Port:      ${PORT.toString().padEnd(27)}║
    ║  API:       ${process.env.DEEPSEEK_API_KEY ? '✅ Configured' : '❌ Missing Key'.padEnd(22)}║
    ║  Mode:      ${process.env.NODE_ENV || 'development'.padEnd(22)}║
    ╚═══════════════════════════════════════════╝
    `);
});

module.exports = app;