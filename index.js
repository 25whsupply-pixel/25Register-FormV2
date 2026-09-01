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

// Track pending edit sessions from group admins
const activeEditSessions = new Map();

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

// Welcome Message in Khmer
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId, 
    "25Realty សូមស្វាគមន៍ 🙏\nសូមចុចប៊ូតុងខាងក្រោម ឬ Register Form នៅខាងក្រោមផ្នែកខាងឆ្វេង ដើម្បីជ្រើសរើសពាក្យដែលអ្នកចង់បំពេញ📝", 
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 បំពេញទម្រង់បែបបទ / Register Form", web_app: { url: WEB_APP_URL } }]
        ]
      }
    }
  );
});

// Handle Callback Queries (Buttons: Accept, Reject, Edit)
bot.on('callback_query', async (query) => {
  const { id, data, message, from } = query;
  
  if (data.startsWith('status_')) {
    const statusType = data.replace('status_', '');
    let statusBadge = '🟢 Accepted';
    if (statusType === 'rejected') statusBadge = '🔴 Rejected';

    let currentText = message.text;
    if (currentText.includes('Status:')) {
      currentText = currentText.split('\nStatus:')[0];
    }

    const updatedText = currentText + `\n\n<b>Status:</b> ${statusBadge} (by ${from.first_name})`;

    try {
      await bot.editMessageText(updatedText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: message.reply_markup
      });
      bot.answerCallbackQuery(id, { text: `Marked as ${statusType.toUpperCase()}` });
    } catch (err) {
      console.error("Failed to edit message status:", err.message);
    }
  }

  if (data === 'edit_inquiry') {
    activeEditSessions.set(from.id, {
      chatId: message.chat.id,
      messageId: message.message_id,
      originalText: message.text
    });

    bot.answerCallbackQuery(id, { text: "Reply with updated text to overwrite." });
    
    const promptMsg = await bot.sendMessage(
      message.chat.id, 
      `✏️ <b>Edit Mode Activated</b> (${from.first_name})\n\nPlease reply with the new text body you wish to display on the inquiry card.`, 
      { parse_mode: 'HTML', message_thread_id: message.message_thread_id }
    );

    activeEditSessions.get(from.id).promptMessageId = promptMsg.message_id;
  }
});

// Listen for Admin Reply text to apply custom edits
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const session = activeEditSessions.get(msg.from.id);
  if (session) {
    let newText = escapeHtml(msg.text);
    let editorTag = msg.from.username ? `@${msg.from.username}` : `${msg.from.first_name}`.trim();

    if (newText.includes('Edited by:')) {
      newText = newText.split('\n\n<i>Edited by:')[0];
    }

    newText += `\n\n<i>Edited by: ${editorTag}</i>`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🟢 Accept", callback_data: "status_accepted" },
          { text: "🔴 Reject", callback_data: "status_rejected" }
        ],
        [
          { text: "✏️ Edit Details", callback_data: "edit_inquiry" }
        ]
      ]
    };

    try {
      await bot.editMessageText(newText, {
        chat_id: session.chatId,
        message_id: session.messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

      await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});

      if (session.promptMessageId) {
        await bot.deleteMessage(msg.chat.id, session.promptMessageId).catch(() => {});
      }

      const confirmMsg = await bot.sendMessage(
        msg.chat.id, 
        "✅ Card updated successfully!", 
        { message_thread_id: msg.message_thread_id }
      );

      setTimeout(() => {
        bot.deleteMessage(msg.chat.id, confirmMsg.message_id).catch(() => {});
      }, 15000);

      activeEditSessions.delete(msg.from.id);
    } catch (err) {
      console.error("Failed to apply admin edit:", err.message);
    }
  }
});

