import { verifyKey } from 'discord-interactions';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// Vercel a besoin de recevoir les données brutes pour que la sécurité Discord fonctionne
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
    let data = '';
    for await (const chunk of req) { data += chunk; }
    return data;
}

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    maxOutputTokens: 1024,
    temperature: 0.5,
    apiKey: process.env.GEMINI_API_KEY
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    // 1. VÉRIFICATION DE SÉCURITÉ DISCORD
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const rawBody = await getRawBody(req);

    const isValidRequest = verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY);
    if (!isValidRequest) return res.status(401).end('Signature invalide');

    const interaction = JSON.parse(rawBody);

    // Type 1 : Ping de vérification initial de Discord
    if (interaction.type === 1) return res.status(200).json({ type: 1 });

    // Type 2 : Quelqu'un a tapé une Slash Command !
    if (interaction.type === 2 && interaction.data.name === 'resume') {
        const urlCible = interaction.data.options[0].value;

        // Discord exige une réponse en moins de 3 secondes. 
        // On répond donc immédiatement "Je réfléchis..." (Type 5)
        res.status(200).json({ type: 5 });

        // --- TRAITEMENT EN ARRIÈRE-PLAN ---
        try {
            // L'astuce magique : r.jina.ai transforme une page web complexe en texte brut !
            const jinaRes = await fetch(`https://r.jina.ai/${urlCible}`);
            let textePage = await jinaRes.text();
            
            // On limite la taille pour ne pas surcharger Gemini
            textePage = textePage.substring(0, 15000);

            const prompt = `Tu es Simone l'Ergonome. On m'a envoyé ce lien : ${urlCible}.
            Résume le contenu de cette page web en 3 ou 4 puces claires et percutantes. 
            Adopte ton ton habituel d'experte UI/UX. Voici le contenu brut de la page :\n\n${textePage}`;
            
            const reponseAI = await llm.invoke(prompt);

            // On modifie le message "Je réfléchis..." par le résumé final
            await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: "⚡ Résumé express",
                        description: `**Source :** ${urlCible}\n\n${reponseAI.content}`,
                        color: 5814783 // Un petit bleu sympa
                    }]
                })
            });
        } catch (erreur) {
            console.error(erreur);
        }
    }
}