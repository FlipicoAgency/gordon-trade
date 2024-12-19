import type {Member} from './memberstack';
import {getMemberData} from './memberstack';
import type {Product, ProductInCart} from "../types/cart";
import {addNewOrderToExcel} from "./excel";
import type {Category} from "../types/cart";

const addedToCartModal = document.querySelector<HTMLElement>('#added-to-cart');

export async function fetchCartData() {
    try {
        const response = await fetch('https://gordon-trade.onrender.com/api/cart', {
            credentials: 'include', // Dodaj credentials
        });
        const cartItems = await response.json();

        if (!Array.isArray(cartItems)) {
            throw new Error('Received data is not an array');
        }

        return cartItems;
    } catch (error) {
        console.error('Failed to fetch cart items:', error);
        return []; // Zwróć pustą tablicę jako domyślną wartość
    }
}

async function updateCartUI() {
    const stateDefault = document.querySelector<HTMLElement>('.state-default');
    const stateEmpty = document.querySelector<HTMLElement>('.state-empty');
    const stateSuccess = document.querySelector<HTMLElement>('.state-success');
    const stateError = document.querySelector<HTMLElement>('.state-error');

    try {
        const cartItems: ProductInCart[] = await fetchCartData();
        //console.log('Cart items:', cartItems);

        const memberData: Member | null = await getMemberData();
        const memberDiscount = memberData?.customFields.rabat
            ? Number(memberData.customFields.rabat.replace('%', ''))
            : 0;
        //console.log('Member discount:', memberDiscount);

        let totalAmount = 0;

        // Przelicz cenę dla każdego itemu uwzględniając ilości kartonowe i resztę
        for (const item of cartItems) {
            const quantity = item.quantity;
            const qInBox = item.fieldData.quantityInBox;
            const priceNormalOrPromo = item.fieldData.pricePromo > 0 ? item.fieldData.pricePromo : item.fieldData.priceNormal;
            const priceCarton = item.fieldData.priceCarton > 0 ? item.fieldData.priceCarton : priceNormalOrPromo;

            let lineCost = 0;

            if (qInBox > 0 && quantity >= qInBox) {
                // Ile pełnych kartonów?
                const fullBoxes = Math.floor(quantity / qInBox);
                const fullBoxItems = fullBoxes * qInBox;
                const leftover = quantity % qInBox;

                const fullBoxCost = fullBoxItems * priceCarton;
                const leftoverCost = leftover * priceNormalOrPromo;

                lineCost = fullBoxCost + leftoverCost;
            } else {
                // Brak pełnego kartonu, wszystko po cenie normalnej/promo
                lineCost = quantity * priceNormalOrPromo;
            }

            totalAmount += lineCost;
        }

        // Elementy do wyświetlenia cen
        const discountElement = document.getElementById('cart-discount');
        const totalAmountElement = document.getElementById('cart-total');
        const cartQuantityElement = document.getElementById('cart-quantity');

        if (cartQuantityElement) {
            cartQuantityElement.textContent = cartItems.reduce((sum, item) => sum + item.quantity, 0).toString();
        }

        let finalAmount = totalAmount;
        let discountAmount = 0;

        if (memberDiscount > 0) {
            // Oblicz kwotę rabatu i finalną kwotę
            discountAmount = totalAmount * (memberDiscount / 100);
            finalAmount = totalAmount - discountAmount;
        }

        // Aktualizacja wyświetlania kwot
        if (totalAmountElement) {
            totalAmountElement.style.display = 'block';
            totalAmountElement.textContent = `${finalAmount.toFixed(2)} zł`;
        }

        if (discountElement && totalAmountElement) {
            if (memberDiscount > 0) {
                discountElement.style.display = 'block';
                discountElement.textContent = `${discountAmount.toFixed(2)} zł`;
            } else {
                // @ts-ignore
                discountElement.parentElement.style.display = 'none';
            }
        }

        // Obsługa stanów koszyka
        if (stateDefault && stateEmpty && stateSuccess && stateError) {
            if (cartItems.length > 0) {
                stateEmpty.style.display = 'none';
                stateSuccess.style.display = 'none';
                stateError.style.display = 'none';
                stateDefault.style.display = 'block';
            } else {
                stateDefault.style.display = 'none';
                stateSuccess.style.display = 'none';
                stateError.style.display = 'none';
                stateEmpty.style.display = 'flex';
            }
        }

        renderCartItems(cartItems);
    } catch (error) {
        console.error('Failed to update cart UI:', error);
        const stateDefault = document.querySelector<HTMLElement>('.state-default');
        const stateEmpty = document.querySelector<HTMLElement>('.state-empty');
        const stateSuccess = document.querySelector<HTMLElement>('.state-success');
        const stateError = document.querySelector<HTMLElement>('.state-error');
        if (stateDefault && stateEmpty && stateSuccess && stateError) {
            stateEmpty.style.display = 'none';
            stateDefault.style.display = 'none';
            stateSuccess.style.display = 'none';
            stateError.style.display = 'flex';
        }
    }
}

