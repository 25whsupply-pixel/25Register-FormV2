const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CONFIGURATION (FROM RENDER ENV VARIABLES)
// ==========================================
const SCRIPT_URL = process.env.SCRIPT_URL || process.env.WEB_APP_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;

// ==========================================
// PAGE ROUTES
// ==========================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/listing', (req, res) => {
  res.sendFile(path.join(__dirname, 'listing.html'));
});

// ==========================================
// HELPER FUNCTION: FORWARD TO GOOGLE APPS SCRIPT
// ==========================================
async function forwardToAppsScript(payload) {
  if (!SCRIPT_URL) {
    throw new Error("SCRIPT_URL is not set in Render Environment Variables.");
  }

  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Apps Script returned status ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ==========================================
// TELEGRAM WEBHOOK HANDLER (/start COMMAND)
// ==========================================
app.post('/telegram-webhook', async (req, res) => {
  try {
    const update = req.body;

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text.startsWith('/start')) {
        const welcomeMessage = `👋 <b>Welcome to 25Realty Bot!</b>\n\nPlease use the link below to submit inquiries or property listings.`;

        if (BOT_TOKEN) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcomeMessage,
              parse_mode: 'HTML'
            })
          });
        }
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(200).send('OK'); // Always return 200 to Telegram
  }
});

// ==========================================
// ENDPOINT 1: CLIENT INQUIRY (/submit)
// ==========================================
app.post('/submit', async (req, res) => {
  try {
    const payload = {
      formType: 'inquiry',
      topicId: process.env.TOPIC_CLIENT_ID || null,
      ...req.body
    };

    await forwardToAppsScript(payload);
    return res.status(200).send("Success");
  } catch (err) {
    console.error("Error submitting inquiry:", err.message);
    return res.status(500).send("Failed to process submission.");
  }
});

// ==========================================
// ENDPOINT 2: PROPERTY LISTING (/submit-listing)
// ==========================================
app.post('/submit-listing', async (req, res) => {
  try {
    const payload = {
      formType: 'listing',
      topicId: process.env.TOPIC_PROPERTY_ID || null,
      ...req.body
    };

    await forwardToAppsScript(payload);
    return res.status(200).send("Success");
  } catch (err) {
    console.error("Error submitting listing:", err.message);
    return res.status(500).send("Failed to process submission.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
