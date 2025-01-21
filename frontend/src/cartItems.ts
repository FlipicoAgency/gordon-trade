import type {Member} from './memberstack';
import {getMemberData} from './memberstack';
import type {Product, ProductInCart} from "../types/cart";
import {addNewOrderToExcel} from "./excel";
import type {Category} from "../types/cart";

// Zmienna globalna na nasłuchiwacz
let onQuantityChange: ((event: Event) => Promise<void>) | null = null;

const currencyMap: Record<string, string> = {
    pl: 'zł',
    cs: 'EUR',
    hu: 'EUR',
    en: 'EUR',
};

const addedToCartModal = document.querySelector<HTMLElement>('#added-to-cart');

export async function fetchCartData() {
    try {
        const response = await fetch('https://koszyk.gordontrade.pl/api/cart', {
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

async function updateCartUI(translations: Record<string, string>, language: string) {
    const stateDefault = document.querySelector<HTMLElement>('.state-default');
    const stateEmpty = document.querySelector<HTMLElement>('.state-empty');
    const stateSuccess = document.querySelector<HTMLElement>('.state-success');
    const stateError = document.querySelector<HTMLElement>('.state-error');

    try {
        const cartItems: ProductInCart[] = await fetchCartData();

        // Wyliczamy sumę brutto (price * quantity) dla całego koszyka
        const totalAmount = cartItems.reduce((sum, item) => sum + (item.lineCost), 0);

        // Dynamiczne pobranie waluty na podstawie języka
        const currency = currencyMap[language] || 'zł'; // Domyślna waluta to 'zł'

        // Uaktualnij sumę w UI
        const totalAmountElement = document.getElementById('cart-total');
        if (totalAmountElement) {
            totalAmountElement.style.display = 'block';
            totalAmountElement.textContent = `${totalAmount.toFixed(2)} ${currency}`;
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

        await renderCartItems(cartItems, translations, language, currency);
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
    const qInBox = product.fieldData.quantityInBox || 1;
    const priceCarton = product.fieldData.priceCarton || 0;
    const pricePromo = product.fieldData.pricePromo || 0;
    const priceNormal = product.fieldData.priceNormal || 0;

    // (1) Cena specjalna (highest priority):
    if (specialPrice && specialPrice > 0) {
        return specialPrice * quantity;
    }

    // Rozbijamy ilość na pełne kartony i resztę
    const fullBoxes = Math.floor(quantity / qInBox); // Ile pełnych kartonów
    const leftover = quantity % qInBox; // Ile sztuk ponad pełne kartony

    // Priorytetowe ceny
    const effectiveCartonPrice = priceCarton > 0 ? priceCarton : (pricePromo > 0 ? pricePromo : priceNormal);
    const effectivePiecePrice = pricePromo > 0 ? pricePromo : priceNormal;

    // Oblicz koszt pełnych kartonów
    const costFullBoxes = fullBoxes * qInBox * effectiveCartonPrice;

    // Oblicz koszt leftover
    const costLeftover = leftover * effectivePiecePrice;

    // Suma
    return costFullBoxes + costLeftover;
}

/**
 * Funkcja obsługująca dodawanie do koszyka (kliknięcie w przycisk 'Dodaj do koszyka')
 * @param button - element HTML przycisku
 * @param isCartonPurchase - czy kliknięto w 'Kup cały karton'
 */
export async function handleAddToCart(
    button: HTMLElement,
    isCartonPurchase: boolean = false,
    translations: Record<string, string>,
    language: string
) {
    // 1) Znajdź, jaki produkt jest dodawany, ile sztuk, itp.
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
            alert(translations.alertSelect);
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
            alert(translations.alertSelect);
            return;
        }
    }

    // Ustalamy liczbę dodawanych sztuk
    let quantity = 1;
    const quantityInput = productElement.querySelector<HTMLInputElement>('input[data-input="quantity"]');
    if (!isCartonPurchase) {
        quantity = quantityInput && quantityInput.value.trim() !== ''
            ? parseInt(quantityInput.value, 10)
            : 1;
    }

    try {
        // 2) Pobieramy dane produktu
        const product: Product = await fetchProductDetails(productId, language);
        if (!product) return;

        // Jeśli klikamy "Kup karton" i mamy sensowny qInBox
        const qInBox = product.fieldData.quantityInBox || 1;
        if (isCartonPurchase && qInBox > 0) {
            quantity = qInBox;
        }

        // 3) Pobieramy bieżący koszyk
        const cartItems: ProductInCart[] = await fetchCartData();

        // 4) Znajdujemy, czy w koszyku już jest ta sama pozycja
        const existingItem = cartItems.find(
            (item) => item.id === productId && item.variant === (selectedVariant || null)
        );

        // 5) Wyznaczamy "łączną" ilość - sumujemy, jeśli item już istnieje
        const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

        // 6) Sprawdzamy, czy użytkownik ma specialPrice
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

        // 7) Obliczamy koszt całej pozycji
        const totalCostForNewQuantity = calculateLineCostAdvanced(product, newQuantity, specialPrice);

        console.log("Product:", product);
        console.log("Quantity:", newQuantity);
        console.log("Total cost podczas dodawania:", totalCostForNewQuantity);

        // 7.5) Obliczamy koszt całej pozycji w oparciu o (kartony + leftover)
        const finalSinglePrice = getFinalSinglePrice(product, newQuantity, specialPrice);

        // 8) Przygotuj obiekt do wysłania do koszyka
        const selectedItem: ProductInCart = {
            ...product,
            variant: selectedVariant || null,
            quantity: newQuantity,
            price: finalSinglePrice,
            lineCost: totalCostForNewQuantity, // kluczowe pole
        };

        await addItemToCart(selectedItem, translations, language);
    } catch (err) {
        console.error('Error getting selected item:', err);
    }
}

async function addItemToCart(item: ProductInCart, translations: Record<string, string>, language: string) {
    try {
        const response = await fetch('https://koszyk.gordontrade.pl/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Failed to add item to cart: ${response.statusText}`);
        }

        // Po udanym dodaniu odśwież UI
        await updateCartUI(translations, language);

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

function initializeVariantSelect(addToCartForm: HTMLFormElement | null, translations: Record<string, string>, language: string): void {
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
        placeholderColor.textContent = translations.selectColor;
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
        placeholderSize.textContent = translations.selectSize;
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

export const initializeAddToCartButtons = (translations: Record<string, string>, language: string): void => {
    const addToCartButtons = document.querySelectorAll<HTMLElement>('.addtocartbutton');
    const addToCartBoxButtons = document.querySelectorAll<HTMLElement>('[data-quantity="box"]');

    // Obsługa standardowych przycisków dodawania do koszyka
    addToCartButtons.forEach((button) => {
        if (button.dataset.listenerAdded === "true") return;
        const addToCartForm = button.closest('.product_default-state') as HTMLFormElement | null;

        initializeVariantSelect(addToCartForm, translations, language);

        button.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                await handleAddToCart(button, false, translations, language);
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

        initializeVariantSelect(addToCartForm, translations, language);

        button.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                await handleAddToCart(button, true, translations, language);
            } catch (error) {
                console.error('Error adding to cart by carton:', error);
            }
        });

        button.dataset.listenerAdded = "true";
    });
};

async function removeItemFromCart(itemId: string, variant: string | null = null, translations: Record<string, string>, language: string) {
    try {
        const cleanVariant = variant === "null" ? null : variant; // Zamiana "null" na null
        const response = await fetch(`https://koszyk.gordontrade.pl/api/cart/${itemId}`, {
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

        await updateCartUI(translations, language); // Aktualizacja koszyka po usunięciu
    } catch (error) {
        console.error('Failed to remove item from cart:', error);
    }
}

async function updateItemQuantity(itemId: string, quantity: number, variant: string | null = null, translations: Record<string, string>, language: string) {
    try {
        const cleanVariant = variant === "null" ? null : variant;

        // Pobierz szczegóły produktu (priceCarton, pricePromo, itp.)
        const product = await fetchProductDetails(itemId, language);
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

        const totalCostForNewQuantity = calculateLineCostAdvanced(product, quantity, specialPrice);
        const finalSinglePrice = getFinalSinglePrice(product, quantity, specialPrice);

        console.log("Product:", product);
        console.log("Quantity:", quantity);
        console.log("Total cost podczas aktualizacji:", totalCostForNewQuantity);

        // Zaktualizuj dany item w koszyku (PUT)
        const response = await fetch(`https://koszyk.gordontrade.pl/api/cart/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                variant: cleanVariant,
                quantity,
                price: finalSinglePrice,
                lineCost: totalCostForNewQuantity,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to update item quantity: ${response.statusText}`);
        }

        // Tymczasowe usunięcie nasłuchiwacza na czas aktualizacji UI
        if (onQuantityChange) {
            document.removeEventListener('change', onQuantityChange);
        }

        // Zaktualizuj UI
        await updateCartUI(translations, language);

        // Przywrócenie nasłuchiwacza po odświeżeniu UI
        addQuantityChangeListener(translations, language);
    } catch (error) {
        console.error('Failed to update item quantity:', error);
    }
}

function addQuantityChangeListener(translations: Record<string, string>, language: string) {
    // Usuń poprzedni nasłuchiwacz, jeśli istnieje
    if (onQuantityChange) {
        document.removeEventListener('change', onQuantityChange);
    }

    // Zdefiniuj nowy nasłuchiwacz
    onQuantityChange = async (event: Event) => {
        const input = event.target as HTMLInputElement;

        if (!input.classList.contains('is-quantity-input')) return;

        const newQuantity = parseInt(input.value, 10);
        const cartItemElement = input.closest('.cart-item');
        const itemId = cartItemElement?.querySelector('.deletebutton')?.getAttribute('data-item-id');
        const variant = cartItemElement?.querySelector('.deletebutton')?.getAttribute('data-variant') || null;

        if (itemId && newQuantity > 0) {
            await updateItemQuantity(itemId, newQuantity, variant, translations, language);
        }
    };

    // Dodaj nowy nasłuchiwacz
    document.addEventListener('change', onQuantityChange);
}

/**
 * Renderuje listę produktów w koszyku (w .cart-list).
 */
async function renderCartItems(cartItems: ProductInCart[], translations: Record<string, string>, language: string, currency: string) {
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
        const formattedPrice = parseFloat(priceSpecialOrPromoOrNormal.toString()).toFixed(2);

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
                    <div class="display-inline">${translations.variant}</div>
                    <div class="display-inline text-weight-semibold text-color-brand">&nbsp;${item.variant}</div>
                </div>
                
                <!-- Cena za sztukę (regular) -->
                <div class="cart-product-parameter">
                    <div class="display-inline">${translations.pricePerUnit}</div>
                    <div class="display-inline text-weight-semibold text-color-brand">&nbsp;${formattedPrice} ${currency}</div>
                </div>
                
                <!-- Cena za sztukę (karton) -->
                <div class="cart-product-parameter" style="display: ${(priceCarton > 0 && !hasSpecialPrice) ? 'flex' : 'none'};">
                    <div class="display-inline">${translations.inCarton}</div>
                    <div class="display-inline text-weight-semibold text-color-brand">&nbsp;${priceCarton > 0 ? priceCarton.toFixed(2) : ''} ${currency}</div>
                </div>
                
                <div class="cart-product-parameter">
                    <div class="display-inline">${translations.quantityOfProducts}</div>
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

    addQuantityChangeListener(translations, language);

    const removeButtons = document.querySelectorAll('.deletebutton');
    removeButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
            const buttonElement = event.currentTarget as HTMLElement;
            const itemId = buttonElement.getAttribute('data-item-id');
            const variant = buttonElement.getAttribute('data-variant') || null;

            if (itemId) {
                await removeItemFromCart(itemId, variant, translations, language);
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
                alert(translations.cartEmpty);
                return;
            }
            await processOrder(cartItems, translations, language);
        });
    }
}

export async function processOrder(cartItems: ProductInCart[], translations: Record<string, string>, language: string) {
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
                currency: currencyMap[language] || 'zł'
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
        await addNewOrderToExcel(cartItems, memberData, translations, language, undefined);

        // Obsługa UI (pokazywanie "sukces" i czyszczenie koszyka)
        if (stateSuccess && stateDefault) {
            stateDefault.style.display = 'none';
            stateSuccess.style.display = 'flex';
            setTimeout(async () => {
                await clearCart(translations, language);
                await updateCartUI(translations, language);
            }, 3000);
        }
    } catch (error) {
        console.error('Failed to process order:', error);
        if (stateError && stateDefault) {
            stateDefault.style.display = 'none';
            stateError.style.display = 'flex';
            setTimeout(() => {
                updateCartUI(translations, language);
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
    const isEmptyString = (value: any) => value === '' || value === null || value === undefined;

    return {
        id: apiResponse.id,
        cmsLocaleId: apiResponse.cmsLocaleId,
        lastPublished: isEmptyString(apiResponse.lastPublished) ? null : apiResponse.lastPublished,
        lastUpdated: isEmptyString(apiResponse.lastUpdated) ? null : apiResponse.lastUpdated,
        createdOn: isEmptyString(apiResponse.createdOn) ? null : apiResponse.createdOn,
        isArchived: apiResponse.isArchived ?? false,
        isDraft: apiResponse.isDraft ?? false,
        fieldData: {
            priceNormal: isEmptyString(apiResponse.fieldData["cena"]) ? 0 : apiResponse.fieldData["cena"],
            pricePromo: isEmptyString(apiResponse.fieldData["procent-znizki"]) ? 0 : apiResponse.fieldData["procent-znizki"],
            promo: apiResponse.fieldData["promocja"] ?? false,
            quantityInBox: isEmptyString(apiResponse.fieldData["ilosc-w-kartonie"]) ? 0 : apiResponse.fieldData["ilosc-w-kartonie"],
            stockNumber: isEmptyString(apiResponse.fieldData["stan-magazynowy"]) ? 0 : apiResponse.fieldData["stan-magazynowy"],
            inStock: apiResponse.fieldData["w-magazynie"] ?? false,
            weightCarton: isEmptyString(apiResponse.fieldData["1-karton---waga"]) ? 0 : apiResponse.fieldData["1-karton---waga"],
            dimensionsCarton: isEmptyString(apiResponse.fieldData["1-karton---wymiary-2"]) ? '' : apiResponse.fieldData["1-karton---wymiary-2"],
            priceCarton: isEmptyString(apiResponse.fieldData["cena-za-karton"]) ? 0 : apiResponse.fieldData["cena-za-karton"],
            name: isEmptyString(apiResponse.fieldData["name"]) ? '' : apiResponse.fieldData["name"],
            description: isEmptyString(apiResponse.fieldData["opis"]) ? '' : apiResponse.fieldData["opis"],
            tags: isEmptyString(apiResponse.fieldData["tagi"]) ? '' : apiResponse.fieldData["tagi"],
            ean: isEmptyString(apiResponse.fieldData["ean-2"]) ? undefined : apiResponse.fieldData["ean-2"],
            sku: isEmptyString(apiResponse.fieldData["sku"]) ? '' : apiResponse.fieldData["sku"],
            thumbnail: {
                fileId: isEmptyString(apiResponse.fieldData["miniatura"]?.fileId) ? '' : apiResponse.fieldData["miniatura"]?.fileId,
                url: isEmptyString(apiResponse.fieldData["miniatura"]?.url) ? '' : apiResponse.fieldData["miniatura"]?.url,
                alt: isEmptyString(apiResponse.fieldData["miniatura"]?.alt) ? null : apiResponse.fieldData["miniatura"]?.alt,
            },
            gallery: Array.isArray(apiResponse.fieldData["galeria"])
                ? apiResponse.fieldData["galeria"].map((item: any) => ({
                    fileId: isEmptyString(item.fileId) ? '' : item.fileId,
                    url: isEmptyString(item.url) ? '' : item.url,
                    alt: isEmptyString(item.alt) ? null : item.alt,
                }))
                : [],
            slug: isEmptyString(apiResponse.fieldData["slug"]) ? '' : apiResponse.fieldData["slug"],
            category: isEmptyString(apiResponse.fieldData["kategoria"]) ? '' : apiResponse.fieldData["kategoria"],
            productUnavailable: apiResponse.fieldData["produkt-niedostepny"] ?? false,
            productFeatured: apiResponse.fieldData["produkt-wyrozniony"] ?? false,
            productVisibleOnPage: apiResponse.fieldData["produkt-widoczny-na-stronie"] ?? false,
        },
    };
}

// Function to fetch current exchange rates from NBP API
export async function fetchExchangeRates() {
    try {
        const response = await fetch('https://api.nbp.pl/api/exchangerates/tables/A/?format=json');

        if (!response.ok) {
            throw new Error('Failed to fetch exchange rates');
        }

        const data = await response.json();
        const rates = data[0].rates;

        // Convert rates into a key-value pair object for quick access
        const exchangeRates = {};
        // @ts-ignore
        rates.forEach(rate => {
            // @ts-ignore
            exchangeRates[rate.code] = rate.mid;
        });

        return exchangeRates;
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        return null;
    }
}

// Function to fetch product details by productId
export async function fetchProductDetails(productId: string, lang: string): Promise<any> {
    try {
        const response = await fetch(`https://koszyk.gordontrade.pl/api/products/${productId}?lang=${lang}`, {
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

        // Fetch exchange rates
        const exchangeRates = await fetchExchangeRates();
        if (!exchangeRates) {
            throw new Error('Could not fetch exchange rates');
        }

        // Update product prices based on exchange rates and lang
        switch (lang) {
            case 'cs': {
                // @ts-ignore
                const plnToCzkRate = exchangeRates['EUR'];
                if (plnToCzkRate) {
                    product.fieldData.priceNormal /= plnToCzkRate;
                    product.fieldData.pricePromo /= plnToCzkRate;
                    product.fieldData.priceCarton /= plnToCzkRate;
                }
                break;
            }
            case 'hu': {
                // @ts-ignore
                const plnToHufRate = exchangeRates['EUR'];
                if (plnToHufRate) {
                    product.fieldData.priceNormal /= plnToHufRate;
                    product.fieldData.pricePromo /= plnToHufRate;
                    product.fieldData.priceCarton /= plnToHufRate;
                }
                break;
            }
            case 'en': {
                // @ts-ignore
                const plnToGbpRate = exchangeRates['EUR'];
                if (plnToGbpRate) {
                    product.fieldData.priceNormal /= plnToGbpRate;
                    product.fieldData.pricePromo /= plnToGbpRate;
                    product.fieldData.priceCarton /= plnToGbpRate;
                }
                break;
            }
            default: {
                console.warn('Unsupported language, prices not updated:', lang);
                break;
            }
        }

        console.log('Updated product prices:', product);

        return product;
    } catch (error) {
        console.error(`Error fetching product details:`, error);
        return null;
    }
}

export async function clearCart(translations: Record<string, string>, language: string) {
    try {
        await fetch('https://koszyk.gordontrade.pl/api/cart', {
            method: 'DELETE',
            credentials: 'include',
        });
        await updateCartUI(translations, language);
    } catch (error) {
        console.error('Failed to clear cart:', error);
    }
}

// Funkcja do pobrania ID sesji
export async function getSessionID() {
    try {
        const response = await fetch('https://koszyk.gordontrade.pl/api/session-id', {
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
        const response = await fetch(`https://koszyk.gordontrade.pl/api/categories`, {
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

export async function initializeCart(translations: Record<string, string>, language: string) {
    await updateCartUI(translations, language);
}
