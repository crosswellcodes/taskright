const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const knex = require('../db');
const { sendSMS } = require('../services/notificationService');
const {
  confirmCustomerSelection,
  generateSelectionToken,
} = require('../services/businessService');

// Ensure the media download directory exists
const MEDIA_DIR = path.join(__dirname, '../../uploads/messages');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const WEBSITE_URL = process.env.WEBSITE_URL || 'https://taskrightpro.com';

/**
 * Downloads a Twilio media URL to disk using Basic auth.
 * Follows redirects (Twilio may redirect to CDN).
 */
function downloadMedia(url, dest) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    const makeRequest = (targetUrl, sendAuth = true) => {
      const reqOptions = sendAuth ? { headers: { Authorization: `Basic ${auth}` } } : {};
      https.get(targetUrl, reqOptions, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          return makeRequest(res.headers.location, false);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Media download failed: HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

/**
 * Handle C/T/D/N keyword replies from known customers.
 * Stateful follow-up (note content after N) is handled first.
 * Anything unrecognized is left in the thread as a personal touchpoint for the business owner.
 */
async function handleKeyword(business, customer, fromPhone, body) {
  const keyword = (body || '').trim().toUpperCase();

  // ── Stateful: waiting for note content after customer sent N ──────────────
  if (customer.pending_sms_action === 'note_pending') {
    if (!body.trim()) return;

    const openCycle = await knex('selection_cycles')
      .where('customer_id', customer.id)
      .where('status', 'open')
      .orderBy('service_date', 'asc')
      .first();

    await knex('customers').where('id', customer.id).update({
      pending_sms_action: null,
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });

    if (openCycle) {
      const serviceDate = new Date(openCycle.service_date).toISOString().split('T')[0];
      await knex('selection_cycles').where('id', openCycle.id).update({
        customer_note: body.trim(),
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });
      await sendSMS(business, fromPhone, `Got it. Your team will see your note for ${serviceDate}.`);
    } else {
      await sendSMS(business, fromPhone, `Got it — we'll pass your note along when your next service is scheduled.`);
    }
    return;
  }

  // ── C — Confirm current tasks ─────────────────────────────────────────────
  if (keyword === 'C') {
    const result = await confirmCustomerSelection(customer.id);
    if (result.status === 'no_cycle') {
      await sendSMS(business, fromPhone, `You don't have any upcoming services scheduled yet. ${business.name} will notify you when your next visit is set.`);
    } else if (result.status === 'already_confirmed') {
      await sendSMS(business, fromPhone, `You're already confirmed for ${result.serviceDate}. See you then!`);
    } else if (result.status === 'no_previous') {
      await sendSMS(business, fromPhone, `Reply T to set your task preferences for ${result.serviceDate}.`);
    } else {
      await sendSMS(business, fromPhone, `Confirmed! Your ${result.serviceDate} service is all set.`);
    }
    return;
  }

  // ── T — Review tasks via tokenized link ───────────────────────────────────
  if (keyword === 'T') {
    const openCycle = await knex('selection_cycles')
      .where('customer_id', customer.id)
      .where('status', 'open')
      .orderBy('service_date', 'asc')
      .first();

    if (!openCycle) {
      await sendSMS(business, fromPhone, `You don't have any upcoming services scheduled yet. ${business.name} will be in touch.`);
      return;
    }

    const token = await generateSelectionToken(openCycle.id);
    const serviceDate = new Date(openCycle.service_date).toISOString().split('T')[0];
    await sendSMS(business, fromPhone, `Review your tasks for ${serviceDate}: ${WEBSITE_URL}/s/${token}`);
    return;
  }

  // ── D — Request a date change ─────────────────────────────────────────────
  if (keyword === 'D') {
    await sendSMS(business, fromPhone, `Your date change request has been forwarded to ${business.name}. They'll be in touch shortly.`);
    return;
  }

  // ── N — Leave a note for the team ─────────────────────────────────────────
  if (keyword === 'N') {
    const openCycle = await knex('selection_cycles')
      .where('customer_id', customer.id)
      .where('status', 'open')
      .orderBy('service_date', 'asc')
      .first();

    if (!openCycle) {
      await sendSMS(business, fromPhone, `You don't have any upcoming services scheduled yet. ${business.name} will be in touch.`);
      return;
    }

    const serviceDate = new Date(openCycle.service_date).toISOString().split('T')[0];
    await knex('customers').where('id', customer.id).update({
      pending_sms_action: 'note_pending',
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });
    await sendSMS(business, fromPhone, `What's your note for the team? Reply with your message and it will be ready for your ${serviceDate} visit.`);
    return;
  }

  // ── Unrecognized — stays in the thread, no auto-reply ────────────────────
  // Business owner sees it and handles personally. This is intentional.
}

/**
 * POST /api/webhooks/inbound-sms
 *
 * Twilio posts here when a customer replies to a business's dedicated number.
 * Returns 200 with empty TwiML immediately; processes async after response.
 */
router.post('/inbound-sms', async (req, res) => {
  res.set('Content-Type', 'text/xml');
  res.send('<Response/>');

  setImmediate(async () => {
    try {
      const {
        To: toPhone,
        From: fromPhone,
        Body: body,
        MessageSid: twilioMessageSid,
        NumMedia: numMediaStr,
      } = req.body;

      const numMedia = parseInt(numMediaStr) || 0;

      if (!toPhone || !fromPhone || (!body && numMedia === 0)) {
        console.warn('Inbound SMS webhook missing required fields:', req.body);
        return;
      }

      // Deduplicate — Twilio may retry if our earlier response was slow
      if (twilioMessageSid) {
        const existing = await knex('messages')
          .where('twilio_message_sid', twilioMessageSid)
          .first();
        if (existing) {
          console.log(`Duplicate inbound SID ${twilioMessageSid} — skipping`);
          return;
        }
      }

      const business = await knex('businesses')
        .where('twilio_phone_number', toPhone)
        .first();

      if (!business) {
        console.warn(`Inbound SMS to unknown Twilio number ${toPhone} — no matching business`);
        return;
      }

      const customer = await knex('customers')
        .where('phone_number', fromPhone)
        .where('business_id', business.id)
        .first();

      // Download any attached media files
      let mediaUrls = null;
      if (numMedia > 0) {
        const paths = [];
        for (let i = 0; i < numMedia; i++) {
          const mediaUrl = req.body[`MediaUrl${i}`];
          const contentType = req.body[`MediaContentType${i}`] || 'image/jpeg';
          const ext = contentType.split('/')[1]?.split(';')[0]?.replace('+', '') || 'jpg';
          const filename = `${twilioMessageSid}_${i}.${ext}`;
          const dest = path.join(MEDIA_DIR, filename);
          try {
            await downloadMedia(mediaUrl, dest);
            paths.push(`/uploads/messages/${filename}`);
            console.log(`📎 Media downloaded: ${filename}`);
          } catch (err) {
            console.error(`❌ Media download failed (${i}) for SID ${twilioMessageSid}:`, err.message, '| URL:', mediaUrl);
          }
        }
        if (paths.length > 0) mediaUrls = JSON.stringify(paths);
      }

      await knex('messages').insert({
        business_id: business.id,
        customer_id: customer ? customer.id : null,
        direction: 'inbound',
        body: (body || '').trim(),
        twilio_message_sid: twilioMessageSid || null,
        to_phone: toPhone,
        from_phone: fromPhone,
        media_urls: mediaUrls,
      });

      console.log(
        `📥 Inbound ${numMedia > 0 ? 'MMS' : 'SMS'} from ${fromPhone} → business ${business.id}` +
        (customer ? ` (customer ${customer.id})` : ' (unknown caller)') +
        (numMedia > 0 ? ` [${numMedia} media file(s)]` : '')
      );

      // Keyword handling: known customers with a text body only
      if (customer && body && body.trim()) {
        await handleKeyword(business, customer, fromPhone, body);
      }
    } catch (err) {
      console.error('Inbound SMS processing error:', err.message);
    }
  });
});

module.exports = router;
