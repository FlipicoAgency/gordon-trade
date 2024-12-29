import {initializeAddToCartButtons, initializeCart} from './cartItems';
import {calculatePromoPercentage} from "./shop";

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

        if (currentUrl.includes("/produkty")) { await initializeAddToCartButtons(); }

        const categoryListHome = document.querySelector('[category-list="home"]');
        const categoryListNav = document.querySelector('[category-list="nav"]');
        const categoryListFooter = document.querySelector('[category-list="footer"]');
        const categoryListCategories = document.querySelector('[category-list="categories"]');
        const promoListNav = document.querySelector('[promo-list="nav"]');
        const promoListProductPage = document.querySelector('[promo-list="product"]');

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

        if (promoListNav) {
            // Konwertujemy `promoListNav.children` na tablicę elementów (HTMLElement[])
            const navItems = Array.from(promoListNav.children) as HTMLElement[];
            await calculatePromoPercentage(navItems);
        }

        if (promoListProductPage) {
            const productItems = Array.from(promoListProductPage.children) as HTMLElement[];

            // Tworzymy tablicę z jedynym elementem
            const singleElementArray = [ productItems[0] ];

            // Wywołujemy funkcję z tablicą (zawierającą wyłącznie ten pierwszy element)
            await calculatePromoPercentage(singleElementArray);
        }

        // Update links for lists
        updateCategoryLinks(categoryListHome, baseUrl);
        updateCategoryLinks(categoryListNav, baseUrl);
        updateCategoryLinks(categoryListFooter, baseUrl);
        updateCategoryLinks(categoryListCategories, baseUrl);
    } catch (error) {
        console.error('Błąd podczas obsługi Webflow:', error);
    }
});
