import { verifyKey } from 'discord-interactions';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// Obligatoire pour laisser Discord vérifier la signature de sécurité
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
    // 1. On bloque les curieux qui n'utilisent pas la bonne méthode
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    try {
        console.log("📥 Nouvelle requête reçue de Discord !");

        // 2. Lecture ultra-sécurisée du message de Discord
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString('utf8');
        
        // 3. Vérification cryptographique
        const signature = req.headers['x-signature-ed25519'];
        const timestamp = req.headers['x-signature-timestamp'];

        const isValidRequest = verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY);

        if (!isValidRequest) {
            console.error("❌ Échec : La signature ne correspond pas à la clé publique.");
            return res.status(401).json({ error: 'Signature invalide' });
        }

        console.log("✅ Signature valide, ouverture du paquet...");
        const interaction = JSON.parse(rawBody);

        // 4. L'ÉPREUVE DU PING (C'est ici que ça bloquait)
        if (interaction.type === 1) {
            console.log("🏓 Ping Discord reçu, renvoi de l'accusé de réception strict...");
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).send(JSON.stringify({ type: 1 }));
        }

        // 5. Traitement de ta commande /resume
        if (interaction.type === 2 && interaction.data.name === 'resume') {
            console.log("🚀 Commande /resume déclenchée par l'utilisateur !");
            const urlCible = interaction.data.options[0].value;

            // On demande à Discord de patienter (Type 5 = "Simone réfléchit...")
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(JSON.stringify({ type: 5 }));

            // On lance la lecture de l'article en arrière-plan
            try {
                const jinaRes = await fetch(`https://r.jina.ai/${urlCible}`);
                let textePage = await jinaRes.text();
                textePage = textePage.substring(0, 15000); // Limite de mémoire

                const prompt = `Tu es Simone l'Ergonome. On m'a envoyé ce lien : ${urlCible}.
                Résume le contenu de cette page web en 3 ou 4 puces claires et percutantes. 
                Adopte ton ton habituel d'experte UI/UX. Voici le contenu brut :\n\n${textePage}`;
                
                const reponseAI = await llm.invoke(prompt);

                // On envoie le résultat final pour remplacer le "Simone réfléchit..."
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
                console.log("✅ Résumé envoyé avec succès sur Discord !");
            } catch (erreur) {
                console.error("❌ Erreur pendant la génération du résumé :", erreur);
            }
            return; 
        }

        console.warn("⚠️ Type d'interaction inconnu :", interaction.type);
        return res.status(400).json({ error: 'Type inconnu' });

    } catch (error) {
        console.error("🔥 Crash critique du serveur :", error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}