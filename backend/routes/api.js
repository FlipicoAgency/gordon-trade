const express = require('express');
const router = express.Router();
//const { clients } = require('../websocket');
const axios = require('axios');
const { getSheetsInstance } = require('../googleSheetsClient');

const webflowConfig = {
    webflowApiUrl: 'https://api.webflow.com/v2',
    webflowToken: process.env.WEBLOW_TOKEN,
    containersCollectionId: '6723715370c537f5a2e31c79',
    productsCollectionId: '671f74158ad8b36b6c82188c',
    statusesCollectionId: '671fa6eea160e723f30e9c27',
    categoriesCollectionId: '671f61456cbcd434a4a123d4',
    siteId: '671f56de2f5de134f0f39123',
};

const SPREADSHEET_ID = '14vV1YgB7M2kc8uwIRHBUateZhB1RL1RzIwThdn1jbs8';

// Pobierz zamówienia B2B
router.get('/sheets/orders', async (req, res) => {
    const { nip } = req.query; // NIP przekazany jako query parameter
    if (!nip) {
        return res.status(400).json({ error: 'Parametr "nip" jest wymagany.' });
    }

    try {
        const sheets = await getSheetsInstance();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Orders!A1:Q', // Zakres danych
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Brak danych w arkuszu.' });
        }

        // Pobierz nagłówki i dane
        const [headers, ...data] = rows;

        let lastNIP = null;
        let lastOrderId = null;
        const orders = [];

        // Procesowanie danych
        data.forEach((row) => {
            if (row[0]) lastNIP = row[0]; // Aktualizacja NIP, jeśli komórka nie jest pusta
            if (row[1]) lastOrderId = row[1]; // Aktualizacja ID zamówienia, jeśli komórka nie jest pusta

            // Filtruj zamówienia na podstawie NIP
            if (lastNIP === nip) {
                // Znajdź istniejące zamówienie
                let existingOrder = orders.find((order) => order.orderId === lastOrderId);

                if (!existingOrder) {
                    // Twórz nowe zamówienie, jeśli nie istnieje
                    existingOrder = headers.reduce((acc, header, index) => {
                        acc[header] = row[index] || '';
                        return acc;
                    }, { products: [] }); // Dodaj pole products
                    existingOrder.orderId = lastOrderId; // Ustaw ID zamówienia
                    orders.push(existingOrder);
                }

                // Dodaj produkt do zamówienia
                existingOrder.products.push({
                    productId: row[3],      // Kolumna Product ID
                    quantity: row[4],       // Kolumna Quantity
                    productName: row[2],    // Kolumna Product name
                });
            }
        });

        res.status(200).json(orders);
    } catch (error) {
        console.error('Błąd pobierania danych z arkusza:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Dodaj zamówienia B2B
router.post('/sheets/orders', async (req, res) => {
    const { values } = req.body;
    if (!values || !Array.isArray(values)) {
        return res.status(400).json({ error: 'Nieprawidłowe dane.' });
    }

    try {
        const sheets = await getSheetsInstance();

        // Dodaj nowe wiersze
        const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Orders!A1:Q',
            valueInputOption: 'USER_ENTERED',
            resource: { values },
        });
        console.log('Append Response:', appendResponse.data);

        // Scal odpowiednie komórki
        const mergeRequests = [];
        let currentRow = await getLastRow(sheets);

        values.forEach((row, index) => {
            if (row[0] !== '') {
                const startRow = currentRow + index;
                const endRow = startRow + values.filter((r) => r[0] === '').length || startRow + 1;

                const columnsToMerge = [0, 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
                columnsToMerge.forEach((colIndex) => {
                    mergeRequests.push({
                        mergeCells: {
                            range: {
                                sheetId: 24398558,
                                startRowIndex: startRow - 1,
                                endRowIndex: endRow,
                                startColumnIndex: colIndex,
                                endColumnIndex: colIndex + 1,
                            },
                            mergeType: 'MERGE_ALL',
                        },
                    });
                });
            }
        });

        // Dodanie obramowań dla całego zakresu A:U
        mergeRequests.push({
            updateBorders: {
                range: {
                    sheetId: 24398558, // ID arkusza (Orders)
                    startRowIndex: currentRow - 1, // Pierwszy wiersz do obramowania
                    endRowIndex: currentRow + values.length - 1, // Ostatni wiersz (liczba dodanych wierszy)
                    startColumnIndex: 0, // Kolumna A
                    endColumnIndex: 17, // Kolumna Q (17, bo endColumnIndex jest wyłączny)
                },
                top: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                bottom: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                left: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                right: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                innerHorizontal: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                innerVertical: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
            },
        });

        // Dodanie wycentrowania tekstu dla całego zakresu A:U
        mergeRequests.push({
            repeatCell: {
                range: {
                    sheetId: 24398558, // ID arkusza (Orders)
                    startRowIndex: currentRow - 1, // Pierwszy wiersz do wycentrowania
                    endRowIndex: currentRow + values.length - 1, // Ostatni wiersz
                    startColumnIndex: 0, // Kolumna A
                    endColumnIndex: 17, // Kolumna Q (23, bo endColumnIndex jest wyłączny)
                },
                cell: {
                    userEnteredFormat: {
                        horizontalAlignment: 'CENTER', // Wycentrowanie poziome
                        verticalAlignment: 'MIDDLE', // Wycentrowanie pionowe
                    },
                },
                fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)', // Wskaż zmieniane pola
            },
        });

        if (mergeRequests.length === 0) {
            throw new Error('Brak żądań scalania komórek.');
        }

        console.log('Merge Requests:', JSON.stringify(mergeRequests, null, 2));

        const batchResponse = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: mergeRequests,
            },
        });
        console.log('BatchUpdate Response:', JSON.stringify(batchResponse.data, null, 2));

        res.status(201).json({ message: 'Dane zostały dodane do arkusza.' });
    } catch (error) {
        console.error('Błąd dodawania danych do arkusza:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Pobierz zamówienia kontenerowe
router.get('/sheets/containers', async (req, res) => {
    const { nip } = req.query; // NIP przekazany jako query parameter
    if (!nip) {
        return res.status(400).json({ error: 'Parametr "nip" jest wymagany.' });
    }

    try {
        const sheets = await getSheetsInstance();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Containers!A1:S', // Zakres danych
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Brak danych w arkuszu.' });
        }

        // Pobierz nagłówki i dane
        const [headers, ...data] = rows;

        let lastNIP = null;
        let lastOrderId = null;
        const orders = [];

        // Procesowanie danych
        data.forEach((row) => {
            if (row[0]) lastNIP = row[0]; // Aktualizacja NIP, jeśli komórka nie jest pusta
            if (row[1]) lastOrderId = row[1]; // Aktualizacja ID zamówienia, jeśli komórka nie jest pusta

            // Filtruj zamówienia na podstawie NIP
            if (lastNIP === nip) {
                // Znajdź istniejące zamówienie
                let existingOrder = orders.find((order) => order.orderId === lastOrderId);

                if (!existingOrder) {
                    // Twórz nowe zamówienie, jeśli nie istnieje
                    existingOrder = headers.reduce((acc, header, index) => {
                        acc[header] = row[index] || '';
                        return acc;
                    }, { products: [] }); // Dodaj pole products
                    existingOrder.orderId = lastOrderId; // Ustaw ID zamówienia
                    orders.push(existingOrder);
                }

                // Dodaj produkt do zamówienia
                existingOrder.products.push({
                    name: row[3],               // Kolumna Product name
                    orderValue: row[5],         // Kolumna Order value
                    EstimatedFreight: row[6],   // Kolumna Estimated freight
                    Capacity: row[7],           // Kolumna Capacity
                    quantity: row[4],           // Kolumna Quantity
                });
            }
        });

        res.status(200).json(orders);
    } catch (error) {
        console.error('Błąd pobierania danych z arkusza:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Dodaj zamówienia kontenerowe
router.post('/sheets/containers', async (req, res) => {
    const { values } = req.body;
    if (!values || !Array.isArray(values)) {
        return res.status(400).json({ error: 'Nieprawidłowe dane.' });
    }

    try {
        const sheets = await getSheetsInstance();

        // Dodaj nowe wiersze
        const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Orders!A1:S',
            valueInputOption: 'USER_ENTERED',
            resource: { values },
        });
        console.log('Append Response:', appendResponse.data);

        // Scal odpowiednie komórki
        const mergeRequests = [];
        let currentRow = await getLastRow(sheets);

        values.forEach((row, index) => {
            if (row[0] !== '') {
                const startRow = currentRow + index;
                const endRow = startRow + values.filter((r) => r[0] === '').length || startRow + 1;

                const columnsToMerge = [0, 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
                columnsToMerge.forEach((colIndex) => {
                    mergeRequests.push({
                        mergeCells: {
                            range: {
                                sheetId: 24398558,
                                startRowIndex: startRow - 1,
                                endRowIndex: endRow,
                                startColumnIndex: colIndex,
                                endColumnIndex: colIndex + 1,
                            },
                            mergeType: 'MERGE_ALL',
                        },
                    });
                });
            }
        });

        // Dodanie obramowań dla całego zakresu A:U
        mergeRequests.push({
            updateBorders: {
                range: {
                    sheetId: 24398558, // ID arkusza (Orders)
                    startRowIndex: currentRow - 1, // Pierwszy wiersz do obramowania
                    endRowIndex: currentRow + values.length - 1, // Ostatni wiersz (liczba dodanych wierszy)
                    startColumnIndex: 0, // Kolumna A
                    endColumnIndex: 23, // Kolumna W (23, bo endColumnIndex jest wyłączny)
                },
                top: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                bottom: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                left: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                right: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                innerHorizontal: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
                innerVertical: {
                    style: 'SOLID',
                    width: 1,
                    color: { red: 0, green: 0, blue: 0 },
                },
            },
        });

        // Dodanie wycentrowania tekstu dla całego zakresu A:U
        mergeRequests.push({
            repeatCell: {
                range: {
                    sheetId: 24398558, // ID arkusza (Orders)
                    startRowIndex: currentRow - 1, // Pierwszy wiersz do wycentrowania
                    endRowIndex: currentRow + values.length - 1, // Ostatni wiersz
                    startColumnIndex: 0, // Kolumna A
                    endColumnIndex: 23, // Kolumna W (23, bo endColumnIndex jest wyłączny)
                },
                cell: {
                    userEnteredFormat: {
                        horizontalAlignment: 'CENTER', // Wycentrowanie poziome
                        verticalAlignment: 'MIDDLE', // Wycentrowanie pionowe
                    },
                },
                fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)', // Wskaż zmieniane pola
            },
        });

        if (mergeRequests.length === 0) {
            throw new Error('Brak żądań scalania komórek.');
        }

        console.log('Merge Requests:', JSON.stringify(mergeRequests, null, 2));

        const batchResponse = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: mergeRequests,
            },
        });
        console.log('BatchUpdate Response:', JSON.stringify(batchResponse.data, null, 2));

        res.status(201).json({ message: 'Dane zostały dodane do arkusza.' });
    } catch (error) {
        console.error('Błąd dodawania danych do arkusza:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Funkcja pomocnicza do pobrania ostatniego wiersza
async function getLastRow(sheets) {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Orders!A:A', // Kolumna A
    });

    return response.data.values.length; // Liczba istniejących wierszy
}

// Pobierz określony produkt na podstawie ID
router.get('/products/:productId', async (req, res) => {
    const productId = req.params.productId; // Pobierz ID produktu z URL
    const apiUrl = `${webflowConfig.webflowApiUrl}/collections/${webflowConfig.productsCollectionId}/items/${productId}`;

    try {
        const response = await axios.get(apiUrl, {
            headers: { 'Authorization': `Bearer ${webflowConfig.webflowToken}` }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching product:', error);
        if (error.response) {
            res.status(error.response.status).json({ error: error.response.data });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

// Pobierz elementy kolekcji
router.get('/categories', async (req, res) => {
    const apiUrl = `${webflowConfig.webflowApiUrl}/collections/${webflowConfig.categoriesCollectionId}/items`;

    try {
        const response = await axios.get(apiUrl, {
            headers: { 'Authorization': `Bearer ${webflowConfig.webflowToken}` },
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error fetching collection items:', error);

        if (error.response) {
            res.status(error.response.status).json({ error: error.response.data });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

// Pobierz ID sesji
router.get('/session-id', (req, res) => {
    res.json({ sessionID: req.sessionID });
});

// Dodaj przedmiot do koszyka
router.post('/cart', (req, res) => {
    const item = req.body;
    const existingItem = req.session.cart.find(i => i.id === item.id);

    if (existingItem) {
        existingItem.quantity += item.quantity;
    } else {
        req.session.cart.push(item);
        console.log('Koszyk został zaktualizowany:', req.session.cart);
    }
    res.status(201).send(req.session.cart);
});

// Pobierz koszyk
router.get('/cart', (req, res) => {
    res.json(req.session.cart);
});

// Zaktualizuj ilość przedmiotu w koszyku
router.put('/cart/:itemId', (req, res) => {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const item = req.session.cart.find(i => i.id === itemId);

    if (item) {
        item.quantity = quantity;
        res.send(req.session.cart);
    } else {
        res.status(404).send({ message: 'Item not found' });
    }
});

// Usuń przedmiot z koszyka
router.delete('/cart/:itemId', (req, res) => {
    const { itemId } = req.params;
    req.session.cart = req.session.cart.filter(i => i.id !== itemId);
    res.send(req.session.cart);
});

// Opróżnij koszyk
router.delete('/cart', (req, res) => {
    req.session.cart = [];
    res.send(req.session.cart);
});

module.exports = router;