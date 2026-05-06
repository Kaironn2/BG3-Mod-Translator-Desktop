import { translateText } from '../main/services/deepl.service'

async function main() {
  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPL_API_KEY não definida");
  }

  const result = await translateText('Fireball triggers &lt;LSTag Type="Spell" Tooltip="Target_AnimateDead"&gt;Animate Dead&lt;/LSTag&gt;', 'en', 'pt-BR', apiKey, "Baldur's Gate 3 Spell");
  console.log(result);
}

main();