export async function handleAddToCart(button: HTMLElement, isCartonPurchase: boolean = false) {
    const productElement =
        button.closest('.additional-product-item') ||
        button.closest('.product_add-to-cart') ||
        button.closest('.product_item') ||
        (window.location.pathname.includes('/konto')
            ? button.parentElement?.parentElement?.children[0]?.children[1]
            : null);

    if (!productElement) {
        console.error('Product element not found');
        return;
    }

    const productId = button.getAttribute('data-commerce-product-id');
    if (!productId) {
        console.error('Product ID not found');
        return;
    }

    const selectElement = productElement.querySelector('select[data-input="variant"]') as HTMLSelectElement;
    const optionPillGroup = productElement.querySelector('div[data-input="pill-group"]') as HTMLDivElement;
    let selectedVariant: string | null = null;

    // Walidacja wariantów
    if (selectElement && selectElement.getAttribute('validate') === 'true') {
        if (selectElement.value === '') {
            alert('Proszę wybrać opcję przed dodaniem produktu do koszyka.');
            return;
        }
        selectedVariant = selectElement.value;
    }

    // Obsługa wariantów w formie pill (jeśli istnieje)
    if (optionPillGroup) {
        const selectedPill = optionPillGroup.querySelector<HTMLDivElement>('div[aria-checked="true"]');
        if (selectedPill) {
            selectedVariant = selectedPill.getAttribute('data-variant-value') || null;
        } else if (!selectElement) {
            alert('Proszę wybrać opcję przed dodaniem produktu do koszyka.');
            return;
        }
    }

    let quantity = 1;
    const quantityInput = productElement.querySelector<HTMLInputElement>('input[data-input="quantity"]');
    if (!isCartonPurchase) {
        quantity = quantityInput && quantityInput.value.trim() !== ''
            ? parseInt(quantityInput.value, 10)
            : 1;
    }

    try {
        const product: Product = await fetchProductDetails(productId);
        const quantityInBox = product.fieldData.quantityInBox;

        // Jeśli kupujemy pełny karton i jest określony quantityInBox
        if (isCartonPurchase && quantityInBox > 0) {
            quantity = quantityInBox;
        }

        // Ustal cenę na poziomie dodawania do koszyka:
        // Jeśli ilość jest równa ilości w kartonie, to cena = priceCarton (jeśli >0),
        // w innym wypadku cena = promo lub normalna.
        let finalPrice = product.fieldData.pricePromo > 0 ? product.fieldData.pricePromo : product.fieldData.priceNormal;
        if (product.fieldData.priceCarton > 0 && quantity === quantityInBox) {
            finalPrice = product.fieldData.priceCarton;
        }

        const selectedItem: ProductInCart = {
            ...product,
            variant: selectedVariant || null,
            quantity,
            price: finalPrice,
        };

        await addItemToCart(selectedItem);
    } catch (err) {
        console.error('Error getting selected item:', err);
    }
}

