// ====================================================
// SHEETS.JS — Leitura/escrita na planilha via Google Sheets API
// ====================================================
const { google } = require('googleapis');
require('dotenv').config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

function getAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

// Lê um range da planilha
async function lerRange(range) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.data.values || [];
}

// Escreve valores em um range
async function escreverRange(range, values) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

// Adiciona linhas ao final de uma aba
async function adicionarLinhas(aba, values) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${aba}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

// Lê aba inteira
async function lerAba(aba) {
  return lerRange(`${aba}!A:ZZ`);
}

// Lê cabeçalho de uma aba
async function lerCabecalho(aba) {
  const rows = await lerRange(`${aba}!1:1`);
  return rows[0] || [];
}

module.exports = { lerRange, escreverRange, adicionarLinhas, lerAba, lerCabecalho, SPREADSHEET_ID };
