var express = require('express');
var router = express.Router();
//const { clients } = require('../websocket');

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

module.exports = router;