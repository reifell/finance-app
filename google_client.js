require('dotenv').config();
const { google } = require('googleapis');

let _sheetsClient = null;

async function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  _sheetsClient = google.sheets({ version: 'v4', auth });
  return _sheetsClient;
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

module.exports = { getSheetsClient, SPREADSHEET_ID };