app.post('/submit-form', async (req, res) => {
  console.log("Form payload received:", req.body);
  const data = req.body;
  const lang = data.lang || 'km';

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

  let sizeText = '';
  if (landSize) sizeText += `\n📐 Land Size: ${landSize}`;
  if (buildingSize) sizeText += `\n🏢 Building Size: ${buildingSize}`;

  let submittedByLink = 'N/A';
  let submittedByPlain = 'N/A';

  if (data.tgUsername) {
    submittedByLink = `@${data.tgUsername}`;
    submittedByPlain = `@${data.tgUsername}`;
  } else if (data.tgUserId) {
    const userFullName = escapeHtml(`${data.tgFirstName} ${data.tgLastName}`.trim()) || 'User';
    submittedByLink = `<a href="tg://user?id=${data.tgUserId}">${userFullName}</a>`;
    submittedByPlain = `${userFullName} (ID: ${data.tgUserId})`;
  }

  // 1. Alert Notification to Telegram Group Topic (Internal Admin Format)
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

    const options = { 
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🟢 Accept", callback_data: "status_accepted" },
            { text: "🔴 Reject", callback_data: "status_rejected" }
          ],
          [
            { text: "✏️ Edit Details", callback_data: "edit_inquiry" }
          ]
        ]
      }
    };

    if (TOPIC_ID) {
      options.message_thread_id = TOPIC_ID;
    }

    await bot.sendMessage(GROUP_CHAT_ID, groupMessage, options)
      .catch(err => console.error("Group Alert Error:", err.message));
  }

  // 2. Direct Confirmation Message to Client (Formatted in Chosen Language)
  if (data.chat_id) {
    let clientMessage = '';
    
    if (lang === 'en') {
      let sizeClientText = '';
      if (landSize) sizeClientText += `\n• <b>Land Size:</b> ${landSize}`;
      if (buildingSize) sizeClientText += `\n• <b>Building Size:</b> ${buildingSize}`;

      clientMessage = 
`✅ <b>Registration Received!</b>

Thank you, ${name}, for registering with 25Realty.

<b>Summary of Details:</b>
• <b>Phone:</b> ${phoneSummary}
• <b>Telegram Account:</b> ${telegramAccount}
• <b>Purpose:</b> ${target}
• <b>Property Type:</b> ${propertyType}${sizeClientText}
• <b>Preferred Location:</b> ${locationSummary}
• <b>Price Range:</b> $${minPrice} - $${maxPrice}
• <b>Bedrooms:</b> ${bedrooms}
• <b>Bathrooms:</b> ${bathrooms}
• <b>Parking:</b> ${parking}
• <b>Direction:</b> ${direction}
• <b>Notes:</b> ${notes}

<b>Submitted Date:</b> ${submittedAt}
<b>Submitted By:</b> ${submittedByLink}

Our team will contact you shortly!`;
    } else {
      let sizeClientText = '';
      if (landSize) sizeClientText += `\n• <b>ទំហំដី:</b> ${landSize}`;
      if (buildingSize) sizeClientText += `\n• <b>ទំហំអគារ:</b> ${buildingSize}`;

      clientMessage = 
`✅ <b>ទទួលបានព័ត៌មានចុះឈ្មោះរួចរាល់!</b>

សូមអរគុណ ${name} ដែលបានចុះឈ្មោះជាមួយ 25Realty។

<b>សង្ខេបព័ត៌មាន៖</b>
• <b>លេខទូរស័ព្ទ:</b> ${phoneSummary}
• <b>គណនី Telegram:</b> ${telegramAccount}
• <b>គោលបំណង:</b> ${target === 'Rent' ? 'ជួល' : 'ទិញ'}
• <b>ប្រភេទអចលនទ្រព្យ:</b> ${propertyType}${sizeClientText}
• <b>ទីតាំងចង់បាន:</b> ${locationSummary}
• <b>ថវិកា:</b> $${minPrice} - $${maxPrice}
• <b>បន្ទប់គេង:</b> ${bedrooms}
• <b>បន្ទប់ទឹក:</b> ${bathrooms}
• <b>ចំណតរថយន្ត:</b> ${parking}
• <b>បែរមុខទៅ:</b> ${direction}
• <b>ព័ត៌មានបន្ថែម:</b> ${notes}

<b>កាលបរិច្ឆេទ:</b> ${submittedAt}
<b>ផ្ញើដោយ:</b> ${submittedByLink}

ក្រុមការងារយើងខ្ញុំនឹងទាក់ទងទៅអ្នកក្នុងពេលឆាប់ៗនេះ!`;
    }

    await bot.sendMessage(data.chat_id, clientMessage, { parse_mode: 'HTML' })
      .catch(err => console.error("Client DM Error:", err.message));

    // Follow-up Channel Promo Message
    setTimeout(() => {
      const followUpText = lang === 'en' 
        ? "To follow our listings, please join our Telegram channels below 👇" 
        : "ដើម្បីតាមដានពួកយើង សូមចូលឆាណែលតេឡេក្រាមខាងក្រោម👇";

      const followUpOptions = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: lang === 'en' ? "Property For Rent" : "អចលនទ្រព្យ ជួល", url: "https://t.me/+wbOpMBLS6t1hYzY1" }
            ],
            [
              { text: lang === 'en' ? "Property For Sale" : "អចលនទ្រព្យ លក់", url: "https://t.me/khmer25service" }
            ]
          ]
        }
      };

      bot.sendMessage(data.chat_id, followUpText, followUpOptions)
        .catch(err => console.error("Follow-up Message Error:", err.message));
    }, 5000);
  }

  // 3. Google Sheets Endpoint
  if (SCRIPT_URL) {
    try {
      const sheetPayload = {
        fullName: name,
        phone1: phone1 ? `'${phone1}` : 'N/A',
        phone2: phone2 ? `'${phone2}` : 'N/A',
        telegramAccount: telegramAccount,
        target: target,
        propertyType: propertyType,
        buildingSize: buildingSize || 'N/A',
        landSize: landSize || 'N/A',
        location: locationSummary,
        minPrice: minPrice,
        maxPrice: maxPrice,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        parking: parking,
        direction: direction,
        notes: notes,
        submittedAt: submittedAt,
        submittedBy: submittedByPlain
      };

      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetPayload)
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
