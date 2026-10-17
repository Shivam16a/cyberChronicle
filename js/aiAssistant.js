/**
 * js/aiAssistant.js
 * Advanced Autonomous AI Editorial Engine for Notes
 * Powered by Google AI Studio (Gemini Fleet) with Dynamic Temperature & Resilient Fallback
 */
export class AIAssistantManager {
    constructor(getNoteContentFn, setNoteContentFn) {
        this.getNoteContent = getNoteContentFn;
        this.setNoteContent = setNoteContentFn;

        // ============================================================
        // TESTING API KEY: Apni Google AI Studio API Key yahan paste karein
        // ============================================================
        this.KEY1 = "BGa3oMjtXDNVN-o7kzo_WuDbxHOfbw"
        this.TEST_API_KEY = `AQ.Ab8RN6K7Sl_rz9mzerhO${this.KEY1}`;

        this.backdrop = document.getElementById('ai-sheet-backdrop');
        this.btnOpen = document.getElementById('btn-open-ai-assistant');
        this.btnClose = document.getElementById('btn-close-ai-sheet');
        this.loadingIndicator = document.getElementById('ai-loading-indicator');

        // ============================================================
        // ALL AVAILABLE GOOGLE AI STUDIO TEXT GENERATION MODELS CASCADE
        // Priority order: Ultra-Fast Frontier -> Pro Reasoning -> High Quota
        // ============================================================
        this.FALLBACK_MODELS = [
            // --- Tier 1: Next-Gen Gemini 3.x Series ---
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-3.6-flash',
            'gemini-3.5-flash-lite',
            'gemini-3-flash',
            'gemini-3.1-pro',
            'gemini-3.1-flash-lite',

            // --- Tier 2: Gemini 2.5 & 2.0 Core Fleet ---
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.5-pro',
            'gemini-2-flash',
            'gemini-2-flash-lite',
            'gemini-omni-flash',

            // --- Tier 3: Open Weights Frontier (Gemma 4) ---
            'gemma-4-31b',
            'gemma-4-26b',

            // --- Tier 4: Long-Term Production Fallbacks ---
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'gemini-1.5-pro-latest'
        ];

        this.initEvents();
    }

    getApiKey() {
        if (this.TEST_API_KEY && !this.TEST_API_KEY.includes('YOUR_TEST_API_KEY_HERE')) {
            return this.TEST_API_KEY.trim();
        }
        return localStorage.getItem('GEMINI_API_KEY') || '';
    }

