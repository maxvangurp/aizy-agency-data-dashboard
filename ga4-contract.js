/**
 * De rekenlaag van de GA4-module.
 *
 * Eén plek waar uit een opgehaald GA4-rapport de KPI's, tabellen en
 * vergelijkingen komen. Het dashboard, de inzichten en de rapportage lezen
 * allemaal hieruit, zodat een conversieratio nergens anders berekend wordt.
 *
 * Dat is geen netheid maar noodzaak: zodra twee plekken hun eigen ratio
 * uitrekenen, verschillen ze een keer, en dan is er geen manier om te zien
 * welke van de twee klopt.
 *
 * VIER REGELS DIE HIER WORDEN AFGEDWONGEN
 *
 * 1. Een ratio komt uit totalen, nooit uit een gemiddelde van rijpercentages.
 *    Het gemiddelde van "10% op 10 sessies" en "1% op 10.000 sessies" is 5,5%,
 *    en dat getal beschrijft niets.
 *
 * 2. Gebruikers worden niet opgeteld uit rijen. Dezelfde persoon komt in twee
 *    kanalen voor. Het gebruikersaantal komt daarom alleen uit de totalen.
 *
 * 3. Ontbrekend, nul en niet-beschikbaar zijn drie verschillende dingen.
 *    `null` betekent "niet gemeten", `0` betekent "gemeten, en het was nul".
 *    Een leadgenklant heeft geen omzet: dat is niet nul maar niet van
 *    toepassing.
 *
 * 4. Leads en aankopen komen nooit in één cijfer. Ook niet bij een
 *    gecombineerde klant, ook niet als "totaal conversies".
 */

/* ------------------------------------------------------------- getallen -- */

const getal = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Deelt, met een lege uitkomst waar de noemer geen noemer is. */
function deel(teller, noemer) {
  const t = getal(teller);
  const n = getal(noemer);
  if (t == null || n == null || n === 0) return null;
  return t / n;
}

function rond(waarde, decimalen = 2) {
  const n = getal(waarde);
  if (n == null) return null;
  const f = 10 ** decimalen;
  return Math.round(n * f) / f;
}

/**
 * De verandering tussen twee waarden.
 *
 * `procent` blijft leeg als de vorige waarde nul of leeg is. Van nul naar tien
 * is geen "oneindig procent groei" en ook geen honderd procent; het is een
 * verandering die zich niet in een percentage laat uitdrukken. `absoluut` zegt
 * dan wél iets.
 */
function verandering(nu, vorig) {
  const a = getal(nu);
  const b = getal(vorig);
  if (a == null || b == null) return { absoluut: null, procent: null, vanNul: false };
  if (b === 0) {
    return { absoluut: rond(a - b, 2), procent: null, vanNul: a !== 0 };
  }
  return { absoluut: rond(a - b, 2), procent: rond(((a - b) / b) * 100, 1), vanNul: false };
}

/* ---------------------------------------------------------------- doelen -- */

/**
 * De aantallen van één doelgroep, uit de uitsplitsing per event.
 *
 * Levert twee getallen die allebei waar zijn en verschillende dingen betekenen:
 *
 *   `events`   hoe vaak het gebeurde. Twee formulieren in één sessie is twee.
 *   `sessies`  in hoeveel sessies het gebeurde. Twee formulieren in één sessie
 *              is één.
 *
 * Ze worden nooit door elkaar gehaald en `sessies` wordt nooit uit de losse
 * eventrijen opgeteld: dat komt te hoog uit. Bij Waltmann leverden drie
 * leadevents 145 events in 136 sessies, terwijl optellen op 137 uitkwam.
 */
