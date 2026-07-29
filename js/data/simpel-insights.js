/**
 * Auto-inzichten voor het simpele Meta/Google Ads-dashboard.
 *
 * Deterministische, ad-gerichte observaties, puur afgeleid uit de al aanwezige
 * platformdata (combined totalen, campagnes, weekdagen, deltas). Elk inzicht
 * draagt zijn eigen cijfers als bewijs — nooit een conclusie zonder onderbouwing.
 * De vorm sluit aan op `renderInzichtkaart` ({categorie, betrouwbaarheid, titel,
 * samenvatting, bewijs[], herkomst, actie}).
 */

import { fmt } from '../views/components.js';
import { combineerTotalen, alleCampagnes, adDeltas, perWeekdag, adSegmenten, gecombineerdeReeks, reeksIsDagelijks } from './ads-data.js';
import { toonKorteDatum } from '../filters/period.js';

/** Betrouwbaarheid op basis van het resultaatvolume waar het inzicht op rust. */
function betrouwbaarheidVanVolume(results) {
  if (results >= 30) return 'hoog';
  if (results >= 10) return 'redelijk';
  return 'beperkt';
}

/** Mediaan van een getallenreeks (nulls genegeerd). */
function mediaan(arr) {
  const g = (arr ?? []).filter((v) => v != null).sort((a, b) => a - b);
  if (!g.length) return 0;
  const m = Math.floor(g.length / 2);
  return g.length % 2 ? g[m] : (g[m - 1] + g[m]) / 2;
}

/** Het resultaat in enkelvoud, per klanttype (voor natuurlijke zinnen). */
function resultEnkelvoud(model) {
  if (model === 'ecommerce') return 'aankoop';
  if (model === 'awareness') return 'interactie';
  return 'lead';
}

const METRIEK_LABEL = {
  spend: 'uitgaven', impressions: 'vertoningen', clicks: 'klikken', ctr: 'doorklikratio',
  cpc: 'kosten per klik', cpm: 'CPM', results: 'resultaten', costPerResult: 'kosten per resultaat',
  conversieratio: 'conversie per klik', roas: 'ROAS', revenue: 'omzet',
};

/**
 * Bouwt de ad-inzichten. Geeft `{ primair, aanvullend }` terug, gesorteerd op
 * urgentie (aandachtspunten eerst, dan kansen, dan ontwikkelingen). Alle claims
 * zijn deterministisch afgeleid uit de al aanwezige platformdata; elk inzicht
 * draagt zijn eigen cijfers als bewijs.
 */
