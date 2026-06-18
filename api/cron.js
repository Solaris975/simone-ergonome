import Parser from 'rss-parser';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// L'initialisation du cerveau
const llm = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    maxOutputTokens: 1024,
    temperature: 0.7,
    apiKey: process.env.GEMINI_API_KEY
});

const parser = new Parser();

// Vercel exige une fonction "handler" qui agit comme une page web
export default async function handler(request, response) {
    try {
        const feed = await parser.parseURL('https://uxdesign.cc/feed');
        const dernierArticle = feed.items[0];
        
        const prompt = `Tu es Simone l'Ergonome, une experte UI/UX. 
        Voici le titre et la description d'un article récent : "${dernierArticle.title}" - ${dernierArticle.contentSnippet}.
        
        Rédige un résumé très court (3 puces maximum) en français. 
        Adopte un ton professionnel mais chaleureux et bienveillant. 
        Termine par un petit mot d'encouragement pour ma journée de designer.`;
        
        const reponseAI = await llm.invoke(prompt);
        const resume = reponseAI.content;

        const discordPayload = {
            content: `**🔔 La Veille Matinale de Simone l'Ergonome**\n\n**${dernierArticle.title}**\n${resume}\n\n👉 [Lire l'article complet](${dernierArticle.link})`
        };

        await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordPayload)
        });

        // On dit à Vercel "C'est bon, j'ai fini !"
        return response.status(200).json({ success: true, message: "Le rapport a été envoyé sur Discord !" });

    } catch (erreur) {
        return response.status(500).json({ success: false, message: erreur.message });
    }
}