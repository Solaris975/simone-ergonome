import Parser from 'rss-parser';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    maxOutputTokens: 1024,
    temperature: 0.7,
    apiKey: process.env.GEMINI_API_KEY
});

const parser = new Parser();

export default async function handler(request, response) {
    try {
        // 1. Simone met ses lunettes et lit les derniers messages de ton salon
        const discordResponse = await fetch(`https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages?limit=10`, {
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`
            }
        });

        if (!discordResponse.ok) {
            throw new Error("Simone n'arrive pas à lire le salon Discord.");
        }

        const messages = await discordResponse.json();
        
        // 2. Elle filtre uniquement les messages qui ressemblent à des liens
        const liensDisponibles = messages
            .map(msg => msg.content.trim())
            .filter(content => content.startsWith('http'));

        // Par sécurité, si le salon est vide, elle lit son journal habituel
        let urlFlux = 'https://uxdesign.cc/feed'; 
        if (liensDisponibles.length > 0) {
            // Elle tire un lien au sort parmi ceux qu'elle a trouvés !
            urlFlux = liensDisponibles[Math.floor(Math.random() * liensDisponibles.length)];
        }

        // 3. Elle lit l'article du flux sélectionné
        const feed = await parser.parseURL(urlFlux);
        const dernierArticle = feed.items[0];
        
        // 4. Elle prépare sa synthèse
        const prompt = `Tu es Simone l'Ergonome, une experte UI/UX. 
        Voici le titre et la description d'un article récent : "${dernierArticle.title}" - ${dernierArticle.contentSnippet}.
        
        Rédige un résumé très court (3 puces maximum) en français. 
        Adopte un ton professionnel mais chaleureux et bienveillant. 
        Termine par un petit mot d'encouragement pour ma journée de designer.`;
        
        const reponseAI = await llm.invoke(prompt);
        const resume = reponseAI.content;

        // 5. Elle t'envoie le résultat via sa bouche (le Webhook)
        const discordPayload = {
            content: `**🔔 La Veille Matinale de Simone l'Ergonome**\n*Source : ${urlFlux}*\n\n**${dernierArticle.title}**\n${resume}\n\n👉 [Lire l'article complet](${dernierArticle.link})`
        };

        await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordPayload)
        });

        return response.status(200).json({ success: true, message: "Le rapport a été envoyé !" });

    } catch (erreur) {
        return response.status(500).json({ success: false, message: erreur.message });
    }
}