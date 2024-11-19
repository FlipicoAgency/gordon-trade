const { google } = require('googleapis');

const authenticateGoogleSheets = () => {
    const auth = new google.auth.JWT(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, // Email konta serwisowego
        null, // Klucz pliku JSON (nie używany)
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Klucz prywatny (zamiana \n na nową linię)
        ['https://www.googleapis.com/auth/spreadsheets'] // Zakresy dostępu
    );

    return auth;
};

const getSheetsInstance = async () => {
    const auth = authenticateGoogleSheets();
    const sheets = google.sheets({ version: 'v4', auth });
    return sheets;
};

module.exports = { getSheetsInstance };