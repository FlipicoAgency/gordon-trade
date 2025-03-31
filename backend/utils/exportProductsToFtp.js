const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const axios = require('axios');
const { Builder } = require('xml2js');

const WEBFLOW_TOKEN = process.env.WEBFLOW_TOKEN;
const PRODUCTS_COLLECTION_ID = '671f74158ad8b36b6c82188c';
const SITE_ID = '671f56de2f5de134f0f39123';
const WEBFLOW_API_URL = 'https://api.webflow.com/v2';

async function fetchProductsFromWebflow() {
    const url = `${WEBFLOW_API_URL}/collections/${PRODUCTS_COLLECTION_ID}/items`;
    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${WEBFLOW_TOKEN}`,
                'accept-version': '1.0.0'
            }
        });
        return response.data.items;
    } catch (error) {
        console.error('Error fetching Webflow products:', error.response?.data || error);
        return [];
    }
}

function generateXmlFile(products, outputPath) {
    const builder = new Builder();
    const xml = builder.buildObject({ products });
    fs.writeFileSync(outputPath, xml);
    console.log('XML file created at', outputPath);
}

async function uploadToFTP(localFilePath, remoteFileName) {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: 'ftp.gordontrade.pl',
            user: 'flipico@gordontrade.pl',
            password: process.env.FTP_PASSWORD,
            secure: false,
        });

        await client.uploadFrom(localFilePath, remoteFileName);
        console.log(`✅ Plik wrzucony na FTP jako ${remoteFileName}`);
    } catch (error) {
        console.error('❌ Błąd uploadu FTP:', error);
    }
    await client.close();
}

async function runExport() {
    const products = await fetchProductsFromWebflow();
    const exportPath = path.join(__dirname, '../exports/products.xml');

    generateXmlFile(products, exportPath);
    await uploadToFTP(exportPath, 'products.xml');
}

module.exports = { runExport };
