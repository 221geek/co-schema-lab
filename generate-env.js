#!/usr/bin/env node
/**
 * Generates environment.prod.ts from environment variables at build time.
 * Used by Railway, Vercel, etc. to inject Firebase config without committing secrets.
 *
 * Required env vars:
 *   FIREBASE_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
 * Optional: FIREBASE_AUTH_DOMAIN, FIREBASE_STORAGE_BUCKET, FIREBASE_MEASUREMENT_ID, RECAPTCHA_SITE_KEY
 */

const fs = require('fs');
const path = require('path');

const projectId = process.env.FIREBASE_PROJECT_ID;
const apiKey = process.env.FIREBASE_API_KEY;
const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.FIREBASE_APP_ID;

if (!apiKey || !projectId || !messagingSenderId || !appId) {
  console.warn(
    '⚠️  Firebase env vars not set (FIREBASE_API_KEY, FIREBASE_PROJECT_ID, etc.).\n' +
      '   Using placeholders - production build may not work. Set env vars in your deployment platform.'
  );
}

const authDomain = process.env.FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : 'YOUR_PROJECT_ID.firebaseapp.com');
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.firebasestorage.app` : 'YOUR_PROJECT_ID.firebasestorage.app');
const measurementId = process.env.FIREBASE_MEASUREMENT_ID || 'G-XXXXXXXXXX';
const recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY || '';

const content = `export const environment = {
  production: true,
  firebase: {
    apiKey: '${apiKey || 'YOUR_API_KEY'}',
    authDomain: '${authDomain}',
    projectId: '${projectId || 'YOUR_PROJECT_ID'}',
    storageBucket: '${storageBucket}',
    messagingSenderId: '${messagingSenderId || 'YOUR_MESSAGING_SENDER_ID'}',
    appId: '${appId || 'YOUR_APP_ID'}',
    measurementId: '${measurementId}'
  },
  recaptchaSiteKey: '${recaptchaSiteKey}'
};
`;

const outPath = path.join(__dirname, 'src/environments/environment.prod.ts');
fs.writeFileSync(outPath, content, 'utf8');
console.log('✓ Generated environment.prod.ts from env vars');
