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
                baseUrl = "/panel-b2b?kategoria=";
                break;
            case currentUrl.includes("/cn"): // Chinese
                baseUrl = "/panel-b2b?kategoria=";
                break;
            case currentUrl.includes("/en"): // English
                baseUrl = "/panel-b2b?kategoria=";
                break;
            default: // Default language (e.g., Polish)
                baseUrl = "/panel-b2b?kategoria=";
                break;
        }

        const categoryListHome = document.querySelector('[category-list="home"]');
        const categoryListNav = document.querySelector('[category-list="nav"]');
        const categoryListFooter = document.querySelector('[category-list="footer"]');
        const categoryListCategories = document.querySelector('[category-list="categories"]');
        const promoListNav = document.querySelector('[promo-list="nav"]');

        const updatePromoPrices = (promoList: Element | null) => {
            if (promoList) {
                // Convert HTMLCollection to an array and iterate over elements
                Array.from(promoList.children).forEach((productItem) => {
                    // Query elements with proper type assertions
                    const promo = productItem.querySelector<HTMLElement>('[data-price="promo"]');
                    const normal = productItem.querySelector<HTMLElement>('[data-price="normal"]');
                    const tagline = productItem.querySelector<HTMLElement>('.promo-tagline');
                    const span = productItem.querySelector<HTMLSpanElement>('.promo-percentage');

                    // Ensure all required elements are present
                    if (promo && normal && tagline && span) {
                        // Extract and parse text content to numbers
                        const promoPrice = parseFloat(promo.textContent?.trim() || '');
                        const normalPrice = parseFloat(normal.textContent?.trim() || '');

                        if (!isNaN(promoPrice) && !isNaN(normalPrice) && normalPrice > 0 && !promo.classList.contains('w-dyn-bind-empty')) {
                            // Calculate percentage
                            const percentage = Math.round(((promoPrice - normalPrice) / normalPrice) * 100);

                            // Update span content and display tagline
                            span.textContent = Math.abs(percentage) + '%';
                            tagline.style.display = 'block';
                        }
                    }
                });
            }
        };

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

        // Update promo prices
        updatePromoPrices(promoListNav);

        // Update links for lists
        updateCategoryLinks(categoryListHome, baseUrl);
        updateCategoryLinks(categoryListNav, baseUrl);
        updateCategoryLinks(categoryListFooter, baseUrl);
        updateCategoryLinks(categoryListCategories, baseUrl);
    } catch (error) {
        console.error('Błąd podczas obsługi Webflow:', error);
    }
});
