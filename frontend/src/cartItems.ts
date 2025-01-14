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

        // Wyliczamy sumę brutto (price * quantity) dla całego koszyka
        const totalAmount = cartItems.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );

        // Uaktualnij sumę w UI
        const totalAmountElement = document.getElementById('cart-total');
        if (totalAmountElement) {
            totalAmountElement.style.display = 'block';
            totalAmountElement.textContent = `${totalAmount.toFixed(2)} zł`;
        }

        // Ukryj elementy rabatów itd., bo już nie używamy
        const discountElement = document.getElementById('cart-discount');
        if (discountElement?.parentElement) {
            discountElement.parentElement.style.display = 'none';
        }

        // Update cart quantity w UI
        const cartQuantityElement = document.getElementById('cart-quantity');
        if (cartQuantityElement) {
            const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
            cartQuantityElement.textContent = totalQuantity.toString();
            //console.log('Total Quantity in Cart:', totalQuantity);
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

        await renderCartItems(cartItems);
    } catch (error) {
        console.error('Failed to update cart UI:', error);
        if (stateDefault && stateEmpty && stateSuccess && stateError) {
            stateEmpty.style.display = 'none';
            stateDefault.style.display = 'none';
            stateSuccess.style.display = 'none';
            stateError.style.display = 'flex';
        }
    }
}

export function getFinalSinglePrice(
    product: Product,
    quantity: number,
    specialPrice?: number
): number {
    // Liczymy łączny koszt advanced
    const totalCost = calculateLineCostAdvanced(product, quantity, specialPrice);

    // Dzielimy przez quantity, żeby uzyskać "średnią" cenę za 1 sztukę
    if (quantity > 0) {
        return totalCost / quantity;
    } else {
        return 0;
    }
}

/**
 * Oblicza łączny koszt pozycji z mieszanym rozbiciem:
 * - jeśli user ma specialPrice – bierzemy to na sztukę * quantity (bez kartonów),
 * - w przeciwnym razie, rozbijamy na pełne kartony i resztę.
 *
 * Przykład:
 *  quantity=11, qInBox=10 =>
 *    1 karton (10 szt) * priceCarton + 1 szt leftover * (pricePromo lub priceNormal)
 */
export function calculateLineCostAdvanced(
    product: Product,
    quantity: number,
    specialPrice?: number
): number {
    const qInBox = product.fieldData.quantityInBox;
    const priceCarton = product.fieldData.priceCarton || 0;
    const pricePromo = product.fieldData.pricePromo || 0;
    const priceNormal = product.fieldData.priceNormal || 0;

    // (1) Cena specjalna (highest priority):
    if (specialPrice && specialPrice > 0) {
        return specialPrice * quantity;
    }

    // (2) Jeżeli nie mamy specialPrice => rozbijamy na pełne kartony i resztę:
    // Ile pełnych kartonów?
    const fullBoxes = qInBox > 1 ? Math.floor(quantity / qInBox) : 0;
    // Ile sztuk "ponad" pełne kartony
    const leftover = qInBox > 1 ? (quantity % qInBox) : quantity;

    // Koszt pełnych kartonów:
    let costFullBoxes = 0;
    if (fullBoxes > 0 && priceCarton > 0) {
        costFullBoxes = fullBoxes * qInBox * priceCarton;
    } else {
        // brak pełnych kartonów – costFullBoxes=0
    }

    // Koszt leftover:
    // - jeśli pricePromo>0 => leftover * pricePromo
    // - w przeciwnym wypadku leftover * priceNormal
    let leftoverPrice = priceNormal;
    if (pricePromo > 0) {
        leftoverPrice = pricePromo;
    }
    const costLeftover = leftover * leftoverPrice;

    // Suma:
    return costFullBoxes + costLeftover;
}