function doelTotaal(groep) {
  if (!groep) return null;
  const perEvent = groep.perEvent ?? [];
  const events = perEvent.reduce((som, r) => som + (getal(r.aantal) ?? 0), 0);
  const sessies = (groep.uniek ?? []).reduce((som, r) => som + (getal(r.sessiesMetDoel) ?? 0), 0);

  return {
    events,
    sessies,
    // Meerdere events kunnen in dezelfde sessie vallen. Dat is geen fout, maar
    // het betekent wel dat `events` geen aantal unieke aanvragen is -- en dat
    // moet een lezer weten voordat hij het een "aantal leads" noemt.
    kanOverlappen: (groep.events ?? []).length > 1,
    aantalEvents: (groep.events ?? []).length,
  };
}

/** Dezelfde aantallen, maar uit de dagreeks van een doelgroep. */
function doelUitReeks(reeks) {
  if (!Array.isArray(reeks)) return null;
  return {
    events: reeks.reduce((som, r) => som + (getal(r.aantal) ?? 0), 0),
    sessies: reeks.reduce((som, r) => som + (getal(r.sessiesMetDoel) ?? 0), 0),
  };
}

/* ------------------------------------------------------------------ KPI's -- */

/**
 * De KPI's die bij dit klanttype horen, in de volgorde waarin ze op het scherm
 * komen.
 *
 * De algemene contextcijfers staan voorop en zijn voor iedereen gelijk. Daarna
 * volgt per doel een eigen groep -- nooit samengevoegd, ook niet bij een
 * gecombineerde klant.
 */
function kpiGroepen(rapport, vorig = null, { prioriteit = null } = {}) {
  if (!rapport) return [];
  const t = rapport.totalen ?? {};
  const tv = vorig?.totalen ?? null;
  const klanttype = rapport.klanttype;

  const context = {
    sleutel: 'context',
    titel: 'Websiteverkeer',
    uitleg: 'Geldt voor de hele site, ongeacht het bedrijfsdoel.',
    kpis: [
      kpi('gebruikers', 'Actieve gebruikers', t.gebruikers, tv?.gebruikers, {
        eenheid: 'aantal',
        definitie: 'Gebruikers die de site in deze periode gebruikten. Niet op te tellen '
          + 'uit de tabellen hieronder: dezelfde persoon komt in meerdere kanalen voor.',
      }),
      kpi('sessies', 'Sessies', t.sessies, tv?.sessies, {
        eenheid: 'aantal',
        definitie: 'Bezoeken aan de site. De noemer van elke conversieratio hieronder.',
      }),
      kpi('engagement', 'Engagementpercentage', pct(t.engagementpercentage), pct(tv?.engagementpercentage), {
        eenheid: 'procent',
        definitie: 'Aandeel sessies dat langer duurde dan tien seconden, een belangrijke '
          + 'gebeurtenis had, of meer dan een pagina bekeek.',
      }),
    ],
  };

  const groepen = [context];
  const volgorde = doelvolgorde(klanttype, prioriteit);

  for (const doel of volgorde) {
    if (doel === 'leads') groepen.push(leadGroep(rapport, vorig));
    if (doel === 'aankopen') groepen.push(aankoopGroep(rapport, vorig));
  }
  return groepen.filter(Boolean);
}

function doelvolgorde(klanttype, prioriteit) {
  if (klanttype === 'leadgen') return ['leads'];
  if (klanttype === 'ecommerce') return ['aankopen'];
  return prioriteit === 'aankopen' ? ['aankopen', 'leads'] : ['leads', 'aankopen'];
}

