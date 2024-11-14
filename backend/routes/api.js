var express = require('express');
var router = express.Router();
//const { clients } = require('../websocket');
const axios = require('axios');

const config = {
    webflowApiUrl: 'https://api.webflow.com/v2',
    webflowToken: '34f47bfe4c8cb71babd3bfda12102276c33e2a48c532dde5d11a5540e7edd27c',
    containersCollectionId: '6723715370c537f5a2e31c79',
    productsCollectionId: '671f74158ad8b36b6c82188c',
    statusesCollectionId: '671fa6eea160e723f30e9c27',
    siteId: '671f56de2f5de134f0f39123',
};

// Pobierz określony produkt na podstawie ID
router.get('/products/:productId', async (req, res) => {
    const productId = req.params.productId; // Pobierz ID produktu z URL
    const apiUrl = `https://api.webflow.com/v2/collections/671f74158ad8b36b6c82188c/items/${productId}`; // Wstaw ID produktu do URL

    try {
        const apiResponse = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer 34f47bfe4c8cb71babd3bfda12102276c33e2a48c532dde5d11a5540e7edd27c'
            }
        });

        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({ error: 'Product not found' });
        }

        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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
        // Step 1: Receive webhook data
        const webhookData = req.body;
        //console.log('Step 1 - Webhook data received: ', webhookData);

        // Step 2: Fetch all items from Webflow collection
        const allItems = await fetchContainers();
        //console.log('Step 2 - All containers fetched from Webflow:', allItems);

        // Step 3: Apply filters and aggregation based on specific fields
        const filteredContainers = filterItems(allItems, webhookData);
        console.log('Step 3 - Filtered containers based on parsed data:', filteredContainers);

        // Step 4: Iterate over items and process each
        const processedContainersContents = await processContainers(filteredContainers);
        console.log('Step 4 - Processed container contents:', processedContainersContents);

        // Flatten the processed container contents array
        const flattenedContents = processedContainersContents.flat();
        console.log('Flattened processed container contents:', flattenedContents);

        // Step 5: Fetch product details for each item
        const productDetails = await fetchProductDetails(flattenedContents);
        console.log('Step 5 - Product details fetched:', productDetails);


        // Step 6: Set variables or aggregate data
        const products = aggregateData(productDetails);
        console.log('Step 6 - Aggregated product data:', products);

        // Step 7: Fetch status for each item
        const statuses = await fetchStatus(filteredContainers);
        console.log('Step 7 - Fetched statuses for filtered containers:', statuses);

        // Step 8: Final aggregation of all data
        const aggregatedData = aggregateFinalData(statuses, products, filteredContainers.fieldData);
        console.log('Step 8 - Final aggregated data:', aggregatedData);

        // Step 9: Respond with aggregated data
        res.status(200).json(aggregatedData);
        console.log('Step 9 - Response sent with aggregated data:', aggregatedData);

    } catch (error) {
        console.error('Error running workflow:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Helper functions
async function fetchContainers() {
    // Fetch items from Webflow
    return axios.get(`${config.webflowApiUrl}/collections/${config.containersCollectionId}/items`, {
        headers: { Authorization: `Bearer ${config.webflowToken}` }
    }).then(response => response.data.items);
}

function filterItems(items, webhookData) {
    // Example filter based on client ID
    return items.filter(item => item.fieldData['data-ms-member-klient-id'] === webhookData.id);
}

async function processContainers(items) {
    // Process items logic
    return items.map(item => item.fieldData.zawartosc);
}

async function fetchProductDetails(items) {
    // Fetch product details from Webflow for each item
    return Promise.all(items.map(item =>
        axios.get(`${config.webflowApiUrl}/collections/${config.productsCollectionId}/items/${item}`, {
            headers: { Authorization: `Bearer ${config.webflowToken}` }
        }).then(response => response.data)));
}

function aggregateData(data) {
    // Aggregate data logic
    return data.map(item => item.fieldData);;
}

async function fetchStatus(items) {
    // Fetch status for each item
    return Promise.all(items.map(item =>
        axios.get(`${config.webflowApiUrl}/collections/${config.statusesCollectionId}/items/${item.fieldData.status}`, {
            headers: { Authorization: `Bearer ${config.webflowToken}` }
        }).then(response => response.data)));
}

function aggregateFinalData(statusData, products, containers) {
    // Final aggregation
    return { statusData, products, containers };
}

module.exports = router;