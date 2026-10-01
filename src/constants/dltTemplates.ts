// src/constants/dltTemplates.ts
/**
 * DLT / message template registry.
 *
 * Template ids and their approved bodies are STATIC identifiers, not secrets and
 * not per-environment configuration — the same template id is used in every
 * environment, and it only changes when the template is re-registered on DLT.
 * So they live here in versioned code rather than in `.env`.
 *
 * This is deliberately a registry (keyed map) rather than a single constant, so
 * additional templates — a second SMS template, an email verification template,
 * a WhatsApp template — are added by appending an entry, with no change to the
 * services that consume them.
 *
 * RULES
 *  - `body` must be byte-for-byte identical to what is registered on DLT / added
 *    in the SMS gateway. The gateway matches delivered text against this exact
 *    string; any drift (punctuation, casing, entity name) gets the message
 *    rejected. Only the `{#var#}` placeholders are substituted at send time.
 *  - Keep placeholders as the DLT standard `{#var#}`. `renderTemplate` fills them
 *    left-to-right from the values array.
 */

export type MessageChannel = 'SMS' | 'EMAIL' | 'WHATSAPP';

export interface MessageTemplate {
  /** DLT (or provider) template id. */
  id: string;
  /** Channel this template is registered for. */
  channel: MessageChannel;
  /**
   * The approved template body. `{#var#}` marks each substitution point and is
   * filled, in order, by renderTemplate(). Must match the registered text exactly.
   */
  body: string;
  /** Human-facing note on what this template is for. Not sent anywhere. */
  description: string;
}

/**
 * Registry key. Add new keys here as templates are introduced
 * (e.g. 'EMAIL_VERIFY', 'TXN_ALERT').
 */
export type TemplateKey = 'OTP_AUTH';

export const DLT_TEMPLATES: Record<TemplateKey, MessageTemplate> = {
  /**
   * Authentication OTP. Registered under ZAD DIGITAL PRIVATE LIMITED for the
   * SAMAJUNNATI sender route. The single `{#var#}` is the OTP code.
   */
  OTP_AUTH: {
    id: '1077356650119279588',
    channel: 'SMS',
    body:
      '{#var#} is your OTP for authentication on SAMAJUNNATI, a service of ZAD DIGITAL PRIVATE LIMITED. This OTP is valid for 15 minutes. Please do not share it with anyone.',
    description: 'OTP sent during phone-number authentication / verification.',
  },
};

/** Convenience accessor so callers do not index the map directly. */
export function getTemplate(key: TemplateKey): MessageTemplate {
  return DLT_TEMPLATES[key];
}

/**
 * Fills a template body's `{#var#}` placeholders, in order, from `values`.
 *
 * Example: body `"{#var#} is your OTP, valid {#var#} min"` with `['1234','15']`
 * → `"1234 is your OTP, valid 15 min"`.
 *
 * Throws if the number of values does not match the number of placeholders, so a
 * malformed send fails loudly here rather than delivering a half-filled message
 * that the DLT filter would reject anyway.
 */
export function renderTemplate(template: MessageTemplate, values: string[]): string {
  const placeholderCount = (template.body.match(/\{#var#\}/g) ?? []).length;
  if (placeholderCount !== values.length) {
    throw new Error(
      `template ${template.id}: expected ${placeholderCount} value(s) for {#var#}, received ${values.length}`
    );
  }
  let i = 0;
  return template.body.replace(/\{#var#\}/g, () => values[i++]);
}
