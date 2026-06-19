import { verifyKey } from 'discord-interactions';

// On empêche Vercel de modifier le message pour que la sécurité cryptographique soit parfaite
export const config = {
    api: { bodyParser: false }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    try {
        // 1. Lecture ultra-rapide des données
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks); // On garde le format Buffer brut pour la sécurité

        // 2. Vérification de sécurité Discord
        const signature = req.headers['x-signature-ed25519'];
        const timestamp = req.headers['x-signature-timestamp'];
        const publicKey = (process.env.DISCORD_PUBLIC_KEY || '').trim();

        if (!signature || !timestamp) return res.status(401).json({ error: 'Headers manquants' });

        const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);

        if (!isValidRequest) {
            return res.status(401).json({ error: 'Signature invalide' });
        }

        // On transforme le Buffer en texte lisible
        const interaction = JSON.parse(rawBody.toString('utf8'));

        // ==========================================
        // 🏓 LE PING DISCORD (Réponse en 10 millisecondes !)
        // ==========================================
        if (interaction.type === 1) {
            return res.status(200).json({ type: 1 });
        }

        // ==========================================
        // 🚀 TA COMMANDE /RESUME
        // ==========================================
        if (interaction.type === 2 && interaction.data.name === 'resume') {
            const urlCible = interaction.data.options[0].value;

            // 1. On dit tout de suite à Discord qu'on a bien reçu, pour éviter le timeout de 3 secondes
            res.status(200).json({ type: 5 });

            // 2. SEULEMENT MAINTENANT, on charge le "cerveau" lourd de Gemini en arrière-plan
            try {
                // Importation dynamique : le fichier ne charge Langchain que si on en a besoin
                const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
                
                const llm = new ChatGoogleGenerativeAI({
                    model: "gemini-3-flash-preview",
                    maxOutputTokens: 1024,
                    temperature: 0.5,
                    apiKey: process.env.GEMINI_API_KEY
                });

                // Lecture de l'article avec Jina
                const jinaRes = await fetch(`https://r.jina.ai/${urlCible}`);
                let textePage = await jinaRes.text();
                textePage = textePage.substring(0, 15000); // Protection contre les articles trop longs

                // Création du résumé
                const prompt = `Tu es Simone l'Ergonome. On m'a envoyé ce lien : ${urlCible}.
                Résume le contenu de cette page web en 3 ou 4 puces claires et percutantes. 
                Adopte ton ton habituel d'experte UI/UX. Voici le contenu brut :\n\n${textePage}`;
                
                const reponseAI = await llm.invoke(prompt);

                // Envoi du résumé final pour remplacer le message d'attente
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
        console.error("Crash critique :", error);
        return res.status(500).json({ error: 'Erreur interne' });
    }
}