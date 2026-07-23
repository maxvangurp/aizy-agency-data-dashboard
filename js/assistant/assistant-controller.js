/**
 * Controller van de Aizy-assistent.
 *
 * Eén plek die de provider, de context en de opslag samenbrengt. De UI roept
 * alleen deze controller aan en kent geen providerlogica. De provider is
 * verwisselbaar: vandaag de demo, later een externe API, zonder dat de UI of de
 * app-wiring hoeft te veranderen.
 */

import { DemoAssistantProvider } from './demo-assistant-provider.js';
import { ExternalAssistantProvider } from './assistant-provider.js';
import { naarRequestModel } from './assistant-context.js';
import {
  leesVoorkeuren, zetVoorkeur, verzekerGesprek, actiefGesprek,
  voegBerichtToe, nieuwGesprek as opslagNieuwGesprek, wisGeschiedenis as opslagWis,
} from './assistant-storage.js';

let provider = new DemoAssistantProvider();
let huidigeContext = null;
let verversCallback = null;
let paneelOpen = false; // alleen relevant in zwevende stand
let bezig = false;

export function zetContext(context) { huidigeContext = context; }
export function getContext() { return huidigeContext; }
export function zetVerversCallback(fn) { verversCallback = fn; }
function ververs() { verversCallback?.(); }

const userId = () => huidigeContext?.userId ?? null;

/* ---------------------------------------------------------------
   Provider (voorbereid op een echte API)
   --------------------------------------------------------------- */

/** Wisselt de actieve provider. In deze fase alleen 'demo' actief. */
export function zetProvider(modus) {
  provider = modus === 'extern' ? new ExternalAssistantProvider('externe provider') : new DemoAssistantProvider();
  return provider.getStatus();
}

export function providerStatus() { return provider.getStatus(); }

/* ---------------------------------------------------------------
   Voorkeuren en paneelstand
   --------------------------------------------------------------- */

export function voorkeuren() { return leesVoorkeuren(userId()); }
export function isZichtbaar() { return voorkeuren().zichtbaar !== false; }
export function positie() { return voorkeuren().positie ?? 'zwevend'; }
export function isVastgezet() { return positie() === 'vastgezet'; }
export function isIngeklapt() { return voorkeuren().ingeklapt === true; }

export function isOpen() {
  // Vastgezet is altijd zichtbaar (tenzij ingeklapt); zwevend hangt van paneelOpen af.
  return isVastgezet() ? true : paneelOpen;
}

export function open() { paneelOpen = true; verzekerGesprek(userId()); ververs(); }
export function sluit() { paneelOpen = false; ververs(); }
export function toggle() { paneelOpen ? sluit() : open(); }

export function zetPositie(nieuw) {
  zetVoorkeur(userId(), { positie: nieuw, ingeklapt: false });
  if (nieuw === 'vastgezet') paneelOpen = true;
  ververs();
}

export function toggleInklap() {
  zetVoorkeur(userId(), { ingeklapt: !isIngeklapt() });
  ververs();
}

export function zetZichtbaar(zichtbaar) { zetVoorkeur(userId(), { zichtbaar }); ververs(); }

/**
 * Bewaart de gekozen modus. De externe provider is in deze fase alleen
 * "voorbereid": we activeren hem niet, zodat de demo altijd blijft werken. Zo
 * suggereert niets een externe koppeling die er nog niet is.
 */
export function zetModus(modus) {
  zetVoorkeur(userId(), { modus });
  ververs();
  return providerStatus();
}

/* ---------------------------------------------------------------
   Gesprek
   --------------------------------------------------------------- */

export function berichten() {
  const g = actiefGesprek(userId());
  return g?.berichten ?? [];
}

export function isBezig() { return bezig; }

/** Verstuurt een vraag en verwerkt het antwoord deterministisch. */
export async function verstuur(tekst) {
  const vraag = String(tekst ?? '').trim();
  if (!vraag || bezig) return;
  const context = huidigeContext;

  voegBerichtToe(userId(), {
    rol: 'gebruiker',
    tekst: vraag,
    contextKort: `${context?.pageTitle ?? ''}`.trim(),
  });
  bezig = true;
  ververs();

  try {
    // De demo-provider krijgt de rijke context; het compacte, API-ready
    // wire-model (naarRequestModel) is wat een externe provider straks ontvangt.
    const antwoord = await provider.sendMessage({
      message: vraag,
      context,
      history: berichten(),
      request: naarRequestModel(vraag, context, berichten()),
    });
    voegBerichtToe(userId(), { rol: 'assistent', ...antwoord });
  } catch {
    voegBerichtToe(userId(), {
      rol: 'assistent',
      tekst: 'Er ging iets mis bij het samenstellen van dit antwoord. De standaard paginahulp blijft bruikbaar.',
      beperking: 'Antwoord kon niet worden opgehaald.',
      demo: true,
    });
  } finally {
    bezig = false;
    ververs();
  }
}

export function nieuwGesprek() { opslagNieuwGesprek(userId()); paneelOpen = true; ververs(); }
export function wisGeschiedenis() { opslagWis(userId()); ververs(); }