export function bouwAdInzichten(dashboard, platforms, vergelijking = null) {
  const totaal = combineerTotalen(platforms);
  if (!totaal) return { primair: [], aanvullend: [] };

  const vergActief = vergelijking ? vergelijking.actief : true;
  const vergKort = vergelijking?.kort ?? 'de vorige periode';
  const meervoud = (totaal.resultLabel ?? 'resultaten').toLowerCase();
  const enkel = resultEnkelvoud(dashboard.model);
  const campagnes = alleCampagnes(platforms);
  const deltas = adDeltas(dashboard, totaal, { vergelijkingActief: vergActief });
  const inzichten = [];

  /* 1. Verspild budget: campagnes met uitgaven maar een gemeten nul aan resultaat. */
  const verspild = campagnes.filter((c) => (c.spend ?? 0) > 0 && c.results === 0);
  if (verspild.length) {
    const som = verspild.reduce((s, c) => s + (c.spend ?? 0), 0);
    const aandeel = totaal.spend ? (som / totaal.spend) * 100 : null;
    inzichten.push({
      _gewicht: 100 + (aandeel ?? 0),
      categorie: 'aandachtspunt',
      betrouwbaarheid: betrouwbaarheidVanVolume(totaal.results),
      titel: `${fmt.euro(som)} ging naar campagnes zonder ${meervoud}`,
      samenvatting: `${verspild.length} ${verspild.length === 1 ? 'campagne besteedde' : 'campagnes besteedden'} budget zonder één ${enkel}${aandeel != null ? `, ${fmt.procent(aandeel)} van de totale uitgaven` : ''}.`,
      bewijs: verspild.slice(0, 4).map((c) => ({ label: c.name, waarde: `${fmt.euro(c.spend)} · 0 ${meervoud}` })),
      herkomst: 'Campagnes met uitgaven in de periode maar een gemeten nul aan resultaat.',
      actie: 'Pauzeer of herzie deze campagnes en verschuif het budget naar wat wél levert.',
    });
  }

  /* 2. Grootste procentuele verandering t.o.v. de vorige periode (over de kernmetrieken). */
  const kandidaten = ['results', 'costPerResult', 'spend', 'clicks', 'impressions', 'ctr', 'cpc', 'roas'];
  const grootste = kandidaten
    .map((k) => ({ k, d: deltas[k] }))
    .filter((x) => x.d && x.d.procent != null && (x.d.status === 'gestegen' || x.d.status === 'gedaald'))
    .sort((a, b) => Math.abs(b.d.procent) - Math.abs(a.d.procent))[0];
  if (grootste) {
    const d = grootste.d;
    const gestegen = d.procent > 0;
    const label = METRIEK_LABEL[grootste.k] ?? grootste.k;
    inzichten.push({
      _gewicht: 60 + Math.min(Math.abs(d.procent), 40),
      categorie: d.richting === 'negatief' ? 'aandachtspunt' : d.richting === 'positief' ? 'kans' : 'ontwikkeling',
      betrouwbaarheid: betrouwbaarheidVanVolume(totaal.results),
      titel: `${label.charAt(0).toUpperCase()}${label.slice(1)} ${gestegen ? 'omhoog' : 'omlaag'} met ${Math.abs(d.procent).toFixed(1)}%`,
      samenvatting: `De grootste procentuele verschuiving onder de kernmetrieken t.o.v. ${vergKort}, over Meta en Google samen.`,
      bewijs: [{ label: METRIEK_LABEL[grootste.k], waarde: `${d.tekst} t.o.v. ${vergKort}` }],
      herkomst: `Vergelijking van de gecombineerde ad-totalen met ${vergKort}.`,
    });
  }

  /* 3. Beste en duurste campagne op kosten/resultaat, vergeleken met het
        campagnegemiddelde (dezelfde set als de zichtbare campagnetabel). */
  const metResultaat = campagnes.filter((c) => c.results > 0 && c.costPerResult != null);
  if (metResultaat.length >= 2) {
    const somSpend = metResultaat.reduce((s, c) => s + (c.spend ?? 0), 0);
    const somRes = metResultaat.reduce((s, c) => s + (c.results ?? 0), 0);
    const gemCPA = somRes ? somSpend / somRes : null;
    if (gemCPA) {
      const gesorteerd = [...metResultaat].sort((a, b) => a.costPerResult - b.costPerResult);
      const beste = gesorteerd[0];
      const duurste = gesorteerd[gesorteerd.length - 1];
      const onder = (1 - beste.costPerResult / gemCPA) * 100;
      const boven = (duurste.costPerResult / gemCPA - 1) * 100;

      inzichten.push({
        _gewicht: 55 + Math.max(onder, 0),
        categorie: 'kans',
        betrouwbaarheid: betrouwbaarheidVanVolume(beste.results),
        titel: `${beste.name} levert het goedkoopste resultaat`,
        samenvatting: `${fmt.euro2(beste.costPerResult)} per ${enkel}${onder > 0 ? `, ${fmt.procent(onder)} onder het campagnegemiddelde` : ''}.`,
        bewijs: [
          { label: beste.name, waarde: `${fmt.euro2(beste.costPerResult)} · ${fmt.getal(beste.results)} ${meervoud}` },
          { label: 'Campagnegemiddelde', waarde: fmt.euro2(gemCPA) },
        ],
        actie: 'Overweeg meer budget naar deze campagne te verschuiven.',
      });

      if (boven > 20) {
        inzichten.push({
          _gewicht: 50 + boven,
          categorie: 'aandachtspunt',
          betrouwbaarheid: betrouwbaarheidVanVolume(duurste.results),
          titel: `${duurste.name} heeft de duurste conversies`,
          samenvatting: `${fmt.euro2(duurste.costPerResult)} per ${enkel}, ${fmt.procent(boven)} boven het campagnegemiddelde.`,
          bewijs: [
            { label: duurste.name, waarde: `${fmt.euro2(duurste.costPerResult)} · ${fmt.getal(duurste.results)} ${meervoud}` },
            { label: 'Campagnegemiddelde', waarde: fmt.euro2(gemCPA) },
          ],
          actie: 'Controleer targeting en biedingen van deze campagne, of verlaag het budget.',
        });
      }
    }
  }

  /* 4. Sterkste dag van de week op kosten/resultaat (alleen bij dagdata). */
  const weekdagen = perWeekdag(platforms).filter((d) => d.results > 0 && d.costPerResult != null);
  if (weekdagen.length >= 3 && totaal.costPerResult != null) {
    const beste = [...weekdagen].sort((a, b) => a.costPerResult - b.costPerResult)[0];
    const onder = (1 - beste.costPerResult / totaal.costPerResult) * 100;
    if (onder > 8) {
      inzichten.push({
        _gewicht: 40 + onder,
        categorie: 'kans',
        betrouwbaarheid: betrouwbaarheidVanVolume(beste.results),
        titel: `${beste.name} is de sterkste dag`,
        samenvatting: `Op ${beste.name.toLowerCase()} is een ${enkel} het goedkoopst: ${fmt.euro2(beste.costPerResult)}.`,
        bewijs: [
          { label: beste.name, waarde: `${fmt.euro2(beste.costPerResult)} · ${fmt.getal(beste.results)} ${meervoud}` },
          { label: 'Gemiddeld', waarde: fmt.euro2(totaal.costPerResult) },
        ],
        actie: 'Overweeg meer budget in te plannen rond de sterkste dagen.',
      });
    }
  }

  /* 5. Budgetconcentratie: één campagne slokt een groot deel van het budget op. */
  if (campagnes.length >= 2 && totaal.spend) {
    const top = campagnes[0]; // alleCampagnes is aflopend op uitgaven gesorteerd
    const aandeel = (top.spend / totaal.spend) * 100;
    if (aandeel >= 40) {
      inzichten.push({
        _gewicht: 45 + (aandeel - 40),
        categorie: 'aandachtspunt',
        betrouwbaarheid: betrouwbaarheidVanVolume(totaal.results),
        titel: `${fmt.procent(aandeel)} van het budget zit in één campagne`,
        samenvatting: `${top.name} draagt het grootste deel van de uitgaven; het totale resultaat hangt sterk van deze ene campagne af.`,
        bewijs: [
          { label: top.name, waarde: `${fmt.euro(top.spend)} · ${fmt.procent(aandeel)} van het budget` },
          { label: 'Totaal', waarde: fmt.euro(totaal.spend) },
        ],
        actie: 'Spreid het budget of houd deze campagne extra in de gaten — een dip hier raakt het geheel.',
      });
    }
  }

  /* 6. CTR-vs-conversie-mismatch: veel klikken, weinig resultaat. */
  if (totaal.conversieratio != null && totaal.ctr != null) {
    const kandidaat = campagnes
      .filter((c) => c.clicks >= 20 && c.ctr != null && c.ctr > totaal.ctr)
      .map((c) => ({ c, convr: c.clicks ? (c.results / c.clicks) * 100 : 0 }))
      .filter((x) => x.convr < totaal.conversieratio * 0.6)
      .sort((a, b) => b.c.clicks - a.c.clicks)[0];
    if (kandidaat) {
      const c = kandidaat.c;
      inzichten.push({
        _gewicht: 48,
        categorie: 'aandachtspunt',
        betrouwbaarheid: betrouwbaarheidVanVolume(c.results),
        titel: `${c.name}: veel klikken, weinig resultaat`,
        samenvatting: `Bovengemiddelde CTR (${fmt.procent(c.ctr)}), maar de conversie per klik (${fmt.procent(kandidaat.convr)}) blijft ver achter bij het gemiddelde (${fmt.procent(totaal.conversieratio)}).`,
        bewijs: [
          { label: c.name, waarde: `${fmt.getal(c.clicks)} klikken · ${fmt.getal(c.results)} ${meervoud}` },
          { label: 'Conversie per klik', waarde: `${fmt.procent(kandidaat.convr)} vs ${fmt.procent(totaal.conversieratio)} gemiddeld` },
        ],
        actie: 'Controleer de landingspagina en of het zoekwoord/de doelgroep bij de intentie past.',
      });
    }
  }

  /* 7. Piekdag-anomalie: een dag die sterk afwijkt van de mediaan (alleen dagdata). */
  const reeks = gecombineerdeReeks(platforms);
  if (reeksIsDagelijks(reeks) && reeks.length >= 7) {
    const spends = reeks.map((p) => p.spend);
    const med = mediaan(spends);
    const mad = mediaan(spends.map((v) => Math.abs(v - med))) || 1;
    const piek = reeks.map((p) => ({ p, z: Math.abs(p.spend - med) / mad })).sort((a, b) => b.z - a.z)[0];
    if (piek && piek.z >= 3 && med > 0) {
      const pct = ((piek.p.spend - med) / med) * 100;
      inzichten.push({
        _gewicht: 42,
        categorie: piek.p.spend > med ? 'aandachtspunt' : 'ontwikkeling',
        betrouwbaarheid: 'redelijk',
        titel: `Uitschieter in de uitgaven op ${toonKorteDatum(piek.p.date)}`,
        samenvatting: `De uitgaven waren die dag ${piek.p.spend > med ? 'veel hoger' : 'veel lager'} dan gebruikelijk (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% t.o.v. de mediaan per dag).`,
        bewijs: [
          { label: toonKorteDatum(piek.p.date), waarde: fmt.euro(piek.p.spend) },
          { label: 'Mediaan per dag', waarde: fmt.euro(med) },
        ],
        actie: 'Controleer of hier een campagnewijziging, budgetpiek of trackingfout achter zit.',
      });
    }
  }

  /* 8. Apparaat-efficiëntie: goedkoopste vs duurste apparaat (waar kosten bekend zijn). */
  const devices = (adSegmenten(dashboard, platforms).devices ?? []).filter((d) => d.spend != null && d.results > 0 && d.costPerResult != null);
  if (devices.length >= 2) {
    const g = [...devices].sort((a, b) => a.costPerResult - b.costPerResult);
    const beste = g[0];
    const duurste = g[g.length - 1];
    if (duurste.costPerResult > beste.costPerResult * 1.4) {
      inzichten.push({
        _gewicht: 38,
        categorie: 'kans',
        betrouwbaarheid: betrouwbaarheidVanVolume(beste.results),
        titel: `${beste.name} is het efficiëntste apparaat`,
        samenvatting: `Een ${enkel} kost op ${beste.name.toLowerCase()} ${fmt.euro2(beste.costPerResult)}, tegen ${fmt.euro2(duurste.costPerResult)} op ${duurste.name.toLowerCase()}.`,
        bewijs: [
          { label: beste.name, waarde: `${fmt.euro2(beste.costPerResult)} per ${enkel}` },
          { label: duurste.name, waarde: `${fmt.euro2(duurste.costPerResult)} per ${enkel}` },
        ],
        actie: 'Overweeg biedingen of budget te verschuiven richting het efficiëntste apparaat.',
      });
    }
  }

  /* 9. Zoekwoord-/placement-uitschieter: opvallend dure regel vs de mediaan. */
  const breakdownRijen = [
    ...(platforms.google?.breakdowns?.keywords ?? []).map((k) => ({ ...k, soort: 'zoekwoord' })),
    ...(platforms.meta?.breakdowns?.placements ?? []).map((k) => ({ ...k, soort: 'plaatsing' })),
  ].filter((k) => k.results > 0 && k.costPerResult != null && (k.spend ?? 0) >= 50);
  if (breakdownRijen.length >= 3) {
    const medCpr = mediaan(breakdownRijen.map((k) => k.costPerResult));
    const duurste = [...breakdownRijen].sort((a, b) => b.costPerResult - a.costPerResult)[0];
    if (medCpr && duurste.costPerResult > medCpr * 1.8) {
      inzichten.push({
        _gewicht: 36,
        categorie: 'aandachtspunt',
        betrouwbaarheid: 'beperkt',
        titel: `Dure ${duurste.soort}: ${duurste.name}`,
        samenvatting: `${duurste.name} kost ${fmt.euro2(duurste.costPerResult)} per ${enkel}, ruim boven de mediaan (${fmt.euro2(medCpr)}).`,
        bewijs: [
          { label: duurste.name, waarde: `${fmt.euro(duurste.spend)} · ${fmt.getal(duurste.results)} ${meervoud} · ${fmt.euro2(duurste.costPerResult)}/${enkel}` },
          { label: 'Mediaan', waarde: fmt.euro2(medCpr) },
        ],
        actie: `Overweeg deze ${duurste.soort} te pauzeren of het bod te verlagen.`,
      });
    }
  }

  inzichten.sort((a, b) => (b._gewicht ?? 0) - (a._gewicht ?? 0));
  const opgeschoond = inzichten.map(({ _gewicht, ...rest }) => rest);
  return { primair: opgeschoond.slice(0, 3), aanvullend: opgeschoond.slice(3) };
}

