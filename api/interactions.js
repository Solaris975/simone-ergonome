import { verifyKey } from 'discord-interactions';

// 🚀 L'ARME SECRÈTE : On bascule sur le moteur "Edge" de Vercel
export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    // 1. Rejet des requêtes GET (comme ton navigateur)
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // 2. Récupération des clés de sécurité (syntaxe Edge avec .get)
    const signature = req.headers.get('x-signature-ed25519');
    const timestamp = req.headers.get('x-signature-timestamp');

    if (!signature || !timestamp) {
        return new Response('invalid request signature', { status: 401 });
    }

    // 3. LA MAGIE DU EDGE : Lecture parfaite et pure du texte en 1 ligne
    const rawBody = await req.text();
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    // 4. Vérification cryptographique inviolable
    const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);

    if (!isValidRequest) {
        return new Response('invalid request signature', { status: 401 });
    }

    const interaction = JSON.parse(rawBody);

    // 5. LE PING DE DISCORD (Type 1)
    if (interaction.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 6. Si on tape une commande (Type 5 : "Je réfléchis")
    return new Response(JSON.stringify({ type: 5 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}