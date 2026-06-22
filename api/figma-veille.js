export default async function handler(req, res) {
    try {
        console.log("🕵️‍♀️ Lancement de la veille Figma...");

        // 1. On lit le flux RSS officiel de Figma grâce à un convertisseur JSON public
        const rssUrl = "https://www.figma.com/blog/feed/";
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!data || !data.items || data.items.length === 0) {
            return res.status(500).json({ error: "Impossible de lire le flux Figma." });
        }

        // 2. On isole le tout dernier article publié
        const dernierArticle = data.items[0];

        // 3. Préparation et envoi du colis vers Discord
        const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

        await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "Simone - Veille Figma",
                embeds: [{
                    title: `✨ Nouvelle publication : ${dernierArticle.title}`,
                    url: dernierArticle.link,
                    description: "Un nouvel article vient d'être publié par l'équipe Figma !",
                    color: 16733952, // Couleur inspirée de l'interface Figma
                    thumbnail: { url: dernierArticle.thumbnail },
                    footer: { text: "Détecté par Simone" }
                }]
            })
        });

        console.log("✅ Article envoyé sur Discord !");
        return res.status(200).json({ message: "Veille expédiée avec succès !" });

    } catch (error) {
        console.error("❌ Erreur pendant la veille :", error);
        return res.status(500).json({ error: "Erreur interne du serveur" });
    }
}