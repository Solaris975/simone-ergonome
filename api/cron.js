import Parser from 'rss-parser';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export const maxDuration = 120;

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    maxOutputTokens: 2048,
    temperature: 0.5,
    apiKey: process.env.GEMINI_API_KEY
});

// NOUVEAU : On donne au parser de nouvelles lunettes pour chercher les images
const parser = new Parser({
    customFields: {
        item: ['media:content', 'enclosure', 'content:encoded']
    }
});

export default async function handler(request, response) {
    try {
        const discordResponse = await fetch(`https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages?limit=15`, {
            headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });

        if (!discordResponse.ok) throw new Error("Impossible de lire le salon Discord.");
        const messages = await discordResponse.json();
        
        const liensFlux = messages
            .map(msg => msg.content.trim())
            .filter(content => content.startsWith('http'));

        if (liensFlux.length === 0) liensFlux.push('https://uxdesign.cc/feed');

        let tousLesArticles = [];
        const maintenant = Date.now();
        const unJourEnMillisecondes = 24 * 60 * 60 * 1000;

        for (const url of liensFlux) {
            try {
                const feed = await parser.parseURL(url);
                
                for (const item of feed.items) {
                    const datePublication = item.pubDate ? Date.parse(item.pubDate) : maintenant;
                    
                    if (maintenant - datePublication <= unJourEnMillisecondes) {
                        
                        // NOUVEAU : La chasse à l'image !
                        let urlImage = null;
                        if (item.enclosure && item.enclosure.url) {
                            urlImage = item.enclosure.url;
                        } else if (item['media:content'] && item['media:content'].$) {
                            urlImage = item['media:content'].$.url;
                        } else {
                            // Si elle est cachée dans le code HTML de l'article
                            const htmlContent = item['content:encoded'] || item.content || '';
                            const matchImage = htmlContent.match(/<img[^>]+src="([^">]+)"/);
                            if (matchImage) urlImage = matchImage[1];
                        }

                        tousLesArticles.push({
                            title: item.title,
                            snippet: item.contentSnippet || item.summary || "",
                            link: item.link,
                            source: feed.title || "Source Inconnue",
                            image: urlImage // On sauvegarde l'image trouvée
                        });
                    }
                }
            } catch (e) {
                console.log(`Erreur sur le flux ${url}, ignoré.`);
            }
        }

        if (tousLesArticles.length === 0) {
            return response.status(200).json({ success: true, message: "Aucun nouvel article depuis hier." });
        }

        const listeArticlesTexte = tousLesArticles.map((art, index) => 
            `[Article #${index + 1}]\nTitre: ${art.title}\nSource: ${art.source}\nDescription: ${art.snippet}\nLien: ${art.link}\n---`
        ).join("\n");

        const prompt = `Tu es Simone l'Ergonome, directrice de création et experte UI/UX. 
        Voici les articles des dernières 24h :\n\n${listeArticlesTexte}\n\n
        Sélectionne le Top 3 maximum. Rédige un vrai paragraphe détaillé (environ 10 lignes) en français pour chaque. 
        Mets impérativement le lien original sous la forme 👉 [Lire l'article complet](LIEN_EXACT) à la fin de chaque résumé.
        Ton total doit rester sous 1800 caractères.`;

        const reponseAI = await llm.invoke(prompt);
        let rapportFinal = reponseAI.content;

        // NOUVEAU : Trouver l'image du premier article dont parle Gemini
        let imageIllustration = null;
        const premierLienTrouve = rapportFinal.match(/https?:\/\/[^\s)]+/); // On cherche le 1er lien dans le texte
        if (premierLienTrouve) {
            const articleVedette = tousLesArticles.find(a => a.link === premierLienTrouve[0]);
            if (articleVedette && articleVedette.image) {
                imageIllustration = articleVedette.image;
            }
        }

        // NOUVEAU : On ajoute l'image à notre carte Discord
        const discordPayload = {
            embeds: [{
                title: "📰 La Revue de Presse UI/UX de Simone",
                description: rapportFinal.substring(0, 4000),
                color: 16753920,
                image: imageIllustration ? { url: imageIllustration } : null // Ajout de la bannière si on l'a trouvée !
            }]
        };

        const discordReq = await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordPayload)
        });

        if (!discordReq.ok) throw new Error(`Erreur Discord : ${await discordReq.text()}`);

        return response.status(200).json({ success: true, message: "Revue de presse avec image envoyée !" });

    } catch (erreur) {
        return response.status(500).json({ success: false, message: erreur.message });
    }
}