async function addItemToCart(item: ProductInCart) {
    try {
        const response = await fetch('https://gordon-trade.onrender.com/api/cart', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(item),
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Failed to add item to cart: ${response.statusText}`);
        }

        await updateCartUI();
        //addedToCartButton?.click();

        if (addedToCartModal) {
            // Ustawienie początkowego stylu dla animacji
            addedToCartModal.style.display = 'flex';
            addedToCartModal.style.opacity = '0';
            addedToCartModal.style.transition = 'opacity 0.5s ease'; // Animacja płynnego przejścia

            // Ustawienie opacity na 1 po krótkim czasie, aby uruchomić animację
            setTimeout(() => {
                addedToCartModal.style.opacity = '1';
            }, 10); // 10 ms, aby zapewnić płynne przejście

            // Po 1.5 sekundy zaczynamy ukrywanie
            setTimeout(() => {
                addedToCartModal.style.opacity = '0'; // Zmiana opacity na 0, co uruchomi animację zanikania

                // Po zakończeniu animacji (500 ms), ustawiamy display: none
                setTimeout(() => {
                    addedToCartModal.style.display = 'none';
                }, 500); // Czas trwania animacji (zgodny z transition: 500 ms)
            }, 1500); // Ukrywanie elementu po 1.5 sekundy
        }
    } catch (error) {
        console.error('Failed to add item to cart:', error);
    }
}

function initializeVariantSelect(addToCartForm: HTMLFormElement | null): void {
    if (!addToCartForm) return;

    addToCartForm.onsubmit = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        console.log('Form submission prevented');
    };

    const colorVariantsElement = addToCartForm.querySelector<HTMLElement>('[data-variants="color"]');
    const sizeVariantsElement = addToCartForm.querySelector<HTMLElement>('[data-variants="size"]');
    const variantSelect = addToCartForm.querySelector<HTMLSelectElement>('select[data-input="variant"]');
    const variantWrapper = addToCartForm.querySelector<HTMLElement>('[data-wrapper="variant"]');

    if (!variantSelect) {
        console.error('Variant select not found');
        return;
    }

    // Wyczyść poprzednie opcje
    variantSelect.innerHTML = '';

    // Inicjalizacja wariantów kolorów
    const colorText = colorVariantsElement?.textContent?.trim();
    if (colorText && colorText !== '' && variantWrapper) {
        variantWrapper.style.display = 'block';
        variantSelect.setAttribute('validate', 'true');

        const placeholderColor = document.createElement('option');
        placeholderColor.textContent = 'Wybierz kolor';
        placeholderColor.value = '';
        placeholderColor.disabled = true;
        placeholderColor.selected = true;
        variantSelect.appendChild(placeholderColor);

        const colorVariants = colorText.split(',').map(v => v.trim());
        colorVariants.forEach(color => {
            const option = document.createElement('option');
            option.value = color;
            option.textContent = color;
            variantSelect.appendChild(option);
        });
    }

    // Inicjalizacja wariantów rozmiarów
    const sizeText = sizeVariantsElement?.textContent?.trim();
    if (sizeText && sizeText !== '' && variantWrapper) {
        variantWrapper.style.display = 'block';
        variantSelect.setAttribute('validate', 'true');

        const placeholderSize = document.createElement('option');
        placeholderSize.textContent = 'Wybierz rozmiar';
        placeholderSize.value = '';
        placeholderSize.disabled = true;
        placeholderSize.selected = true;
        variantSelect.appendChild(placeholderSize);

        const sizeVariants = sizeText.split(',').map(v => v.trim());
        sizeVariants.forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = size;
            variantSelect.appendChild(option);
        });
    }
}

export const initializeAddToCartButtons = (): void => {
    const addToCartButtons = document.querySelectorAll<HTMLElement>('.addtocartbutton');
    const addToCartBoxButtons = document.querySelectorAll<HTMLElement>('[data-quantity="box"]');

    // Obsługa standardowych przycisków dodawania do koszyka
    addToCartButtons.forEach((button) => {
        if (button.dataset.listenerAdded === "true") return;
        const addToCartForm = button.closest('.product_default-state') as HTMLFormElement | null;

        initializeVariantSelect(addToCartForm);

        button.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                await handleAddToCart(button, false);
            } catch (error) {
                console.error('Error adding to cart:', error);
            }
        });

        button.dataset.listenerAdded = "true";
    });

    // Obsługa przycisków dodawania całego kartonu
    addToCartBoxButtons.forEach((button) => {
        if (button.dataset.listenerAdded === "true") return;
        const addToCartForm = button.closest('.product_default-state') as HTMLFormElement | null;

        initializeVariantSelect(addToCartForm);

        button.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                await handleAddToCart(button, true);
            } catch (error) {
                console.error('Error adding to cart by carton:', error);
            }
        });

        button.dataset.listenerAdded = "true";
    });
};

async function removeItemFromCart(itemId: string, variant: string | null = null) {
    try {
        const cleanVariant = variant === "null" ? null : variant; // Zamiana "null" na null
        const response = await fetch(`https://gordon-trade.onrender.com/api/cart/${itemId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ variant: cleanVariant }), // Użyj prawdziwego `null`
        });

        if (!response.ok) {
            throw new Error(`Failed to remove item: ${response.statusText}`);
        }

        await updateCartUI(); // Aktualizacja koszyka po usunięciu
    } catch (error) {
        console.error('Failed to remove item from cart:', error);
    }
}

