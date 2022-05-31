import { RelayErrorEvent } from "../flashbots-broadcaster";


export function relayErrorToEmbed(event: RelayErrorEvent, chainId: string) {
    return {
        title: 'Relay Error',
        color: 16711680,
        fields: [
          {

            name: 'Code',
            value: `${event.code}`,
          },
          {
            name: 'Reason',
            value: `${event.message}`,
          },
          {
            name: 'Chain',
            value: chainId,
          }
          ],
        footer: {
          text: 'Flashbots Relay Error'
        },
        timestamp: new Date().toISOString(),
      }
}