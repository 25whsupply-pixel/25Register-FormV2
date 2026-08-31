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

// Clean text for safe HTML output
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

  // Form Fields
  const name = escapeHtml(data.fullName) || 'N/A';
  const phone1 = escapeHtml(data.phone);
  const phone2 = escapeHtml(data.phone2);
  const telegramAccount = escapeHtml(data.telegramAccount) || 'N/A';
  const submittedAt = escapeHtml(data.submittedAt) || 'N/A';

  let phoneSummary = phone1 || 'N/A';
  if (phone2) {
    phoneSummary += `, ${phone2}`;
  }

  const loc1 = escapeHtml(data.location);
  const loc2 = escapeHtml(data.location2);
  let locationSummary = loc1 || 'N/A';
  if (loc2) {
    locationSummary += `, ${loc2}`;
  }

  const target = escapeHtml(data.target) || 'N/A';
  const propertyType = escapeHtml(data.propertyType) || 'N/A';
  const landSize = escapeHtml(data.landSize);
  const buildingSize = escapeHtml(data.buildingSize);
  const minPrice = escapeHtml(data.minPrice) || '0';
  const maxPrice = escapeHtml(data.maxPrice) || '0';
  const bedrooms = escapeHtml(data.bedrooms) || 'N/A';
  const bathrooms = escapeHtml(data.bathrooms) || 'N/A';
  const parking = escapeHtml(data.parking) || 'N/A';
  const direction = escapeHtml(data.direction) || 'N/A';
  const notes = escapeHtml(data.notes) || 'N/A';

  // Build Size Info string if available
  let sizeText = '';
  if (landSize) sizeText += `\n📐 Land Size: ${landSize}`;
  if (buildingSize) sizeText += `\n🏢 Building Size: ${buildingSize}`;

  // Build "Submitted By" link
  let submittedByLink = 'N/A';
  if (data.tgUsername) {
    submittedByLink = `@${data.tgUsername}`;
  } else if (data.tgUserId) {
    const userFullName = escapeHtml(`${data.tgFirstName} ${data.tgLastName}`.trim()) || 'User';
    submittedByLink = `<a href="tg://user?id=${data.tgUserId}">${userFullName}</a>`;
  }

  // 1. Alert Notification to Telegram Group / Topic
  if (GROUP_CHAT_ID) {
    const groupMessage = 
`🚨 <b>NEW CLIENT INQUIRY ALERT</b> 🚨

👤 <b>Client Name:</b> ${name}
📞 <b>Phone:</b> ${phoneSummary}
💬 <b>Telegram Account:</b> ${telegramAccount}
🏷 <b>Target:</b> ${target}
🏠 <b>Type:</b> ${propertyType}${sizeText}
📍 <b>Location:</b> ${locationSummary}
💰 <b>Budget:</b> $${minPrice} - $${maxPrice}
🛏 <b>Bedrooms:</b> ${bedrooms}
🛁 <b>Bathrooms:</b> ${bathrooms}
🚗 <b>Parking:</b> ${parking}
🧩 <b>Direction:</b> ${direction}
📝 <b>Notes:</b> ${notes}

<b>Submitted Date :</b> ${submittedAt}
<b>Submitted By:</b> ${submittedByLink}`;

    const options = { parse_mode: 'HTML' };
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
`✅ <b>Registration Received!</b>

Thank you, ${name}, for registering with 25Realty.

<b>Summary of Details:</b>
• <b>Phone:</b> ${phoneSummary}
• <b>Telegram Account:</b> ${telegramAccount}
• <b>Target:</b> ${target}
• <b>Property Type:</b> ${propertyType}${sizeClientText}
• <b>Preferred Location:</b> ${locationSummary}
• <b>Price Range:</b> $${minPrice} - $${maxPrice}
• <b>Bedrooms:</b> ${bedrooms}
• <b>Bathrooms:</b> ${bathrooms}
• <b>Parking:</b> ${parking}
• <b>Direction:</b> ${direction}
• <b>Notes:</b> ${notes}

<b>Submitted Date :</b> ${submittedAt}
<b>Submitted By:</b> ${submittedByLink}

Our team will contact you shortly!`;

    await bot.sendMessage(data.chat_id, clientMessage, { parse_mode: 'HTML' })
      .catch(err => console.error("Client DM Error:", err.message));

    // 3. Follow-up Message after 5 seconds delay
    setTimeout(() => {
      const followUpText = "ដើម្បីតាមដានពួកយើង សូមចូលឆាណែលតេឡេក្រាមខាងក្រោម👇";
      const followUpOptions = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "អចលនទ្រព្យ ជួល", url: "https://t.me/+wbOpMBLS6t1hYzY1" }
            ],
            [
              { text: "អចលនទ្រព្យ លក់", url: "https://t.me/khmer25service" }
            ]
          ]
        }
      };

      bot.sendMessage(data.chat_id, followUpText, followUpOptions)
        .catch(err => console.error("Follow-up Message Error:", err.message));
    }, 5000);
  }

  // 4. Google Sheets Endpoint
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
