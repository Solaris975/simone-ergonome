import { verifyKey } from 'discord-interactions';

export const config = {
    api: { bodyParser: false }
};

export default async function handler(req, res) {
    // 1. On recale tout ce qui n'est pas un colis Discord
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const signature = req.headers['x-signature-ed25519'];
        const timestamp = req.headers['x-signature-timestamp'];

        // Si Discord (ou un hacker) "oublie" l'étiquette de sécurité : 401 pur
        if (!signature || !timestamp) {
            return res.status(401).send('invalid request signature');
        }

        // Lecture de la requête en format brut absolu
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString('utf-8');

        // Vérification cryptographique
        const isValidRequest = verifyKey(
            rawBody, 
            signature, 
            timestamp, 
            process.env.DISCORD_PUBLIC_KEY
        );

        // Si c'est le "test piège" de Discord avec une fausse signature : 401 pur
        if (!isValidRequest) {
            return res.status(401).send('invalid request signature');
        }

        const interaction = JSON.parse(rawBody);

        // LE PING DE DISCORD : On renvoie le Type 1 exactement comme exigé
        if (interaction.type === 1) {
            return res.status(200).json({ type: 1 });
        }

        // Si tu tapes une commande (pour ne pas que ça crashe pendant le test)
        return res.status(200).json({ type: 5 });

    } catch (error) {
        return res.status(500).send('Internal Server Error');
    }
}