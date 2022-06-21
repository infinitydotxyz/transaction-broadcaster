import * as phin from 'phin';
import DiscordEmbed from './types';

export async function sendWebhook(url: string, embed: DiscordEmbed) {
  try {
    const res = await phin({
      url,
      method: 'POST',
      data: JSON.stringify({
        avatar_url: 'https://pbs.twimg.com/profile_images/1488261914731814915/nyEgvjn2_400x400.png',
        username: 'Infinity Transaction Broadcaster',
        embeds: [embed]
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (res.statusCode !== 204) {
      throw new Error(res.body.toString());
    }
  } catch (err) {
    console.error(`Failed to send webhook`);
    console.error(err);
  }
}
