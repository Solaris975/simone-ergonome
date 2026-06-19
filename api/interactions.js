// Aucune importation complexe, on bypass tout
export const config = {
    api: { bodyParser: false }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    try {
        console.log("📥 [TEST KAMIKAZE] Requête frappée à la porte !");

        // Lecture brute
        let rawBody = '';
        for await (const chunk of req) {
            rawBody += chunk.toString('utf8');
        }

        const interaction = JSON.parse(rawBody);
        console.log("🔍 Type d'interaction demandée par Discord :", interaction.type);

        // LE FAMEUX PING DE DISCORD
        if (interaction.type === 1) {
            console.log("🏓 Renvoi du PONG brut (Méthode Native Node.js)...");
            
            // On utilise res.end() (natif) plutôt que res.json() (surcouche Vercel)
            res.setHeader('Content-Type', 'application/json');
            res.status(200).end(JSON.stringify({ type: 1 }));
            return;
        }

        // Si tu tentes une commande
        console.log("🚀 Commande reçue !");
        res.setHeader('Content-Type', 'application/json');
        res.status(200).end(JSON.stringify({ type: 5 }));

    } catch (erreur) {
        console.error("❌ Crash lors du test :", erreur);
        return res.status(500).json({ error: 'Crash interne' });
    }
}