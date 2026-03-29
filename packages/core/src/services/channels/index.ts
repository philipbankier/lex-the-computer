export { registerChannel, getChannel, getAllChannels, getConfiguredChannelTypes, generatePairingCode, validatePairingCode, processChannelMessage, initializeChannels, shutdownChannels } from './base.js';
export type { ChannelPlugin } from './base.js';
export { telegramPlugin } from './telegram.js';
export { emailPlugin } from './email.js';
export { discordPlugin } from './discord.js';
export { smsPlugin, generateSmsVerification, validateSmsVerification, twilioSend } from './sms.js';

import { registerChannel } from './base.js';
import { telegramPlugin } from './telegram.js';
import { emailPlugin } from './email.js';
import { discordPlugin } from './discord.js';
import { smsPlugin } from './sms.js';

export function registerAllChannels() {
  registerChannel(telegramPlugin);
  registerChannel(emailPlugin);
  registerChannel(discordPlugin);
  registerChannel(smsPlugin);
}
