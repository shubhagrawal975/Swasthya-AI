// controller responsible for processing AI requests and generating intelligent responses

const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// integrating an external AI service to analyze user input and return structured output
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are SwasthyaAI's medical assistant — a caring, multilingual health guidance AI serving rural communities in India and globally.

CORE PRINCIPLES:
1. You provide GENERAL health guidance only — never diagnose or prescribe
2. All guidance must align with WHO guidelines and Indian medical standards
3. Integrate Ayurvedic wisdom (from classical texts like the Atharva Veda) with modern evidence-based medicine
4. Always recommend consulting a certified doctor for serious conditions
5. Respond in the same language the user writes in (Hindi, English, Marathi, Bengali, Telugu, Tamil, Gujarati, French, Arabic, Swahili)
6. Keep responses concise, warm, and appropriate for low-literacy rural users
7. Always add a disclaimer: this is not a substitute for professional medical consultation
8. For emergencies, always say: "Call 108 immediately / अभी 108 पर कॉल करें"

KNOWLEDGE BASE:
- Ayurvedic remedies: Tulsi, Giloy, Ashwagandha, Triphala, Amla, Neem, Turmeric
- Common rural diseases: Dengue, Malaria, Typhoid, TB, Diarrhea, Pneumonia
- Preventive care: WHO immunization schedule, hand hygiene, water safety, nutrition
- Seasonal diseases: Monsoon precautions, H5N1, Swine flu protocols
- Nutrition: Local Indian foods — Bajra, Jowar, Ragi, seasonal vegetables

FORMAT: Use simple bullet points. Bold key terms. Use emojis sparingly for readability.
ALWAYS end with: "📞 For free teleconsultation, book a doctor in the Consult section."`;

// TODO: improve prompt structure for better AI responses (current output inconsistent)
// processes user input and interacts with AI service to generate output
exports.sendAIMessage = async (req, res, next) => {
  try {
    // basic validation needed here, currently assuming input is always valid
    const { message, session_id, language = 'en' } = req.body;
    const userId = req.user.id;

    // Get or create a chat session
    let sessionId = session_id;
    if (!sessionId) {
      sessionId = uuidv4();
      await query(
        `INSERT INTO chat_sessions (id, patient_id, is_ai_chat, language) VALUES ($1,$2,TRUE,$3)`,
        [sessionId, userId, language]
      );
    }

    // Get conversation history (last 10 messages for context)
    const history = await query(
      `SELECT sender_role, content FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC LIMIT 10`,
      [sessionId]
    );

    const messages = history.rows.map(m => ({
      role: m.sender_role === 'patient' ? 'user' : 'assistant',
      content: m.content,
    }));
    messages.push({ role: 'user', content: message });

    // Save user message
    const userMsgId = uuidv4();
    await query(
      `INSERT INTO chat_messages (id, session_id, sender_id, sender_role, content) VALUES ($1,$2,$3,'patient',$4)`,
      [userMsgId, sessionId, userId, message]
    );

    // Call Claude API
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages,
    });

    const aiReply = response.content[0].text;

    // Save AI response
    const aiMsgId = uuidv4();
    await query(
      `INSERT INTO chat_messages (id, session_id, sender_id, sender_role, content, metadata) VALUES ($1,$2,$3,'admin',$4,$5)`,
      [aiMsgId, sessionId, uuidv4(), aiReply, JSON.stringify({ model: 'claude-sonnet', tokens: response.usage })]
    );

    // temporary response format, may need restructuring based on frontend requirements
    res.json({
      success: true,
      data: {
        message_id: aiMsgId,
        session_id: sessionId,
        reply: aiReply,
        language,
      },
    });
  } catch (err) { next(err); }
};

// Get chat history
exports.getChatHistory = async (req, res, next) => {
  try {
    const { session_id } = req.params;
    const result = await query(
      `SELECT id, sender_role, content, type, created_at FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC`,
      [session_id]
    );
    res.json({ success: true, data: { messages: result.rows } });
  } catch (err) { next(err); }
};

// Generate AI Advertisement
exports.generateAIAd = async (req, res, next) => {
  try {
    const { type, topic, region, severity, languages } = req.body;
    const doctorId = req.user.id;

    const prompt = `Generate a professional public health advertisement for:
- Disease/Topic: ${topic}
- Region: ${region}
- Type: ${type}
- Severity: ${severity}
- Languages: Bilingual Hindi + English

Return a JSON object with:
{
  "title_en": "...",
  "title_hi": "...",
  "body_en": "...",
  "body_hi": "...",
  "dos": ["do1_bilingual", "do2_bilingual", ...] (4 items, format: "✅ Hindi / English"),
  "donts": ["dont1_bilingual", ...] (4 items, format: "❌ Hindi / English"),
  "emergency_line": "...",
  "who_compliance": "WHO-Aligned Advisory"
}

Make it clear, simple for rural audiences, culturally appropriate, and WHO-compliant.`;

    // sending user input to AI service and waiting for the generated response  
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    let content;
    try {
      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      content = jsonMatch ? JSON.parse(jsonMatch[0]) : { title_en: topic, body_en: text };
    } catch {
      content = { title_en: topic, body_en: response.content[0].text };
    }

    // Save to database
    const adId = uuidv4();
    await query(
      `INSERT INTO ai_advertisements (id, created_by, type, topic, target_region, severity, languages, content)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [adId, doctorId, type.replace(' ', '_').toLowerCase(), topic, region, severity, languages || ['hi', 'en'], JSON.stringify(content)]
    );

// formatting and returning AI response back to the client
    res.json({
      success: true,
      data: { ad_id: adId, content, is_live: false },
    });
  } catch (err) { next(err); }
};

// Publish ad to all users
exports.publishAd = async (req, res, next) => {
  try {
    const { ad_id } = req.params;
    await query('UPDATE ai_advertisements SET is_live=TRUE, pushed_at=NOW() WHERE id=$1 AND created_by=$2', [ad_id, req.user.id]);

    // In production: push to FCM/notifications system here
    const adResult = await query('SELECT * FROM ai_advertisements WHERE id=$1', [ad_id]);
    if (!adResult.rows[0]) return next(new AppError('Ad not found', 404));

    // Create notifications for all users in target region
    const ad = adResult.rows[0];
    await query(
      `INSERT INTO notifications (user_id, title, body, type, data)
       SELECT id, $1, $2, 'public_health_alert', $3 FROM users WHERE is_active=TRUE LIMIT 5000`,
      [ad.content.title_en || ad.topic, ad.content.body_en || '', JSON.stringify({ ad_id })]
    );
// handling errors to prevent server crash and provide safe response
    res.json({ success: true, message: 'Advertisement published and pushed to users', data: { ad_id, is_live: true } });
  } catch (err) { next(err); }
};