    initEvents() {
        if (this.btnOpen) {
            this.btnOpen.addEventListener('click', () => this.open());
        }

        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.close());
        }

        if (this.backdrop) {
            this.backdrop.addEventListener('click', (e) => {
                if (e.target === this.backdrop) this.close();
            });
        }

        document.querySelectorAll('[data-ai-action]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const action = btn.getAttribute('data-ai-action');
                await this.executeAIAction(action);
            });
        });
    }

    open() {
        if (this.backdrop) this.backdrop.classList.remove('d-none');
    }

    close() {
        if (this.backdrop) this.backdrop.classList.add('d-none');
    }

    showLoading(text = 'AI Cognitive Engine running...') {
        if (this.loadingIndicator) {
            this.loadingIndicator.classList.remove('d-none');
            const textEl = this.loadingIndicator.querySelector('.ai-loading-text');
            if (textEl) textEl.innerText = text;
        }
    }

    hideLoading() {
        if (this.loadingIndicator) this.loadingIndicator.classList.add('d-none');
    }

    // ============================================================
    // ADVANCED ENTERPRISE CALL WITH NATIVE SYSTEM INSTRUCTION & RETRIES
    // ============================================================
    async callGeminiEngine(systemDirective, userText, temperature = 0.2) {
        const apiKey = this.getApiKey();

        if (!apiKey) {
            alert('Kripya js/aiAssistant.js me TEST_API_KEY paste karein ya Settings me enter karein.');
            return null;
        }

        // High-Grade Payload using Native systemInstruction layer
        const requestBody = {
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemDirective }]
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: userText }]
                }
            ],
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: 2500,
                topP: 0.95
            }
        };

        let lastError = null;

        for (let i = 0; i < this.FALLBACK_MODELS.length; i++) {
            const modelName = this.FALLBACK_MODELS[i];
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            try {
                this.showLoading(`Gemini Engine active [${modelName}]...`);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error?.message || `HTTP ${response.status} on ${modelName}`);
                }

                const data = await response.json();
                const candidate = data.candidates?.[0];

                if (candidate?.content?.parts?.[0]?.text) {
                    return candidate.content.parts[0].text.trim();
                } else {
                    throw new Error('Empty payload returned from model');
                }

            } catch (err) {
                lastError = err;
                console.warn(`[Failover Activated] ${modelName} encountered an issue: ${err.message}. Retrying next tiered model...`);
            }
        }

        console.error('All Gemini AI models exhausted:', lastError);
        alert('AI processing failed. Check your API key, network, or quota: ' + (lastError ? lastError.message : 'Unknown Error'));
        return null;
    }

    // ============================================================
    // EXECUTIVE PROMPT MATRIX & CONTEXT-AWARE TEMPERATURE ENGINE
    // ============================================================
    async executeAIAction(action) {
        const { plainText, htmlContent } = this.getNoteContent();

        if (!plainText || plainText.length < 3) {
            alert('Note me pehle kuch text likhein taaki AI use scan kar sake.');
            return;
        }

        let systemDirective = '';
        let temperature = 0.2;
        let isAppend = false;

        // Strict Persona Architecture (Zero-Chatter, Zero-Hallucination, Direct Injection)
        const BASE_RULE = `You are an elite cognitive document assistant and chief editorial engine embedded in an executive personal diary.
CRITICAL ENFORCEMENT RULES:
1. NEVER output conversational preamble or meta commentary (e.g., "Sure, here is your text", "Here's what I changed").
2. Output ONLY the raw final processed text ready for direct injection into a document editor.
3. Preserve the core language (English, Hinglish, Hindi, etc.) without translating unless requested.
4. Maintain intentional names, technical terms, URLs, and personal specifics without altering them.`;

        if (action === 'cleanup') {
            temperature = 0.05; // Maximum determinism & zero-hallucination
            systemDirective = `${BASE_RULE}
MISSION: Clean up, spell-check, and grammar-perfect the text.
INSTRUCTIONS:
- Meticulously correct all spelling mistakes, typos, character slips, capitalization, and punctuation flaws.
- Fix broken syntactic structures and grammatical anomalies.
- Keep the original wording, tone, and sentence architecture 100% intact. Do NOT rewrite or rephrase stylistic choices; only eliminate errors.`;

        } else if (action === 'format') {
            temperature = 0.15;
            systemDirective = `${BASE_RULE}
MISSION: Architect structural clarity, visual hierarchy, and readability.
INSTRUCTIONS:
- Convert fragmented thoughts into logically separated paragraphs.
- Inject clear Headings (H1/H2 style using markdown # / ##) where logical transitions occur.
- Transform lists, tasks, or serial items into neat bulleted lists (- ) or numbered sequences.
- Keep all original thoughts and technical words intact; your job is strictly structural elevation.`;

        } else if (action === 'polish') {
            temperature = 0.3;
            systemDirective = `${BASE_RULE}
MISSION: Executive-level prose refinement and stylistic polishing.
INSTRUCTIONS:
- Enhance cadence, sentence variety, and vocabulary without sounding pretentious or artificial.
- Remove redundant filler words, passive drag, and clunky phrasing.
- Make the writing compelling, crisp, and intellectually sharp while preserving the author's authentic perspective.`;

        } else if (action === 'continue') {
            isAppend = true;
            temperature = 0.65; // Creative expansion
            systemDirective = `${BASE_RULE}
MISSION: Predictive and cohesive narrative/idea continuation.
INSTRUCTIONS:
- Seamlessly continue writing where the provided text stops.
- Adopt the author's exact tone, pacing, vocabulary, and perspective.
- Produce 2 to 3 natural, logical follow-up paragraphs or actionable next steps that add meaningful substance.`;

        } else if (action === 'elaborate') {
            temperature = 0.45;
            systemDirective = `${BASE_RULE}
MISSION: Deep contextual elaboration and intellectual depth.
INSTRUCTIONS:
- Expand brief thoughts, shorthand notes, and bullet points into fully articulated explanations.
- Provide illustrative reasoning, nuances, and well-structured context for each point.
- Ensure the elaboration feels authoritative and organically connected to the original ideas.`;

        } else if (action === 'shorten') {
            temperature = 0.15;
            systemDirective = `${BASE_RULE}
MISSION: High-density condensation and executive distillation.
INSTRUCTIONS:
- Distill the note into its most impactful, essential core messages.
- Eliminate bloat, repetition, and non-essential elaboration.
- Provide a razor-sharp, punchy version that preserves every key decision, fact, or takeaway.`;

        } else if (action === 'formal') {
            temperature = 0.25;
            systemDirective = `${BASE_RULE}
MISSION: Transform tone into polished corporate/academic professionalism.
INSTRUCTIONS:
- Elevate vocabulary, eliminate slang, colloquialisms, and casual phrasing.
- Frame statements with diplomatic clarity, professional etiquette, and executive precision.`;

        } else if (action === 'casual') {
            temperature = 0.55;
            systemDirective = `${BASE_RULE}
MISSION: Humanize tone into effortless, friendly, and conversational prose.
INSTRUCTIONS:
- Make the text sound approachable, vibrant, and natural, like speaking to a trusted peer.
- Remove stiff corporate jargon and replace it with warm, modern, and engaging language.`;
        }

        this.showLoading(`Applying ${action.toUpperCase()} across document...`);

        const aiOutput = await this.callGeminiEngine(systemDirective, plainText, temperature);
        this.hideLoading();

        if (aiOutput) {
            // Clean and map Markdown/Headings to clean Editor HTML
            const formattedHTML = this.formatMarkdownToEditorHTML(aiOutput);

            if (isAppend) {
                this.setNoteContent(`${htmlContent}<br/><br/>${formattedHTML}`);
            } else {
                this.setNoteContent(formattedHTML);
            }
            this.close();
        }
    }

    // ============================================================
    // SMART MARKDOWN TO EDITABLE HTML CONVERTER
    // ============================================================
    formatMarkdownToEditorHTML(rawText) {
        let clean = rawText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Markdown Headers -> Clean HTML Headings
        clean = clean.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        clean = clean.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        clean = clean.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold & Italics
        clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        clean = clean.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Bullet points
        clean = clean.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
        clean = clean.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
        clean = clean.replace(/<\/ul>\s*<ul>/gim, '');

        // Line breaks to <br/>
        clean = clean.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');

        return clean;
    }
}