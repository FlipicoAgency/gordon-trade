// Import funkcji z modułu `cartItems`
import {initializeCart} from './cartItems';

window.Webflow ||= [];
window.Webflow.push(async () => {
    try {
        await initializeCart();
    } catch (error) {
        console.error('Błąd podczas obsługi Webflow:', error);
    }
});