/**
 * Budget & tempo: gecombineerde ad-uitgaven, gemiddeld per dag, de drukste dag,
 * en (als context) het aandeel van het account-budget. Puur uit de dagreeks,
 * dus robuust voor historische én lopende periodes.
 */
export function budgetTempo(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  if (!totaal) return null;
  // Het echte aantal dagen komt uit de periode (niet uit series.length: bij een
  // lange periode is de reeks verdicht tot minder, meerdaagse punten).
  const reeks = gecombineerdeReeks(platforms);
  const dagen = dashboard?.periode?.dagen ?? reeks.length;
  // De drukste dag is de kalenderdag met de hoogste uitgaven — alleen te bepalen
  // op dagniveau (bij een verdichte reeks tonen we hem niet).
  const drukste = (reeksIsDagelijks(reeks) && reeks.length)
    ? (() => { const d = [...reeks].sort((a, b) => b.spend - a.spend)[0]; return { name: toonKorteDatum(d.date), spend: d.spend }; })()
    : null;
  const accountBudget = dashboard?.budget?.budget ?? null;
  return {
    uitgaven: totaal.spend,
    dagen,
    gemiddeldPerDag: dagen ? totaal.spend / dagen : null,
    drukste,
    accountBudget,
    aandeelBudget: accountBudget ? (totaal.spend / accountBudget) * 100 : null,
  };
}
