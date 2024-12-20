const express = require('express');
const router = express.Router();
//const { clients } = require('../websocket');
const axios = require('axios');
const { getSheetsInstance } = require('../googleSheetsClient');

const webflowConfig = {
    webflowApiUrl: 'https://api.webflow.com/v2',
    //webflowToken: `${process.env.WEBLOW_TOKEN}`,
    webflowToken: '34f47bfe4c8cb71babd3bfda12102276c33e2a48c532dde5d11a5540e7edd27c',
    containersCollectionId: '6723715370c537f5a2e31c79',
    productsCollectionId: '671f74158ad8b36b6c82188c',
    statusesCollectionId: '671fa6eea160e723f30e9c27',
    categoriesCollectionId: '671f61456cbcd434a4a123d4',
    siteId: '671f56de2f5de134f0f39123',
};

const SPREADSHEET_ID = '14vV1YgB7M2kc8uwIRHBUateZhB1RL1RzIwThdn1jbs8';

// Funkcja pomocnicza do pobrania ostatniego wiersza
async function getLastRow(sheets) {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Orders B2B!A:A', // Kolumna A
    });

    return response.data.values.length; // Liczba istniejących wierszy
}

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
            range: 'Orders B2B!A1:N', // Zakres danych
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
                    name: row[2],       // Kolumna Product name
                    id: row[3],         // Kolumna Product ID
                    variant: row[4],    // Kolumna Product variant
                    quantity: row[5],   // Kolumna Quantity
                    price: row[6],      // Kolumna Quantity
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
            range: 'Orders B2B!A1:N',
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

                const columnsToMerge = [0, 1, 7, 8, 9, 10, 11, 12, 13];
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

        // Dodanie obramowań dla całego zakresu A:O
        mergeRequests.push({
            updateBorders: {
                range: {
                    sheetId: 24398558, // ID arkusza (Orders)
                    startRowIndex: currentRow - 1, // Pierwszy wiersz do obramowania
                    endRowIndex: currentRow + values.length - 1, // Ostatni wiersz (liczba dodanych wierszy)
                    startColumnIndex: 0, // Kolumna A
                    endColumnIndex: 14, // Kolumna N (14, bo endColumnIndex jest wyłączny)
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
                    endColumnIndex: 14, // Kolumna N (14, bo endColumnIndex jest wyłączny)
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
/**
 * Funkcja do normalizacji NIP-u poprzez usunięcie wszelkich znaków niebędących cyframi.
 * @param nip NIP do znormalizowania.
 * @returns Znormalizowany NIP.
 */
function normalizeNip(nip) {
    return nip.replace(/\D/g, ''); // Usuwa wszystkie znaki niebędące cyframi
}

router.get('/sheets/containers', async (req, res) => {
    const { nip } = req.query; // NIP przekazany jako query parameter

    if (!nip || typeof nip !== 'string') {
        return res.status(400).json({ error: 'Parametr "nip" jest wymagany i musi być ciągiem znaków.' });
    }

    const normalizedQueryNip = normalizeNip(nip);
    if (normalizedQueryNip.length !== 10) { // Standardowy format NIP to 10 cyfr
        return res.status(400).json({ error: 'Podany NIP ma nieprawidłowy format.' });
    }

    try {
        const sheets = await getSheetsInstance();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Containers!A1:X', // Zakres danych
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Brak danych w arkuszu.' });
        }

        // Pobierz nagłówki i dane
        const [headers, ...data] = rows;

        // Znajdź indeksy interesujących kolumn
        const indices = {
            customerNip: headers.indexOf('Customer NIP'),
            orderId: headers.indexOf('Order ID'),
            containerNo1: headers.indexOf('Container No1'),
            containerNo2: headers.indexOf('Container No2'),
            estimatedDeparture: headers.indexOf('Estimated time of departure'),
            fastestShipping: headers.indexOf('Fastest possible shipping date'),
            estimatedArrival: headers.indexOf('Estimated time of arrival'),
            extendedDelivery: headers.indexOf('Extended delivery date'),
            productName: headers.indexOf('Product Name'), // Przykładowe kolumny produktów
            productVariant: headers.indexOf('Product Variant'),
            quantity: headers.indexOf('Quantity'),
            estimatedFreight: headers.indexOf('Estimated Freight'),
            capacity: headers.indexOf('Capacity'),
        };

        // Sprawdź, czy wszystkie wymagane kolumny zostały znalezione
        const requiredColumns = Object.values(indices).every(index => index !== -1);
        if (!requiredColumns) {
            return res.status(500).json({ error: 'Niektóre wymagane kolumny nie zostały znalezione w arkuszu.' });
        }

        // Zmienna do śledzenia ostatnich wartości dla scalonych komórek
        let lastValues = {
            customerNip: null,
            orderId: null,
            containerNo1: null,
            containerNo2: null,
            estimatedDeparture: null,
            fastestShipping: null,
            estimatedArrival: null,
            extendedDelivery: null,
        };

        const orders = [];

        // Procesowanie danych
        data.forEach((row, rowIndex) => {
            // Pobierz bieżącą wartość NIP z wiersza, znormalizowaną
            const currentCustomerNip = row[indices.customerNip] ? normalizeNip(row[indices.customerNip]) : null;

            // Sprawdź, czy aktualny NIP pasuje do podanego w zapytaniu
            if (currentCustomerNip !== normalizedQueryNip) {
                // Opcjonalnie: logowanie, gdy NIP jest pusty lub nie pasuje
                console.log(`Wiersz ${rowIndex + 2} - NIP nie pasuje lub jest pusty: ${currentCustomerNip} !== ${normalizedQueryNip}`);
                return; // Pomijamy wiersz, jeśli NIP jest pusty lub nie pasuje
            }

            // Aktualizuj wartości dla scalonych kolumn
            const orderId = row[indices.orderId] || lastValues.orderId;
            const containerNo1 = row[indices.containerNo1] || lastValues.containerNo1;
            const containerNo2 = row[indices.containerNo2] || lastValues.containerNo2;
            const estimatedDeparture = row[indices.estimatedDeparture] || lastValues.estimatedDeparture;
            const fastestShipping = row[indices.fastestShipping] || lastValues.fastestShipping;
            const estimatedArrival = row[indices.estimatedArrival] || lastValues.estimatedArrival;
            const extendedDelivery = row[indices.extendedDelivery] || lastValues.extendedDelivery;

            // Znajdź istniejące zamówienie
            let existingOrder = orders.find((order) => order.orderId === orderId);

            if (!existingOrder) {
                // Twórz nowe zamówienie, jeśli nie istnieje
                existingOrder = {
                    customerNip: currentCustomerNip,
                    orderId: orderId,
                    containerNo1: containerNo1,
                    containerNo2: containerNo2,
                    estimatedDeparture: estimatedDeparture,
                    fastestShipping: fastestShipping,
                    estimatedArrival: estimatedArrival,
                    extendedDelivery: extendedDelivery,
                    products: [], // Pusta tablica na produkty
                };

                orders.push(existingOrder);
            }

            // Dodaj produkt do zamówienia
            const product = {
                name: row[indices.productName] || '',               // Kolumna Product Name
                variant: row[indices.productVariant] || '',         // Kolumna Product Variant
                quantity: row[indices.quantity] || '0',             // Kolumna Quantity
                estimatedFreight: row[indices.estimatedFreight] || '', // Kolumna Estimated Freight
                capacity: row[indices.capacity] || '',               // Kolumna Capacity
            };

            existingOrder.products.push(product);
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
            range: 'Orders!A1:X',
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

/// Dodaj przedmiot do koszyka
router.post('/cart', (req, res) => {
    if (!req.session.cart) {
        req.session.cart = []; // Inicjalizacja koszyka, jeśli nie istnieje
    }

    const item = req.body;
    const { id, variant } = item;

    if (!id || typeof item.quantity !== 'number' || item.quantity <= 0) {
        return res.status(400).send({ message: 'Invalid item data' });
    }

    // Sprawdź, czy przedmiot już istnieje w koszyku
    const existingItem = req.session.cart.find(
        i => i.id === id && (i.variant || null) === (variant || null)
    );

    if (existingItem) {
        existingItem.quantity += item.quantity;
    } else {
        req.session.cart.push(item);
    }

    console.log('Koszyk został zaktualizowany:', req.session.cart);
    res.status(201).send(req.session.cart);
});

// Pobierz koszyk
router.get('/cart', (req, res) => {
    res.json(req.session.cart || []);
});

// Zaktualizuj ilość przedmiotu w koszyku
router.put('/cart/:itemId', (req, res) => {
    const { itemId } = req.params;
    const { variant, quantity } = req.body;

    if (!req.session.cart) {
        return res.status(404).send({ message: 'Cart is empty' });
    }

    console.log('Koszyk przed aktualizacją:', req.session.cart);
    console.log('Dane żądania:', { itemId, variant, quantity });

    // Znajdź przedmiot w koszyku
    const item = req.session.cart.find(
        i => i.id === itemId && (i.variant ?? null) === (variant ?? null)
    );

    if (item) {
        console.log('Znaleziono przedmiot do aktualizacji:', item);

        // Zaktualizuj ilość
        item.quantity = quantity;

        console.log('Koszyk po aktualizacji:', req.session.cart);

        res.send(req.session.cart);
    } else {
        console.error('Nie znaleziono przedmiotu w koszyku:', { itemId, variant });
        res.status(404).send({ message: 'Item not found' });
    }
});

// Usuń przedmiot z koszyka
router.delete('/cart/:itemId', (req, res) => {
    const { itemId } = req.params;
    const { variant } = req.body;

    if (!req.session.cart) {
        return res.status(404).send({ message: 'Cart is empty' });
    }

    console.log('Przed usunięciem:', req.session.cart);

    // Upewnij się, że porównanie variant obsługuje brak wartości null lub undefined
    req.session.cart = req.session.cart.filter(
        i => !(i.id === itemId && (i.variant ?? null) === (variant ?? null))
    );

    console.log('Po usunięciu:', req.session.cart);

    res.send(req.session.cart);
});

// Opróżnij koszyk
router.delete('/cart', (req, res) => {
    req.session.cart = [];
    res.send(req.session.cart);
});

module.exports = router;