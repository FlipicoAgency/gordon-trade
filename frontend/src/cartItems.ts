import {getMemberData} from "./memberstack";
import type {Product, ProductInCart} from "../types/cart";
import {addNewOrderToExcel} from "./excel";

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
    const totalAmount = cartItems.reduce((sum, item) => sum + item.fieldData.cena * item.quantity, 0);
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
      // Fallback: ręczna nawigacja po DOM tylko jeśli URL zawiera `/konto` aby obsłużyć favorites
      (window.location.pathname.includes('/konto')
          ? button.parentElement?.parentElement?.children[0]?.children[1]
          : null);

  if (!productElement) {
    console.error('Product element not found');
    return;
  }

  const productId =
      button.getAttribute('data-commerce-product-id') || '';
  const selectElement = productElement.querySelector(
      'form select[data-node-type="commerce-add-to-cart-option-select"]'
  ) as HTMLSelectElement | null;

  // Sprawdź, czy użytkownik wybrał opcję, jeśli selectElement istnieje
  if (selectElement && selectElement.value === '') {
    alert('Proszę wybrać opcję przed dodaniem produktu do koszyka.');
    return;
  }

  // Zdeklaruj zmienną selectedPill
  let selectedPill: HTMLDivElement | null = null;

  // Pobierz element select, jeśli jest dostępny
  const optionPillGroup = productElement.querySelector(
      'form div[data-node-type="commerce-add-to-cart-pill-group"]'
  ) as HTMLDivElement | null;

  // Sprawdź, czy użytkownik wybrał opcję, jeśli selectElement istnieje
  if (optionPillGroup) {
    selectedPill = optionPillGroup.querySelector(
        'form div[aria-checked="true"]'
    ) as HTMLDivElement | null;
  }

  // Pobierz ilość
  const quantityInput = productElement.querySelector<HTMLInputElement>(
      'input[name="commerce-add-to-cart-quantity-input"]'
  );
  const quantity: number = quantityInput ? parseInt(quantityInput.value) : 1;

  // Pobierz `skuId` z wybranej opcji lub formularza
  let skuId: string | null = selectElement
      ? selectElement.value
      : (selectedPill?.getAttribute('data-option-id') ?? null);

  // Jeśli nie ma opcji do wybrania (np. brak formularza wyboru), pobierz `data-commerce-sku-id`
  if (!skuId) {
    skuId = productElement.querySelector('form')?.getAttribute('data-commerce-sku-id') || '';
  }

  try {
    const response = await fetch(`https://gordon-trade.onrender.com/api/products/${productId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data: Product = await response.json();
    //console.log('data: ', data);

    const selectedItem: ProductInCart = {
      ...data,
      quantity,
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
    button.addEventListener('click', async (event) => {
      event.preventDefault();

      try {
        await handleAddToCart(button);
      } catch (error) {
        console.error('Error adding to cart:', error);
      }
    });
  });
};

async function removeItemFromCart(itemId: string) {
  try {
    await fetch(`https://gordon-trade.onrender.com/api/cart/${itemId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await updateCartUI();
  } catch (error) {
    console.error('Failed to remove item from cart:', error);
  }
}

async function updateItemQuantity(itemId: string, quantity: number) {
  try {
    await fetch(`https://gordon-trade.onrender.com/api/cart/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
      credentials: 'include',
    });
    await updateCartUI();
  } catch (error) {
    console.error('Failed to update item quantity:', error);
  }
}

function addQuantityChangeListener() {
  document.addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.classList.contains('is-quantity-input')) return;

    const newQuantity = parseInt(input.value, 10);
    const itemId = input
      .closest('.cart-item')
      ?.querySelector('.remove-from-cart')
      ?.getAttribute('data-item-id');

    if (itemId && newQuantity > 0) {
      await updateItemQuantity(itemId, newQuantity);
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
      <img src="${item.fieldData.miniatura.url}" loading="lazy" alt="${item.fieldData.miniatura.alt}" class="image-2">
      <a href="/produkty/${item.fieldData.slug}" class="product-link">
        <div>
          <div class="text-weight-bold text-style-2lines">${item.fieldData.name}</div>
          <div class="div-block">
            <div class="text-color-brand">Cena: ${item.fieldData.cena.toFixed(2)} zł</div>
            <div class="text-color-brand">Ilość: ${item.quantity}</div>
          </div>
        </div>
      </a>
      <div class="w-form">
        <input class="form_input is-quantity-input w-input" maxlength="256" value="${item.quantity}" type="number" min="1" />
      </div>
      <div class="icon-embed-xsmall w-embed remove-from-cart" data-item-id="${item.id}">
        <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" width="100%" height="100%" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6L6 18M6 6l12 12"></path>
        </svg>
      </div>
    `;

    cartListElement.appendChild(itemElement);
  });

  addQuantityChangeListener();

  const removeButtons = document.querySelectorAll('.remove-from-cart');
  removeButtons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      const itemId = (event.currentTarget as HTMLElement).getAttribute('data-item-id');
      if (itemId) {
        await removeItemFromCart(itemId);
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

    // Log the response data
    //console.log(`Response for product ID ${productId}:`, data);

    return await response.json();
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
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    const data = await response.json();
    return data.sessionID;
  } catch (error) {
    console.error('Błąd podczas pobierania ID sesji:', error);
    return null;
  }
}

export async function initializeCart() {
  await updateCartUI();
}
