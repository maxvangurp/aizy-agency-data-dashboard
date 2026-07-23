/**
 * De demo-provider: de enige actieve provider in deze fase.
 *
 * Hij implementeert het providercontract met de deterministische intent-engine.
 * Er is bewust geen kunstmatige vertraging en geen nagemaakte "typende" API: de
 * antwoorden komen direct en zijn als demo herkenbaar.
 */

import { AssistantProvider, ProviderStatus } from './assistant-provider.js';
import { beantwoord, startsuggesties } from './assistant-intents.js';

export class DemoAssistantProvider extends AssistantProvider {
  async sendMessage({ message, context }) {
    return beantwoord(message, context);
  }

  async getSuggestions({ context }) {
    return startsuggesties(context);
  }

  getStatus() {
    return { status: ProviderStatus.DEMO_ACTIEF, label: 'Demo actief', extern: false };
  }
}
