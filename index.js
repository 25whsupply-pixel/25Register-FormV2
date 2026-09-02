const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CONFIGURATION (UPDATE YOUR CREDENTIALS HERE)
// ==========================================
const TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const TELEGRAM_CHAT_ID = "YOUR_TELEGRAM_GROUP_CHAT_ID"; // e.g. -1001234567890

// Optional Telegram Group Topic Thread IDs (Leave null if not using topics)
const TELEGRAM_INQUIRY_TOPIC_ID = null; // e.g., 2
const TELEGRAM_LISTING_TOPIC_ID = null; // e.g., 4

// Google Apps Script Web App URLs
const GOOGLE_SHEET_INQUIRY_URL = "YOUR_GOOGLE_APPS_SCRIPT_INQUIRY_WEB_APP_URL";
const GOOGLE_SHEET_LISTING_URL = "YOUR_GOOGLE_APPS_SCRIPT_LISTING_WEB_APP_URL";

// ==========================================
// HELPER FUNCTIONS FOR OUTBOUND CALLS
// ==========================================

// Send formatted message to Telegram Group/Topic
async function sendTelegramMessage(text, threadId = null) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: TELEGRAM_CHAT_ID,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };

  if (threadId) {
    body.message_thread_id = threadId;
  }

  return axios.post(url, body);
}

// Send payload to Google Sheets Web App
async function sendToGoogleSheet(webAppUrl, payload) {
  if (!webAppUrl || webAppUrl.includes("YOUR_GOOGLE_APPS_SCRIPT")) {
    console.warn("Google Sheet Web App URL not configured properly.");
    return;
  }
  return axios.post(webAppUrl, payload, {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ==========================================
// ENDPOINT 1: CLIENT INQUIRY (/submit)
// ==========================================
app.post('/submit', async (req, res) => {
  const data = req.body;

  // 1. Format Telegram Message
  const tgMessage = `
<b>📋 NEW CLIENT INQUIRY</b>
----------------------------------
<b>Target:</b> ${data.target || 'N/A'}
<b>Property Type:</b> ${data.propertyType || 'N/A'}
<b>Price Range:</b> $${data.minPrice || '0'} - $${data.maxPrice || '0'}
<b>Location:</b> ${data.location || 'N/A'}
<b>Building Size:</b> ${data.buildingSize || 'N/A'}
<b>Land Size:</b> ${data.landSize || 'N/A'}
<b>Bedrooms:</b> ${data.bedrooms || 'N/A'} | <b>Bathrooms:</b> ${data.bathrooms || 'N/A'}
<b>Direction:</b> ${data.direction || 'N/A'} | <b>Parking:</b> ${data.parking || 'N/A'}
----------------------------------
<b>Client Name:</b> ${data.fullName || 'N/A'}
<b>Phone 1:</b> ${data.phone1 || 'N/A'}
<b>Phone 2:</b> ${data.phone2 || 'N/A'}
<b>Telegram:</b> ${data.telegramAccount || 'N/A'}
<b>Submitted By:</b> ${data.submittedBy || 'N/A'}
<b>Submitted At:</b> ${data.submittedAt || 'N/A'}
<b>Remarks:</b> ${data.notes || 'None'}
  `.trim();

  try {
    // Dispatch both requests in parallel
    const results = await Promise.allSettled([
      sendTelegramMessage(tgMessage, TELEGRAM_INQUIRY_TOPIC_ID),
      sendToGoogleSheet(GOOGLE_SHEET_INQUIRY_URL, data)
    ]);

    // Check if both external services failed
    const tgFailed = results[0].status === 'rejected';
    const sheetFailed = results[1].status === 'rejected';

    if (tgFailed) console.error('Telegram API Error:', results[0].reason?.response?.data || results[0].reason);
    if (sheetFailed) console.error('Google Sheet API Error:', results[1].reason?.response?.data || results[1].reason);

    if (tgFailed && sheetFailed) {
      return res.status(500).send("Failed to deliver data to Telegram and Google Sheets.");
    }

    return res.status(200).send("Success");
  } catch (err) {
    console.error("Server Error on /submit:", err);
    return res.status(500).send("Internal Server Error");
  }
});

// ==========================================
// ENDPOINT 2: PROPERTY LISTING (/submit-listing)
// ==========================================
app.post('/submit-listing', async (req, res) => {
  const data = req.body;

  // 1. Format Telegram Message
  const tgMessage = `
<b>🏠 NEW PROPERTY LISTING</b>
----------------------------------
<b>User Role:</b> ${data.userRole || 'N/A'}
<b>Submitted By:</b> ${data.fullName || 'N/A'}
<b>Tel 1:</b> ${data.phone || 'N/A'} | <b>Tel 2:</b> ${data.phone2 || 'N/A'}
<b>Telegram:</b> ${data.telegramAccount || 'N/A'}
----------------------------------
<b>Property Type:</b> ${data.propertyType || 'N/A'}
<b>Listing Type:</b> ${data.listingType || 'N/A'}
<b>Rent Price:</b> $${data.rentPrice || '0'} | <b>Sale Price:</b> $${data.salePrice || '0'}
<b>Location:</b> ${data.location || 'N/A'}
<b>Google Map:</b> ${data.mapLink || 'N/A'}
<b>Land Size:</b> ${data.landSize || 'N/A'} | <b>Building Size:</b> ${data.buildingSize || 'N/A'}
<b>Bedrooms:</b> ${data.bedrooms || 'N/A'} | <b>Bathrooms:</b> ${data.bathrooms || 'N/A'}
<b>Parking:</b> ${data.parking || 'N/A'}
<b>Commission Agree:</b> ${data.commission || 'N/A'}
<b>Submitted At:</b> ${data.submittedAt || 'N/A'}
<b>Remarks:</b> ${data.notes || 'None'}
  `.trim();

  try {
    // Dispatch both requests in parallel
    const results = await Promise.allSettled([
      sendTelegramMessage(tgMessage, TELEGRAM_LISTING_TOPIC_ID),
      sendToGoogleSheet(GOOGLE_SHEET_LISTING_URL, data)
    ]);

    const tgFailed = results[0].status === 'rejected';
    const sheetFailed = results[1].status === 'rejected';

    if (tgFailed) console.error('Telegram API Error:', results[0].reason?.response?.data || results[0].reason);
    if (sheetFailed) console.error('Google Sheet API Error:', results[1].reason?.response?.data || results[1].reason);

    if (tgFailed && sheetFailed) {
      return res.status(500).send("Failed to deliver data to Telegram and Google Sheets.");
    }

    return res.status(200).send("Success");
  } catch (err) {
    console.error("Server Error on /submit-listing:", err);
    return res.status(500).send("Internal Server Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
