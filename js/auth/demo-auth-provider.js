/**
 * Demo-implementatie van de authenticatieprovider.
 *
 * Gebruikt de fictieve gebruikers uit domain.js. Er is geen versleuteling,
 * geen token en geen serverkant. Dit is een demonstratie van de rollen en de
 * datascheiding, geen beveiliging.
 */

import { AuthProvider, AuthFout } from './auth-provider.js';
import {
  DEMO_WACHTWOORD,
  AccountStatus,
  vindGebruikerOpEmail,
  vindGebruikerOpId,
} from './domain.js';
import { leesSessie, schrijfSessie, wisSessie } from './session.js';

/** Lokale wijzigingen aan gebruikers die de demo mag onthouden. */
const OVERRIDE_SLEUTEL = 'aizy.userOverrides';

function leesOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDE_SLEUTEL);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function schrijfOverride(userId, wijziging) {
  const alle = leesOverrides();
  alle[userId] = { ...(alle[userId] ?? {}), ...wijziging };
  try {
    localStorage.setItem(OVERRIDE_SLEUTEL, JSON.stringify(alle));
  } catch {
    // Zonder opslag gelden wijzigingen alleen voor deze sessie.
  }
  return alle[userId];
}

export function wisOverrides() {
  try {
    localStorage.removeItem(OVERRIDE_SLEUTEL);
  } catch {
    // Niets te doen.
  }
}

/**
 * Voegt lokale wijzigingen samen met de basisgebruiker.
 * Zo blijven teamwijzigingen in de demo bewaard zonder domain.js aan te passen.
 */
export function metOverrides(user) {
  if (!user) return null;
  const override = leesOverrides()[user.id];
  if (!override) return user;

  const samengevoegd = { ...user, ...override };
  // Afgeleide velden opnieuw bepalen zodat ze bij de nieuwe waarden passen.
  samengevoegd.displayName = `${samengevoegd.firstName} ${samengevoegd.lastName}`.trim();
  samengevoegd.avatarInitials =
    (samengevoegd.firstName[0] ?? '') + (samengevoegd.lastName[0] ?? '');
  return samengevoegd;
}

function ok(user) {
  return { ok: true, user, foutcode: null, melding: null };
}

function fout(foutcode, melding) {
  return { ok: false, user: null, foutcode, melding };
}

const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class DemoAuthProvider extends AuthProvider {
  constructor() {
    super();
    /** @type {object|null} */
    this._user = null;
  }

  /**
   * Controleert e-mailadres en wachtwoord tegen de demo-gebruikers.
   *
   * De volgorde van de controles is bewust: eerst de invoer, dan de
   * combinatie, dan de accountstatus. Een gedeactiveerd account mag pas
   * gemeld worden nadat het wachtwoord klopt, anders verklapt de melding
   * welke adressen bestaan.
   */
  async login({ email, wachtwoord } = {}) {
    const adres = String(email ?? '').trim();

    if (!adres || !wachtwoord) {
      return fout(AuthFout.ONGELDIGE_INVOER, 'Vul een e-mailadres en wachtwoord in.');
    }
    if (!EMAIL_PATROON.test(adres)) {
      return fout(AuthFout.ONGELDIGE_INVOER, 'Dit is geen geldig e-mailadres.');
    }

    const basis = vindGebruikerOpEmail(adres);
    const combinatieKlopt = basis != null && wachtwoord === DEMO_WACHTWOORD;

    if (!combinatieKlopt) {
      return fout(
        AuthFout.ONBEKENDE_COMBINATIE,
        'Deze combinatie van e-mailadres en wachtwoord klopt niet.'
      );
    }

    const user = metOverrides(basis);

    if (user.status === AccountStatus.GEDEACTIVEERD) {
      return fout(
        AuthFout.ACCOUNT_GEDEACTIVEERD,
        'Dit account is gedeactiveerd. Neem contact op met een beheerder.'
      );
    }
    if (user.status === AccountStatus.UITGENODIGD) {
      return fout(
        AuthFout.ACCOUNT_UITGENODIGD,
        'Deze uitnodiging is nog niet geaccepteerd. Open de uitnodigingslink om je account te activeren.'
      );
    }

    this._user = user;
    schrijfSessie({ userId: user.id, contextClientId: null });
    return ok(user);
  }

  async logout() {
    this._user = null;
    wisSessie();
  }

  getCurrentUser() {
    return this._user;
  }

  /**
   * Herstelt een sessie bij het opstarten.
   *
   * De gebruiker wordt opnieuw uit het domeinmodel gehaald in plaats van uit
   * de sessie. Een aangepaste localStorage kan daardoor geen rol of
   * klanttoewijzing toevoegen; hoogstens verwijst hij naar een andere
   * bestaande gebruiker, en ook die krijgt alleen zijn eigen rechten.
   */
  async restoreSession() {
    const sessie = leesSessie();
    if (!sessie) return fout(AuthFout.SESSIE_VERLOPEN, null);

    const basis = vindGebruikerOpId(sessie.userId);
    if (!basis) {
      wisSessie();
      return fout(AuthFout.SESSIE_VERLOPEN, 'Je sessie is niet meer geldig.');
    }

    const user = metOverrides(basis);
    if (user.status !== AccountStatus.ACTIEF) {
      wisSessie();
      return fout(
        user.status === AccountStatus.GEDEACTIVEERD
          ? AuthFout.ACCOUNT_GEDEACTIVEERD
          : AuthFout.ACCOUNT_UITGENODIGD,
        'Dit account is niet meer actief.'
      );
    }

    this._user = user;
    return ok(user);
  }

  /**
   * Accepteert een uitnodiging binnen de demo.
   * Het opgegeven wachtwoord wordt niet bewaard; alleen de status verandert.
   */
  async acceptInvite({ email, wachtwoord, naamBevestigd } = {}) {
    const basis = vindGebruikerOpEmail(email);

    if (!basis || basis.status !== AccountStatus.UITGENODIGD) {
      return fout(
        AuthFout.ONGELDIGE_INVOER,
        'Deze uitnodiging is niet meer geldig of is al geaccepteerd.'
      );
    }
    if (!naamBevestigd) {
      return fout(AuthFout.ONGELDIGE_INVOER, 'Bevestig je naam om door te gaan.');
    }
    if (!wachtwoord || wachtwoord.length < 6) {
      return fout(AuthFout.ONGELDIGE_INVOER, 'Kies een wachtwoord van minimaal 6 tekens.');
    }

    schrijfOverride(basis.id, { status: AccountStatus.ACTIEF });
    const user = metOverrides(vindGebruikerOpId(basis.id));

    this._user = user;
    schrijfSessie({ userId: user.id, contextClientId: null });
    return ok(user);
  }

  /**
   * Simuleert een wachtwoordherstel.
   * Het antwoord is altijd hetzelfde, zodat niet valt af te leiden welke
   * e-mailadressen een account hebben.
   */
  async requestPasswordReset({ email } = {}) {
    const adres = String(email ?? '').trim();
    if (!adres || !EMAIL_PATROON.test(adres)) {
      return { ok: false, melding: 'Vul een geldig e-mailadres in.' };
    }
    return {
      ok: true,
      melding:
        'Als er een account bij dit e-mailadres hoort, is er een herstellink verstuurd. In deze demo worden geen e-mails verzonden.',
    };
  }
}
