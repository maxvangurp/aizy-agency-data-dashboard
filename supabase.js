/**
 * Read-only client voor het Supabase-project van de Marketing OS.
 *
 * Dit dashboard is de gebruikerslaag; `max-marketing-os` haalt de
 * advertentiedata op, normaliseert hem en schrijft hem naar Supabase. Hier
 * wordt alleen gelezen. Die richting is expres: twee schrijvers op dezelfde
 * tabellen betekent twee waarheden, en dan is de vraag welke van de twee klopt
 * niet meer te beantwoorden.
 *
 * Geen `@supabase/supabase-js`. Die library doet auth, realtime en storage; wij
 * lezen rijen. Het geharde `api`-schema van dat project is aan deze kant niet
 * meer dan een `Accept-Profile`-header.
 *
 * Ontbreken de omgevingsvariabelen, dan is dat geen fout maar een toestand:
 * `beschikbaar()` geeft false en de server valt terug op wat hij al deed.
 */

const STANDAARD_SCHEMA = 'api';

const VEREISTE_SLEUTELS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

/** Welke sleutels ontbreken. Leest nooit een waarde uit. */
function ontbrekendeSleutels(env = process.env) {
  return VEREISTE_SLEUTELS.filter((naam) => !String(env?.[naam] ?? '').trim());
}

function beschikbaar(env = process.env) {
  return ontbrekendeSleutels(env).length === 0 && !sleutelProbleem(env);
}

/**
 * Welk soort sleutel is dit, te zien aan de vorm?
 *
 * Het sleutelscherm van Supabase toont er twee die op elkaar lijken, en de
 * verkeerde kiezen kost tijd: de publishable key geeft in het geharde
 * api-schema een 401 met "Invalid API key", en die melding vertelt je niet
 * wélke je gepakt hebt. Kijkt alleen naar de vorm, nooit naar de inhoud.
 */
function sleutelSoort(sleutel) {
  const s = String(sleutel ?? '').trim();
  if (s.startsWith('sb_secret_')) return 'secret';
  if (s.startsWith('sb_publishable_')) return 'publishable';
  // De klassieke anon en service_role zijn allebei JWT's; welke van de twee
  // het is valt aan de buitenkant niet te zien, dus die laten we door.
  if (s.startsWith('eyJ')) return 'secret';
  return 'onbekend';
}

/** Beschrijft wat er mis is met de sleutel, of null als de vorm klopt. */
function sleutelProbleem(env = process.env) {
  const sleutel = String(env?.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!sleutel) return null; // dat meldt ontbrekendeSleutels al
  const soort = sleutelSoort(sleutel);
  if (soort === 'secret') return null;
  if (soort === 'publishable') {
    return 'SUPABASE_SERVICE_ROLE_KEY bevat een publishable key (sb_publishable_...). '
      + 'Die is voor de browser en heeft in het geharde api-schema geen rechten. '
      + 'Neem de secret key uit Project Settings > API Keys > Secret keys.';
  }
  return 'SUPABASE_SERVICE_ROLE_KEY heeft geen herkenbare vorm. Verwacht sb_secret_... '
    + 'of een JWT die met eyJ begint.';
}

/**
 * Knipt een meegeleverde `/rest/v1` van de URL af.
 *
 * Supabase toont in de console zowel de project-URL als de volledige REST-URL.
 * Zonder deze correctie wordt het `/rest/v1/rest/v1` en krijg je een 404 die
 * naar het schema wijst in plaats van naar de URL.
 */
function basisUrl(url) {
  return String(url).trim().replace(/\/+$/, '').replace(/\/rest\/v\d+$/i, '');
}

function maakSupabase({
  url = process.env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  schema = process.env.SUPABASE_SCHEMA || STANDAARD_SCHEMA,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!url || !serviceRoleKey) {
    throw new Error(
      `Supabase niet geconfigureerd. Zet ${VEREISTE_SLEUTELS.join(' en ')} in .env.`
    );
  }
  const basis = `${basisUrl(url)}/rest/v1`;
  const redigeer = maakRedactie(serviceRoleKey);

  /** Rijen lezen. `filters` is kolom -> waarde (gelijkheid), tenzij de waarde al een operator bevat. */
  async function lees(tabel, { kolommen = '*', filters = {}, order = null, limiet = null } = {}) {
    const query = new URLSearchParams({ select: kolommen });
    for (const [kolom, waarde] of Object.entries(filters)) {
      query.append(kolom, /^[a-z]+\./.test(String(waarde)) ? String(waarde) : `eq.${waarde}`);
    }
    if (order) query.append('order', order);
    if (limiet != null) query.append('limit', String(limiet));

    const antwoord = await fetchImpl(`${basis}/${tabel}?${query}`, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'accept-profile': schema,
      },
    });

    const tekst = await antwoord.text().catch(() => '');
    if (!antwoord.ok) throw vertaalFout(antwoord.status, tekst, { tabel, schema, redigeer });
    try {
      return JSON.parse(tekst || '[]');
    } catch {
      throw new Error(`Supabase gaf geen JSON terug op ${tabel}.`);
    }
  }

  return { schema, lees, beschrijf: () => ({ url: basis, schema }) };
}

function maakRedactie(geheim) {
  return (tekst) => (typeof geheim === 'string' && geheim.length >= 8
    ? String(tekst ?? '').split(geheim).join('[weggelaten]')
    : String(tekst ?? ''));
}

/**
 * Vertaalt de twee fouten die je hier echt tegenkomt.
 *
 * Een 401 betekent bijna altijd de verkeerde sleutel; een 403 met "permission
 * denied for schema" betekent juist dat de sleutel klópt maar dat de rol geen
 * GRANT heeft — service_role omzeilt Row Level Security, maar geen GRANTs.
 */
function vertaalFout(status, tekst, { tabel, schema, redigeer }) {
  const bericht = redigeer(tekst).slice(0, 300);
  if (/permission denied for schema/i.test(bericht)) {
    return new Error(
      `Supabase weigert schema "${schema}" (${status}). De sleutel klopt, maar de rol mist USAGE. `
      + 'Draai migratie 013_service_role_grants.sql in het Supabase-project.'
    );
  }
  if (status === 401 || status === 403) {
    return new Error(
      `Supabase weigert de toegang (${status}) op ${tabel}. Gebruik de secret key `
      + `(sb_secret_… of de service_role JWT), niet de publishable key. ${bericht}`
    );
  }
  if (status === 404) {
    return new Error(
      `Supabase kent ${tabel} niet (404). Staat die view in schema "${schema}" en is dat schema `
      + `geëxposeerd onder Data API > Settings? ${bericht}`
    );
  }
  return new Error(`Supabase gaf ${status} op ${tabel}. ${bericht}`);
}

module.exports = {
  VEREISTE_SLEUTELS, ontbrekendeSleutels, beschikbaar, basisUrl, maakSupabase,
  sleutelSoort, sleutelProbleem,
};
