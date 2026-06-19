import { verifyKey } from 'discord-interactions';

export const config = {
    api: { bodyParser: false }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

    try {
        // 1. Lecture indestructible du corps du message
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString('utf-8');

        // 2. Récupération des clés
        const signature = req.headers['x-signature-ed25519'];
        const timestamp = req.headers['x-signature-timestamp'];
        const publicKey = process.env.DISCORD_PUBLIC_KEY;

        // Sécurité anti-crash si la clé est introuvable sur Vercel
        if (!signature || !timestamp || !publicKey) {
            console.error("❌ CLÉ PUBLIQUE INTROUVABLE SUR VERCEL !");
            return res.status(401).end('Missing credentials');
        }

        // 3. Vérification cryptographique
        const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);

        if (!isValidRequest) {
            console.error("❌ ALERTE : Fausse signature détectée (Test Discord ou Hacker)");
            return res.status(401).end('Invalid signature');
        }

        const interaction = JSON.parse(rawBody);

        // 4. LE PING OFFICIEL
        if (interaction.type === 1) {
            console.log("🏓 PING VALIDE ! Renvoi du Pong...");
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).send(JSON.stringify({ type: 1 }));
        }

        // 5. Attente pour la commande /resume
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(JSON.stringify({ type: 5 }));

    } catch (error) {
        console.error("🔥 Crash Serveur :", error);
        return res.status(500).end('Internal Server Error');
    }
}