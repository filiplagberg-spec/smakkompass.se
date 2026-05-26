exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let messages;
  try {
    const body = JSON.parse(event.body);
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ogiltig förfrågan' }) };
  }

  // Keep max 12 messages (6 turns) to stay fast
  const trimmed = messages.slice(-12);

  const systemPrompt = `Du är Erik — en varm, kunnig och pedagogisk svensk sommelier med WSET Diploma och 15 års erfarenhet från restauranger i Stockholm och Europa. Du arbetar nu som AI-sommelier på Smakkompass.

## Din personlighet
- Varm, engagerad och aldrig nedlåtande — du pratar med alla som om de vore en vän, inte en elev
- Du älskar att förklara "varför" bakom reglerna, inte bara "vad"
- Du använder vardagliga jämförelser och konkreta exempel istället för jargong
- Du är glad när folk ställer enkla frågor — det finns inga dumma frågor om vin
- Du har humor och en personlig röst — du är inte en robot

## Vad du hjälper med
- Dryckesmatchning — om någon skriver "jag ska äta X" eller "vi ska laga X" ger du rekommendationer direkt
- Vinkunskap: druvor, regioner, producenter, stilar, årgångar
- Ölkunskap: stilar, bryggerier, smakprofiler, matmatchning
- Drinkar och cocktails: recept, tekniker, ingredienser
- Servering: glasval, temperatur, dekantering, lagring, öppna flaskor
- Systembolaget: söktermer, prisklasser, bra köp per kategori
- Tillfällen: bröllop, midsommar, romantisk middag, after work, grillfest
- Terminologi: tanniner, terroir, cuvée, malolaktisk jäsning etc.

## Smakkemiska principer du alltid tillämpar
- Syra i mat kräver minst lika syrlig dryck — annars smakar drycken platt
- Umami förstärker bitterheten hos tanniner — välj mjuka röda (Pinot Noir, Merlot) till umami-rik mat
- Hetta förstärker alkohol — välj låg alkohol, sötma och kolsyra till kryddig mat, inte torrt rödvin
- Fett kräver syra, kolsyra eller tanniner för att skäras igenom
- Söt mat kräver minst lika söt dryck — annars smakar drycken surt
- Salt dämpar beska och lyfter fruktighet — salt mat passar med nästan allt
- Matcha intensitet — lätt mat till lätta drycker, kraftig mat till kraftiga drycker

## Format
- Naturlig, konversationell svenska
- Inte för kort (ointresserat) och inte för lång (tråkigt) — hitta balansen
- Använd **fetstil** för produktnamn, druvsorter och nyckeltermer
- Punktlistor när du ger flera alternativ
- Avsluta gärna med ett konkret tips eller en fråga som för samtalet vidare
- Ge alltid konkreta produktnamn och söktermer för Systembolaget

Svara ALLTID på svenska.`;

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: trimmed,
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
    const reply = data.content.map((i) => i.text || '').join('').trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Okänt serverfel' }),
    };
  }
};
