/**
 * SmsProvider — the provider-abstraction seam for TaskRight's SMS/MMS layer.
 *
 * Every Twilio (and, later, SignalHouse) call-site routes through this contract.
 * Providers own EXTERNAL-API I/O only. The `messages` table is written by the
 * app layer (notificationService / webhooks / businesses route); provisioning
 * identifiers are persisted inside the provider methods (they already are).
 *
 * All phone numbers cross this seam in E.164 (+15551234567). Each provider
 * adapts to its own wire format at its own boundary.
 *
 * See shared/specs/SIGNALHOUSE_MIGRATION.md §1 for the full design.
 *
 * @typedef {Object} SendResult
 * @property {string|null} id      Provider message id (twilio SID / SH _id). null in dev mode.
 * @property {'sent'|'dev'|'blocked'|'failed'} status  Normalized outcome.
 * @property {object|null} raw     Provider-native response, for logging/debug only.
 *
 * @typedef {Object} InboundMedia
 * @property {string} url          Remote media URL to fetch.
 * @property {string} contentType  e.g. 'image/jpeg'.
 * @property {boolean} authRequired  Whether fetching needs provider auth.
 *
 * @typedef {Object} InboundMessage
 * @property {string} toPhone      Our business number (E.164).
 * @property {string} fromPhone    The customer (E.164).
 * @property {string} body         Trimmed text (may be '').
 * @property {string|null} messageId  Provider inbound id (dedupe key).
 * @property {string|null} subgroupId  SignalHouse routing key; null for Twilio.
 * @property {InboundMedia[]} media  Attached media descriptors (may be []).
 */
class SmsProvider {
  /** @returns {string} 'twilio' | 'signalhouse' */
  get name() {
    throw new Error('SmsProvider.name not implemented');
  }

  /**
   * Send one SMS on behalf of a business. Handles dev-mode fallback internally.
   * Does NOT write the messages table — the caller logs.
   * @param {object} business
   * @param {string} toPhone  E.164
   * @param {string} body
   * @returns {Promise<SendResult>}
   */
  async send(business, toPhone, body) {
    throw new Error('SmsProvider.send not implemented');
  }

  /**
   * Provision SMS infrastructure for a new business (fire-and-forget from signup).
   * Owns its own DB writes; no-ops to 'dev_mode' when the provider isn't configured.
   * @param {number} businessId
   * @returns {Promise<void>}
   */
  async provisionBusiness(businessId) {
    throw new Error('SmsProvider.provisionBusiness not implemented');
  }

  /**
   * Register the business for 10DLC (brand + campaign). Fire-and-forget from KYC.
   * EIN is transient — never logged, never persisted.
   * @param {number} businessId
   * @param {string|null} ein
   * @returns {Promise<void>}
   */
  async registerA2P(businessId, ein) {
    throw new Error('SmsProvider.registerA2P not implemented');
  }

  /**
   * Normalize a raw inbound webhook request into an InboundMessage.
   * @param {import('express').Request} req
   * @returns {InboundMessage}
   */
  parseInbound(req) {
    throw new Error('SmsProvider.parseInbound not implemented');
  }

  /**
   * Authenticate an inbound webhook request. Return true to accept.
   * @param {import('express').Request} req
   * @returns {boolean}
   */
  verifyInboundSignature(req) {
    throw new Error('SmsProvider.verifyInboundSignature not implemented');
  }

  /**
   * Download one inbound media file to disk, applying provider auth as needed.
   * @param {InboundMedia} media
   * @param {string} destPath
   * @returns {Promise<void>}
   */
  async fetchInboundMedia(media, destPath) {
    throw new Error('SmsProvider.fetchInboundMedia not implemented');
  }

  /**
   * Send an OTP to a phone (web signup / join flow).
   * @param {string} phone  E.164
   * @returns {Promise<void>}
   */
  async sendOtp(phone) {
    throw new Error('SmsProvider.sendOtp not implemented');
  }

  /**
   * Check an OTP code. Returns whether it is valid & unexpired.
   * @param {string} phone  E.164
   * @param {string} code
   * @returns {Promise<boolean>}
   */
  async verifyOtp(phone, code) {
    throw new Error('SmsProvider.verifyOtp not implemented');
  }
}

module.exports = SmsProvider;
