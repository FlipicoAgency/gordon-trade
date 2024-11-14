const express = require('express');
const router = express.Router();
//const { clients } = require('../websocket');
const axios = require('axios');
import memberstackAdmin from "@memberstack/admin";

const webflowConfig = {
    webflowApiUrl: 'https://api.webflow.com/v2',
    webflowToken: '34f47bfe4c8cb71babd3bfda12102276c33e2a48c532dde5d11a5540e7edd27c',
    containersCollectionId: '6723715370c537f5a2e31c79',
    productsCollectionId: '671f74158ad8b36b6c82188c',
    statusesCollectionId: '671fa6eea160e723f30e9c27',
    siteId: '671f56de2f5de134f0f39123',
};

const memberstackConfig = {
    memberstackSecretKey: 'sk_sb_2612076c66d651e8bc1e',
    memberstackPublicKey: 'pk_sb_c4a3e6d9fab2ca06ce6e',
};

const memberstack = memberstackAdmin.init(memberstackConfig.memberstackSecretKey);

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

router.post('/memberstack/update-user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { order } = req.body;

    try {
        // Aktualizacja użytkownika w Memberstacku z dodaniem zamówienia do metaData
        const response = await memberstack.members.update({
            id: userId,
            data: {
                metaData: {
                    orders: order
                }
            }
        });

        // Sprawdzenie odpowiedzi
        if (response.error) {
            throw new Error(`Memberstack update failed: ${response.error}`);
        }

        res.status(200).json({ message: 'User updated successfully', data: response });
    } catch (error) {
        console.error('Error updating Memberstack user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

module.exports = router;