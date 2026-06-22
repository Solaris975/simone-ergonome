export default async function handler(req, res) {
    try {
        console.log("🕵️‍♀️ Lancement de la veille Figma...");

        // 1. Nouvelle source : Le flux RSS officiel des annonces Figma
        const rssUrl = "https://forum.figma.com/c/announcements/15.rss";
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!data || !data.items || data.items.length === 0) {
            return res.status(500).json({ error: "Impossible de lire le flux Figma." });
        }

        // 2. On isole la toute dernière annonce
        const dernierArticle = data.items[0];

        // 3. Préparation et envoi vers Discord
        const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

        await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "Simone l'Ergonome",
                embeds: [{
                    title: `✨ Nouvelle mise à jour : ${dernierArticle.title}`,
                    url: dernierArticle.link,
                    description: "Figma vient de publier une nouvelle annonce officielle !",
                    color: 16733952, // Orange/Rouge Figma
                    footer: { text: "Veille automatique Figma" }
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