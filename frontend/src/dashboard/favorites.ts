import {getMemberData, getMemberJSON, updateMemberJSON} from "../memberstack";
import {categoryMap, fetchCategories, fetchProductDetails, getFinalSinglePrice} from "../cartItems";
import type {Product} from "../../types/cart";

const noResultElement = document.querySelector('[favorites="none"]') as HTMLElement;
const favoriteList = document.querySelector('.favorite_list') as HTMLElement;

function generateFavoriteItem(
    product: Product,
    finalPrice: number,
    hasSpecialPrice: boolean
): HTMLElement {
    // Wyciągamy dane kartonowe
    const priceCarton = product.fieldData.priceCarton || 0;
    const quantityInBox = product.fieldData.quantityInBox || 0;

    const categoryName = categoryMap[product.fieldData.category] || 'Unknown Category';

    // Tworzymy <li>
    const li = document.createElement('li');
    li.className = 'favorite_list_item';

    // Wyliczamy procent promo, jeśli jest
    let promoPercentageHTML = '';
    if (product.fieldData.pricePromo > 0 && product.fieldData.priceNormal > 0) {
        const discountPercent = Math.round(
            ((product.fieldData.priceNormal - product.fieldData.pricePromo) / product.fieldData.priceNormal) * 100
        );
        promoPercentageHTML = `
      <div class="promo-tagline w-embed" style="display: block">
        <span style="position: relative; top:-0.05rem">–</span>
        <span class="promo-percentage">${discountPercent}</span>%
      </div>
    `;
    }

    // Czy pokazać cenę kartonu (jeśli >0 i nie ma ceny specjalnej)
    const showCarton = (priceCarton > 0 && !hasSpecialPrice);

    li.innerHTML = `
        <div class="favorite_wrapper">
          <img loading="lazy" src="${product.fieldData.thumbnail?.url}" 
               alt="${product.fieldData.thumbnail?.alt || product.fieldData.name}" 
               class="favorite_image">
          <div class="favorite_product">
            <div class="product_name">
              <a href="${window.location.origin}/produkty/${product.fieldData.slug}" 
                 class="text-size-medium text-weight-semibold text-style-2lines">
                ${product.fieldData.name}
              </a>
              <div class="text-size-small">${categoryName}</div>
            </div>
    
            <!-- Cena wyliczona (finalPrice) -->
            <div class="product_price is-favourite">
              <div class="product_price_group">
                <div class="price-wrapper">
                  <div class="heading-style-h6 text-color-brand">${finalPrice.toFixed(2)}</div>
                  <div class="heading-style-h6 text-color-brand">&nbsp;zł</div>
                </div>
                ${promoPercentageHTML}
              </div>
            </div>
    
            <!-- Cena przy zakupie całego kartonu -->
            <div data-price="carton" class="product_header2_price-box" 
                 style="display: ${showCarton ? 'block' : 'none'};">
              <div class="display-inline text-size-small">
                Cena przy zakupie całego kartonu: 
              </div>
              <div class="display-inline text-style-nowrap">
                <div class="display-inline text-size-small text-weight-semibold text-color-brand">
                  ${priceCarton.toFixed(2)} zł
                </div>
              </div>
              <div aria-hidden="true" class="box-quantity">
                ${quantityInBox}
              </div>
            </div>
            
            <div class="product_details is-favourite">
                <div class="product_details_stock ${product.fieldData.productUnavailable ? 'hide' : ''}">
                    <div class="icon-1x1-xxsmall is-yes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256">
                            <path d="M176.49,95.51a12,12,0,0,1,0,17l-56,56a12,12,0,0,1-17,0l-24-24a12,12,0,1,1,17-17L112,143l47.51-47.52A12,12,0,0,1,176.49,95.51ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z"></path>
                        </svg>
                    </div>
                    <div class="text-size-small">W magazynie</div>
                </div>
                <div class="product_details_stock product_details_stock ${!product.fieldData.productUnavailable ? 'hide' : ''}">
                    <div class="icon-1x1-xxsmall is-no">
                        <svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256">
                            <path d="M168.49,104.49,145,128l23.52,23.51a12,12,0,0,1-17,17L128,145l-23.51,23.52a12,12,0,0,1-17-17L111,128,87.51,104.49a12,12,0,0,1,17-17L128,111l23.51-23.52a12,12,0,0,1,17,17ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z"></path>
                        </svg>
                    </div>
                    <div class="text-size-small">Brak na stanie</div>
                </div>
                <div class="product_details_stock">
                    <div class="icon-1x1-xxsmall is-info">
                        <svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256">
                            <path d="M108,84a16,16,0,1,1,16,16A16,16,0,0,1,108,84Zm128,44A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Zm-72,36.68V132a20,20,0,0,0-20-20,12,12,0,0,0-4,23.32V168a20,20,0,0,0,20,20,12,12,0,0,0,4-23.32Z"></path>
                        </svg>
                    </div>
                    <div class="text-size-small">SKU: ${product.fieldData.sku}</div>
                </div>
            </div>
        </div>
    </div>
    <div class="favorite_buttons">
        <button data-ms-content="members" class="button is-secondary is-small deletefromfavourites">
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
            noResultElement.style.display = 'flex';
        }
    } catch (error) {
        console.error(`Error removing favorite:`, error);
    }
};

const renderFavorites = async (favorites: string[], translations: Record<string, string>): Promise<void> => {
    favoriteList.innerHTML = '';
    if (favorites.length === 0) {
        noResultElement.style.display = 'flex';
    } else {
        noResultElement.style.display = 'none';

        // 1. Pobierz dane usera i ewentualnie metaData
        const memberData = await getMemberData();
        const specialPrices = memberData?.metaData || {};

        for (const productId of favorites) {
            const productDetails = await fetchProductDetails(productId);
            if (productDetails) {
                // 2. Cena specjalna?
                let sp = 0;
                if (specialPrices[productId]) {
                    const spVal = parseFloat(specialPrices[productId]);
                    if (!isNaN(spVal)) sp = spVal;
                }

                // 3. finalPrice = getFinalSinglePrice(..., 1, sp)
                const finalPrice = getFinalSinglePrice(productDetails, 1, sp);
                const hasSpecial = (sp > 0);

                // ---- CONSOLE LOG: Wyświetlamy pełne info ----
                // console.log('[FAVORITES] Product loaded:', {
                //     productId,
                //     productName: productDetails.fieldData.name,
                //     priceNormal: productDetails.fieldData.priceNormal,
                //     pricePromo: productDetails.fieldData.pricePromo,
                //     priceCarton: productDetails.fieldData.priceCarton,
                //     quantityInBox: productDetails.fieldData.quantityInBox,
                //     hasSpecialPrice: hasSpecial,
                //     specialPrice: sp,
                //     finalPrice
                // });

                // 4. Wygeneruj element
                const favoriteItem = generateFavoriteItem(productDetails, finalPrice, hasSpecial);
                favoriteList.appendChild(favoriteItem);

                // 5. Usuń z ulubionych
                const removeButton = favoriteItem.querySelector('.deletefromfavourites') as HTMLElement;
                if (removeButton) {
                    removeButton.addEventListener('click', async () => {
                        await removeFromFavorites(productId, favoriteItem);
                    });
                }
            }
        }
        // (Opcjonalnie) initializeAddToCartButtons() itp.
    }
};

export const initializeFavorites = async (translations: Record<string, string>): Promise<void> => {
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
    await renderFavorites(favorites, translations);
};