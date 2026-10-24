/**
 * Ferramenta LOCAL de provisionamento do proprietário.
 * Não é rota do Next.js; não expõe credenciais ao navegador.
 *
 * Pré-requisitos (em ambiente confiável):
 * npm install --no-save --package-lock=false firebase-admin
 * export GOOGLE_APPLICATION_CREDENTIALS="/caminho/fora-do-repositorio/credenciais.json"
 * export FIREBASE_PROJECT_ID="id-exato-do-projeto"
 * export EXPECTED_ADMIN_EMAIL="email-exato-do-proprietario"
 *
 * Primeiro execute: node scripts/set-admin-claim.cjs UID
 * Depois confira e execute: node scripts/set-admin-claim.cjs UID --apply
 */
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

async function main() {
  const uid = process.argv[2];
  const apply = process.argv.includes("--apply");
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const expectedEmail = process.env.EXPECTED_ADMIN_EMAIL;
  if (!uid || uid.startsWith("--") || !projectId || !expectedEmail || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Informe UID, FIREBASE_PROJECT_ID, EXPECTED_ADMIN_EMAIL e GOOGLE_APPLICATION_CREDENTIALS. Não coloque credenciais no repositório.");
  }
  initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth();
  const account = await auth.getUser(uid);
  if (!account.email || account.email.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error("E-mail do UID não corresponde ao proprietário esperado. Nenhuma alteração aplicada.");
  }
  if (account.disabled) throw new Error("Conta desativada. Nenhuma alteração aplicada.");
  const claims = account.customClaims || {};
  console.log(JSON.stringify({ projectId, uid: account.uid, email: account.email, disabled: account.disabled, currentAdmin: claims.admin === true, operation: apply ? "apply" : "dry-run" }, null, 2));
  if (!apply) {
    console.log("Simulação: nenhuma alteração realizada. Verifique UID, projeto e e-mail antes de usar --apply.");
    return;
  }
  await auth.setCustomUserClaims(uid, { ...claims, admin: true });
  const verified = await auth.getUser(uid);
  if (verified.customClaims?.admin !== true) throw new Error("Falha na confirmação da claim admin.");
  console.log("Claim admin confirmada. Saia e entre novamente no aplicativo para renovar o token.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
