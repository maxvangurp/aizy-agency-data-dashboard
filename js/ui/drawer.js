/**
 * Inhoud van het detailpaneel.
 *
 * Het paneel bestaat zodat een gebruiker een detail kan bekijken zonder zijn
 * lijst te verlaten. Dat is niet alleen prettig: wie na elke klik terug moet
 * navigeren, verliest zijn filters, zijn sortering en zijn plek in de lijst, en
 * gaat daarom minder details bekijken dan goed voor hem is.
 *
 * WAT ER IN HET PANEEL HOORT
 * Genoeg om een besluit te nemen, niet meer. Een klantpreview toont het
 * resultaat, de signalen, de openstaande acties, wie erbij betrokken is en de
 * laatste activiteit, met een knop naar de volledige klantomgeving. Wie het
 * hele dashboard wil, gaat daarheen; het paneel probeert dat niet na te doen.
 */

import { fmt, esc, badge, ontbrekendeCel } from '../views/components.js';
import { emptyState } from './states.js';
import { renderMedewerker } from '../views/context-header.js';
import { toonDatum, toonBereik } from '../filters/period.js';
import { dashboardtypeTerm, betrouwbaarheidTerm, LABELS } from '../terminology.js';
import { ACTIE_STATUSSEN, ACTIE_PRIORITEITEN, ActieStatus } from '../model/actions.js';
import { SignaalStatus } from '../model/signals.js';
import { betrouwbaarheidVan, hoofdreden } from '../views/portfolio.js';
import { BusinessModel } from '../sample-data/shared.js';

/* ---------------------------------------------------------------
   Klantpreview
   --------------------------------------------------------------- */

