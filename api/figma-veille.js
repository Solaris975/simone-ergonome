export default async function handler(req, res) {
    try {
        console.log("🕵️‍♀️ Lancement de la veille directe (Mode Brut)...");

        // 1. On tape directement à la source officielle (sans aucun intermédiaire)
        const rssUrl = "https://www.figma.com/blog/feed/atom.xml";
        
        // On se déguise en navigateur classique pour passer les sécurités de Figma
        const response = await fetch(rssUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "application/rss+xml, application/atom+xml, text/xml"
            }
        });

        // Si Figma bloque l'accès, Vercel nous affichera le vrai code d'erreur
        if (!response.ok) {
            return res.status(500).json({ error: `Figma a bloqué Simone : Erreur HTTP ${response.status}` });
        }

        const xmlText = await response.text();

        // 2. Découpage chirurgical du texte XML (Simone cherche le premier article)
        // Cette formule magique fonctionne pour tous les formats (RSS et Atom)
        const premierArticleMatch = xmlText.match(/<(entry|item)>([\s\S]*?)<\/\1>/i);
        
        if (!premierArticleMatch) {
            return res.status(500).json({ error: "Aucun article trouvé dans le code de la page." });
        }

        const articleContent = premierArticleMatch[2];
        
        // Extraction du titre
        const titleMatch = articleContent.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
        const titre = titleMatch ? titleMatch[1].trim() : "Mise à jour Figma détectée !";

        // Extraction de l'URL
        let lien = "https://www.figma.com/blog/";
        const hrefMatch = articleContent.match(/<link[^>]+href=["']([^"']+)["']/i);
        const textLinkMatch = articleContent.match(/<link[^>]*>([^<]*)<\/link>/i);
        
        if (hrefMatch && hrefMatch[1].startsWith('http')) {
            lien = hrefMatch[1];
        } else if (textLinkMatch && textLinkMatch[1].trim().startsWith('http')) {
            lien = textLinkMatch[1].trim();
        }

        // 3. Expédition directe vers Discord
        const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

        await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "Simone - Veille Figma",
                embeds: [{
                    title: `✨ Nouveau sur le blog Figma : ${titre}`,
                    url: lien,
                    description: "Simone a récupéré cette information directement à la source !",
                    color: 16733952,
                    footer: { text: "Lecture brute 100% indépendante" }
                }]
            })
        });

        return res.status(200).json({ message: "Veille directe expédiée avec succès !" });

    } catch (error) {
        return res.status(500).json({ error: "Erreur interne : " + error.message });
    }
}