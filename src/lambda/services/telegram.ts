const TELEGRAM_API_BASE = 'https://api.telegram.org';

export class TelegramService {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
  ) {}

  async sendMessage(text: string): Promise<void> {
    const url = `${TELEGRAM_API_BASE}/bot${this.botToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text, parse_mode: 'HTML' }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram API returned ${response.status}: ${body}`);
    }
  }
}
