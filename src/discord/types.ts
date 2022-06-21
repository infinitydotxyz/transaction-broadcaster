export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export default interface DiscordEmbed {
  url?: string;

  title: string;

  color: number;

  fields: EmbedField[];

  footer: {
    text: string;
    icon_url?: string;
  };

  timestamp: string;

  thumbnail?: {
    url?: string;
  };
}
