/**
 * De inzichtkaarten van de GA4-module.
 *
 * Hoogstens vijf, gerangschikt op verwachte bedrijfsimpact, en alleen als de
 * cijfers ze dragen. Geen inzichten forceren: een lege lijst is een antwoord,
 * en wie altijd vijf kaarten toont leert iedereen ze te negeren.
 *
 * DRIE DINGEN DIE UIT ELKAAR WORDEN GEHOUDEN
 *
 *   waarneming   wat er in de cijfers staat. Meetbaar, niet te betwisten.
 *   verklaring   wat het zou kunnen betekenen. Een mogelijkheid, geen oorzaak.
 *   actie        wat je zou kunnen doen of controleren.
 *
 * Ze staan als aparte velden op de kaart en worden nergens tot één zin
 * samengevoegd. Zodra dat gebeurt, leest een mogelijkheid als een conclusie --
 * "mobiel converteert slechter dus de site is stuk op mobiel" -- en dan gaat
 * iemand een probleem oplossen dat misschien een kanaalmix is.
 *
 * WAAROM ABSOLUUT BOVEN PROCENTUEEL
 *
 * Een landingspagina die van 2 naar 1 aanvraag gaat is vijftig procent gedaald
 * en dat betekent niets. Een pagina die van 80 naar 60 gaat is vijfentwintig
 * procent gedaald en kost twintig aanvragen. De rangschikking gebruikt daarom
 * het absolute verschil, en elke regel heeft een minimumvolume waaronder hij
 * zwijgt.
 */

const {verandering} = require('./ga4-contract');

/**
 * Wanneer is iets opvallend genoeg om te melden?
 *
 * Expliciet en instelbaar, want een drempel die in een `if` verstopt zit is een
 * mening die niemand kan bijstellen. Alle aantallen gelden over de hele
 * gevraagde periode.
 */
const DREMPELS = Object.freeze({
  // Onder dit aantal sessies zeggen we niets over een segment. Een kanaal met
  // veertig bezoeken kan van 0% naar 5% conversie springen door één formulier.
  minimumSessies: 200,

  // En onder dit aantal resultaten trekken we geen conclusie over een ratio.
  minimumResultaten: 10,

  // Vanaf hier noemen we een verandering opvallend.
  verschilProcent: 15,

  // Maar alleen als er ook echt iets achter zit: onder dit absolute verschil
  // blijft een groot percentage een klein getal.
  verschilAbsoluut: 5,

  // Een landingspagina of kanaal dat minstens dit aandeel van het verkeer
  // trekt, mag beoordeeld worden op wat het oplevert.
  aandeelVerkeer: 0.05,

  // Hoeveel slechter een apparaat moet presteren voordat we het melden.
  apparaatVerschil: 0.3,

  // Hoogstens dit aantal kaarten. Meer leest niemand.
  maximum: 5,
});

/**
 * Bouwt de kaarten voor één klant.
 *
 * @param {object} data het antwoord van /api/ga4
 * @param {object} [opties]
 * @param {object} [opties.drempels]
 */
function inzichten(data, {drempels = DREMPELS} = {}) {
  if (!data || data.status !== 'ok') return [];

  const leadgen = data.klanttype === 'leadgen' || data.klanttype === 'beide';
  const ecommerce = data.klanttype === 'ecommerce' || data.klanttype === 'beide';
  const kandidaten = [];

  if (leadgen) {
    kandidaten.push(
      aanvragenTegenVerkeer(data, drempels),
      contactklikkenZonderAanvragen(data, drempels),
      ...segmentKansen(data, drempels, 'leads'),
    );
  }
  if (ecommerce) {
    kandidaten.push(
      omzetUiteengerafeld(data, drempels),
      verkeerTegenAankopen(data, drempels),
      productMetAandachtZonderAankoop(data, drempels),
      ...segmentKansen(data, drempels, 'aankopen'),
    );
  }
  kandidaten.push(apparaatVerschil(data, drempels, leadgen ? 'leads' : 'aankopen'));
  kandidaten.push(meetprobleem(data));

  return kandidaten
    .filter(Boolean)
    .sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0))
    .slice(0, drempels.maximum);
}

/* ------------------------------------------------------------- leadgen -- */

