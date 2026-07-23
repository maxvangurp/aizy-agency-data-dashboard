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
        <h3>Volgt signaal op</h3>
        <p>${esc(actie.signaal.probleem)}</p>
        <p class="muted klein">Deze actie afronden lost het signaal niet vanzelf op — het resultaat wordt eerst gecontroleerd.</p>
        ${actie.signaal.workflow ? `<p class="muted klein">Volgende stap voor het signaal: ${esc(actie.signaal.workflow.volgendeStap.tekst)}</p>` : ''}
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

/** De werkstroom als stappenbalk: waar staat dit signaal in het proces. */
function werkstroomStepper(workflow) {
  if (!workflow) return '';
  return `<ol class="werkstroom" aria-label="Werkstroom van dit signaal">
    ${workflow.stappen.map((s) => `<li class="werkstroom-stap is-${esc(s.status)}"
      ${s.status === 'huidig' ? 'aria-current="step"' : ''}>
      <span class="werkstroom-punt" aria-hidden="true"></span>
      <span class="werkstroom-label">${esc(s.label)}</span>
    </li>`).join('')}
  </ol>`;
}

/** Één regel in de activiteitentijdlijn. */
function tijdlijnMoment(op) {
  const d = new Date(op);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function signaalDetail({ signaal, magVerwerken, medewerkers = [] }) {
  if (!signaal) {
    return {
      titel: 'Signaal niet gevonden',
      inhoud: emptyState({
        titel: 'Dit signaal bestaat niet',
        uitleg: 'Het valt buiten de geselecteerde periode of je account heeft er geen toegang toe.',
      }),
    };
  }

  const wf = signaal.workflow;
  const heeftActie = Boolean(signaal.primaryActionId);
  const wachtOpControle = signaal.status === SignaalStatus.WACHT_OP_CONTROLE;
  const afgehandeld = [SignaalStatus.OPGELOST, SignaalStatus.GENEGEERD].includes(signaal.status);
  const acties = signaal.actiesVerrijkt ?? (signaal.actie ? [signaal.actie] : []);
  const tijdlijn = signaal.tijdlijn ?? [];

  // De directe knop bij de volgende stap. Plannen/controleren/beoordelen gebeurt
  // via de formulieren eronder; die stappen krijgen hier geen losse knop.
  const stapKnop = () => {
    if (!magVerwerken || !wf) return '';
    switch (wf.volgendeStap.actie) {
      case 'beoordelen':
        return `<button type="button" class="btn klein primary" data-signaal-bekeken="${esc(signaal.id)}">Beoordeel dit signaal</button>`;
      case 'actie-maken':
        return `<button type="button" class="btn klein primary" data-signaal-actie="${esc(signaal.id)}">Maak een actie aan</button>`;
      case 'uitvoeren':
        return signaal.primaryActionId
          ? `<button type="button" class="btn klein" data-actiepaneel="${esc(signaal.primaryActionId)}">Open de actie</button>`
          : '';
      case 'heropenen':
        return `<button type="button" class="btn klein" data-signaal-heropen="${esc(signaal.id)}">Heropenen</button>`;
      default:
        return '';
    }
  };

  const planForm = magVerwerken && heeftActie && !afgehandeld
    ? `<form class="paneel-form paneel-form-inline" data-plan-form="${esc(signaal.id)}">
        <div class="veld">
          <label for="planDatum-${esc(signaal.id)}">Opvolging inplannen op</label>
          <input type="date" id="planDatum-${esc(signaal.id)}" name="datum" value="${esc(signaal.plannedAt ?? '')}">
        </div>
        <button type="submit" class="btn klein">${signaal.plannedAt ? 'Datum bijwerken' : 'Actie inplannen'}</button>
      </form>`
    : '';

  const controleBlok = magVerwerken && wachtOpControle
    ? `<section class="paneel-blok verwerk-blok">
        <h3>Resultaat controleren</h3>
        <p class="muted klein">De gekoppelde actie is uitgevoerd. Het signaal sluit pas wanneer jij het resultaat beoordeelt — dat gebeurt bewust en nooit automatisch.</p>
        <form class="paneel-form paneel-form-inline" data-controle-form="${esc(signaal.id)}">
          <div class="veld">
            <label for="controleDatum-${esc(signaal.id)}">Resultaatcontrole inplannen op</label>
            <input type="date" id="controleDatum-${esc(signaal.id)}" name="datum" value="${esc(signaal.nextReviewAt ?? '')}">
          </div>
          <button type="submit" class="btn klein">Controle inplannen</button>
        </form>
        <form class="beoordeel-form" data-beoordeel-form="${esc(signaal.id)}">
          <div class="veld">
            <label for="beoordeelNotitie-${esc(signaal.id)}">Uitkomst (optioneel)</label>
            <input type="text" id="beoordeelNotitie-${esc(signaal.id)}" name="notitie"
              placeholder="Bijvoorbeeld: kosten per lead terug op niveau">
          </div>
          <div class="actie-groep">
            <button type="button" class="btn klein primary" data-signaal-beoordeel="${esc(signaal.id)}" data-uitkomst="opgelost">Opgelost</button>
            <button type="button" class="btn klein" data-signaal-beoordeel="${esc(signaal.id)}" data-uitkomst="vervolgactie">Vervolgactie maken</button>
            <button type="button" class="btn klein" data-signaal-beoordeel="${esc(signaal.id)}" data-uitkomst="heropenen">Nog niet opgelost</button>
          </div>
        </form>
      </section>`
    : '';

  return {
    titel: signaal.probleem,
    ondertitel: `${signaal.klantNaam} · ${signaal.kanaalLabel}`,
    inhoud: `
      <div class="paneel-labels">
        ${badge(signaal.ernst === 'hoog' ? 'Hoge urgentie' : 'Gemiddelde urgentie', signaal.ernst === 'hoog' ? 'hoog' : 'middel')}
        ${badge(signaal.statusTerm.kort, signaal.statusTerm.variant)}
      </div>

      <section class="paneel-blok">
        <h3>Werkstroom</h3>
        ${werkstroomStepper(wf)}
        ${wf ? `<p class="volgende-stap-tekst"><strong>Volgende stap:</strong> ${esc(wf.volgendeStap.tekst)}</p>` : ''}
        ${stapKnop()}
      </section>

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
          ${signaal.plannedAt ? `<div><dt>Ingepland</dt><dd>${esc(toonDatum(signaal.plannedAt))}</dd></div>` : ''}
          ${signaal.nextReviewAt ? `<div><dt>Resultaatcontrole</dt><dd>${esc(toonDatum(signaal.nextReviewAt))}</dd></div>` : ''}
          ${signaal.reden ? `<div><dt>Reden van negeren</dt><dd>${esc(signaal.reden)}</dd></div>` : ''}
          ${signaal.resolutionNote ? `<div><dt>Uitkomst</dt><dd>${esc(signaal.resolutionNote)}</dd></div>` : ''}
        </dl>
      </section>

      <section class="paneel-blok">
        <h3>Gekoppelde acties</h3>
        ${acties.length
          ? `<ul class="gekoppeld-lijst">
              ${acties.map((a) => `<li>
                <button type="button" class="link" data-actiepaneel="${esc(a.id)}">${esc(a.titel)}</button>
                ${a.statusTerm ? badge(a.statusTerm.kort, a.statusTerm.variant) : ''}
                ${a.id === signaal.primaryActionId ? '<span class="muted klein">primair</span>' : ''}
              </li>`).join('')}
            </ul>
            <p class="muted klein">Een afgeronde actie lost dit signaal niet vanzelf op: het resultaat wordt eerst gecontroleerd.</p>`
          : `<p class="muted klein">Nog geen actie. Maak er een aan om dit signaal op te volgen.</p>`}
      </section>

      ${planForm ? `<section class="paneel-blok verwerk-blok"><h3>Inplannen</h3>${planForm}</section>` : ''}
      ${controleBlok}

      <section class="paneel-blok">
        <h3>Activiteit</h3>
        <ul class="tijdlijn">
          ${tijdlijn.length
            ? tijdlijn.map((e) => `<li>
                <span class="tijdlijn-moment">${esc(tijdlijnMoment(e.op))}</span>
                <span>${e.actorNaam ? `<strong>${esc(e.actorNaam)}</strong> ` : ''}${esc(e.tekst)}</span>
              </li>`).join('')
            : '<li><span></span><span class="muted">Nog geen activiteit vastgelegd.</span></li>'}
        </ul>
      </section>`,
    voettekst: magVerwerken
      ? `${signaal.status === SignaalStatus.NIEUW
          ? `<button type="button" class="btn klein" data-signaal-bekeken="${esc(signaal.id)}">Markeren als bekeken</button>`
          : ''}
        ${!heeftActie
          ? `<button type="button" class="btn primary" data-signaal-actie="${esc(signaal.id)}">Omzetten naar actie</button>`
          : `<button type="button" class="btn klein" data-actiepaneel="${esc(signaal.primaryActionId)}">Gekoppelde actie openen</button>`}
        ${afgehandeld
          ? `<button type="button" class="btn klein" data-signaal-heropen="${esc(signaal.id)}">Heropenen</button>`
          : `<button type="button" class="btn klein" data-signaal-oplossen="${esc(signaal.id)}">Markeren als opgelost</button>`}
        <a class="btn klein" href="#/agency/clients/${esc(signaal.klantId)}">Open klant</a>`
      : '',
  };
}
