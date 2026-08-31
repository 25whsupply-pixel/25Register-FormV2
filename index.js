const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Fetch Environment Variables
const TOKEN = process.env.BOT_TOKEN;

const WEB_APP_URL = 
  process.env.WEB_APP_URL || 
  process.env['WEB-APP-URL'] || 
  "https://two5register-formv2-8kmz.onrender.com";

const SCRIPT_URL = 
  process.env.SCRIPT_URL || 
  process.env.GOOGLE_SHEET_URL;

const GROUP_CHAT_ID = 
  process.env.GROUP_CHAT_ID || 
  process.env.TELEGRAM_GROUP_ID;

const TOPIC_ID = process.env.TOPIC_CLIENT_ID || process.env.TOPIC_ID 
  ? parseInt(process.env.TOPIC_CLIENT_ID || process.env.TOPIC_ID) 
  : null;

// Helper function to escape special formatting characters safely
function cleanText(str) {
  if (!str) return '';
  return String(str).replace(/[*_`\[\]]/g, '').trim();
}

// Initialize Telegram Bot
const bot = new TelegramBot(TOKEN, { polling: true });

// Serve HTML registration form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
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

  // Extract Form Data
  const name = cleanText(data.fullName) || 'N/A';
  const phone1 = cleanText(data.phone);
  const phone2 = cleanText(data.phone2);
  const handle = cleanText(data.telegramUser) || 'N/A';
  const submittedAt = cleanText(data.submittedAt) || new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

  let phoneSummary = phone1 || 'N/A';
  if (phone2) {
    phoneSummary += `, ${phone2}`;
  }

  const loc1 = cleanText(data.location);
  const loc2 = cleanText(data.location2);
  let locationSummary = loc1 || 'N/A';
  if (loc2) {
    locationSummary += `, ${loc2}`;
  }

  const target = cleanText(data.target) || 'N/A';
  const propertyType = cleanText(data.propertyType) || 'N/A';
  const landSize = cleanText(data.landSize);
  const buildingSize = cleanText(data.buildingSize);
  const minPrice = cleanText(data.minPrice) || '0';
  const maxPrice = cleanText(data.maxPrice) || '0';
  const bedrooms = cleanText(data.bedrooms) || 'N/A';
  const bathrooms = cleanText(data.bathrooms) || 'N/A';
  const parking = cleanText(data.parking) || 'N/A';
  const direction = cleanText(data.direction) || 'N/A';
  const notes = cleanText(data.notes) || 'None';

  // Build Size Info string if available
  let sizeText = '';
  if (landSize) sizeText += `\n📐 Land Size: ${landSize}`;
  if (buildingSize) sizeText += `\n🏢 Building Size: ${buildingSize}`;

  // 1. Alert Notification to Telegram Group / Topic
  if (GROUP_CHAT_ID) {
    const groupMessage = 
`🚨 NEW CLIENT INQUIRY ALERT 🚨

📅 Date & Time: ${submittedAt}
👤 Client Name: ${name}
📞 Phone: ${phoneSummary}
💬 Telegram Account: ${handle}
🏷 Target: ${target}
🏠 Type: ${propertyType}${sizeText}
📍 Location: ${locationSummary}
💰 Budget: $${minPrice} - $${maxPrice}
🛏 Bedrooms: ${bedrooms}
🛁 Bathrooms: ${bathrooms}
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

  // 2. Direct Confirmation Message to Client User
  if (data.chat_id) {
    let sizeClientText = '';
    if (landSize) sizeClientText += `\n• Land Size: ${landSize}`;
    if (buildingSize) sizeClientText += `\n• Building Size: ${buildingSize}`;

    const clientMessage = 
`✅ Registration Received!

Thank you, ${name}, for registering with 25Realty.

Summary of Details:
📅 Submitted: ${submittedAt}
• Phone: ${phoneSummary}
• Target: ${target}
• Property Type: ${propertyType}${sizeClientText}
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
