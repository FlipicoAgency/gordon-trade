const express = require('express');
const router = express.Router();
//const { clients } = require('../websocket');
const axios = require('axios');
const { getSheetsInstance } = require('../googleSheetsClient');
const { Translate } = require('@google-cloud/translate').v2;

// Inicjalizacja klienta z kluczem API
const translate = new Translate({ key: process.env.GOOGLE_TRANSLATE_API_KEY });

async function translateText(text, targetLanguage) {
    try {
        const [translation] = await translate.translate(text, targetLanguage);
        console.log(`Translation: ${translation}`);
        return translation;
    } catch (error) {
        console.error('Error translating text:', error);
        throw error;
    }
}

const webflowConfig = {
    webflowApiUrl: 'https://api.webflow.com/v2',
    //webflowToken: `${process.env.WEBLOW_TOKEN}`,
    webflowToken: '101b6d48d3bddfc2b5ab504b3c8f41f2a2a9e5893983a6dbf0467ab8e3580934',
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

// Pobierz zamówienia kontenerowe
/**
 * Funkcja do normalizacji NIP-u poprzez usunięcie wszelkich znaków niebędących cyframi.
 * @param nip NIP do znormalizowania.
 * @returns Znormalizowany NIP.
 */
function normalizeNip(nip) {
    return nip.replace(/\D/g, ''); // Usuwa wszystkie znaki niebędące cyframi
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
            range: 'Orders B2B!A1:O',  // Zakres danych
            valueRenderOption: 'UNFORMATTED_VALUE', // Ważne: zwraca surowe, niesformatowane wartości
            majorDimension: 'ROWS',    // (opcjonalne) Upewnia się, że dane są wierszami
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Brak danych w arkuszu.' });
        }

        // Pobierz nagłówki (pierwszy wiersz) i dane (reszta wierszy)
        const [headers, ...data] = rows;

        let lastNIP = null;
        let lastOrderId = null;
        let lastCustomerName = null;
        const orders = [];

        // Procesowanie danych wiersz po wierszu
        data.forEach((row) => {
            // Rzutuj NIP i Order ID na string — nawet jeśli są liczbami
            let cellNip = row[0] !== undefined && row[0] !== null ? String(row[0]) : null;
            let cellCustomerName = row[1] !== undefined && row[1] !== null ? String(row[1]) : null;
            let cellOrderId = row[2] !== undefined && row[2] !== null ? String(row[2]) : null;

            // Jeśli w komórce jest coś, uaktualniamy lastNIP / lastOrderId / lastCostumerName
            if (cellNip) lastNIP = cellNip;
            if (lastCustomerName ) lastCustomerName = cellCustomerName;
            if (cellOrderId) lastOrderId = cellOrderId;

            // Filtruj zamówienia na podstawie NIP
            if (lastNIP === nip) {
                // Szukamy istniejącego zamówienia w tablicy orders
                let existingOrder = orders.find(order => order.orderId === lastOrderId);

                if (!existingOrder) {
                    // Tworzymy nowe zamówienie na podstawie aktualnego wiersza
                    existingOrder = headers.reduce((acc, header, index) => {
                        // Jeśli row[index] jest undefined, wpisujemy pusty string
                        acc[header] = row[index] !== undefined ? row[index] : '';
                        return acc;
                    }, { products: [] });

                    // Ustawiamy orderId i Customer Name explicite
                    existingOrder.orderId = lastOrderId;
                    existingOrder.customerName = lastCustomerName;
                    orders.push(existingOrder);
                }

                // Dodaj produkt do zamówienia
                existingOrder.products.push({
                    name: row[3] !== undefined ? row[3] : '',       // Product name (kolumna 3)
                    id: row[4] !== undefined ? String(row[4]) : '', // Product ID (kolumna 4)
                    variant: row[5] !== undefined ? String(row[5]) : '',
                    quantity: row[6] !== undefined ? String(row[6]) : '',
                    price: row[7] !== undefined ? String(row[7]) : '',
                });
            }
        });

        console.log('Orders:', orders);
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
            range: 'Orders B2B!A1:O',
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

                const columnsToMerge = [0, 1, 2, 8, 9, 10, 11, 12, 13, 14];
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
                    endColumnIndex: 15, // Kolumna O (15, bo endColumnIndex jest wyłączny)
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
                    endColumnIndex: 15, // Kolumna O (14, bo endColumnIndex jest wyłączny)
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

router.get('/sheets/containers', async (req, res) => {
    const { nip, pending } = req.query;

    if (!nip || typeof nip !== 'string') {
        return res.status(400).json({ error: 'Parametr "nip" jest wymagany i musi być ciągiem znaków.' });
    }

    const normalizedQueryNip = normalizeNip(nip);
    if (normalizedQueryNip.length !== 10) {
        return res.status(400).json({ error: 'Podany NIP ma nieprawidłowy format.' });
    }

    try {
        const sheets = await getSheetsInstance();

        // Sprawdzenie, czy w zapytaniu jest pending=true
        const sheetRange = pending === 'true' ? 'Containers Pending!A1:AB' : 'Containers!A1:AB';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: sheetRange,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Brak danych w arkuszu.' });
        }

        const [headers, ...data] = rows;

        // Indeksy wymaganych kolumn
        const indices = {
            customerNip: headers.indexOf('Customer NIP'),
            orderId: headers.indexOf('Order ID'),
            containerNo1: headers.indexOf('Container No1'),
            containerNo2: headers.indexOf('Container No2'),
            containerType: headers.indexOf('Container type'),
            fvPdf: headers.indexOf('FV PDF'),
            fvAmountNetto: headers.indexOf('FV amount (netto)'),
            fvNo: headers.indexOf('FV No'),
            loadingPort: headers.indexOf('Loading port'),
            personalization: headers.indexOf('Personalization'),
            qualityControlPhotos: headers.indexOf('Quality control photos'),
            changeInTransportationCost: headers.indexOf('Change in transportation cost'),
            periodicity: headers.indexOf('Periodicity'),
            estimatedDeparture: headers.indexOf('Estimated time of departure'),
            fastestShipping: headers.indexOf('Fastest possible shipping date'),
            estimatedArrival: headers.indexOf('Estimated time of arrival'),
            extendedDelivery: headers.indexOf('Extended delivery date'),
            productName: headers.indexOf('Product Name'),
            productVariant: headers.indexOf('Product Variant'),
            productSKU: headers.indexOf('Product SKU'),
            productImage: headers.indexOf('Product image'),
            quantity: headers.indexOf('Quantity'),
            estimatedFreight: headers.indexOf('Estimated Freight'),
            capacity: headers.indexOf('Capacity'),
            available: headers.indexOf('Available to buy')
        };

        // Sprawdzenie brakujących kolumn
        const missingColumns = Object.keys(indices).filter(key => indices[key] === -1);
        if (missingColumns.length > 0) {
            return res.status(500).json({
                error: `Brakuje następujących kolumn w arkuszu: ${missingColumns.join(', ')}.`
            });
        }

        // Funkcja do uzupełniania scalonych komórek
        function fillMergedCells(data, columns) {
            const filledData = [...data];
            columns.forEach(columnIndex => {
                let lastValue = null;
                filledData.forEach(row => {
                    if (row[columnIndex]) {
                        lastValue = row[columnIndex];
                    } else {
                        row[columnIndex] = lastValue;
                    }
                });
            });
            return filledData;
        }

        // Uzupełnij scalone komórki dla Container No1 i Container No2
        const filledData = fillMergedCells(data, [indices.containerNo1, indices.containerNo2]);

        const containersMap = new Map();

        // Przetwarzanie danych
        filledData.forEach((row) => {
            const currentCustomerNip = row[indices.customerNip] ? normalizeNip(row[indices.customerNip]) : null;

            if (currentCustomerNip !== normalizedQueryNip) {
                return;
            }

            const containerNo1 = row[indices.containerNo1];
            if (!containerNo1) {
                return;
            }

            // Jeśli kontener już istnieje w mapie, dodaj produkt do listy produktów
            if (containersMap.has(containerNo1)) {
                const existingContainer = containersMap.get(containerNo1);
                existingContainer.products.push({
                    name: row[indices.productName] || 'Nieznany produkt',
                    variant: row[indices.productVariant] || 'Brak',
                    quantity: parseInt(row[indices.quantity], 10) || 0,
                    estimatedFreight: parseFloat(row[indices.estimatedFreight]) || 0,
                    capacity: parseFloat(row[indices.capacity]) || 0,
                    sku: row[indices.productSKU],
                    image: row[indices.productImage]
                });
            } else {
                // Jeśli kontener nie istnieje, dodaj go do mapy
                containersMap.set(containerNo1, {
                    customerNip: currentCustomerNip,
                    orderId: row[indices.orderId],
                    containerNo1,
                    containerNo2: row[indices.containerNo2],
                    containerType: row[indices.containerType] || 'Brak',
                    fvPdf: row[indices.fvPdf] || 'Brak',
                    fvAmountNetto: row[indices.fvAmountNetto] || 0,
                    fvNo: row[indices.fvNo] || 'Brak',
                    loadingPort: row[indices.loadingPort] || 'Brak',
                    personalization: row[indices.personalization] || 'Brak',
                    available: row[indices.available] || 'Nie',
                    qualityControlPhotos: row[indices.qualityControlPhotos] || 'Brak',
                    changeInTransportationCost: row[indices.changeInTransportationCost] || 'Brak',
                    periodicity: row[indices.periodicity] || 'Brak',
                    estimatedDeparture: row[indices.estimatedDeparture],
                    fastestShipping: row[indices.fastestShipping],
                    estimatedArrival: row[indices.estimatedArrival],
                    extendedDelivery: row[indices.extendedDelivery],
                    products: [
                        {
                            name: row[indices.productName] || 'Nieznany produkt',
                            variant: row[indices.productVariant] || 'Brak',
                            quantity: parseInt(row[indices.quantity], 10) || 0,
                            estimatedFreight: parseFloat(row[indices.estimatedFreight]) || 0,
                            capacity: parseFloat(row[indices.capacity]) || 0,
                            sku: row[indices.productSKU],
                            image: row[indices.productImage]
                        },
                    ],
                });
            }
        });

        // Konwersja mapy na tablicę kontenerów
        const containers = Array.from(containersMap.values());

        res.status(200).json(containers);
    } catch (error) {
        console.error('Błąd pobierania danych z arkusza:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Dodaj zamówienia kontenerowe
// router.post('/sheets/containers', async (req, res) => {
//     const { values } = req.body;
//     if (!values || !Array.isArray(values)) {
//         return res.status(400).json({ error: 'Nieprawidłowe dane.' });
//     }
//
//     try {
//         const sheets = await getSheetsInstance();
//
//         // Dodaj nowe wiersze
//         const appendResponse = await sheets.spreadsheets.values.append({
//             spreadsheetId: SPREADSHEET_ID,
//             range: 'Orders!A1:X',
//             valueInputOption: 'USER_ENTERED',
//             resource: { values },
//         });
//         console.log('Append Response:', appendResponse.data);
//
//         // Scal odpowiednie komórki
//         const mergeRequests = [];
//         let currentRow = await getLastRow(sheets);
//
//         values.forEach((row, index) => {
//             if (row[0] !== '') {
//                 const startRow = currentRow + index;
//                 const endRow = startRow + values.filter((r) => r[0] === '').length || startRow + 1;
//
//                 const columnsToMerge = [0, 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
//                 columnsToMerge.forEach((colIndex) => {
//                     mergeRequests.push({
//                         mergeCells: {
//                             range: {
//                                 sheetId: 24398558,
//                                 startRowIndex: startRow - 1,
//                                 endRowIndex: endRow,
//                                 startColumnIndex: colIndex,
//                                 endColumnIndex: colIndex + 1,
//                             },
//                             mergeType: 'MERGE_ALL',
//                         },
//                     });
//                 });
//             }
//         });
//
//         // Dodanie obramowań dla całego zakresu A:U
//         mergeRequests.push({
//             updateBorders: {
//                 range: {
//                     sheetId: 24398558, // ID arkusza (Orders)
//                     startRowIndex: currentRow - 1, // Pierwszy wiersz do obramowania
//                     endRowIndex: currentRow + values.length - 1, // Ostatni wiersz (liczba dodanych wierszy)
//                     startColumnIndex: 0, // Kolumna A
//                     endColumnIndex: 23, // Kolumna W (23, bo endColumnIndex jest wyłączny)
//                 },
//                 top: {
//                     style: 'SOLID',
//                     width: 1,
//                     color: { red: 0, green: 0, blue: 0 },
//                 },
//                 bottom: {
//                     style: 'SOLID',
//                     width: 1,
//                     color: { red: 0, green: 0, blue: 0 },
//                 },
//                 left: {
//                     style: 'SOLID',
//                     width: 1,
//                     color: { red: 0, green: 0, blue: 0 },
//                 },
//                 right: {
//                     style: 'SOLID',
//                     width: 1,
//                     color: { red: 0, green: 0, blue: 0 },
//                 },
//                 innerHorizontal: {
//                     style: 'SOLID',
//                     width: 1,
//                     color: { red: 0, green: 0, blue: 0 },
//                 },
//                 innerVertical: {
//                     style: 'SOLID',
//                     width: 1,
//                     color: { red: 0, green: 0, blue: 0 },
//                 },
//             },
//         });
//
//         // Dodanie wycentrowania tekstu dla całego zakresu A:U
//         mergeRequests.push({
//             repeatCell: {
//                 range: {
//                     sheetId: 24398558, // ID arkusza (Orders)
//                     startRowIndex: currentRow - 1, // Pierwszy wiersz do wycentrowania
//                     endRowIndex: currentRow + values.length - 1, // Ostatni wiersz
//                     startColumnIndex: 0, // Kolumna A
//                     endColumnIndex: 23, // Kolumna W (23, bo endColumnIndex jest wyłączny)
//                 },
//                 cell: {
//                     userEnteredFormat: {
//                         horizontalAlignment: 'CENTER', // Wycentrowanie poziome
//                         verticalAlignment: 'MIDDLE', // Wycentrowanie pionowe
//                     },
//                 },
//                 fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)', // Wskaż zmieniane pola
//             },
//         });
//
//         if (mergeRequests.length === 0) {
//             throw new Error('Brak żądań scalania komórek.');
//         }
//
//         console.log('Merge Requests:', JSON.stringify(mergeRequests, null, 2));
//
//         const batchResponse = await sheets.spreadsheets.batchUpdate({
//             spreadsheetId: SPREADSHEET_ID,
//             resource: {
//                 requests: mergeRequests,
//             },
//         });
//         console.log('BatchUpdate Response:', JSON.stringify(batchResponse.data, null, 2));
//
//         res.status(201).json({ message: 'Dane zostały dodane do arkusza.' });
//     } catch (error) {
//         console.error('Błąd dodawania danych do arkusza:', error);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// });

// Pobierz określony produkt na podstawie ID
router.get('/products/:productId', async (req, res) => {
    const productId = req.params.productId; // Pobierz ID produktu z URL
    const targetLang = req.query.lang || 'en'; // Domyślnie język angielski
    const apiUrl = `${webflowConfig.webflowApiUrl}/collections/${webflowConfig.productsCollectionId}/items/${productId}`;

    try {
        const response = await axios.get(apiUrl, {
            headers: { 'Authorization': `Bearer ${webflowConfig.webflowToken}` }
        });

        const product = response.data;
        console.log('PRODUCT:', product);

        // Tłumaczenie nazwy produktu tylko, gdy targetLang nie jest "pl"
        if (targetLang !== 'pl') {
            const translatedName = await translateText(product.fieldData.name, targetLang);
            product.fieldData.name = translatedName;
        }

        res.json(product);
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
    const { id, variant, quantity, lineCost } = item;

    if (!id || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).send({ message: 'Invalid item data' });
    }

    // Sprawdź, czy przedmiot już istnieje w koszyku
    const existingItem = req.session.cart.find(
        i => i.id === id && (i.variant || null) === (variant || null)
    );

    if (existingItem) {
        existingItem.quantity = quantity;    // nadpisz w całości
        existingItem.lineCost = lineCost;    // nadpisz w całości
        existingItem.price = existingItem.lineCost / existingItem.quantity;
    } else {
        // DODAJEMY
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
    const { variant, quantity, price, lineCost } = req.body;

    if (!req.session.cart) {
        return res.status(404).send({ message: 'Cart is empty' });
    }

    //console.log('Koszyk przed aktualizacją:', req.session.cart);
    //console.log('Dane żądania:', { itemId, variant, quantity, price });

    // Znajdź przedmiot w koszyku
    const item = req.session.cart.find(
        i => i.id === itemId && (i.variant ?? null) === (variant ?? null)
    );

    if (item) {
        //console.log('Znaleziono przedmiot do aktualizacji:', item);

        // Zaktualizuj
        item.quantity = quantity;
        item.lineCost = lineCost;
        item.price = price;

        //console.log('Koszyk po aktualizacji:', req.session.cart);

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

    //console.log('Przed usunięciem:', req.session.cart);

    // Upewnij się, że porównanie variant obsługuje brak wartości null lub undefined
    req.session.cart = req.session.cart.filter(
        i => !(i.id === itemId && (i.variant ?? null) === (variant ?? null))
    );

    //console.log('Po usunięciu:', req.session.cart);

    res.send(req.session.cart);
});

// Opróżnij koszyk
router.delete('/cart', (req, res) => {
    req.session.cart = [];
    res.send(req.session.cart);
});

module.exports = router;