/** Aanvragen dalen terwijl het verkeer gelijk blijft: dan ligt het aan de site. */
function aanvragenTegenVerkeer(data, d) {
  const leads = groep(data, 'leads');
  if (!leads || !data.vergelijking?.beschikbaar) return null;

  const aanvragen = kpiUit(data, 'leads', 'aanvragen');
  const sessies = kpiUit(data, 'context', 'sessies');
  if (!aanvragen?.gemeten || !sessies?.gemeten) return null;
  if ((aanvragen.vorige ?? 0) < d.minimumResultaten) return null;

  const va = aanvragen.verandering;
  const vs = sessies.verandering;
  if (va.procent == null || vs.procent == null) return null;
  if (va.procent > -d.verschilProcent) return null;
  if (Math.abs(va.absoluut) < d.verschilAbsoluut) return null;

  // Alleen melden als het verkeer níet meebeweegt. Dalen ze samen, dan is het
  // een verkeersverhaal en hoort de kaart over het kanaal te gaan.
  const verkeerStabiel = Math.abs(vs.procent) < d.verschilProcent;

  return {
    code: 'aanvragen_dalen',
    titel: verkeerStabiel
      ? 'Minder aanvragen bij gelijkblijvend verkeer'
      : 'Minder aanvragen',
    impact: Math.abs(va.absoluut),
    waarneming: `${getal(aanvragen.waarde)} aanvragen tegenover ${getal(aanvragen.vorige)} in `
      + `${data.vergelijking.label.toLowerCase()} (${va.absoluut}, ${va.procent}%). `
      + `Het verkeer ging van ${getal(sessies.vorige)} naar ${getal(sessies.waarde)} sessies `
      + `(${vs.procent}%).`,
    cijfers: {
      nu: aanvragen.waarde, vorig: aanvragen.vorige,
      periode: data.periode, vergelijking: {start: data.vergelijking.start, eind: data.vergelijking.eind},
    },
    waarom: verkeerStabiel
      ? 'Er komen evenveel mensen, maar minder van hen vragen iets aan. Het verschil zit '
        + 'dan niet in de advertenties maar tussen de landing en het formulier.'
      : 'Minder aanvragen kost direct omzet, ongeacht waar het aan ligt.',
    verklaring: verkeerStabiel
      ? 'Mogelijk een wijziging aan het formulier of de pagina, een meetfout sinds een '
        + 'release, of een verschuiving in welk verkeer er binnenkomt.'
      : 'Mogelijk verschoof de verkeersmix naar bronnen die minder aanvragen.',
    actie: 'Loop de landingspagina\'s hieronder na op welke pagina de daling zit, en '
      + 'controleer of het formulierevent nog afvuurt.',
    onzekerheid: leads.kanOverlappen
      ? 'Dit telt gebeurtenissen, niet unieke aanvragers: één bezoeker kan meer dan één '
        + 'formulier versturen.'
      : null,
    naar: {tab: 'landingspaginas'},
  };
}

/** Contactklikken stijgen, bevestigde aanvragen niet. */
function contactklikkenZonderAanvragen(data, d) {
  if (!data.vergelijking?.beschikbaar) return null;
  const contact = kpiUit(data, 'leads', 'contact');
  const aanvragen = kpiUit(data, 'leads', 'aanvragen');
  if (!contact?.gemeten || !aanvragen?.gemeten) return null;
  if ((contact.vorige ?? 0) < d.minimumResultaten) return null;

  const vc = contact.verandering;
  const va = aanvragen.verandering;
  if (vc.procent == null || va.procent == null) return null;
  if (vc.procent < d.verschilProcent) return null;
  if (va.procent >= d.verschilProcent) return null;
  if (Math.abs(vc.absoluut) < d.verschilAbsoluut) return null;

  return {
    code: 'contact_zonder_aanvraag',
    titel: 'Meer contactklikken, niet meer aanvragen',
    impact: Math.abs(vc.absoluut),
    waarneming: `Contactklikken gingen van ${getal(contact.vorige)} naar ${getal(contact.waarde)} `
      + `(${vc.procent}%), terwijl de aanvragen op ${getal(aanvragen.waarde)} bleven (${va.procent}%).`,
    cijfers: {
      nu: contact.waarde, vorig: contact.vorige,
      periode: data.periode, vergelijking: {start: data.vergelijking.start, eind: data.vergelijking.eind},
    },
    waarom: 'Er is meer interesse, maar die loopt niet via het formulier. Wat er via de '
      + 'telefoon binnenkomt is hier niet zichtbaar en telt nergens mee.',
    verklaring: 'Mogelijk kiezen bezoekers vaker voor bellen dan voor het formulier, of is '
      + 'het formulier minder goed vindbaar geworden.',
    actie: 'Vraag na hoeveel telefonische aanvragen er binnenkwamen. Zijn dat er veel, dan '
      + 'onderschat dit dashboard structureel wat de site oplevert.',
    onzekerheid: 'Een klik op een telefoonnummer is geen gesprek. Er is niet gemeten of er '
      + 'daadwerkelijk contact volgde.',
    naar: {tab: 'leads'},
  };
}

