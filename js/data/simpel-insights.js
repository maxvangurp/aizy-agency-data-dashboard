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
import { combineerTotalen, alleCampagnes, adDeltas, perWeekdag } from './ads-data.js';

/** Betrouwbaarheid op basis van het resultaatvolume. */
function betrouwbaarheidVanVolume(results) {
  if (results >= 30) return 'hoog';
  if (results >= 10) return 'redelijk';
  return 'beperkt';
}

const METRIEK_LABEL = {
  spend: 'uitgaven', impressions: 'vertoningen', clicks: 'klikken', ctr: 'doorklikratio',
  cpc: 'kosten per klik', cpm: 'CPM', results: 'resultaten', costPerResult: 'kosten per resultaat',
  conversieratio: 'conversieratio', roas: 'ROAS', revenue: 'omzet',
};

/**
 * Bouwt de ad-inzichten. Geeft `{ primair, aanvullend }` terug, gesorteerd op
 * urgentie (aandachtspunten eerst, dan kansen, dan ontwikkelingen).
 */
export function bouwAdInzichten(dashboard, platforms) {
  const totaal = combineerTotalen(platforms);
  if (!totaal) return { primair: [], aanvullend: [] };

  const rlabel = (totaal.resultLabel ?? 'resultaten').toLowerCase();
  const campagnes = alleCampagnes(platforms);
  const deltas = adDeltas(dashboard, totaal);
  const zeker = betrouwbaarheidVanVolume(totaal.results);
  const inzichten = [];

  /* 1. Verspild budget: campagnes met uitgaven maar geen resultaat. */
  const verspild = campagnes.filter((c) => (c.spend ?? 0) > 0 && !(c.results > 0));
  if (verspild.length) {
    const som = verspild.reduce((s, c) => s + (c.spend ?? 0), 0);
    const aandeel = totaal.spend ? (som / totaal.spend) * 100 : null;
    inzichten.push({
      _gewicht: 100 + (aandeel ?? 0),
      categorie: 'aandachtspunt',
      betrouwbaarheid: zeker,
      titel: `${fmt.euro(som)} ging naar campagnes zonder ${rlabel}`,
      samenvatting: `${verspild.length} ${verspild.length === 1 ? 'campagne besteedde' : 'campagnes besteedden'} budget zonder één ${rlabel.replace(/s$/, '')}${aandeel != null ? `, ${fmt.procent(aandeel)} van de totale uitgaven` : ''}.`,
      bewijs: verspild.slice(0, 4).map((c) => ({ label: c.name, waarde: `${fmt.euro(c.spend)} · 0 ${rlabel}` })),
      herkomst: 'Campagnes met uitgaven in de periode maar zonder geregistreerd resultaat.',
      actie: 'Pauzeer of herzie deze campagnes en verschuif het budget naar wat wél levert.',
    });
  }

  /* 2. Grootste verandering t.o.v. de vorige periode. */
  const kandidaten = ['results', 'costPerResult', 'spend', 'ctr', 'roas'];
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
      betrouwbaarheid: zeker,
      titel: `${label.charAt(0).toUpperCase()}${label.slice(1)} ${gestegen ? 'omhoog' : 'omlaag'} met ${Math.abs(d.procent).toFixed(1)}%`,
      samenvatting: `Dit is de grootste verschuiving t.o.v. de vorige periode over Meta en Google samen.`,
      bewijs: [{ label: 'Verandering', waarde: `${d.tekst} t.o.v. de vorige periode` }],
      herkomst: 'Vergelijking van de gecombineerde ad-totalen met de vorige periode van gelijke lengte.',
    });
  }

  /* 3. Beste en duurste campagne op kosten/resultaat. */
  const metResultaat = campagnes.filter((c) => c.results > 0 && c.costPerResult != null);
  if (metResultaat.length >= 2 && totaal.costPerResult != null) {
    const gesorteerd = [...metResultaat].sort((a, b) => a.costPerResult - b.costPerResult);
    const beste = gesorteerd[0];
    const duurste = gesorteerd[gesorteerd.length - 1];
    const onder = totaal.costPerResult ? (1 - beste.costPerResult / totaal.costPerResult) * 100 : null;
    const boven = totaal.costPerResult ? (duurste.costPerResult / totaal.costPerResult - 1) * 100 : null;

    inzichten.push({
      _gewicht: 55 + (onder ?? 0),
      categorie: 'kans',
      betrouwbaarheid: zeker,
      titel: `${beste.name} levert het goedkoopste resultaat`,
      samenvatting: `${fmt.euro2(beste.costPerResult)} per ${rlabel.replace(/s$/, '')}${onder != null && onder > 0 ? `, ${fmt.procent(onder)} onder het gemiddelde` : ''}.`,
      bewijs: [
        { label: beste.name, waarde: `${fmt.euro2(beste.costPerResult)} · ${fmt.getal(beste.results)} ${rlabel}` },
        { label: 'Gemiddeld', waarde: fmt.euro2(totaal.costPerResult) },
      ],
      actie: 'Overweeg meer budget naar deze campagne te verschuiven.',
    });

    if (boven != null && boven > 20) {
      inzichten.push({
        _gewicht: 50 + boven,
        categorie: 'aandachtspunt',
        betrouwbaarheid: zeker,
        titel: `${duurste.name} heeft de duurste conversies`,
        samenvatting: `${fmt.euro2(duurste.costPerResult)} per ${rlabel.replace(/s$/, '')}, ${fmt.procent(boven)} boven het gemiddelde.`,
        bewijs: [
          { label: duurste.name, waarde: `${fmt.euro2(duurste.costPerResult)} · ${fmt.getal(duurste.results)} ${rlabel}` },
          { label: 'Gemiddeld', waarde: fmt.euro2(totaal.costPerResult) },
        ],
        actie: 'Controleer targeting en biedingen van deze campagne, of verlaag het budget.',
      });
    }
  }

  /* 4. Beste dag van de week op kosten/resultaat. */
  const weekdagen = perWeekdag(platforms).filter((d) => d.results > 0 && d.costPerResult != null);
  if (weekdagen.length >= 3 && totaal.costPerResult != null) {
    const beste = [...weekdagen].sort((a, b) => a.costPerResult - b.costPerResult)[0];
    const onder = totaal.costPerResult ? (1 - beste.costPerResult / totaal.costPerResult) * 100 : null;
    if (onder != null && onder > 8) {
      inzichten.push({
        _gewicht: 40 + onder,
        categorie: 'kans',
        betrouwbaarheid: zeker,
        titel: `${beste.name} is de sterkste dag`,
        samenvatting: `Op ${beste.name.toLowerCase()} is een ${rlabel.replace(/s$/, '')} het goedkoopst: ${fmt.euro2(beste.costPerResult)}.`,
        bewijs: [
          { label: beste.name, waarde: `${fmt.euro2(beste.costPerResult)} · ${fmt.getal(beste.results)} ${rlabel}` },
          { label: 'Gemiddeld', waarde: fmt.euro2(totaal.costPerResult) },
        ],
        actie: 'Overweeg meer budget in te plannen rond de sterkste dagen.',
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
  const dagen = platforms?.meta?.series?.length || platforms?.google?.series?.length || 0;
  const weekdagen = perWeekdag(platforms);
  const drukste = weekdagen.length ? [...weekdagen].sort((a, b) => b.spend - a.spend)[0] : null;
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
