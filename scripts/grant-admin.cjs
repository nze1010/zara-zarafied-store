/**
 * ZARA — ZARAFIED STORE
 * Administrator Custom Claim Provisioning Script
 * Project ID: zarastore-17250
 * Target Admin Email: Janetzara97@gmail.com
 * 
 * SECURITY COMPLIANCE:
 * - Never invents passwords or commits private credentials.
 * - Enforces cryptographically signed Firebase Auth Custom Claims: request.auth.token.admin == true
 * - Client-side isAdmin flags are strictly rejected.
 */

const auth = require('C:/Users/COLLINS/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');
const scopes = require('C:/Users/COLLINS/AppData/Roaming/npm/node_modules/firebase-tools/lib/scopes');
const { Client } = require('C:/Users/COLLINS/AppData/Roaming/npm/node_modules/firebase-tools/lib/apiv2');

const TARGET_EMAIL = 'Janetzara97@gmail.com';
const PROJECT_ID = 'zarastore-17250';

async function main() {
  console.log(`[Admin Provisioning] Checking user account for: ${TARGET_EMAIL}...`);

  const account = auth.getGlobalDefaultAccount();
  const authScopes = [
    scopes.EMAIL,
    scopes.OPENID,
    scopes.CLOUD_PLATFORM
  ];
  const token = await auth.getAccessToken(account?.tokens?.refresh_token, authScopes);

  const client = new Client({
    urlPrefix: 'https://identitytoolkit.googleapis.com',
    apiVersion: 'v1',
    auth: false
  });

  // Query user by email
  try {
    const res = await client.post(`/projects/${PROJECT_ID}/accounts:lookup`, {
      email: [TARGET_EMAIL]
    }, {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });

    const user = res.body?.users?.[0];
    if (!user) {
      console.log(`\n[Notice]: Account '${TARGET_EMAIL}' has not registered or been added to the project yet.`);
      console.log(`To assign administrator privileges safely:`);
      console.log(`1. In Firebase Console (Authentication > Users > Add user), add '${TARGET_EMAIL}' with their private password, or invite the owner.`);
      console.log(`2. Re-run: node scripts/grant-admin.cjs`);
      return;
    }

    console.log(`[Found]: User UID: ${user.localId}, Email: ${user.email}`);

    // Set custom user claims { admin: true }
    console.log(`[Admin Provisioning] Assigning custom claim { admin: true }...`);
    const updateRes = await client.post(`/projects/${PROJECT_ID}/accounts:update`, {
      localId: user.localId,
      customAttributes: JSON.stringify({ admin: true })
    }, {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });

    console.log(`[SUCCESS]: Administrator claim { admin: true } successfully provisioned for ${TARGET_EMAIL} (UID: ${user.localId}).`);
    console.log(`This claim is cryptographically enforced by firestore.rules and storage.rules.`);
  } catch (err) {
    console.error('[Error]:', err.message, err.context?.body || '');
  }
}

main();
