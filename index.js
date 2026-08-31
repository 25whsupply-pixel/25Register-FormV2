const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Fetch Environment Variables
const TOKEN = process.env.BOT_TOKEN;

const WEB_APP_URL = 
  process.env.WEB_APP_URL || 
  process.env['WEB-APP-URL'] || 
  "https://bputheavypc22-pixel.github.io/25Register-FormV2/";

const SCRIPT_URL = 
  process.env.SCRIPT_URL || 
  process.env.GOOGLE_SHEET_URL;

const GROUP_CHAT_ID = 
  process.env.GROUP_CHAT_ID || 
  process.env.TELEGRAM_GROUP_ID;

const TOPIC_ID = 
  process.env.TOPIC_ID || 
  process.env.TOPIC_CLIENT_ID ? 
  parseInt(process.env.TOPIC_ID || process.env.TOPIC_CLIENT_ID) : null;

// Helper function to escape special formatting characters safely
function cleanText(str) {
  if (!str) return '';
  return String(str).replace(/[*_`\[\]]/g, '').trim();
}

// Initialize Telegram Bot
const bot = new TelegramBot(TOKEN, { polling: true });

app.get('/', (req, res) => {
  res.send('25Realty Backend Server is active and running!');
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Welcome to 25Realty Inquiry Portal!\n\nClick the button below to open the form:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Open Registration Form", web_app: { url: WEB_APP_URL } }]
      ]
    }
  });
});

app.post('/submit-form', async (req, res) => {
  console.log("Form payload received:", req.body);
  const data = req.body;

  // Clean form values
  const name = cleanText(data.fullName) || 'N/A';
  const phone1 = cleanText(data.phone);
  const phone2 = cleanText(data.phone2);
  
  // Combine Phone Numbers into a single string for Telegram
  let phoneSummary = phone1 || 'N/A';
  if (phone2) {
    phoneSummary += `, ${phone2}`;
  }

  // Combine Locations into a single wrapped string for Telegram
  const loc1 = cleanText(data.location);
  const loc2 = cleanText(data.location2);
  let locationSummary = loc1 || 'N/A';
  if (loc2) {
    locationSummary += `, ${loc2}`;
  }

  const handle = cleanText(data.telegramUser) || 'N/A';
  const target = cleanText(data.target) || 'N/A';
  const propertyType = cleanText(data.propertyType) || 'N/A';
  const minPrice = cleanText(data.minPrice) || '0';
  const maxPrice = cleanText(data.maxPrice) || '0';
  const bedrooms = cleanText(data.bedrooms) || 'N/A';
  const bathrooms = cleanText(data.bathrooms) || 'N/A';
  const parking = cleanText(data.parking) || 'N/A';
  const direction = cleanText(data.direction) || 'N/A';
  const notes = cleanText(data.notes) || 'None';

  // 1. Direct Message to Client User
  if (data.chat_id) {
    const clientMessage = 
`✅ Registration Received!

Thank you, ${name}, for registering with 25Realty.

Summary of Details:
• Phone: ${phoneSummary}
• Telegram Handle: @${handle}
• Target: ${target}
• Property Type: ${propertyType}
• Preferred Location: ${locationSummary}
• Price Range: $${minPrice} - $${maxPrice}
• Bedrooms: ${bedrooms}
• Bathrooms: ${bathrooms}
• Parking: ${parking}
• Direction: ${direction}
• Notes: ${notes}

Our team will contact you shortly!`;

    await bot.sendMessage(data.chat_id, clientMessage)
      .catch(err => console.error("Client DM Error:", err.message));
  }

  // 2. Alert Notification to Group / Topic
  if (GROUP_CHAT_ID) {
    const groupMessage = 
`🚨 NEW CLIENT INQUIRY ALERT 🚨

👤 Client Name: ${name}
📞 Phone: ${phoneSummary}
💬 Telegram Handle: @${handle}
🏷️ Target: ${target}
🏠 Type: ${propertyType}
📍 Location: ${locationSummary}
💰 Budget: $${minPrice} - $${maxPrice}
🛏️ Bedrooms: ${bedrooms}
0️⃣ Bathrooms: ${bathrooms}
🚗 Parking: ${parking}
🧩 Direction: ${direction}
📝 Notes: ${notes}`;

    const options = {};
    if (TOPIC_ID) {
      options.message_thread_id = TOPIC_ID;
    }

    await bot.sendMessage(GROUP_CHAT_ID, groupMessage, options)
      .catch(err => console.error("Group Alert Error:", err.message));
  } else {
    console.error("GROUP_CHAT_ID not set in process.env");
  }

  // 3. Google Sheets Endpoint
  if (SCRIPT_URL) {
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      console.log("Successfully posted to Google Sheets.");
    } catch (err) {
      console.error("Google Sheets Error:", err.message);
    }
  }

  return res.status(200).json({ success: true, message: "Processed successfully" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