/* ---------------------------------------------------------- e-commerce -- */

/** Omzet daalt: door minder aankopen of door een lagere orderwaarde? */
function omzetUiteengerafeld(data, d) {
  if (!data.vergelijking?.beschikbaar) return null;
  const omzet = kpiUit(data, 'aankopen', 'omzet');
  const aankopen = kpiUit(data, 'aankopen', 'aankopen');
  const aov = kpiUit(data, 'aankopen', 'orderwaarde');
  if (!omzet?.gemeten || !aankopen?.gemeten) return null;
  if ((aankopen.vorige ?? 0) < d.minimumResultaten) return null;

  const vo = omzet.verandering;
  if (vo.procent == null || Math.abs(vo.procent) < d.verschilProcent) return null;

  const va = aankopen.verandering;
  const vw = aov?.verandering ?? {procent: null};
  const richting = vo.procent < 0 ? 'daalt' : 'stijgt';

  // Welke van de twee factoren het meest verschoof. Dat is de vraag die je
  // erna stelt, en het antwoord scheelt wat je eraan doet.
  const door = Math.abs(va.procent ?? 0) >= Math.abs(vw.procent ?? 0)
    ? 'het aantal aankopen'
    : 'de gemiddelde orderwaarde';

  return {
    code: 'omzet_verandering',
    titel: `Aankoopomzet ${richting} door ${door}`,
    impact: Math.abs(vo.absoluut ?? 0),
    waarneming: `Omzet ${geld(omzet.waarde)} tegenover ${geld(omzet.vorige)} `
      + `(${vo.procent}%). Aankopen ${getal(aankopen.waarde)} tegenover ${getal(aankopen.vorige)} `
      + `(${va.procent ?? '—'}%), gemiddelde orderwaarde ${geld(aov?.waarde)} tegenover `
      + `${geld(aov?.vorige)} (${vw.procent ?? '—'}%).`,
    cijfers: {
      nu: omzet.waarde, vorig: omzet.vorige,
      periode: data.periode, vergelijking: {start: data.vergelijking.start, eind: data.vergelijking.eind},
    },
    waarom: `Omzet is aantal maal waarde. Weten welke van de twee verschoof bepaalt of je `
      + `aan verkeer en conversie werkt, of aan assortiment en prijs.`,
    verklaring: door === 'het aantal aankopen'
      ? 'Mogelijk minder of ander verkeer, of een drempel in het afrekenen.'
      : 'Mogelijk een verschuiving in welke producten verkocht worden, of een actie met korting.',
    actie: door === 'het aantal aankopen'
      ? 'Kijk bij Acquisitie welk kanaal het verschil verklaart.'
      : 'Kijk bij de productprestaties welke artikelen van plek zijn gewisseld.',
    onzekerheid: 'Dit is de door GA4 gemeten omzet. Wat GA4 niet meet, staat hier niet in; '
      + 'dit is niet automatisch de volledige webshopomzet.',
    naar: {tab: door === 'het aantal aankopen' ? 'acquisitie' : 'producten'},
  };
}

