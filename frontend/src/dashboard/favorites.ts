import {getMemberJSON, updateMemberJSON} from "../memberstack";
import {fetchProductDetails, initializeAddToCartButtons} from "../cartItems";
import type {Product} from "../cartItems";
import {initializeGenerateOffer} from "./generate-offer";

export interface Category {
    id: string;
    cmsLocaleId: string;
    lastPublished: string;
    lastUpdated: string;
    createdOn: string;
    isArchived: boolean;
    isDraft: boolean;
    fieldData: {
        name: string;
        slug: string;
        zdjecie: {
            fileId: string;
            url: string;
            alt: string | null;
        };
        ikona: {
            fileId: string;
            url: string;
            alt: string | null;
        };
    };
}

const noResultElement = document.querySelector('[favorites="none"]') as HTMLElement;
const favoriteList = document.querySelector('.favorite_list') as HTMLElement;

export let categoryMap: Record<string, string> = {};

// Function to fetch product details by productId
const fetchCategories = async (): Promise<void> => {
    try {
        const response = await fetch(`https://gordon-trade.onrender.com/api/categories`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch categories`);
        }

        const data: { items: Category[] } = await response.json();
        categoryMap = data.items.reduce((map, category) => {
            map[category.id] = category.fieldData.name;
            return map;
        }, {} as Record<string, string>);

        //console.log(`Category map initialized:`, categoryMap);
    } catch (error) {
        console.error(`Error fetching categories:`, error);
    }
};

const generateFavoriteItem = (product: Product): HTMLElement => {
    const categoryName = categoryMap[product.fieldData.kategoria] || 'Unknown Category';

    const li = document.createElement('li');
    li.className = 'favorite_list_item';
    li.innerHTML = `
        <div class="favorite_wrapper">
            <img loading="lazy" src="${product.fieldData.miniatura?.url}" alt="${product.fieldData.miniatura?.alt || product.fieldData.name}" class="favorite_image">
            <div class="favorite_product">
                <div class="favorite_product_name">
                    <div class="text-size-medium text-weight-semibold">${product.fieldData.name}</div>
                    <div class="text-size-small">${categoryName}</div>
                </div>
                <div class="favorite_product_price">
                    <div class="price-embed w-embed">
                        <p class="heading-style-h6 text-color-brand"><span>${product.fieldData.cena.toFixed(2)}</span> zł</p>
                    </div>
                    ${product.fieldData.promocja ? `
                    <div class="promo-tagline w-embed">
                        <span aria-label="Minus" style="position: relative; top:-0.0625rem">–</span>
                        <span>10</span>% 
                    </div>` : ''}
                </div>
                <div class="favorite_product_details">
                    <div class="favorite_product_details_stock ${product.fieldData.produktNiedostepny ? 'hide' : ''}">
                        <div class="icon-1x1-xxsmall is-yes">
                            <svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256"><path d="M176.49,95.51a12,12,0,0,1,0,17l-56,56a12,12,0,0,1-17,0l-24-24a12,12,0,1,1,17-17L112,143l47.51-47.52A12,12,0,0,1,176.49,95.51ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z"></path></svg>
                        </div>
                        <div class="text-size-small">W magazynie</div>
                    </div>
                    <div class="favorite_product_details_stock ${!product.fieldData.produktNiedostepny ? 'hide' : ''}">
                        <div class="icon-1x1-xxsmall is-no">
                            <svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256"><path d="M168.49,104.49,145,128l23.52,23.51a12,12,0,0,1-17,17L128,145l-23.51,23.52a12,12,0,0,1-17-17L111,128,87.51,104.49a12,12,0,0,1,17-17L128,111l23.51-23.52a12,12,0,0,1,17,17ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z"></path></svg>
                        </div>
                        <div class="text-size-small">Brak na stanie</div>
                    </div>
                    <div class="favorite_product_details_stock">
                        <div class="icon-1x1-xxsmall is-info">
                            <svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256"><path d="M108,84a16,16,0,1,1,16,16A16,16,0,0,1,108,84Zm128,44A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Zm-72,36.68V132a20,20,0,0,0-20-20,12,12,0,0,0-4,23.32V168a20,20,0,0,0,20,20,12,12,0,0,0,4-23.32Z"></path></svg>
                        </div>
                        <div class="text-size-small">SKU: ${product.fieldData.sku}</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="favorite_buttons">
            <button blocks-name="button" data-ms-content="members" class="button is-small addtocartbutton" data-commerce-product-id="${product.id}">
                <div class="text-visual-fix">Dodaj do koszyka</div>
            </button>
            <button blocks-name="button" data-ms-content="members" class="button is-secondary is-small deletefromfavorites" data-product-id="${product.id}">
                <div class="text-visual-fix">Usuń z ulubionych</div>
            </button>
        </div>
    `;
    return li;
};

const removeFromFavorites = async (productId: string, listItem: HTMLElement): Promise<void> => {
    try {
        // Pobierz aktualne dane użytkownika
        const memberJson = await getMemberJSON();
        let favorites: string[] = memberJson.data?.favorites || [];

        // Usuń dany produkt z ulubionych
        favorites = favorites.filter((id) => id !== productId);

        // Zaktualizuj JSON w Memberstack
        await updateMemberJSON({json: {...memberJson.data, favorites}});

        // Usuń element z DOM
        listItem.remove();

        // Sprawdź, czy lista ulubionych jest teraz pusta i pokaż/ukryj noResultElement
        if (favorites.length === 0) {
            noResultElement.style.display = 'block';
        }
    } catch (error) {
        console.error(`Error removing favorite:`, error);
    }
};

const renderFavorites = async (favorites: string[]): Promise<void> => {
    favoriteList.innerHTML = ''; // Wyczyść istniejącą listę
    if (favorites.length === 0) {
        noResultElement.style.display = 'block';
    } else {
        noResultElement.style.display = 'none';

        for (const productId of favorites) {
            const productDetails = await fetchProductDetails(productId);
            if (productDetails) {
                const favoriteItem = generateFavoriteItem(productDetails);
                favoriteList.appendChild(favoriteItem);

                // Dodaj nasłuchiwanie kliknięcia do przycisku "Usuń z ulubionych"
                const removeButton = favoriteItem.querySelector('.deletefromfavorites') as HTMLElement;
                if (removeButton) {
                    removeButton.addEventListener('click', async () => {
                        await removeFromFavorites(productId, favoriteItem);
                    });
                }
            }
        }

        // Inicjalizuj przyciski "Dodaj do koszyka" po renderowaniu elementów
        await initializeAddToCartButtons();
    }
};

export const initializeFavorites = async (): Promise<void> => {
    // Fetch and map categories
    await fetchCategories();

    let memberJson = await getMemberJSON();

    // Check if memberJson.data is null and initialize it if necessary
    if (!memberJson.data) {
        console.warn("Member JSON is null. Initializing new data structure.");
        memberJson.data = {favorites: []}; // Initialize with an empty favorites array
        await updateMemberJSON({json: memberJson.data});
        memberJson = await getMemberJSON(); // Refresh after update
    }

    const favorites: string[] = memberJson.data.favorites || [];
    await renderFavorites(favorites);
    await initializeGenerateOffer(favorites);
};