async function updateItemQuantity(itemId: string, quantity: number, variant: string | null = null) {
    try {
        const cleanVariant = variant === "null" ? null : variant; // Zamiana "null" na null
        const response = await fetch(`https://gordon-trade.onrender.com/api/cart/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity, variant: cleanVariant }), // Przekaż ilość i wariant
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Failed to update item quantity: ${response.statusText}`);
        }

        await updateCartUI(); // Zaktualizuj interfejs użytkownika
    } catch (error) {
        console.error('Failed to update item quantity:', error);
    }
}

function addQuantityChangeListener() {
    document.addEventListener('change', async (event) => {
        const input = event.target as HTMLInputElement;

        if (!input.classList.contains('is-quantity-input')) return;

        const newQuantity = parseInt(input.value, 10);
        const cartItemElement = input.closest('.cart-item');
        const itemId = cartItemElement?.querySelector('.deletebutton')?.getAttribute('data-item-id');
        const variant = cartItemElement?.querySelector('.deletebutton')?.getAttribute('data-variant') || null;

        if (itemId && newQuantity > 0) {
            await updateItemQuantity(itemId, newQuantity, variant); // Przekaż również `variant`
        }
    });
}

function renderCartItems(cartItems: ProductInCart[]) {
    const cartListElement = document.querySelector<HTMLElement>('.cart-list');
    if (!cartListElement) return;

    cartListElement.innerHTML = ''; // Wyczyść listę przed dodaniem nowych elementów

    cartItems.forEach((item) => {
        //console.log(item);
        const priceNormalOrPromo = item.fieldData.pricePromo > 0 ? item.fieldData.pricePromo : item.fieldData.priceNormal;
        const priceCarton = (item.fieldData.priceCarton && item.fieldData.priceCarton > 0) ? item.fieldData.priceCarton : 0;


        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <img sizes="100vw" alt="" src="${item.fieldData.thumbnail.url}" loading="lazy" class="cart-product-image">
            <div class="cart-product-info">
                <div class="margin-bottom margin-custom5">    
                    <a href="/produkty/${item.fieldData.slug}" class="text-weight-semibold text-style-2lines">${item.fieldData.name}</a>
                </div>
                <div class="cart-product-parameter" style="display: ${item.variant !== null ? 'flex' : 'none'}">
                    <div class="display-inline">Wariant:</div>
                    <div class="display-inline text-weight-semibold text-color-brand">&nbsp;${item.variant}</div>
                </div>
                <div class="cart-product-parameter">
                    <div class="display-inline">Cena za szt. (regular):</div>
                    <div class="display-inline text-weight-semibold text-color-brand">&nbsp;${priceNormalOrPromo.toFixed(2)} zł</div>
                </div>
                <div class="cart-product-parameter" style="display: ${priceCarton > 0 ? 'flex' : 'none'}">
                    <div class="display-inline">Cena za szt. (karton):</div>
                    <div class="display-inline text-weight-semibold text-color-brand">&nbsp;${priceCarton > 0 ? priceCarton.toFixed(2) : ''} zł</div>
                </div>
                <div class="cart-product-parameter">
                    <div class="display-inline">Ilość:</div>
                    <div class="display-inline text-weight-semibold text-color-brand">&nbsp;${item.quantity}</div>
                </div>
            </div>
            <div class="card-product-form w-form">
                <input class="form_input is-quantity-input w-input" data-input="quantity" maxlength="256" value="${item.quantity}" type="number">
            </div>
            <button class="button deletebutton" data-item-id="${item.id}" data-variant="${item.variant}">
                <div class="icon-1x1-xsmall">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-x">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                        <path d="M18 6l-12 12"></path>
                        <path d="M6 6l12 12"></path>
                    </svg>
                </div>
            </button>
        `;
    
        cartListElement.appendChild(itemElement);
    });

    addQuantityChangeListener();

    const removeButtons = document.querySelectorAll('.deletebutton');
    removeButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
            const buttonElement = event.currentTarget as HTMLElement;
            const itemId = buttonElement.getAttribute('data-item-id');
            const variant = buttonElement.getAttribute('data-variant') || null;

            if (itemId) {
                await removeItemFromCart(itemId, variant); // Przekaż `variant` do funkcji
            } else {
                console.error('Failed to remove item from cart: missing item ID');
            }
        });
    });

    const submitButton = document.getElementById('place-order');
    if (submitButton) {
        // Usunięcie istniejących nasłuchiwaczy (jeśli istnieją)
        submitButton.replaceWith(submitButton.cloneNode(true)); // Resetuje zdarzenia
        const newSubmitButton = document.getElementById('place-order');

        newSubmitButton?.addEventListener('click', async () => {
            const cartItems = await fetchCartData();
            if (cartItems.length === 0) {
                alert('Koszyk jest pusty!');
                return;
            }
            await processOrder(cartItems);
        });
    }
}

export async function processOrder(cartItems: ProductInCart[]) {
    console.log('Items to process:', cartItems);

    const makeUrl = 'https://hook.eu2.make.com/ey0oofllpglvwpgbjm0pw6t0yvx37cnd';
    const stateDefault = document.querySelector<HTMLElement>('.state-default');
    const stateSuccess = document.querySelector<HTMLElement>('.state-success');
    const stateError = document.querySelector<HTMLElement>('.state-error');

    try {
        const memberData = await getMemberData();

        const payload = {
            items: cartItems,
            member: memberData,
        };

        const response = await fetch(makeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        await addNewOrderToExcel(cartItems, undefined, memberData || undefined);

        if (stateSuccess && stateDefault) {
            stateDefault.style.display = 'none';
            stateSuccess.style.display = 'flex';
            setTimeout(async () => {
                await clearCart();
                await updateCartUI();
            }, 3000);
        }
    } catch (error) {
        console.error('Failed to process order:', error);
        if (stateError && stateDefault) {
            stateDefault.style.display = 'none';
            stateError.style.display = 'flex';
            setTimeout(() => {
                updateCartUI();
            }, 3000);
        }
    }
}

// Function to map API response to Product Interface
export function mapApiResponseToProduct(apiResponse: any): Product {
    return {
        id: apiResponse.id,
        cmsLocaleId: apiResponse.cmsLocaleId,
        lastPublished: apiResponse.lastPublished ?? null,
        lastUpdated: apiResponse.lastUpdated,
        createdOn: apiResponse.createdOn,
        isArchived: apiResponse.isArchived,
        isDraft: apiResponse.isDraft,
        fieldData: {
            priceNormal: apiResponse.fieldData["cena"] ?? 0,
            pricePromo: apiResponse.fieldData["procent-znizki"] ?? 0, // assuming there might be a promo price key
            promo: apiResponse.fieldData["promocja"] ?? false,
            quantityInBox: apiResponse.fieldData["ilosc-w-kartonie"] ?? 0,
            stockNumber: apiResponse.fieldData["stan-magazynowy"] ?? 0,
            inStock: apiResponse.fieldData["w-magazynie"] ?? false,
            weightCarton: apiResponse.fieldData["1-karton---waga"] ?? 0,
            dimensionsCarton: apiResponse.fieldData["1-karton---wymiary-2"] ?? '',
            priceCarton: apiResponse.fieldData["cena-za-karton"],
            name: apiResponse.fieldData["name"] ?? '',
            description: apiResponse.fieldData["opis"] ?? '',
            tags: apiResponse.fieldData["tagi"] ?? '',
            ean: apiResponse.fieldData["ean-2"] ?? undefined,
            sku: apiResponse.fieldData["sku"] ?? '',
            thumbnail: {
                fileId: apiResponse.fieldData["miniatura"]?.fileId ?? '',
                url: apiResponse.fieldData["miniatura"]?.url ?? '',
                alt: apiResponse.fieldData["miniatura"]?.alt ?? null,
            },
            gallery: apiResponse.fieldData["galeria"]?.map((item: any) => ({
                fileId: item.fileId,
                url: item.url,
                alt: item.alt ?? null,
            })) ?? [],
            slug: apiResponse.fieldData["slug"] ?? '',
            category: apiResponse.fieldData["kategoria"] ?? '',
            productUnavailable: apiResponse.fieldData["produkt-niedostepny"] ?? false,
            productFeatured: apiResponse.fieldData["produkt-wyrozniony"] ?? false,
            productVisibleOnPage: apiResponse.fieldData["produkt-widoczny-na-stronie"] ?? false,
        },
    };
}

// Function to fetch product details by productId
export async function fetchProductDetails(productId: string): Promise<any> {
    try {
        const response = await fetch(`https://gordon-trade.onrender.com/api/products/${productId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch product details for ID: ${productId}`);
        }

        const data = await response.json();
        //console.log(`Response for product ID ${productId}:`, data);

        const product: Product = mapApiResponseToProduct(data);
        //console.log(`Response for product ID ${productId}:`, product);

        return product;
    } catch (error) {
        console.error(`Error fetching product details:`, error);
        return null;
    }
}

export async function clearCart() {
    try {
        await fetch('https://gordon-trade.onrender.com/api/cart', {
            method: 'DELETE',
            credentials: 'include',
        });
        await updateCartUI();
    } catch (error) {
        console.error('Failed to clear cart:', error);
    }
}

// Funkcja do pobrania ID sesji
export async function getSessionID() {
    try {
        const response = await fetch('https://gordon-trade.onrender.com/api/session-id', {
            method: 'GET',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
        });

        const data = await response.json();
        return data.sessionID;
    } catch (error) {
        console.error('Błąd podczas pobierania ID sesji:', error);
        return null;
    }
}

export let categoryMap: Record<string, string> = {};

// Function to fetch product details by productId
export const fetchCategories = async (): Promise<void> => {
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

export async function initializeCart() {
    await updateCartUI();
}