/** Meer verkeer, maar een lager aandeel sessies met een aankoop. */
function verkeerTegenAankopen(data, d) {
  if (!data.vergelijking?.beschikbaar) return null;
  const sessies = kpiUit(data, 'context', 'sessies');
  const ratio = kpiUit(data, 'aankopen', 'aankoopratio');
  if (!sessies?.gemeten || !ratio?.gemeten) return null;

  const vs = sessies.verandering;
  const vr = ratio.verandering;
  if (vs.procent == null || vr.procent == null) return null;
  if (vs.procent < d.verschilProcent) return null;
  if (vr.procent > -d.verschilProcent) return null;

  return {
    code: 'verkeer_zonder_aankopen',
    titel: 'Meer verkeer, minder vaak een aankoop',
    impact: Math.abs(vs.absoluut ?? 0) / 100,
    waarneming: `Sessies stegen ${vs.procent}% naar ${getal(sessies.waarde)}, terwijl het aandeel `
      + `sessies met een aankoop zakte van ${procent(ratio.vorige)} naar ${procent(ratio.waarde)}.`,
    cijfers: {
      nu: ratio.waarde, vorig: ratio.vorige,
      periode: data.periode, vergelijking: {start: data.vergelijking.start, eind: data.vergelijking.eind},
    },
    waarom: 'Meer bezoekers is niet vanzelf beter. Als het extra verkeer niet koopt, stijgen '
      + 'de kosten zonder dat de omzet meebeweegt.',
    verklaring: 'Mogelijk komt het extra verkeer uit een bron die minder koopintentie heeft, '
      + 'of landde het op pagina\'s die niet tot een aankoop leiden.',
    actie: 'Vergelijk bij Acquisitie welk kanaal groeide en wat dat kanaal oplevert.',
    onzekerheid: null,
    naar: {tab: 'acquisitie'},
  };
}

/** Een product dat veel bekeken wordt maar weinig verkoopt. */
function productMetAandachtZonderAankoop(data, d) {
  const producten = data.producten ?? [];
  if (!producten.length) return null;

  const totaalBekeken = producten.reduce((s, p) => s + (p.bekeken ?? 0), 0);
  if (!totaalBekeken) return null;

  const kandidaten = producten
    .filter((p) => (p.bekeken ?? 0) >= totaalBekeken * d.aandeelVerkeer)
    .filter((p) => (p.gekocht ?? 0) === 0)
    .sort((a, b) => (b.bekeken ?? 0) - (a.bekeken ?? 0));

  const p = kandidaten[0];
  if (!p) return null;

  return {
    code: 'product_zonder_aankoop',
    titel: 'Veel bekeken product zonder aankopen',
    impact: (p.bekeken ?? 0) / 100,
    waarneming: `"${p.product}" werd ${getal(p.bekeken)} keer bekeken en ${getal(p.inWinkelwagen)} keer `
      + `in de winkelwagen gelegd, maar niet gekocht.`,
    cijfers: {nu: p.bekeken, vorig: null, periode: data.periode, vergelijking: null},
    waarom: 'Dit product trekt aandacht die nergens toe leidt. Dat is verkeer waar al voor '
      + 'betaald is.',
    verklaring: 'Mogelijk is het uitverkocht, staat de prijs of levertijd in de weg, of '
      + 'ontbreken maat- of voorraadgegevens.',
    actie: 'Controleer voorraad, prijs en levertijd van dit artikel.',
    onzekerheid: 'Itemaantallen zijn geen sessies: dezelfde bezoeker kan het artikel meerdere '
      + 'keren bekijken.',
    naar: {tab: 'producten'},
  };
}

/* ------------------------------------------------------- beide typen -- */