function leadGroep(rapport, vorig) {
  const nu = doelUitReeks(rapport.doelReeksen?.leads);
  const was = doelUitReeks(vorig?.doelReeksen?.leads);
  const sessies = rapport.totalen?.sessies;
  const events = rapport.doelen?.leads ?? [];

  const contactNu = doelUitReeks(rapport.doelReeksen?.contactinteracties);
  const contactWas = doelUitReeks(vorig?.doelReeksen?.contactinteracties);

  return {
    sleutel: 'leads',
    titel: 'Leadgeneratie',
    uitleg: events.length
      ? `Gemeten op ${events.join(', ')}.`
      : 'Er zijn nog geen gebeurtenissen als aanvraag aangewezen.',
    // Het dashboard hoort dit te tonen als er niets gekozen is: een lege
    // KPI-groep zonder uitleg leest als "nul aanvragen".
    nietIngericht: events.length === 0,
    kpis: [
      kpi('aanvragen', 'Aanvragen', nu?.events, was?.events, {
        eenheid: 'aantal',
        definitie: events.length > 1
          ? `Alle gebeurtenissen uit ${events.length} leadevents bij elkaar. Eén bezoeker `
            + 'kan er meer dan een versturen, dus dit is geen aantal unieke aanvragers.'
          : 'Het aantal keer dat het leadevent voorkwam.',
        voorbehoud: events.length > 1 ? 'Kan overlappen binnen een sessie' : null,
      }),
      kpi('leadratio', 'Sessies met een aanvraag', pct(deel(nu?.sessies, sessies)), pct(deel(was?.sessies, vorig?.totalen?.sessies)), {
        eenheid: 'procent',
        definitie: 'Het aandeel sessies waarin minstens één aanvraag werd verstuurd. '
          + 'Niet het aantal gebeurtenissen gedeeld door sessies -- dat telt twee '
          + 'formulieren in één bezoek als twee bezoeken.',
      }),
      kpi('contact', 'Contactklikken', contactNu?.events, contactWas?.events, {
        eenheid: 'aantal',
        definitie: 'Klikken op een telefoonnummer, e-mailadres of WhatsApp. Een signaal '
          + 'van interesse, geen bevestigde aanvraag: er is niet gemeten of er '
          + 'daadwerkelijk contact volgde.',
        secundair: true,
      }),
    ],
  };
}

function aankoopGroep(rapport, vorig) {
  const t = rapport.totalen ?? {};
  const tv = vorig?.totalen ?? null;
  const doelNu = doelUitReeks(rapport.doelReeksen?.aankopen);
  const doelWas = doelUitReeks(vorig?.doelReeksen?.aankopen);

  return {
    sleutel: 'aankopen',
    titel: 'E-commerce',
    uitleg: 'Door GA4 gemeten aankopen en omzet. Dit is niet automatisch de '
      + 'volledige webshopomzet: wat GA4 niet meet, staat hier niet in.',
    nietIngericht: (rapport.doelen?.aankopen ?? []).length === 0,
    kpis: [
      kpi('aankopen', 'Aankopen', t.aankopen, tv?.aankopen, {
        eenheid: 'aantal',
        definitie: 'Afgeronde aankopen. Winkelwagens en gestarte betalingen tellen niet mee.',
      }),
      kpi('omzet', 'Aankoopomzet', t.omzet, tv?.omzet, {
        eenheid: 'geld',
        definitie: 'Door GA4 gemeten omzet over de aankopen in deze periode.',
      }),
      kpi('aankoopratio', 'Sessies met een aankoop', pct(deel(doelNu?.sessies ?? t.aankopen, t.sessies)), pct(deel(doelWas?.sessies ?? tv?.aankopen, tv?.sessies)), {
        eenheid: 'procent',
        definitie: 'Het aandeel sessies waarin een aankoop plaatsvond.',
      }),
      kpi('orderwaarde', 'Gemiddelde orderwaarde', t.gemiddeldeOrderwaarde, tv?.gemiddeldeOrderwaarde, {
        eenheid: 'geld',
        definitie: 'Zoals GA4 hem rekent, over de aankopen waar een orderwaarde bij hoorde. '
          + 'Omzet zelf door aankopen delen geeft een andere noemer en dus een ander getal.',
      }),
    ],
  };
}

function kpi(sleutel, label, nu, vorig, { eenheid, definitie, voorbehoud = null, secundair = false }) {
  const waarde = getal(nu);
  return {
    sleutel, label, eenheid, definitie, voorbehoud, secundair,
    waarde,
    vorige: getal(vorig),
    verandering: verandering(waarde, vorig),
    // Ontbrekend is niet nul. Een KPI zonder waarde hoort "niet gemeten" te
    // tonen en geen streepje dat voor een nul kan doorgaan.
    gemeten: waarde != null,
  };
}

