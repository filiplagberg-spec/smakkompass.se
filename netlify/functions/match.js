exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let ratt, detaljniva;
  try {
    const body = JSON.parse(event.body);
    ratt = body.ratt;
    detaljniva = body.detaljniva || 'normal';
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ogiltig förfrågan' }) };
  }

  if (!ratt || ratt.trim().length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ingen rätt angiven' }) };
  }

  const antalViner = detaljniva === 'enkel' ? 1 : detaljniva === 'detaljerad' ? 3 : 2;

  const systemPrompt = `Du är en erfaren svensk sommelier. Rekommendera drycker till en maträtt.

REGLER:
- Svara ENBART med giltig JSON, inga backticks, ingen annan text
- Rekommendera verkliga produkter som säljs på Systembolaget
- Varje "varfor" ska förklara smakkemisk koppling (syra, tannin, fett, umami etc)
- Håll alla textsträngar KORTA — max 2 meningar per fält
- Ge exakt ${antalViner} vinförslag

JSON-format (följ exakt):
{
  "ratt": "kort namn max 5 ord",
  "smakprofil": "en mening om rätten",
  "dominerandeSmaker": ["ord1","ord2","ord3"],
  "viner": [
    {
      "namn": "produktnamn",
      "producent": "producent",
      "typ": "Rödvin/Vitt vin/Rosévin/Mousserande",
      "druva": "druvsort",
      "region": "region, land",
      "pris_sek": "ca XXX kr",
      "artikelnr": null,
      "systembolaget_sok": "sökord",
      "varfor": "kort smakkemisk förklaring"
    }
  ],
  "ol": {
    "namn": "produktnamn",
    "bryggeri": "bryggeri",
    "typ": "öltyp",
    "land": "land",
    "pris_sek": "ca XXX kr",
    "artikelnr": null,
    "systembolaget_sok": "sökord",
    "varfor": "kort smakkemisk förklaring"
  },
  "drinkar": [
    {
      "namn": "drinknamn",
      "varfor": "kort koppling till rätten",
      "recept": {
        "ingredienser": ["4 cl spirits","2 cl juice","fyll på med soda"],
        "instruktion": "Kort instruktion i en mening."
      }
    }
  ],
  "alkoholfritt": {
    "namn": "produktnamn",
    "beskrivning": "vad det är",
    "pris_sek": "ca XXX kr",
    "artikelnr": null,
    "systembolaget_sok": "sökord eller null",
    "varfor": "kort smakkemisk förklaring"
  },
  "sommelierTips": "ett oväntat insidertips i en mening"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1800,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Rätten: ${ratt.trim()}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: err.error?.message || `API-fel ${response.status}` }),
      };
    }

    const data = await response.json();
    let text = data.content.map((i) => i.text || '').join('').trim();

    // Strip markdown fences if present
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    // Validate JSON
    JSON.parse(text);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: text,
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'AI returnerade ogiltigt svar — försök igen.' }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Okänt serverfel' }),
    };
  }
};