/** Een kanaal of pagina met veel verkeer dat weinig oplevert. */
function segmentKansen(data, d, groepNaam) {
  const kaarten = [];
  for (const [doorsnede, label] of [['kanaal', 'kanaal'], ['landingspagina', 'landingspagina']]) {
    const tabel = data.tabellen?.[doorsnede];
    if (!tabel?.rijen?.length) continue;

    const totaal = tabel.totaalSessies ?? 0;
    const gemiddelde = gemiddeldeRatio(tabel, groepNaam);
    if (gemiddelde == null) continue;

    // Rijen met genoeg verkeer die duidelijk onder het gemiddelde blijven.
    const zwak = tabel.rijen
      .filter((r) => !r.onbekend)
      .filter((r) => (r.sessies ?? 0) >= Math.max(d.minimumSessies, totaal * d.aandeelVerkeer))
      .map((r) => ({rij: r, ratio: r.resultaten?.[groepNaam]?.ratio}))
      .filter((x) => x.ratio != null && x.ratio < gemiddelde * 0.5)
      // Gemist resultaat: wat deze rij zou opleveren op het gemiddelde.
      .map((x) => ({...x, gemist: Math.round(((gemiddelde - x.ratio) / 100) * x.rij.sessies)}))
      .sort((a, b) => b.gemist - a.gemist);

    const beste = zwak[0];
    if (!beste || beste.gemist < d.minimumResultaten) continue;

    const wat = groepNaam === 'aankopen' ? 'aankopen' : 'aanvragen';
    kaarten.push({
      code: `zwak_${doorsnede}`,
      titel: doorsnede === 'landingspagina'
        ? 'Landingspagina met veel bezoek en weinig resultaat'
        : 'Kanaal met veel verkeer en weinig resultaat',
      impact: beste.gemist,
      waarneming: `"${beste.rij.segment}" bracht ${getal(beste.rij.sessies)} sessies `
        + `(${procent((beste.rij.sessies / totaal) * 100)} van het verkeer) met `
        + `${procent(beste.ratio)} ${wat}, tegen ${procent(gemiddelde)} gemiddeld.`,
      cijfers: {nu: beste.ratio, vorig: gemiddelde, periode: data.periode, vergelijking: null},
      waarom: `Op het gemiddelde zou dit ${beste.gemist} ${wat} extra opleveren, zonder dat er `
        + 'één bezoeker bij hoeft.',
      verklaring: doorsnede === 'landingspagina'
        ? 'Mogelijk sluit de pagina niet aan op de verwachting waarmee bezoekers komen, of '
          + 'staat het formulier te ver naar beneden.'
        : 'Mogelijk trekt dit kanaal bezoekers met een andere intentie, of landen ze op de '
          + 'verkeerde pagina.',
      actie: doorsnede === 'landingspagina'
        ? 'Bekijk deze pagina naast een pagina die het wél goed doet, met dezelfde bezoekersvraag.'
        : 'Controleer op welke pagina\'s dit kanaal binnenkomt en of dat de bedoeling is.',
      onzekerheid: 'Een verschil in conversieratio kan ook aan de bezoekersmix liggen; dit is '
        + 'geen bewijs dat de pagina zelf het probleem is.',
      naar: {tab: doorsnede === 'landingspagina' ? 'landingspaginas' : 'acquisitie'},
    });
  }
  return kaarten;
}

/** Mobiel presteert duidelijk anders dan desktop. */
function apparaatVerschil(data, d, groepNaam) {
  const tabel = data.tabellen?.apparaat;
  if (!tabel?.rijen?.length) return null;

  const mobiel = tabel.rijen.find((r) => r.segment === 'mobile');
  const desktop = tabel.rijen.find((r) => r.segment === 'desktop');
  if (!mobiel || !desktop) return null;
  if ((mobiel.sessies ?? 0) < d.minimumSessies || (desktop.sessies ?? 0) < d.minimumSessies) return null;

  const rm = mobiel.resultaten?.[groepNaam]?.ratio;
  const rd = desktop.resultaten?.[groepNaam]?.ratio;
  if (rm == null || rd == null || rd === 0) return null;
  if (rm >= rd * (1 - d.apparaatVerschil)) return null;

  const wat = groepNaam === 'aankopen' ? 'aankopen' : 'aanvragen';
  const gemist = Math.round(((rd - rm) / 100) * mobiel.sessies);
  if (gemist < d.minimumResultaten) return null;

  return {
    code: 'mobiel_achter',
    titel: 'Mobiel levert relatief weinig op',
    impact: gemist,
    waarneming: `Mobiel: ${procent(rm)} ${wat} op ${getal(mobiel.sessies)} sessies. `
      + `Desktop: ${procent(rd)} op ${getal(desktop.sessies)} sessies.`,
    cijfers: {nu: rm, vorig: rd, periode: data.periode, vergelijking: null},
    waarom: `Mobiel is het grootste deel van het verkeer. Op het desktopniveau zou dit `
      + `${gemist} ${wat} extra betekenen.`,
    verklaring: 'Mogelijk werkt het formulier of het afrekenen minder goed op een klein '
      + 'scherm. Het kan ook zijn dat mobiel verkeer uit andere kanalen komt, met een '
      + 'andere intentie.',
    actie: 'Loop de belangrijkste pagina op een telefoon door, en vergelijk de kanaalmix van '
      + 'mobiel met die van desktop voordat je de site aanpast.',
    onzekerheid: 'Een verschil tussen apparaten is geen bewijs van een technisch probleem. '
      + 'Mobiel en desktop verschillen ook in wie er komt en waarvoor.',
    naar: {tab: 'apparaten'},
  };
}