/** GA4 levert fracties; het dashboard rekent in procenten. */
const pct = (fractie) => (getal(fractie) == null ? null : rond(getal(fractie) * 100, 2));

/* ---------------------------------------------------------------- tabellen -- */

/**
 * Eén doorsnedetabel: verkeer per kanaal, pagina, apparaat of land, met de
 * bedrijfsresultaten ernaast.
 *
 * De conversieratio per rij komt uit de unieke sessies van die rij gedeeld door
 * de sessies van die rij -- twee getallen uit dezelfde doorsnede. Nooit uit een
 * totaal gedeeld door een rij, en nooit als gemiddelde van andere rijen.
 */
function doorsnedeTabel(rapport, doorsnede, { vorig = null, doel = null, minimumSessies = 0 } = {}) {
  const bron = rapport?.rapporten?.[doorsnede];
  if (!bron) return null;

  const groepen = Object.keys(bron.doelen ?? {});
  const primair = doel ?? (groepen.includes('aankopen') ? 'aankopen' : groepen[0] ?? null);

  const vorigePerSegment = new Map(
    (vorig?.rapporten?.[doorsnede]?.basis ?? []).map((r) => [r.segment, r])
  );

  const rijen = bron.basis
    .filter((r) => (getal(r.sessies) ?? 0) >= minimumSessies)
    .map((r) => {
      const resultaten = {};
      for (const groep of groepen) {
        const g = bron.doelen[groep];
        const events = (g.perEvent ?? []).filter((e) => e.segment === r.segment);
        const uniek = (g.uniek ?? []).find((u) => u.segment === r.segment);
        const sessiesMetDoel = getal(uniek?.sessiesMetDoel) ?? 0;
        resultaten[groep] = {
          events: events.reduce((som, e) => som + (getal(e.aantal) ?? 0), 0),
          sessies: sessiesMetDoel,
          ratio: pct(deel(sessiesMetDoel, r.sessies)),
          perEvent: events.map((e) => ({ event: e.event, aantal: e.aantal })),
        };
      }

      const was = vorigePerSegment.get(r.segment) ?? null;
      return {
        segment: r.segment,
        onbekend: r.onbekend === true,
        hostnaam: r.hostnaam ?? null,
        sessies: r.sessies,
        engagement: pct(r.engagementpercentage),
        omzet: r.omzet ?? null,
        aankopen: r.aankopen ?? null,
        resultaten,
        sessiesVorig: was ? was.sessies : null,
        sessiesVerandering: was ? verandering(r.sessies, was.sessies) : null,
        // Een rij zonder vorige waarde is niet gedaald of gestegen; hij is nieuw.
        nieuw: vorig != null && !was,
      };
    });

  // Standaard op het belangrijkste bedrijfsresultaat, niet op verkeer. Sorteren
  // op sessies zet het grootste kanaal bovenaan, ook als daar niets uitkomt.
  const opResultaat = (r) => (primair ? r.resultaten[primair]?.sessies ?? 0 : r.sessies);
  rijen.sort((a, b) => opResultaat(b) - opResultaat(a) || b.sessies - a.sessies);

  return {
    doorsnede,
    primairDoel: primair,
    groepen,
    rijen,
    // De som van de rijen, om naast het totaal te kunnen leggen. Wijken ze af,
    // dan is er afgekapt of heeft GA4 rijen weggelaten wegens een drempelwaarde.
    somSessies: rijen.reduce((s, r) => s + (getal(r.sessies) ?? 0), 0),
    totaalSessies: rapport.totalen?.sessies ?? null,
  };
}

/**
 * Wijken de rijen af van het totaal, en waarom kan dat?
 *
 * Zonder dit ziet iemand een tabel die niet optelt tot de KPI erboven en gaat
 * hij zoeken naar een rekenfout die er niet is.
 */
