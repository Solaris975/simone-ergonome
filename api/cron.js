import Parser from 'rss-parser';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// On maintient la sécurité contre le timeout de Vercel
export const maxDuration = 120;

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    maxOutputTokens: 2048, // Augmenté pour permettre des résumés plus longs
    temperature: 0.5, // Un peu plus bas pour être plus rigoureux sur le tri
    apiKey: process.env.GEMINI_API_KEY
});

const parser = new Parser();

export default async function handler(request, response) {
    try {
        // 1. Récupérer les sources sur Discord
        const discordResponse = await fetch(`https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages?limit=15`, {
            headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });

        if (!discordResponse.ok) throw new Error("Impossible de lire le salon Discord.");
        const messages = await discordResponse.json();
        
        const liensFlux = messages
            .map(msg => msg.content.trim())
            .filter(content => content.startsWith('http'));

        if (liensFlux.length === 0) {
            // Sécurité si salon vide
            liensFlux.push('https://uxdesign.cc/feed');
        }

        // 2. Parcourir TOUS les flux en même temps pour collecter les articles
        let tousLesArticles = [];
        const maintenant = Date.now();
        const unJourEnMillisecondes = 24 * 60 * 60 * 1000;

        for (const url of liensFlux) {
            try {
                const feed = await parser.parseURL(url);
                
                for (const item of feed.items) {
                    const datePublication = item.pubDate ? Date.parse(item.pubDate) : maintenant;
                    
                    // FILTRE : Est-ce que l'article a moins de 24 heures ?
                    if (maintenant - datePublication <= unJourEnMillisecondes) {
                        tousLesArticles.push({
                            title: item.title,
                            snippet: item.contentSnippet || item.summary || "",
                            link: item.link,
                            source: feed.title || "Source Inconnue"
                        });
                    }
                }
            } catch (e) {
                console.log(`Erreur sur le flux ${url}, ignoré.`);
            }
        }

        // Cas où aucun article n'a été publié ces dernières 24h
        if (tousLesArticles.length === 0) {
            return response.status(200).json({ success: true, message: "Aucun nouvel article depuis hier." });
        }

        // 3. Préparer les données pour le "Rédacteur en chef" Gemini
        const listeArticlesTexte = tousLesArticles.map((art, index) => 
            `[Article #${index + 1}]\nTitre: ${art.title}\nSource: ${art.source}\nDescription: ${art.snippet}\nLien: ${art.link}\n---`
        ).join("\n");

        const prompt = `Tu es Simone l'Ergonome, directrice de création et experte UI/UX de haut niveau. 
        Voici la liste des articles publiés ces dernières 24 heures dans notre réseau de veille :\n\n${listeArticlesTexte}\n\n
        
        Ta mission :
        1. Analyse ces articles et sélectionne uniquement les plus importants/pertinents pour un designer (Maximum 3 articles).
        2. Classe-les par ordre d'importance décroissante.
        3. Pour CHAQUE article sélectionné, rédige un compte-rendu approfondi et détaillé d'environ 10 lignes en français. Ne fais pas de puces courtes, fais de vrais paragraphes structurés qui expliquent le fond, la méthodologie ou la tendance évoquée.
        4. Conserve obligatoirement une ligne claire avec le lien original au format : 👉 [Lire l'article complet](LIEN_DE_L_ARTICLE) juste après son résumé.
        
        Adopte un ton d'experte passionnée, pointue, mais chaleureuse. Commande ton rapport avec un titre percutant. Attention, le total de ta réponse doit rester sous la barre des 1800 caractères pour ne pas saturer Discord.`;

        // 4. Demander à l'IA de synthétiser la grande revue
        const reponseAI = await llm.invoke(prompt);
        let rapportFinal = reponseAI.content;

        // 5. Envoyer la grande revue sur Discord
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: rapportFinal })
        });

        return response.status(200).json({ success: true, message: "La grande revue de presse a été envoyée !" });

    } catch (erreur) {
        return response.status(500).json({ success: false, message: erreur.message });
    }
}