/**
 * Funkcja obsługująca dodawanie do koszyka (kliknięcie w przycisk 'Dodaj do koszyka')
 * @param button - element HTML przycisku
 * @param isCartonPurchase - czy kliknięto w 'Kup cały karton'
 */
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
        const qInBox = product.fieldData.quantityInBox;

        // Jeśli kliknięto 'Kup karton' i product ma quantityInBox > 0
        if (isCartonPurchase && qInBox > 0) {
            quantity = qInBox;
        }

        // 1. Pobierz ewentualną cenę specjalną z metaData (lub 0 jeśli brak)
        const memberData: Member | null = await getMemberData();
        let specialPrice = 0;
        if (memberData && memberData.metaData) {
            const userPrices = memberData.metaData; // np. { "someProductId": "99.99", ... }
            if (userPrices[productId]) {
                const sp = parseFloat(userPrices[productId]);
                if (!isNaN(sp)) {
                    specialPrice = sp;
                }
            }
        }

        // 2. Oblicz finalną cenę poj. sztuki
        const finalSinglePrice = getFinalSinglePrice(product, quantity, specialPrice);

        // 3. Przygotuj obiekt do wysłania do koszyka
        const selectedItem: ProductInCart = {
            ...product,
            variant: selectedVariant || null,
            quantity,
            // Zapisujemy ustaloną finalną cenę za sztukę
            price: finalSinglePrice,
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Failed to add item to cart: ${response.statusText}`);
        }

        // Po udanym dodaniu odśwież UI
        await updateCartUI();

        // Małe powiadomienie "dodano do koszyka"
        if (addedToCartModal) {
            addedToCartModal.style.display = 'flex';
            addedToCartModal.style.opacity = '0';
            addedToCartModal.style.transition = 'opacity 0.5s ease';

            setTimeout(() => {
                addedToCartModal.style.opacity = '1';
            }, 10);

            setTimeout(() => {
                addedToCartModal.style.opacity = '0';
                setTimeout(() => {
                    addedToCartModal.style.display = 'none';
                }, 500);
            }, 1500);
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
        const cleanVariant = variant === "null" ? null : variant;

        // Pobierz szczegóły produktu (priceCarton, pricePromo, itp.)
        const product = await fetchProductDetails(itemId);
        if (!product) {
            throw new Error(`Product not found for id: ${itemId}`);
        }

        // Sprawdź, czy user ma cenę specjalną
        const memberData: Member | null = await getMemberData();
        let specialPrice = 0;
        if (memberData && memberData.metaData) {
            const spRaw = memberData.metaData[itemId];
            if (spRaw) {
                const spVal = parseFloat(spRaw);
                if (!isNaN(spVal)) {
                    specialPrice = spVal;
                }
            }
        }

        // Wylicz finalną cenę za sztukę (special > carton > promo > normal)
        const finalSinglePrice = getFinalSinglePrice(product, quantity, specialPrice);

        // Zaktualizuj dany item w koszyku (PUT)
        const response = await fetch(`https://gordon-trade.onrender.com/api/cart/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                variant: cleanVariant,
                quantity,
                price: finalSinglePrice
            }),
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

/**
 * Renderuje listę produktów w koszyku (w .cart-list).
 */
async function renderCartItems(cartItems: ProductInCart[]) {
    const member: Member | null = await getMemberData();
    let specialPrices: Record<string, string> = {};

    if (member) {
        const memberMetadata = member?.metaData;
        //console.log('Metadata:', memberMetadata);

        // Extract special prices from metadata if available
        specialPrices = memberMetadata || {};
    } else {
        console.warn("User not logged in or metadata not available. Special prices won't be applied.");
    }

    const cartListElement = document.querySelector<HTMLElement>('.cart-list');
    if (!cartListElement) return;

    cartListElement.innerHTML = ''; // Wyczyść listę przed dodaniem nowych elementów

    cartItems.forEach((item, index) => {
        const priceCarton = item.fieldData.priceCarton || 0;
        const hasSpecialPrice = !!specialPrices[item.id];
        const priceSpecialOrPromoOrNormal = hasSpecialPrice ? specialPrices[item.id] : item.fieldData.pricePromo > 0 ? item.fieldData.pricePromo : item.fieldData.priceNormal;

        // Upewnij się, że cena ma dwa miejsca po przecinku
        const formattedPrice = parseFloat(priceSpecialOrPromoOrNormal).toFixed(2);

        // Tworzymy DIV w koszyku
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
                
                <!-- Cena za sztukę (regular) -->
                <div class="cart-product-parameter">
                    <div class="display-inline">Cena za sztukę:</div>
                    <div class="display-inline text-weight-semibold text-color-brand">&nbsp;${formattedPrice} zł</div>
                </div>
                
                <!-- Cena za sztukę (karton) -->
                <div class="cart-product-parameter" style="display: ${(priceCarton > 0 && !hasSpecialPrice) ? 'flex' : 'none'};">
                    <div class="display-inline">W kartonie:</div>
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
        // (Opcjonalnie) Pobierz dane użytkownika
        const memberData: Member | null = await getMemberData();

        // Wyliczamy łączną wartość zamówienia
        const totalAmount = cartItems.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );

        // Przygotowujemy dane do wysłania do Make
        const itemsForMake = cartItems.map((item) => {
            // Obliczamy całkowitą cenę danej pozycji
            const totalPrice = (item.price * item.quantity).toFixed(2);

            return {
                id: item.id,
                name: item.fieldData.name,
                sku: item.fieldData.sku,
                url: item.fieldData.thumbnail.url,
                quantity: item.quantity,
                pricePerUnit: item.price.toFixed(2),
                totalPrice,
                variant: item.variant,
            };
        });

        const payload = {
            orderNumber: String(Math.floor(100000000 + Math.random() * 900000000)), // Losowe ID
            orderDate: getTodayDate(), // np. "DD.MM.YYYY"
            totalAmount: totalAmount.toFixed(2),
            status: 'Złożono zapytanie',
            items: itemsForMake,
            member: memberData, // ewentualnie dane użytkownika, jeśli potrzebne
        };

        // Wysyłamy request do Make
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

        // Zapis do Excela (o ile używacie tej funkcji)
        await addNewOrderToExcel(cartItems, memberData, undefined);

        // Obsługa UI (pokazywanie "sukces" i czyszczenie koszyka)
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

/**
 * Funkcja zwraca aktualną datę w formacie DD.MM.YYYY
 */
function getTodayDate(): string {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Miesiące są indeksowane od 0
    const year = today.getFullYear();
    return `${day}.${month}.${year}`;
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
