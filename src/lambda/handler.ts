import { CouncilApiService } from './services/council-api';
import { TelegramService } from './services/telegram';
import { Bin, BinColour } from './types';

const COLOUR_EMOJIS: Record<BinColour, string> = {
  Blue: '🔵',
  Grey: '⚫',
  Brown: '🟤',
  Yellow: '🟡',
};

export function formatMessage(bins: Bin[], date: Date): string {
  const dateStr = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  });

  const binLines = bins.map((b) => `${COLOUR_EMOJIS[b.colour]} ${b.name}`).join('\n');

  return `♻️ Bin Reminder\n\nCollection tomorrow:\n\n${binLines}\n\nDate:\n${dateStr}`;
}

export const handler = async (): Promise<void> => {
  const uprn = process.env.UPRN;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!uprn || !botToken || !chatId) {
    throw new Error('Missing required environment variables: UPRN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID');
  }

  const councilApi = new CouncilApiService(uprn);
  const telegram = new TelegramService(botToken, chatId);

  console.log(`Fetching collection dates for UPRN: ${uprn}`);
  const collection = await councilApi.getNextCollection();
  console.log(`Next collection: ${collection.date.toISOString()}, bins: ${collection.bins.map((b) => b.name).join(', ')}`);

  const message = formatMessage(collection.bins, collection.date);
  console.log('Sending Telegram message');
  await telegram.sendMessage(message);
  console.log('Done');
};
