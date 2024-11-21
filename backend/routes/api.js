const express = require('express');
const router = express.Router();
//const { clients } = require('../websocket');
const axios = require('axios');
const { getSheetsInstance } = require('../googleSheetsClient');

const webflowConfig = {
    webflowApiUrl: 'https://api.webflow.com/v2',
    webflowToken: '34f47bfe4c8cb71babd3bfda12102276c33e2a48c532dde5d11a5540e7edd27c',
    containersCollectionId: '6723715370c537f5a2e31c79',
    productsCollectionId: '671f74158ad8b36b6c82188c',
    statusesCollectionId: '671fa6eea160e723f30e9c27',
    categoriesCollectionId: '671f61456cbcd434a4a123d4',
    siteId: '671f56de2f5de134f0f39123',
};

const SPREADSHEET_ID = '14vV1YgB7M2kc8uwIRHBUateZhB1RL1RzIwThdn1jbs8';

// Pobierz zamówienia na podstawie NIP
router.get('/sheets/orders', async (req, res) => {
    const { nip } = req.query; // NIP przekazany jako query parameter
    if (!nip) {
        return res.status(400).json({ error: 'Parametr "nip" jest wymagany.' });
    }

    try {
        const sheets = await getSheetsInstance();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Orders!A1:U', // Zakres danych
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
                    productId: row[3], // Kolumna Product ID
                    quantity: row[4], // Kolumna Quantity
                    productName: row[2], // Kolumna Product name
                });
            }
        });

        res.status(200).json(orders);
    } catch (error) {
        console.error('Błąd pobierania danych z arkusza:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Dodaj dane do arkusza
router.post('/sheets/data', async (req, res) => {
    const { values } = req.body;
    if (!values || !Array.isArray(values)) {
        return res.status(400).json({ error: 'Nieprawidłowe dane.' });
    }

    try {
        const sheets = await getSheetsInstance();

        // Dodaj nowe wiersze
        const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Orders!A1:U',
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

                const columnsToMerge = [0, 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
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
                    startRowIndex: currentRow, // Pierwszy wiersz do obramowania
                    endRowIndex: currentRow + values.length, // Ostatni wiersz (liczba dodanych wierszy)
                    startColumnIndex: 0, // Kolumna A
                    endColumnIndex: 21, // Kolumna U (21, bo endColumnIndex jest wyłączny)
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

router.post('/kontenery', async (req, res) => {
    try {
        const { body: webhookData } = req;

        // Fetch all containers, filter by webhookData, and process contents
        const allContainers = await axios.get(`${webflowConfig.webflowApiUrl}/collections/${webflowConfig.containersCollectionId}/items`, {
            headers: { Authorization: `Bearer ${webflowConfig.webflowToken}` }
        }).then(({ data }) => data.items);

        const filteredContainers = allContainers.filter(({ fieldData }) => fieldData['data-ms-member-klient-id'] === webhookData.id);
        const flattenedContents = filteredContainers.flatMap(({ fieldData }) => fieldData.zawartosc);

        // Fetch product details and statuses concurrently
        const [productDetails, statuses] = await Promise.all([
            Promise.all(flattenedContents.map(itemId =>
                axios.get(`${webflowConfig.webflowApiUrl}/collections/${webflowConfig.productsCollectionId}/items/${itemId}`, {
                    headers: { Authorization: `Bearer ${webflowConfig.webflowToken}` }
                }).then(({ data }) => data.fieldData)
            )),
            Promise.all(filteredContainers.map(({ fieldData }) =>
                axios.get(`${webflowConfig.webflowApiUrl}/collections/${webflowConfig.statusesCollectionId}/items/${fieldData.status}`, {
                    headers: { Authorization: `Bearer ${webflowConfig.webflowToken}` }
                }).then(({ data }) => data.fieldData)
            ))
        ]);

        // Aggregate final data
        const aggregatedData = filteredContainers.map(({ fieldData: containerFieldData }, index) => ({
            array: [
                {
                    array: [
                        {
                            fieldData: {
                                name: statuses[index].name,
                                slug: statuses[index].slug,
                                'data-ms-content': statuses[index]['data-ms-content'],
                                position: statuses[index].position,
                                procent: statuses[index].procent
                            }
                        }
                    ]
                }
            ],
            Products: containerFieldData.zawartosc.map(id => productDetails.find(product => product['cms-id'] === id)),
            fieldData: {
                'data-przybycia': containerFieldData['data-przybycia'],
                'data-zaladunku': containerFieldData['data-zaladunku'],
                'data-wyjscia': containerFieldData['data-wyjscia'],
                name: containerFieldData.name,
                slug: containerFieldData.slug,
                'data-ms-member-klient-id': containerFieldData['data-ms-member-klient-id'],
                zawartosc: containerFieldData.zawartosc,
                status: containerFieldData.status,
                'planowana-dostawa': containerFieldData['planowana-dostawa'],
                error: containerFieldData.error
            }
        }));

        res.status(200).json(aggregatedData);
    } catch (error) {
        console.error('Error running workflow:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint aktualizujący użytkownika w Memberstack
router.post('/memberstack/update-user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { order } = req.body;

        const { updateMemberstackUser } = await import('../memberstack.mjs');
        const result = await updateMemberstackUser(userId, order);

        res.status(200).json({ message: 'User updated successfully', data: result });
    } catch (error) {
        console.error(`Error updating user: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;