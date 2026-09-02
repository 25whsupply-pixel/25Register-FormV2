const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL; // e.g. https://your-render-app.onrender.com
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

// Initialize Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Helper to escape HTML characters
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Function to send form selection menu
function sendFormMenu(chatId) {
  bot.sendMessage(
    chatId, 
    "25Realty សូមស្វាគមន៍ 🙏\nសូមជ្រើសរើសទម្រង់ដែលអ្នកចង់បំពេញខាងក្រោម៖", 
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 ស្វែងរកអចលនទ្រព្យ (Client Inquiry)", web_app: { url: WEB_APP_URL } }],
          [{ text: "🏠 ដាក់លក់/ជួល អចលនទ្រព្យ (Property Listing)", web_app: { url: `${WEB_APP_URL}/listing` } }]
        ]
      }
    }
  );
}

// Serve Client Inquiry Form (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve Property Listing Form (listing.html)
app.get('/listing', (req, res) => {
  res.sendFile(path.join(__dirname, 'listing.html'));
});

// Handle /start command and any text/menu interaction
bot.on('message', (msg) => {
  // Always trigger the selection menu when user interacts with the bot
  sendFormMenu(msg.chat.id);
});

// Endpoint for Client Inquiry Submissions
app.post('/submit', async (req, res) => {
  try {
    const data = req.body;

    // Send to Google Apps Script
    if (GOOGLE_SCRIPT_URL) {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, formType: "client_inquiry" })
      });
    }

    // Send Alert to Telegram Group
    if (GROUP_CHAT_ID) {
      const alertMsg = 
`📋 <b>NEW CLIENT INQUIRY ALERT</b> 📋

👤 <b>Name:</b> ${escapeHtml(data.fullName)}
📞 <b>Tel 1:</b> ${escapeHtml(data.phone1)} | <b>Tel 2:</b> ${escapeHtml(data.phone2 || 'N/A')}
💬 <b>Telegram:</b> ${escapeHtml(data.telegramAccount)}
🎯 <b>Target:</b> ${escapeHtml(data.target)}
🏠 <b>Type:</b> ${escapeHtml(data.propertyType)}
💰 <b>Price Rank:</b> $${escapeHtml(data.minPrice || 0)} - $${escapeHtml(data.maxPrice || 0)}
📍 <b>Area:</b> ${escapeHtml(data.location)}
📐 <b>Building:</b> ${escapeHtml(data.buildingSize || 'N/A')} | <b>Land:</b> ${escapeHtml(data.landSize || 'N/A')}
🛏 <b>Beds:</b> ${escapeHtml(data.bedrooms)} | 🛁 <b>Baths:</b> ${escapeHtml(data.bathrooms)}
🧩 <b>Direction:</b> ${escapeHtml(data.direction)} | 🚗 <b>Parking:</b> ${escapeHtml(data.parking)}
📝 <b>Remark:</b> ${escapeHtml(data.notes || 'N/A')}
✍️ <b>Submitted By:</b> ${escapeHtml(data.submittedBy)}

<b>Submitted At:</b> ${escapeHtml(data.submittedAt)}`;

      bot.sendMessage(GROUP_CHAT_ID, alertMsg, { parse_mode: 'HTML' }).catch(console.error);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Inquiry Submission Error:', err);
    return res.status(500).json({ success: false, error: err.toString() });
  }
});

// Endpoint for Property Listing Submissions
app.post('/submit-listing', async (req, res) => {
  try {
    const data = req.body;

    // Send to Google Apps Script
    if (GOOGLE_SCRIPT_URL) {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, formType: "property_listing" })
      });
    }

    // Construct Price text display
    let priceText = '';
    if (data.listingType === 'Rent') priceText = `$${escapeHtml(data.rentPrice)}/mo`;
    else if (data.listingType === 'Sale') priceText = `$${escapeHtml(data.salePrice)}`;
    else priceText = `Sale: $${escapeHtml(data.salePrice)} | Rent: $${escapeHtml(data.rentPrice)}/mo`;

    // Send Alert to Telegram Group
    if (GROUP_CHAT_ID) {
      const alertMsg = 
`🏠 <b>NEW PROPERTY LISTING ALERT</b> 🏠

👤 <b>Role:</b> ${escapeHtml(data.userRole)} (${escapeHtml(data.fullName)})
📞 <b>Tel 1:</b> ${escapeHtml(data.phone)} | <b>Tel 2:</b> ${escapeHtml(data.phone2 || 'N/A')}
💬 <b>Telegram:</b> ${escapeHtml(data.telegramAccount)}
🏠 <b>Property Type:</b> ${escapeHtml(data.propertyType)}
🏷 <b>Listing Type:</b> ${escapeHtml(data.listingType)}
💰 <b>Price Rank:</b> ${priceText}
📍 <b>Location:</b> ${escapeHtml(data.location)}
🔗 <b>Map Link:</b> ${escapeHtml(data.mapLink)}
📐 <b>Land Size:</b> ${escapeHtml(data.landSize || 'N/A')} | 🏢 <b>Building:</b> ${escapeHtml(data.buildingSize || 'N/A')}
🛏 <b>Beds/Baths:</b> ${data.propertyType === 'Land' ? 'N/A' : `${escapeHtml(data.bedrooms)} Bed / ${escapeHtml(data.bathrooms)} Bath`}
🚗 <b>Parking:</b> ${escapeHtml(data.parking)}
🤝 <b>Commission Agree:</b> ${escapeHtml(data.commission)}
📝 <b>Remark:</b> ${escapeHtml(data.notes || 'N/A')}

<b>Submitted At:</b> ${escapeHtml(data.submittedAt)}`;

      bot.sendMessage(GROUP_CHAT_ID, alertMsg, { parse_mode: 'HTML' }).catch(console.error);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Listing Submission Error:', err);
    return res.status(500).json({ success: false, error: err.toString() });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
