// Add listing route to express
app.get('/listing', (req, res) => {
  res.sendFile(path.join(__dirname, 'listing.html'));
});

// Update Telegram /start Command with dual Mini App options
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
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
});

// Endpoint for Property Listing submission
app.post('/submit-listing', async (req, res) => {
  const data = req.body;
  const lang = data.lang || 'km';

  const userRole = escapeHtml(data.userRole);
  const fullName = escapeHtml(data.fullName);
  const phone = escapeHtml(data.phone);
  const phone2 = escapeHtml(data.phone2);
  const telegramAccount = escapeHtml(data.telegramAccount);
  const listingType = escapeHtml(data.listingType); // Rent, Sale, or Sale & Rent
  const propertyType = escapeHtml(data.propertyType);
  const rentPrice = escapeHtml(data.rentPrice);
  const salePrice = escapeHtml(data.salePrice);
  const location = escapeHtml(data.location);
  const mapLink = escapeHtml(data.mapLink);
  const landSize = escapeHtml(data.landSize);
  const buildingSize = escapeHtml(data.buildingSize);
  const bedrooms = escapeHtml(data.bedrooms);
  const bathrooms = escapeHtml(data.bathrooms);
  const commission = escapeHtml(data.commission);
  const direction = escapeHtml(data.direction);
  const notes = escapeHtml(data.notes);
  const submittedAt = escapeHtml(data.submittedAt);

  let priceText = '';
  if (listingType === 'Rent') priceText = `$${rentPrice}/mo`;
  else if (listingType === 'Sale') priceText = `$${salePrice}`;
  else priceText = `Sale: $${salePrice} | Rent: $${rentPrice}/mo`;

  if (GROUP_CHAT_ID) {
    const alertMsg = 
`🏠 <b>NEW PROPERTY LISTING ALERT</b> 🏠

👤 <b>Role:</b> ${userRole} (${fullName})
📞 <b>Phone:</b> ${phone} ${phone2 ? `/ ${phone2}` : ''}
💬 <b>Telegram:</b> ${telegramAccount}
🏷 <b>Listing Type:</b> ${listingType}
🏠 <b>Property Type:</b> ${propertyType}
💰 <b>Price:</b> ${priceText}
📍 <b>Location:</b> ${location}
🔗 <b>Map:</b> ${mapLink || 'N/A'}
📐 <b>Land Size:</b> ${landSize || 'N/A'} | 🏢 <b>Building:</b> ${buildingSize || 'N/A'}
🛏 <b>Beds:</b> ${bedrooms} | 🛁 <b>Baths:</b> ${bathrooms}
🤝 <b>Commission:</b> ${commission || 'N/A'}
🧩 <b>Direction:</b> ${direction}
📝 <b>Notes:</b> ${notes}

<b>Submitted At:</b> ${submittedAt}`;

    bot.sendMessage(GROUP_CHAT_ID, alertMsg, { parse_mode: 'HTML' }).catch(console.error);
  }

  return res.status(200).json({ success: true });
});
