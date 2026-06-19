import { verifyKey } from 'discord-interactions';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// Obligatoire pour laisser Discord vérifier la sécurité
export const config = {
    api: { bodyParser: false }
};

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    maxOutputTokens: 1024,
    temperature: 0.5,
    apiKey: process.env.GEMINI_API_KEY
});

export default async function handler(req, res) {
    // 1. On recale les navigateurs web
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    try {
        // 2. Lecture indestructible du corps de la requête (Le remède anti-Vercel)
        const rawBody = await new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });

        // 3. Le remède anti-bug absolu : suppression des espaces invisibles (.trim)
        const signature = req.headers['x-signature-ed25519'];
        const timestamp = req.headers['x-signature-timestamp'];
        const publicKey = (process.env.DISCORD_PUBLIC_KEY || '').trim();

        // 4. Vérification cryptographique stricte
        const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);

        if (!isValidRequest) {
            return res.status(401).json({ error: 'Signature invalide' });
        }

        const interaction = JSON.parse(rawBody);

        // 5. L'ÉPREUVE DU PING DE DISCORD (La réponse exacte qu'il attend)
        if (interaction.type === 1) {
            return res.status(200).json({ type: 1 });
        }

        // 6. Traitement de ta commande /resume
        if (interaction.type === 2 && interaction.data.name === 'resume') {
            const urlCible = interaction.data.options[0].value;

            // On dit immédiatement à Discord "J'ai bien reçu, je réfléchis"
            res.status(200).json({ type: 5 });

            // Traitement IA en arrière-plan
            try {
                const jinaRes = await fetch(`https://r.jina.ai/${urlCible}`);
                let textePage = await jinaRes.text();
                textePage = textePage.substring(0, 15000);

                const prompt = `Tu es Simone l'Ergonome. Résume cet article en 3 ou 4 puces. Lien : ${urlCible}. Contenu :\n\n${textePage}`;
                const reponseAI = await llm.invoke(prompt);

                // Envoi de la réponse finale à la place du message d'attente
                await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        embeds: [{
                            title: "⚡ Résumé express",
                            description: `**Source :** ${urlCible}\n\n${reponseAI.content}`,
                            color: 5814783
                        }]
                    })
                });
            } catch (erreur) {
                console.error("Erreur IA :", erreur);
            }
        }
    } catch (error) {
        console.error("Erreur globale :", error);
        return res.status(500).json({ error: 'Erreur interne' });
    }
}