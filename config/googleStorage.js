const { Storage } = require('@google-cloud/storage');

const projectId = process.env.GCLOUD_PROJECT_ID;
const privateKey = process.env.GCLOUD_PRIVATE_KEY.split(String.raw`\n`).join(
  '\n',
);
const privateKeyId = process.env.GCLOUD_PRIVATE_KEY_ID;
const clientEmail = process.env.GCLOUD_CLIENT_EMAIL;
const clientId = process.env.GCLOUD_CLIENT_ID;
const clientCertUrl = process.env.GCLOUD_CLIENT_CERT_URL;

const storage = new Storage({
  projectId: projectId,
  credentials: {
    type: 'service_account',
    project_id: projectId,
    private_key_id: privateKeyId,
    private_key: privateKey,
    client_email: clientEmail,
    client_id: clientId,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: clientCertUrl,
    universe_domain: 'googleapis.com',
  },
});

module.exports = storage;
