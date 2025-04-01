const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const axios = require('axios');
const { Builder } = require('xml2js');

const WEBFLOW_TOKEN = '101b6d48d3bddfc2b5ab504b3c8f41f2a2a9e5893983a6dbf0467ab8e3580934';
const PRODUCTS_COLLECTION_ID = '671f74158ad8b36b6c82188c';
const SITE_ID = '671f56de2f5de134f0f39123';
const WEBFLOW_API_URL = 'https://api.webflow.com/v2';

async function fetchProductsFromWebflow() {
    const allItems = [];
    let offset = 0;
    const limit = 100;

    while (true) {
        // Dodajemy parametry offset i limit
        const url = `${WEBFLOW_API_URL}/collections/${PRODUCTS_COLLECTION_ID}/items?offset=${offset}&limit=${limit}`;
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${WEBFLOW_TOKEN}`,
                'accept-version': '1.0.0'
            }
        });

        const batch = response.data.items || [];
        allItems.push(...batch);

        // Jeżeli w tej partii było mniej niż 100,
        // to znaczy, że to już koniec
        if (batch.length < limit) {
            break;
        }

        // Zwiększamy offset i lecimy po kolejną setkę
        offset += limit;
    }

    return allItems;
}

function sanitizeKey(key) {
    return key
        .replace(/[^a-zA-Z0-9_]/g, '_')  // zamień wszystko co nie jest literą/cyfą/_ na _
        .replace(/^([0-9])/, '_$1');     // jeśli zaczyna się od cyfry – dodaj _
}

function sanitizeObjectKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(sanitizeObjectKeys);
    } else if (typeof obj === 'object' && obj !== null) {
        const sanitized = {};
        for (const key in obj) {
            const safeKey = sanitizeKey(key);
            sanitized[safeKey] = sanitizeObjectKeys(obj[key]);
        }
        return sanitized;
    }
    return obj;
}

function generateXmlFile(products, outputPath) {
    const builder = new Builder();
    const safeProducts = sanitizeObjectKeys(products);

    // Klucz "product" zawiera tablicę obiektów
    const xmlData = {
        products: {
            product: safeProducts
        }
    };

    const xml = builder.buildObject(xmlData);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, xml);

    console.log('XML file created at', outputPath);
}

async function uploadToFTP(localFilePath, remoteFileName) {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: 's22.cyber-folks.pl',
            user: 'flipico@gordontrade.pl',
            // password: process.env.FTP_PASSWORD,
            password: '9Vvn-[[Nv-K1NQL*',
            secure: false,
            // secureOptions: {
            //     rejectUnauthorized: false, // 🔐 NIE weryfikuj certyfikatu
            // }
        });

        await client.uploadFrom(localFilePath, remoteFileName);
        console.log(`✅ Plik wrzucony na FTP jako ${remoteFileName}`);
    } catch (error) {
        console.error('❌ Błąd uploadu FTP:', error);
        throw error;
    }
    await client.close();
}

async function runExport() {
    try {
        console.log('🔄 Start exportu...');
        const products = await fetchProductsFromWebflow();
        console.log(`📦 Liczba produktów: ${products.length}`);

        const exportPath = path.join(__dirname, '../exports/products.xml');
        console.log('📁 Ścieżka do XML:', exportPath);

        generateXmlFile(products, exportPath);

        // console.log('📤 Próba uploadu na FTP...');
        // await uploadToFTP(exportPath, 'products.xml');

        console.log('✅ Export zakończony sukcesem.');
    } catch (err) {
        console.error('❌ Błąd w runExport:', err);
        throw err; // przekaż do routera
    }
}

module.exports = { runExport };