export function klantPreview({ samenvatting, acties, signalen, filters, magOpenen }) {
  if (!samenvatting) {
    return {
      titel: 'Klant niet gevonden',
      inhoud: emptyState({
        titel: 'Deze klant is niet beschikbaar',
        uitleg: 'De klant bestaat niet, of je account heeft er geen toegang toe.',
      }),
    };
  }

  const s = samenvatting;
  const term = betrouwbaarheidTerm(betrouwbaarheidVan(s));
  const eigenActies = acties.filter((a) => a.klantId === s.client.id && a.status !== ActieStatus.AFGEROND);
  const eigenSignalen = signalen.filter((sig) => sig.klantId === s.client.id && sig.open);

  return {
    titel: s.client.name,
    ondertitel: `${dashboardtypeTerm(s.model).kort} · ${toonBereik(filters.periode.startDate, filters.periode.endDate)}`,
    inhoud: `
      <div class="paneel-labels">
        ${badge(s.status.label, s.status.variant)}
        ${badge(s.prioriteit.label, s.prioriteit.variant)}
        <span class="badge badge-${esc(term.variant)}" title="${esc(term.omschrijving)}">${esc(term.kort)}</span>
      </div>

      <section class="paneel-blok">
        <h3>Belangrijkste resultaten</h3>
        <dl class="paneel-cijfers">
          ${resultaatRijen(s).map((r) => `<div><dt>${esc(r.label)}</dt><dd>${r.waarde}</dd></div>`).join('')}
        </dl>
      </section>

      <section class="paneel-blok">
        <h3>Waarom deze klant aandacht vraagt</h3>
        ${s.prioriteit.redenen.length
          ? `<ul class="prioriteit-redenen">${s.prioriteit.redenen.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
          : `<p class="muted">${esc(hoofdreden(s))}</p>`}
      </section>

      <section class="paneel-blok">
        <h3>Actieve signalen <span class="muted klein">${eigenSignalen.length}</span></h3>
        ${eigenSignalen.length
          ? `<ul class="paneel-lijst">${eigenSignalen.map((sig) => `<li>
              <button type="button" class="link" data-signaalpaneel="${esc(sig.id)}">${esc(sig.probleem)}</button>
              <span class="muted klein">${esc(sig.kanaalLabel)} · ${esc(sig.statusTerm.kort)}</span>
            </li>`).join('')}</ul>`
          : '<p class="muted klein">Geen openstaande signalen binnen deze periode.</p>'}
      </section>

      <section class="paneel-blok">
        <h3>Openstaande acties <span class="muted klein">${eigenActies.length}</span></h3>
        ${eigenActies.length
          ? `<ul class="paneel-lijst">${eigenActies.map((a) => `<li>
              <button type="button" class="link" data-actiepaneel="${esc(a.id)}">${esc(a.titel)}</button>
              <span class="muted klein">${esc(a.statusTerm.kort)}${a.deadline ? ` · deadline ${toonDatum(a.deadline)}` : ''}</span>
            </li>`).join('')}</ul>`
          : '<p class="muted klein">Er staat geen werk open voor deze klant.</p>'}
      </section>

      <section class="paneel-blok">
        <h3>Betrokken medewerkers</h3>
        ${renderMedewerker(s.team.primair, { rol: 'Verantwoordelijk' })}
        ${(s.team.ondersteunend ?? []).map((m) => renderMedewerker(m, { rol: 'Ondersteunend' })).join('')}
      </section>

      <section class="paneel-blok">
        <h3>Laatste activiteit</h3>
        <p class="muted klein">${esc(laatsteActiviteit(eigenActies, eigenSignalen))}</p>
      </section>`,
    voettekst: magOpenen
      ? `<a class="btn primary" href="#/agency/clients/${esc(s.client.id)}">Volledige klantomgeving openen</a>
         <button type="button" class="btn klein" data-nieuweactie="${esc(s.client.id)}">Actie aanmaken</button>`
      : '',
  };
}

function resultaatRijen(s) {
  const t = s.totalen;
  if (s.client.businessModel === BusinessModel.ECOMMERCE) {
    return [
      { label: 'Omzet', waarde: esc(fmt.euro(t.revenue)) },
      { label: 'Transacties', waarde: esc(fmt.getal(t.purchases)) },
      { label: 'Rendement', waarde: t.roas == null ? ontbrekendeCel('onvoldoende_data') : esc(fmt.ratio(t.roas)) },
      { label: 'Advertentie-uitgaven', waarde: esc(fmt.euro(t.spend)) },
    ];
  }
  if (s.client.businessModel === BusinessModel.LEADGEN) {
    return [
      { label: 'Leads', waarde: esc(fmt.getal(t.leads)) },
      { label: 'Gekwalificeerd', waarde: t.qualifiedLeads == null ? ontbrekendeCel('niet_gekoppeld') : esc(fmt.getal(t.qualifiedLeads)) },
      { label: 'Kosten per lead', waarde: t.cpl == null ? ontbrekendeCel('onvoldoende_data') : esc(fmt.euro2(t.cpl)) },
      { label: 'Advertentie-uitgaven', waarde: esc(fmt.euro(t.spend)) },
    ];
  }
  return [
    { label: 'Vertoningen', waarde: esc(fmt.getal(t.impressions)) },
    { label: 'Bereik', waarde: t.reach == null ? ontbrekendeCel('niet_gemeten') : esc(fmt.getal(t.reach)) },
    { label: 'Frequentie', waarde: t.frequentie == null ? ontbrekendeCel('onvoldoende_data') : esc(fmt.ratio(t.frequentie)) },
    { label: 'Advertentie-uitgaven', waarde: esc(fmt.euro(t.spend)) },
  ];
}

function laatsteActiviteit(acties, signalen) {
  const momenten = [
    ...acties.map((a) => ({ op: a.gewijzigdOp, wat: `Actie bijgewerkt: ${a.titel}` })),
    ...signalen.filter((s) => s.gewijzigdOp).map((s) => ({ op: s.gewijzigdOp, wat: `Signaal bijgewerkt: ${s.probleem}` })),
  ].sort((a, b) => String(b.op).localeCompare(String(a.op)));

  if (!momenten.length) return 'Er is in deze demo nog niets gewijzigd voor deze klant.';
  return `${momenten[0].wat} · ${new Date(momenten[0].op).toLocaleString('nl-NL')}`;
}

/* ---------------------------------------------------------------
   Actiedetail
   --------------------------------------------------------------- */

/**
 * Het detail van een actie, met de bewerkbare velden erin.
 *
 * Iedere wijziging in dit paneel schrijft naar hetzelfde model als het bord en
 * de agenda. Een status die hier verandert, staat direct in de juiste kolom.
 */
export function actieDetail({ actie, medewerkers, magBewerken, user }) {
  if (!actie) {
    return {
      titel: 'Actie niet gevonden',
      inhoud: emptyState({
        titel: 'Deze actie bestaat niet meer',
        uitleg: 'Hij is verwijderd, of je account heeft er geen toegang toe.',
      }),
    };
  }

  const velden = magBewerken ? `
    <form class="paneel-form" data-actie-form="${esc(actie.id)}">
      <div class="veld">
        <label for="paneelTitel">Titel</label>
        <input type="text" id="paneelTitel" name="titel" value="${esc(actie.titel)}" maxlength="140">
      </div>
      <div class="veld">
        <label for="paneelOmschrijving">Omschrijving</label>
        <textarea id="paneelOmschrijving" name="omschrijving" rows="3">${esc(actie.omschrijving)}</textarea>
      </div>
      <div class="veld-rij">
        <div class="veld">
          <label for="paneelStatus">Status</label>
          <select id="paneelStatus" name="status">
            ${ACTIE_STATUSSEN.map((s) => `<option value="${esc(s.key)}"${s.key === actie.status ? ' selected' : ''}>${esc(s.kort)}</option>`).join('')}
          </select>
        </div>
        <div class="veld">
          <label for="paneelPrioriteit">${esc(LABELS.prioriteit)}</label>
          <select id="paneelPrioriteit" name="prioriteit">
            ${ACTIE_PRIORITEITEN.map((p) => `<option value="${esc(p.key)}"${p.key === actie.prioriteit ? ' selected' : ''}>${esc(p.kort)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="veld-rij">
        <div class="veld">
          <label for="paneelStart">Startdatum</label>
          <input type="date" id="paneelStart" name="startdatum" value="${esc(actie.startdatum ?? '')}">
        </div>
        <div class="veld">
          <label for="paneelDeadline">Deadline</label>
          <input type="date" id="paneelDeadline" name="deadline" value="${esc(actie.deadline ?? '')}">
        </div>
      </div>
      <div class="veld">
        <label for="paneelVerantwoordelijke">${esc(LABELS.verantwoordelijke)}</label>
        <select id="paneelVerantwoordelijke" name="verantwoordelijkeId">
          <option value="">Niet toegewezen</option>
          ${medewerkers.map((m) => `<option value="${esc(m.id)}"${m.id === actie.verantwoordelijkeId ? ' selected' : ''}>${esc(m.displayName)}</option>`).join('')}
        </select>
      </div>
      <label class="checkbox">
        <input type="checkbox" name="zichtbaarVoorKlant"${actie.zichtbaarVoorKlant ? ' checked' : ''}>
        <span>Deze actie delen met de klant</span>
      </label>
      <div class="form-acties">
        <button type="submit" class="btn primary">Wijzigingen opslaan</button>
        <button type="button" class="btn klein gevaar" data-actie-verwijder="${esc(actie.id)}">Actie verwijderen</button>
      </div>
    </form>`
    : `<dl class="paneel-cijfers">
        <div><dt>Status</dt><dd>${badge(actie.statusTerm.kort, actie.statusTerm.variant)}</dd></div>
        <div><dt>${esc(LABELS.prioriteit)}</dt><dd>${badge(actie.prioriteitTerm.kort, actie.prioriteitTerm.variant)}</dd></div>
        <div><dt>Deadline</dt><dd>${actie.deadline ? esc(toonDatum(actie.deadline)) : 'Geen deadline'}</dd></div>
        <div><dt>${esc(LABELS.verantwoordelijke)}</dt><dd>${esc(actie.verantwoordelijkeNaam)}</dd></div>
      </dl>
      <p>${esc(actie.omschrijving)}</p>`;

  return {
    titel: actie.titel,
    ondertitel: `${actie.klantNaam} · ${actie.kanaalNaam}`,
    inhoud: `
      <div class="paneel-labels">
        ${badge(actie.statusTerm.kort, actie.statusTerm.variant)}
        ${badge(actie.prioriteitTerm.kort, actie.prioriteitTerm.variant)}
        ${badge(actie.soortTerm.kort, 'muted')}
        ${actie.verlopen ? badge('Deadline verstreken', 'hoog') : ''}
        ${actie.zichtbaarVoorKlant ? badge('Gedeeld met klant', 'ok') : badge('Intern', 'muted')}
      </div>

      ${velden}

      ${actie.signaal ? `<section class="paneel-blok">
        <h3>Gekoppeld signaal</h3>
        <p>${esc(actie.signaal.probleem)}</p>
        <p class="muted klein">${esc(actie.signaal.oorzaak)}</p>
        <button type="button" class="link-klein" data-signaalpaneel="${esc(actie.signaal.id)}">Signaal openen</button>
      </section>` : ''}

      <section class="paneel-blok">
        <h3>Opmerkingen en geschiedenis</h3>
        <ul class="tijdlijn">
          <li>
            <span class="tijdlijn-moment">${esc(new Date(actie.aangemaaktOp).toLocaleString('nl-NL'))}</span>
            <span>Actie aangemaakt${actie.signaalId ? ' vanuit een signaal' : ''}.</span>
          </li>
          ${actie.opmerkingen.map((o) => `<li>
            <span class="tijdlijn-moment">${esc(new Date(o.op).toLocaleString('nl-NL'))}</span>
            <span><strong>${esc(o.auteurNaam)}</strong> ${esc(o.tekst)}</span>
          </li>`).join('')}
          <li>
            <span class="tijdlijn-moment">${esc(new Date(actie.gewijzigdOp).toLocaleString('nl-NL'))}</span>
            <span>Laatste wijziging.</span>
          </li>
        </ul>

        <form class="opmerking-form" data-opmerking-form="${esc(actie.id)}">
          <div class="veld">
            <label for="paneelOpmerking">Opmerking toevoegen</label>
            <input type="text" id="paneelOpmerking" name="tekst" required
              placeholder="Wat is er gebeurd of afgesproken?">
          </div>
          <button type="submit" class="btn klein">Opmerking plaatsen</button>
        </form>
      </section>`,
  };
}

/* ---------------------------------------------------------------
   Signaaldetail
   --------------------------------------------------------------- */

export function signaalDetail({ signaal, magVerwerken }) {
  if (!signaal) {
    return {
      titel: 'Signaal niet gevonden',
      inhoud: emptyState({
        titel: 'Dit signaal bestaat niet',
        uitleg: 'Het valt buiten de geselecteerde periode of je account heeft er geen toegang toe.',
      }),
    };
  }

  return {
    titel: signaal.probleem,
    ondertitel: `${signaal.klantNaam} · ${signaal.kanaalLabel}`,
    inhoud: `
      <div class="paneel-labels">
        ${badge(signaal.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', signaal.ernst === 'hoog' ? 'hoog' : 'middel')}
        ${badge(signaal.statusTerm.kort, signaal.statusTerm.variant)}
      </div>

      <section class="paneel-blok">
        <h3>${esc(LABELS.bewijs)}</h3>
        <p>${esc(signaal.oorzaak)}</p>
      </section>

      <section class="paneel-blok">
        <h3>Voorgestelde actie</h3>
        <p>${esc(signaal.aanbeveling)}</p>
      </section>

      <section class="paneel-blok">
        <h3>Context</h3>
        <dl class="paneel-cijfers">
          <div><dt>Ontstaan op</dt><dd>${esc(toonDatum(signaal.startdatum))}</dd></div>
          <div><dt>Openstaand</dt><dd>${signaal.ouderdomDagen ?? 0} dagen</dd></div>
          <div><dt>${esc(LABELS.verantwoordelijke)}</dt><dd>${esc(signaal.verantwoordelijkeNaam)}</dd></div>
          ${signaal.reden ? `<div><dt>Reden van negeren</dt><dd>${esc(signaal.reden)}</dd></div>` : ''}
        </dl>
      </section>

      ${signaal.actie ? `<section class="paneel-blok">
        <h3>Gekoppelde actie</h3>
        <button type="button" class="link" data-actiepaneel="${esc(signaal.actie.id)}">${esc(signaal.actie.titel)}</button>
        <p class="muted klein">Er kan maar één actie per signaal bestaan, zodat het bord niet vol dubbel werk komt te staan.</p>
      </section>` : ''}`,
    voettekst: magVerwerken
      ? `${signaal.status === SignaalStatus.NIEUW
        ? `<button type="button" class="btn klein" data-signaal-bekeken="${esc(signaal.id)}">Markeren als bekeken</button>`
        : ''}
        <button type="button" class="btn primary" data-signaal-actie="${esc(signaal.id)}">
          ${signaal.actie ? 'Gekoppelde actie openen' : 'Omzetten naar actie'}
        </button>
        <a class="btn klein" href="#/agency/clients/${esc(signaal.klantId)}">Open klant</a>`
      : '',
  };
}
