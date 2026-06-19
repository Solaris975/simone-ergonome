import { verifyKey } from 'discord-interactions';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    try {
        // 1. La méthode de lecture qui a fonctionné dans tes logs
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString('utf8');

        // 2. La validation de sécurité
        const signature = req.headers['x-signature-ed25519'];
        const timestamp = req.headers['x-signature-timestamp'];
        const publicKey = process.env.DISCORD_PUBLIC_KEY;

        const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);

        if (!isValidRequest) {
            return res.status(401).json({ error: 'Signature invalide' });
        }

        const interaction = JSON.parse(rawBody);

        // 3. LA CORRECTION VITALE : L'enveloppe JSON stricte
        if (interaction.type === 1) {
            return res.status(200).json({ type: 1 });
        }

        // 4. Traitement de ta commande /resume
        if (interaction.type === 2 && interaction.data.name === 'resume') {
            const urlCible = interaction.data.options[0].value;

            // On répond instantanément pour rassurer Discord
            res.status(200).json({ type: 5 });

            // Le travail de Simone en arrière-plan
            try {
                const jinaRes = await fetch(`https://r.jina.ai/${urlCible}`);
                let textePage = await jinaRes.text();
                textePage = textePage.substring(0, 15000);

                const prompt = `Tu es Simone l'Ergonome. On m'a envoyé ce lien : ${urlCible}.
                Résume le contenu de cette page web en 3 ou 4 puces claires et percutantes. 
                Adopte ton ton habituel d'experte UI/UX. Voici le contenu brut :\n\n${textePage}`;
                
                const reponseAI = await llm.invoke(prompt);

                // L'envoi du résumé sur ton serveur
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
        console.error("Erreur Serveur :", error);
        return res.status(500).json({ error: 'Erreur interne' });
    }
}