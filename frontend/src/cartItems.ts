import {getMemberData} from "./memberstack";
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

        const totalAmount = cartItems.reduce((sum, item) => {
            const price = item.fieldData.pricePromo > 0 ? item.fieldData.pricePromo : item.fieldData.priceNormal;
            return sum + price * item.quantity;
        }, 0);

        const totalAmountElement = document.getElementById('cart-total');
        const cartQuantityElement = document.getElementById('cart-quantity');

        if (totalAmountElement) totalAmountElement.textContent = `${totalAmount.toFixed(2)} zł`;
        if (cartQuantityElement)
            cartQuantityElement.textContent = cartItems
                .reduce((sum, item) => sum + item.quantity, 0)
                .toString();

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
        if (stateDefault && stateEmpty && stateSuccess && stateError) {
            stateEmpty.style.display = 'none';
            stateDefault.style.display = 'none';
            stateSuccess.style.display = 'none';
            stateError.style.display = 'flex';
        }
    }
}

export async function handleAddToCart(button: HTMLElement) {
    const productElement =
        button.closest('.additional-product-item') ||
        button.closest('.product-header2_add-to-cart') ||
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
    let selectedVariant: string | null = null;

    // Obsługa selectElement (jeśli istnieje)
    if (selectElement && selectElement.getAttribute('validate') === 'true') {
        if (selectElement.value === '') {
            alert('Proszę wybrać opcję przed dodaniem produktu do koszyka.');
            return;
        }
        selectedVariant = selectElement.value;
    }

    // Obsługa wariantów w formie pill (jeśli istnieje)
    const optionPillGroup = productElement.querySelector('div[data-input="pill-group"]') as HTMLDivElement;
    if (optionPillGroup) {
        const selectedPill = optionPillGroup.querySelector<HTMLDivElement>('div[aria-checked="true"]');
        if (selectedPill) {
            selectedVariant = selectedPill.getAttribute('data-variant-value') || null;
        } else if (!selectElement) {
            alert('Proszę wybrać opcję przed dodaniem produktu do koszyka.');
            return;
        }
    }

    // Pobierz ilość
    const quantityInput = productElement.querySelector<HTMLInputElement>('input[data-input="quantity"]');
    const quantity: number = quantityInput && quantityInput.value.trim() !== ''
        ? parseInt(quantityInput.value, 10)
        : 1;

    try {
        const product: Product = await fetchProductDetails(productId);

        const selectedItem: ProductInCart = {
            ...product,
            variant: selectedVariant || null,
            quantity,
            price: (product.fieldData.pricePromo > 0 ? product.fieldData.pricePromo : product.fieldData.priceNormal),
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

export const initializeAddToCartButtons = (): void => {
    const addToCartButtons = document.querySelectorAll<HTMLElement>('.addtocartbutton');

    addToCartButtons.forEach((button) => {
        // Sprawdź, czy przycisk ma już przypisany nasłuchiwacz
        if (button.dataset.listenerAdded === "true") return;

        const addToCartForm: HTMLFormElement | null = button.closest('.product-header2_default-state');

        if (addToCartForm) {
            addToCartForm.onsubmit = (event: Event) => {
                event.preventDefault(); // Zapobiega domyślnemu działaniu formularza
                event.stopPropagation();
                console.log('Form submission prevented');
            };
        } else {
            console.error('Add to Cart form not found');
        }

        // Pobierz elementy wariantów
        const colorVariantsElement = addToCartForm?.querySelector<HTMLElement>('[data-variants="color"]');
        const sizeVariantsElement = addToCartForm?.querySelector<HTMLElement>('[data-variants="size"]');

        // Pobierz select
        const variantSelect = addToCartForm?.querySelector<HTMLElement>('select[data-input="variant"]');
        const variantWrapper = addToCartForm?.querySelector<HTMLElement>('[data-wrapper="variant"]');

        if (variantSelect) {
            // Czyścimy wcześniejsze opcje
            variantSelect.innerHTML = '';

            // Dodaj placeholder dla kolorów, jeśli istnieje
            if (colorVariantsElement && colorVariantsElement.textContent !== '' && variantWrapper) {
                variantWrapper.style.display = 'block';
                variantSelect.setAttribute('validate', 'true');

                const placeholderOption = document.createElement('option');
                placeholderOption.textContent = 'Wybierz kolor';
                placeholderOption.value = '';
                placeholderOption.disabled = true;
                placeholderOption.selected = true;
                variantSelect.appendChild(placeholderOption);

                // Pobierz warianty i dodaj do selecta
                const colorVariants = colorVariantsElement.textContent?.split(',').map(v => v.trim()) || [];
                colorVariants.forEach(color => {
                    const option = document.createElement('option');
                    option.value = color;
                    option.textContent = color;
                    variantSelect.appendChild(option);
                });
            }

            // Dodaj placeholder dla rozmiarów, jeśli istnieje
            if (sizeVariantsElement && sizeVariantsElement.textContent !== '' && variantWrapper) {
                variantWrapper.style.display = 'block';
                variantSelect.setAttribute('validate', 'true');

                const placeholderOption = document.createElement('option');
                placeholderOption.textContent = 'Wybierz rozmiar';
                placeholderOption.value = '';
                placeholderOption.disabled = true;
                placeholderOption.selected = true;
                variantSelect.appendChild(placeholderOption);

                // Pobierz warianty i dodaj do selecta
                const sizeVariants = sizeVariantsElement.textContent?.split(',').map(v => v.trim()) || [];
                sizeVariants.forEach(size => {
                    const option = document.createElement('option');
                    option.value = size;
                    option.textContent = size;
                    variantSelect.appendChild(option);
                });
            }
        } else {
            console.error('Variant select not found');
        }

        button.addEventListener('click', async (event) => {
            event.preventDefault();

            try {
                await handleAddToCart(button);
            } catch (error) {
                console.error('Error adding to cart:', error);
            }
        });

        // Oznacz przycisk jako już zainicjalizowany
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

        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <img sizes="100vw" alt="" src="${item.fieldData.thumbnail.url}" loading="lazy" class="cart-product-image">
            <div class="cart-product-info">
                <a href="/produkty/${item.fieldData.slug}" class="text-weight-semibold text-style-2lines">${item.fieldData.name}</a>
                <div class="cart-product-parameter" style="display: ${item.variant !== null ? 'block' : 'none'}">
                    <div class="display-inline">Wariant:</div>
                    <div class="display-inline text-weight-semibold text-color-brand"> ${item.variant}</div>
                </div>
                <div class="cart-product-parameter">
                    <div class="display-inline">Cena:</div>
                    <div class="display-inline text-weight-semibold text-color-brand"> ${item.fieldData.pricePromo ? item.fieldData.pricePromo.toFixed(2) : item.fieldData.priceNormal.toFixed(2)} zł</div>
                </div>
                <div class="cart-product-parameter">
                    <div class="display-inline">Ilość:</div>
                    <div class="display-inline text-weight-semibold text-color-brand"> ${item.quantity}</div>
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