function dekkingVanTabel(tabel, meldingen = []) {
  if (!tabel || tabel.totaalSessies == null) return null;
  const verschil = tabel.totaalSessies - tabel.somSessies;
  if (verschil <= 0) return null;

  const codes = new Set(meldingen.map((m) => m.code));
  const redenen = [];
  if (codes.has('afgekapt')) redenen.push('de lijst is afgekapt op de grootste rijen');
  if (codes.has('drempelwaarde')) redenen.push('GA4 laat rijen weg met te weinig gebruikers');
  if (codes.has('restpost')) redenen.push('de kleinste rijen zijn samengevoegd');

  return {
    verschil,
    aandeel: rond(deel(verschil, tabel.totaalSessies) * 100, 1),
    tekst: `${verschil.toLocaleString('nl-NL')} sessies staan niet in deze tabel`
      + (redenen.length ? `, omdat ${redenen.join(' en ')}.` : '.'),
  };
}

/* --------------------------------------------------------------- perioden -- */

/**
 * De vergelijkingsperiode bij een gevraagde periode.
 *
 * `vorige`  -- de even lange periode ervoor, aansluitend.
 * `vorigJaar` -- dezelfde datums een jaar eerder.
 *
 * Schrikkeljaren maken dat "een jaar eerder" niet altijd 365 dagen is. We
 * rekenen daarom met de kalender en niet met een aantal dagen: 29 februari
 * bestaat in 2027 niet, en dan schuift de datum naar 28 februari in plaats van
 * naar 1 maart.
 */
function vergelijkingsperiode({ start, eind }, mode = 'vorige') {
  const van = new Date(`${start}T00:00:00Z`);
  const tot = new Date(`${eind}T00:00:00Z`);
  if (Number.isNaN(van.getTime()) || Number.isNaN(tot.getTime())) return null;

  if (mode === 'vorigJaar') {
    return { start: eenJaarEerder(start), eind: eenJaarEerder(eind), label: 'Vorig jaar' };
  }

  const dagen = Math.round((tot - van) / 86400000) + 1;
  const nieuwEind = new Date(van.getTime() - 86400000);
  const nieuwStart = new Date(nieuwEind.getTime() - (dagen - 1) * 86400000);
  return {
    start: nieuwStart.toISOString().slice(0, 10),
    eind: nieuwEind.toISOString().slice(0, 10),
    label: 'Vorige periode',
    dagen,
  };
}

function eenJaarEerder(iso) {
  const [j, m, d] = iso.split('-').map(Number);
  const jaar = j - 1;
  // 29 februari bestaat niet in elk jaar. Terugvallen op de 28e houdt de datum
  // in dezelfde maand; doorschuiven naar 1 maart zou hem in de volgende zetten.
  const laatste = new Date(Date.UTC(jaar, m, 0)).getUTCDate();
  return `${jaar}-${String(m).padStart(2, '0')}-${String(Math.min(d, laatste)).padStart(2, '0')}`;
}

/** Hoeveel volledige dagen beslaat deze periode? */
function dagenIn({ start, eind }) {
  const van = new Date(`${start}T00:00:00Z`);
  const tot = new Date(`${eind}T00:00:00Z`);
  if (Number.isNaN(van.getTime()) || Number.isNaN(tot.getTime())) return null;
  return Math.round((tot - van) / 86400000) + 1;
}

/**
 * Kan de laatste dag nog veranderen?
 *
 * GA4 verwerkt tot ongeveer 48 uur na. Een periode die tot gisteren loopt is
 * dus nog niet definitief, en een vergelijking met een periode die dat wel is
 * laat de nieuwste altijd iets lager uitvallen.
 */
function nogInVerwerking({ eind }, vandaag = new Date()) {
  const tot = new Date(`${eind}T00:00:00Z`);
  if (Number.isNaN(tot.getTime())) return false;
  const dagenGeleden = Math.floor((vandaag - tot) / 86400000);
  return dagenGeleden <= 2;
}

module.exports = {
  verandering, doelTotaal, doelUitReeks, kpiGroepen,
  doorsnedeTabel, dekkingVanTabel,
  vergelijkingsperiode, dagenIn, nogInVerwerking,
};
