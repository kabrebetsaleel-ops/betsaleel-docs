const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");

admin.initializeApp();

// ⚠️ CONFIG À REMPLACER
const GMAIL = "betsaleelbusiness@gmail.com";
const GMAIL_PASS = "xxxx xxxx xxxx xxxx"; // Mot de passe d'application Gmail. Tuto : myaccount.google.com/apppasswords
const WHATSAPP = "+22606625715";

exports.confirmerCommande = functions.https.onCall(async (data, context) => {
  // Sécurité : seul l'admin peut appeler
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Non autorisé");
  }

  const { commandeId } = data;
  const commandeRef = admin.firestore().doc(`commandes/${commandeId}`);
  const commande = (await commandeRef.get()).data();
  
  if (!commande) throw new functions.https.HttpsError("not-found", "Commande introuvable");
  if (commande.statut === 'livré') throw new functions.https.HttpsError("already-exists", "Déjà livré");

  try {
    // 1. Google Drive : créer lien temporaire 24h pour chaque article
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive"]
    });
    const drive = google.drive({ version: "v3", auth });
    
    const liens = [];
    for (const article of commande.articles) {
      // Rendre le fichier lisible par lien
      await drive.permissions.create({
        fileId: article.driveId,
        requestBody: { role: "reader", type: "anyone" }
      });
      
      const { data: file } = await drive.files.get({
        fileId: article.driveId,
        fields: "webContentLink, name"
      });
      
      liens.push({ nom: article.titre, lien: file.webContentLink });
    }

    // 2. Envoyer Email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL, pass: GMAIL_PASS }
    });

    const htmlLiens = liens.map(l => `
      <div style="margin:15px 0;padding:15px;border:1px solid #e2e8f0;border-radius:12px;">
        <strong>${l.nom}</strong><br>
        <a href="${l.lien}" style="display:inline-block;margin-top:10px;background:#6366f1;color:white;padding:12px 24px;text-decoration:none;border-radius:50px;font-weight:600;">Télécharger le PDF</a>
      </div>
    `).join('');

    await transporter.sendMail({
      from: `"Betsaleel Docs" <${GMAIL}>`,
      to: commande.emailClient,
      subject: `Tes documents sont prêts ! Commande #${commandeId.substring(0,6)}`,
      html: `
        <div style="font-family:Manrope,Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#0f172a;">Merci ${commande.nomClient} !</h1>
          <p>Ta commande de <strong>${commande.total} FCFA</strong> est confirmée.</p>
          <p>Télécharge tes documents ci-dessous. <strong>Les liens expirent dans 24h.</strong></p>
          ${htmlLiens}
          <hr style="margin:30px 0;border:none;border-top:1px solid #e2e8f0;">
          <p style="color:#64748b;">Besoin d'aide ? WhatsApp : ${WHATSAPP}</p>
          <p style="color:#64748b;font-size:12px;">Betsaleel Docs - L'excellence scolaire</p>
        </div>
      `
    });

    // 3. Mettre à jour la commande
    await commandeRef.update({ 
      statut: "livré", 
      dateLivraison: admin.firestore.FieldValue.serverTimestamp() 
    });

    return { success: true, message: "Email envoyé" };
    
  } catch (error) {
    console.error("Erreur:", error);
    throw new functions.https.HttpsError("internal", "Erreur lors de l'envoi");
  }
});