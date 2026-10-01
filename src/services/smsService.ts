// src/services/smsService.ts
/**
 * OTP SMS delivery.
 *
 * This is the single place that turns an issued OTP into an actual text message.
 * It owns three responsibilities and nothing else:
 *
 *  1. The DLT-registered template. The id and approved body live in the shared
 *     template registry (src/constants/dltTemplates.ts, key OTP_AUTH) so template
 *     metadata is versioned in code and reused across channels. The provider
 *     matches delivered text against the registered body, so only the OTP value
 *     is substituted into its {#var#} placeholder.
 *
 *  2. The production gate. In any non-production environment this never calls the
 *     SMS provider: the local/staging flow reads the OTP from the API response
 *     (config.otp.debugResponse) instead, so there is no reason to spend a real
 *     SMS credit or hit the DLT gateway. Only NODE_ENV=production sends a message.
 *
 *  3. Normalising the destination number into the <country><10-digit> form the
 *     gateway expects, since stored numbers are inconsistent (bare 10 digits,
 *     or already 91-prefixed).
 *
 * The plaintext OTP is never written to a log line here — same rule as
 * otpService / rabbitmqService.
 */
import { config } from '../config/env';
import { createLogger, maskPhone } from '../lib/logger';
import { getTemplate, renderTemplate } from '../constants/dltTemplates';

const log = createLogger('sms');

/** The DLT template used for authentication OTPs. */
const OTP_TEMPLATE = getTemplate('OTP_AUTH');

/** Builds the final OTP message body by substituting the code into the template. */
export function renderOtpMessage(code: string): string {
  return renderTemplate(OTP_TEMPLATE, [code]);
}

/**
 * Normalises a stored phone to the gateway's expected form.
 *
 * Stored numbers come through as digits only; some already carry the 91 country
 * code, some are bare 10-digit mobiles. The gateway (and the DLT route) expects a
 * country-code-prefixed number, so a bare 10-digit Indian mobile is prefixed
 * with 91. Anything that is already 11-15 digits is passed through untouched.
 */
function toGatewayNumber(phone: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export interface SendSmsResult {
  /** True when the provider accepted the message, or when the send was intentionally skipped in a non-production env. */
  ok: boolean;
  /** 'sent' = handed to provider; 'skipped' = non-production; 'disabled' = no provider configured; 'error' = provider rejected. */
  outcome: 'sent' | 'skipped' | 'disabled' | 'error';
}

/**
 * Sends the OTP SMS.
 *
 * Returns a result rather than throwing: SMS delivery is best-effort relative to
 * the issuing of the code (the code is already stored in Redis and verifiable).
 * The caller — the RabbitMQ consumer — decides ack/nack from this.
 */
export async function sendOtpSms(
  phone: string,
  code: string,
  type: string
): Promise<SendSmsResult> {
  // (2) Production gate. Outside production we never touch the gateway; the OTP
  // is surfaced through the API response for local/staging testing instead.
  if (!config.isProduction) {
    log.info(
      { phone: maskPhone(phone), type, env: config.env },
      'non-production: SMS send skipped (OTP is returned in API response)'
    );
    return { ok: true, outcome: 'skipped' };
  }

  if (!config.sms.enabled) {
    // In production with no provider configured this is a real misconfiguration:
    // the user will never receive a code. Loud, but not a crash — the request
    // path already returned, and other users are unaffected.
    log.error(
      { phone: maskPhone(phone), type },
      'production: SMS provider is not configured; OTP cannot be delivered'
    );
    return { ok: false, outcome: 'disabled' };
  }

  const destination = toGatewayNumber(phone);
  if (!destination) {
    log.error({ phone: maskPhone(phone), type }, 'SMS send aborted: phone could not be normalised');
    return { ok: false, outcome: 'error' };
  }

  const message = renderOtpMessage(code);

  try {
    await dispatchViaBulkSmsIndia(destination, message, OTP_TEMPLATE.id);
    log.info({ phone: maskPhone(phone), type }, 'OTP SMS dispatched');
    return { ok: true, outcome: 'sent' };
  } catch (err: any) {
    // No code, no message body in the log — both are sensitive.
    log.error({ phone: maskPhone(phone), type, err: err?.message ?? String(err) }, 'OTP SMS send failed');
    return { ok: false, outcome: 'error' };
  }
}

/**
 * BulkSMSIndia (bulksmsindia.app) HTTP API — DLT transactional route.
 *
 * Unlike template-variable gateways, BulkSMSIndia takes the fully-rendered
 * message text directly and matches it against the DLT template on their side
 * using the `peid` (principal entity id) and `templateid`. So we send:
 *
 *   apikey      -> account working key           (config.sms.authKey)
 *   senderid    -> DLT-approved 6-char sender id  (config.sms.senderId)
 *   number      -> 91XXXXXXXXXX
 *   message     -> the exact rendered template body (renderOtpMessage)
 *   peid        -> DLT principal entity id         (config.sms.peid)
 *   templateid  -> DLT template id                 (passed in; from the template registry)
 *   format      -> json
 *
 * Success body:  { "status": "OK", "data": [ { status: "SUBMITTED", ... } ], ... }
 * Failure body:  { "status": "OSDxx", "message": "..." }  (see error table)
 *
 * We log the gateway's full response (it contains no OTP code — only the
 * SUBMITTED status and message id) so delivery is diagnosable. A non-"OK"
 * status throws, which makes the consumer retry.
 *
 * The 15s AbortController bounds the call so a hung gateway never ties up the
 * consumer.
 */
async function dispatchViaBulkSmsIndia(
  destination: string,
  message: string,
  templateId: string
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const body: Record<string, string> = {
      apikey: config.sms.authKey as string,
      senderid: config.sms.senderId as string,
      number: destination,
      message,
      format: 'json',
    };
    // DLT metadata. peid is per-account config; the template id comes from the
    // code-side registry and matches the rendered message body.
    if (config.sms.peid) body.peid = config.sms.peid;
    if (templateId) body.templateid = templateId;

    const res = await fetch(`${config.sms.baseUrl}/V2/http-api-post.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const bodyText = await res.text().catch(() => '');

    if (!res.ok) {
      throw new Error(`gateway responded ${res.status} ${bodyText.slice(0, 300)}`);
    }

    let payload: any = {};
    try {
      payload = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      payload = { raw: bodyText.slice(0, 300) };
    }

    const status = payload?.status ? String(payload.status) : undefined;

    // Gateway's own verdict. No OTP code is present in this body — only the
    // SUBMITTED status, the gateway message id, and any error message.
    log.info(
      {
        gatewayStatus: status,
        gatewayMsgId: payload?.msgid,
        gatewayMessage: payload?.message,
        gatewayData: status === 'OK' ? undefined : payload,
      },
      'BulkSMSIndia response'
    );

    // "OK" is the only success status; everything else is an OSDxx error code.
    if (status !== 'OK') {
      throw new Error(`gateway error ${status ?? 'unknown'}: ${payload?.message ?? JSON.stringify(payload).slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
