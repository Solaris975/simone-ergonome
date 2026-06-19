import 'dotenv/config';

// On définit la forme de notre commande
const commandes = [
  {
    name: 'resume',
    description: "Demande à Simone de résumer un article à la volée.",
    options: [
      {
        name: 'url',
        description: "Le lien du site ou de l'article à résumer",
        type: 3, // Type 3 correspond à une chaîne de caractères (STRING)
        required: true,
      },
    ],
  },
];

async function enregistrer() {
    console.log("Envoi de la commande à Discord...");
    const reponse = await fetch(`https://discord.com/api/v10/applications/${process.env.DISCORD_APP_ID}/commands`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`
        },
        body: JSON.stringify(commandes)
    });

    if (reponse.ok) {
        console.log("✅ Commande /resume enregistrée avec succès !");
    } else {
        console.error("❌ Erreur :", await reponse.text());
    }
}

enregistrer();