/** Een meting die ontbreekt is zelf het belangrijkste inzicht. */
function meetprobleem(data) {
  const ecommerce = data.klanttype === 'ecommerce' || data.klanttype === 'beide';
  if (ecommerce) {
    const aankopen = kpiUit(data, 'aankopen', 'aankopen');
    if (aankopen && (aankopen.waarde ?? 0) === 0) {
      return {
        code: 'geen_aankoopmeting',
        // Bewust de hoogste impact: zolang dit niet klopt, betekent geen van de
        // andere kaarten iets.
        impact: Number.MAX_SAFE_INTEGER,
        titel: 'Geen aankopen gemeten',
        waarneming: `Er staan ${getal(data.kpis?.[0]?.kpis?.find((k) => k.sleutel === 'sessies')?.waarde)} `
          + 'sessies tegenover nul gemeten aankopen in deze periode.',
        cijfers: {nu: 0, vorig: null, periode: data.periode, vergelijking: null},
        waarom: 'Dit maakt de klant geen leadgeneratieklant; het betekent dat de '
          + 'aankoopmeting ontbreekt of stuk is. Zolang dat zo is zegt elk cijfer over '
          + 'conversie en omzet hieronder niets.',
        verklaring: 'Mogelijk vuurt het aankoopevent niet af op elke afrekenroute, of staat '
          + 'de bedankpagina buiten de meting.',
        actie: 'Doe een testaankoop en controleer of het aankoopevent binnenkomt.',
        onzekerheid: null,
        naar: {tab: 'instellingen'},
      };
    }
  }

  const leadgen = data.klanttype === 'leadgen' || data.klanttype === 'beide';
  if (leadgen && !(data.doelen?.leads ?? []).length) {
    return {
      code: 'geen_leaddefinitie',
      impact: Number.MAX_SAFE_INTEGER,
      titel: 'Nog geen gebeurtenis als aanvraag aangewezen',
      waarneming: 'Er is voor deze klant geen enkele gebeurtenis aangemerkt als bevestigde aanvraag.',
      cijfers: {nu: null, vorig: null, periode: data.periode, vergelijking: null},
      waarom: 'Zonder die keuze is er geen conversieratio en geen rangschikking van kanalen '
        + 'op resultaat. De rapporten hieronder tonen alleen verkeer.',
      verklaring: 'Mogelijk zijn de formulierbevestigingen nog niet als gebeurtenis ingericht, '
        + 'of dragen ze namen die niet als aanvraag herkenbaar zijn.',
      actie: 'Loop de gemeten gebeurtenissen na en wijs aan welke een bevestigde aanvraag zijn.',
      onzekerheid: null,
      naar: {tab: 'instellingen'},
    };
  }
  return null;
}

/* ------------------------------------------------------------- gedeeld -- */

function kpiUit(data, groepSleutel, kpiSleutel) {
  const groep = (data.kpis ?? []).find((g) => g.sleutel === groepSleutel);
  return groep?.kpis?.find((k) => k.sleutel === kpiSleutel) ?? null;
}

function groep(data, naam) {
  const g = (data.kpis ?? []).find((x) => x.sleutel === naam);
  if (!g) return null;
  return {kanOverlappen: (data.doelen?.[naam] ?? []).length > 1};
}

/**
 * De conversieratio over de hele tabel.
 *
 * Uit de totalen en niet als gemiddelde van de rijpercentages: het gemiddelde
 * van "10% op 10 sessies" en "1% op 10.000 sessies" is 5,5%, en dat getal
 * beschrijft geen enkel kanaal.
 */
function gemiddeldeRatio(tabel, groepNaam) {
  let sessies = 0;
  let metDoel = 0;
  for (const r of tabel.rijen ?? []) {
    sessies += r.sessies ?? 0;
    metDoel += r.resultaten?.[groepNaam]?.sessies ?? 0;
  }
  if (!sessies) return null;
  return Math.round((metDoel / sessies) * 10000) / 100;
}

const getal = (v) => (v == null ? '—' : Number(v).toLocaleString('nl-NL'));
const procent = (v) => (v == null ? '—' : `${Number(v).toLocaleString('nl-NL', {maximumFractionDigits: 2})}%`);
const geld = (v) => (v == null ? '—'
  : Number(v).toLocaleString('nl-NL', {style: 'currency', currency: 'EUR', maximumFractionDigits: 2}));

module.exports = {inzichten, DREMPELS};
