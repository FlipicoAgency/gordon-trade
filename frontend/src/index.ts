// Import funkcji z modułu `cartItems`
import {initializeCart} from './cartItems';

window.Webflow ||= [];
window.Webflow.push(async () => {
    try {
        await initializeCart();

        const currentUrl = window.location.href;
        let baseUrl = '';
        switch (true) {
            case currentUrl.includes("/cz"): // Czech
                baseUrl = "https://gordon-trade.com/cz/panel-b2b?kategoria=";
                break;
            case currentUrl.includes("/cn"): // Chinese
                baseUrl = "https://gordon-trade.com/cn/panel-b2b?kategoria=";
                break;
            case currentUrl.includes("/en"): // English
                baseUrl = "https://gordon-trade.com/en/panel-b2b?kategoria=";
                break;
            default: // Default language (e.g., Polish)
                baseUrl = "https://gordon-trade.webflow.io/panel-b2b?kategoria=";
                break;
        }

        const categoryListHome = document.querySelector('[category-list="home"]');
        const categoryListNav = document.querySelector('[category-list="nav"]');

        const updateCategoryLinks = (categoryList: Element | null, baseUrl: string) => {
            if (categoryList) {
                // Convert HTMLCollection to an array and iterate over elements
                Array.from(categoryList.children).forEach((item) => {
                    // Ensure item is of type Element
                    const element = item as HTMLElement;

                    const nameElement = element.querySelector<HTMLElement>('[category-item="name"]');
                    const linkElement = element.querySelector<HTMLAnchorElement>('[category-item="link"]');

                    if (nameElement && linkElement) {
                        const preparedUrl = nameElement.textContent?.trim().replace(/\s+/g, "+");
                        linkElement.href = `${baseUrl}${preparedUrl}`;
                    }
                });
            }
        };

        // Update links for both lists
        updateCategoryLinks(categoryListHome, baseUrl);
        updateCategoryLinks(categoryListNav, baseUrl);
    } catch (error) {
        console.error('Błąd podczas obsługi Webflow:', error);
    }
});
