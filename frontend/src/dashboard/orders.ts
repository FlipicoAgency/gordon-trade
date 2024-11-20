import {fetchProductDetails} from "../cartItems";
import type {Member} from "../memberstack";
import type {Product} from "../cartItems";

interface OrderProduct {
    productId: string;
    quantity: string;
    productName: string;
}

interface Order {
    products: OrderProduct[];
    "Customer NIP": string;
    "Order ID": string;
    "Product name": string;
    "Product ID": string;
    Quantity: string;
    "Order value": string;
    "Order date": string;
    "Estimated freight": string;
    Capacity: string;
    "FV amount (netto)": string;
    "FV number": string;
    "FV PDF": string;
    "Payment status": string;
    "Delivery status": string;
    "Container ID": string;
    "Container number": string;
    "Loading port": string;
    "Estimated time of departure": string;
    "Fastest possible shipping date": string;
    "Estimated time of arrival": string;
    Comments: string;
    orderId: string;
}

const noResultElement = document.querySelector('[orders="none"]') as HTMLElement;
const orderList = document.querySelector('.order_list') as HTMLElement;
const orderedAgainModal = document.querySelector('#re-ordered') as HTMLElement;

const fetchOrdersByNip = async (customerNip: string): Promise<any> => {
    try {
        const response = await fetch(
            `https://gordon-trade.onrender.com/api/sheets/orders?nip=${encodeURIComponent(customerNip)}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch sheets data');
        }

        const rawData = await response.json();

        // Oczyszczanie i formatowanie danych
        const cleanData = cleanAndFormatData(rawData);
        console.log('Zamówienia:', cleanData);

        return cleanData;
    } catch (error) {
        console.error('Error fetching orders:', error);
        return null;
    }
};

// Funkcja pomocnicza do czyszczenia i formatowania danych
const cleanAndFormatData = (data: Record<string, any>): Record<string, any> => {
    const cleanedData: Record<string, any> = {};

    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const order = data[key];
            const cleanedOrder: Record<string, any> = { ...order };

            for (const field in cleanedOrder) {
                if (typeof cleanedOrder[field] === 'string') {
                    // Usuwanie białych znaków przed pierwszym znakiem
                    cleanedOrder[field] = cleanedOrder[field].replace(/^\s+/, '');
                }
            }

            cleanedData[key] = cleanedOrder;
        }
    }

    return cleanedData;
};

async function handleOrderAgain(button: HTMLElement) {
    if (orderedAgainModal) {
        // Ustawienie początkowego stylu dla animacji
        orderedAgainModal.style.display = 'flex';
        orderedAgainModal.style.opacity = '0';
        orderedAgainModal.style.transition = 'opacity 0.5s ease'; // Animacja płynnego przejścia

        // Ustawienie opacity na 1 po krótkim czasie, aby uruchomić animację
        setTimeout(() => {
            orderedAgainModal.style.opacity = '1';
        }, 10); // 10 ms, aby zapewnić płynne przejście

        // Po 1.5 sekundy zaczynamy ukrywanie
        setTimeout(() => {
            orderedAgainModal.style.opacity = '0'; // Zmiana opacity na 0, co uruchomi animację zanikania

            // Po zakończeniu animacji (500 ms), ustawiamy display: none
            setTimeout(() => {
                orderedAgainModal.style.display = 'none';
            }, 500); // Czas trwania animacji (zgodny z transition: 500 ms)
        }, 1500); // Ukrywanie elementu po 1.5 sekundy
    }
}

async function initializeOrderAgain() {
    const orderAgainButtons = document.querySelectorAll<HTMLElement>('[orders="again"]');

    orderAgainButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();

            try {
                await handleOrderAgain(button);
            } catch (error) {
                console.error('Error adding to cart:', error);
            }
        });
    });
}

function createOrderParameter(
    statusClass: string,
    iconType: string,
    text: string,
    isVisible: boolean
): string {
    return `
        <div class="order-parameter ${statusClass} ${isVisible ? '' : 'hide'}">
            <div class="icon-1x1-xxsmall ${iconType}">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256">
                    <path d="${getIconPath(iconType)}"></path>
                </svg>
            </div>
            <div class="text-size-small">${text}</div>
        </div>
    `;
}

function getIconPath(iconType: string): string {
    switch (iconType) {
        case 'is-yes':
            return 'M176.49,95.51a12,12,0,0,1,0,17l-56,56a12,12,0,0,1-17,0l-24-24a12,12,0,1,1,17-17L112,143l47.51-47.52A12,12,0,0,1,176.49,95.51ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z';
        case 'is-no':
            return 'M168.49,104.49,145,128l23.52,23.51a12,12,0,0,1-17,17L128,145l-23.51,23.52a12,12,0,0,1-17-17L111,128,87.51,104.49a12,12,0,0,1,17-17L128,111l23.51-23.52a12,12,0,0,1,17,17ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z';
        case 'is-info':
            return 'M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212Zm48.49-92.49a12,12,0,0,1,0,17l-32,32a12,12,0,1,1-17-17L139,140H88a12,12,0,0,1,0-24h51l-11.52-11.51a12,12,0,1,1,17-17Z';
        case 'is-transit':
            return 'M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212Zm48.49-92.49a12,12,0,0,1,0,17l-32,32a12,12,0,1,1-17-17L139,140H88a12,12,0,0,1,0-24h51l-11.52-11.51a12,12,0,1,1,17-17Z';
        case 'is-warning':
            return 'M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212Zm-12-80V80a12,12,0,0,1,24,0v52a12,12,0,0,1-24,0Zm28,40a16,16,0,1,1-16-16A16,16,0,0,1,144,172Z';
        case 'is-arrow-right':
            return 'M6.29553 13.4419C6.1979 13.5395 6.03961 13.5395 5.94198 13.4419L5.05809 12.558C4.96046 12.4604 4.96046 12.3021 5.05809 12.2045L9.2626 7.99996L5.05809 3.79547C4.96046 3.69787 4.96046 3.53957 5.05809 3.44187L5.94197 2.55807C6.0396 2.46037 6.1979 2.46037 6.29553 2.55807L11.5607 7.82319C11.6583 7.92082 11.6583 8.07911 11.5607 8.17674L6.29553 13.4419Z';
        default:
            return '';
    }
}

async function generateOrderItem(order: Order) {
    // Stwórz element <li> dla zamówienia
    const li = document.createElement('li');
    li.className = 'order_list_item';

    // Dodaj szczegóły zamówienia
    li.innerHTML = `
        <div class="order_row">
            <div class="order_top-wrapper">
                <div class="margin-vertical margin-xsmall">
                    <div class="order_details">
                        <div class="heading-style-h6">Zamówienie nr <span class="order_number text-color-brand">${order['Order ID'] || 'Brak numeru'}</span></div>
                        <div class="order_details_grid">
                            <div class="order_details_grid_item">
                                <div class="text-size-small">Data zamówienia:</div>
                            </div>
                            <div class="order_details_grid_item">
                                <div class="text-size-small">${order['Order date'] || 'Nieznana'}</div>
                            </div>
                            <div class="order_details_grid_item">
                                <div class="text-size-small">Kwota zamówienia:</div>
                            </div>
                            <div class="order_details_grid_item">
                                <div class="text-size-small">${order['Order value'] || '0.00 zł'}</div>
                            </div>
                            <div class="spacer-xxsmall is-grid-2"></div>
                            <div class="order_details_grid_item">
                                <div class="text-size-small">Status płatności:</div>
                            </div>
                            <div class="order_details_grid_item">
                                    ${createOrderParameter(
                                    'is-paid',
                                    'is-yes',
                                    'Zapłacone',
                                    order['Payment status'] === 'Zapłacone'
                                )}
                                    ${createOrderParameter(
                                    'is-not-paid',
                                    'is-no',
                                    'Procesowanie',
                                    order['Payment status'] === 'Procesowanie'
                                )}
                            </div>
                            <div class="order_details_grid_item">
                                <div class="text-size-small">Status przesyłki:</div>
                            </div>
                            <div class="order_details_grid_item">
                                <div class="order-details">
                                    ${createOrderParameter(
                                        'is-delivered', 
                                        'is-yes', 
                                        'Dostarczono',
                                        order['Delivery status'] === 'Dostarczono'
                                    )}
                                    ${createOrderParameter(
                                        'is-in-transit', 
                                        'is-transit', 
                                        'W tranzycie',
                                        order['Delivery status'] === 'W tranzycie'
                                    )}
                                    ${createOrderParameter(
                                        'is-waiting-for-transit', 
                                        'is-info', 
                                        'Oczekiwanie na transport',
                                        order['Delivery status'] === 'Oczekiwanie na transport'
                                    )}
                                    ${createOrderParameter(
                                        'is-no-payment', 
                                        'is-warning', 
                                        'Oczekiwanie na płatność',
                                        order['Delivery status'] === 'Oczekiwanie na płatność'
                                    )}
                                </div>       
                            </div>                 
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Znajdź element `order_top-wrapper`, gdzie mają być dodane produkty
    const orderTopWrapper = li.querySelector('.order_top-wrapper');
    if (!orderTopWrapper) {
        console.error('Nie znaleziono elementu .order_top-wrapper w li!');
        return li; // Zakończ, jeśli struktura HTML jest niepoprawna
    }

    let totalValue = 0; // Zmienna do przechowywania sumy

    // Dodaj produkty do zamówienia
    for (const product of order.products) {
        const productDetails: Product = await fetchProductDetails(product.productId); // Pobierz szczegóły produktu

        const productQuantity = Number(product.quantity) || 0;
        const productPrice = productDetails.fieldData.cena || 0;
        const productTotal = productQuantity * productPrice;

        totalValue += productTotal; // Dodaj wartość produktu do całkowitej sumy

        const productDiv = document.createElement('div');
        productDiv.className = 'order_product';
        productDiv.innerHTML = `
            <img loading="lazy" src="${productDetails.fieldData.miniatura?.url}" alt="${productDetails.fieldData.miniatura?.alt || productDetails.fieldData.name}" class="order_product_image">
            <div class="order_product_group">
                <div class="order_product_details">
                    <div class="text-weight-semibold">${productDetails.fieldData.name || 'Nieznany produkt'}</div>
                    <div class="order_product_details_grid">
                        <div class="order_details_grid_item">
                            <div class="text-size-small">Ilość produktów:</div>
                            <div class="text-size-small">${product.quantity || 0}</div>
                        </div>
                        <div class="order_details_grid_item">
                            <div class="text-size-small">Kwota za sztukę:</div>
                            <div class="text-size-small">${productDetails.fieldData.cena.toFixed(2) || '0.00'} zł</div>
                        </div>
                    </div>
                </div>
                <div class="order_product_price">
                    <div class="heading-style-h6 text-color-brand">${(productDetails.fieldData.cena * Number(product.quantity)).toFixed(2)} zł</div>
                </div>
            </div>
        `;
        orderTopWrapper.appendChild(productDiv);
    }

    // Dodaj divider
    const dividerDiv = document.createElement('div');
    dividerDiv.className = 'divider';
    orderTopWrapper.appendChild(dividerDiv);

    // Dodaj przyciski akcji
    const actionDiv = document.createElement('div');
    actionDiv.className = 'order_again';
    actionDiv.innerHTML = `
        <div class="margin-vertical margin-xsmall">
            <div class="button is-secondary is-small" orders="again">
                <div>Zamów ponownie</div>
            </div>
        </div>
    `;

    // Znajdź element `order_row` w nowym `li`
    const orderRow = li.querySelector('.order_row');
    if (orderRow) {
        orderRow.appendChild(actionDiv); // Dodaj `order_again` jako dziecko `order_row`
    }

    // Dodaj footer
    const footerDiv = document.createElement('div');
    footerDiv.className = 'margin-vertical margin-xsmall';
    footerDiv.innerHTML = `
        <div class="order_row is-reverse">
            <div class="order_total">
                <div class="text-size-small">Razem:</div>
                <div class="heading-style-h5">${totalValue.toFixed(2)} zł</div>
            </div>
            <div class="button-group">
                <a href="${order['FV PDF']}" class="button is-link is-icon w-inline-block" target="_blank" rel="noopener noreferrer">
                    <div class="order_download_faktura">Pobierz fakturę</div>
<!--                    <div class="order_download_proforma">Pobierz proformę</div>-->
                    <div class="link-chevron"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="${getIconPath('is-arrow-right')}" fill="currentColor"></path></svg></div>
                </a>
            </div>
        </div>
    `;

    li.appendChild(footerDiv);

    return li;
}

const renderOrders = async (orders: Record<string, Order>): Promise<void> => {
    orderList.innerHTML = ''; // Wyczyść istniejącą listę

    // Konwersja obiektu na tablicę
    const orderArray = Object.values(orders);

    if (orderArray.length === 0) {
        noResultElement.style.display = 'block';
    } else {
        noResultElement.style.display = 'none';

        for (const order of orderArray) {
            const orderItem = generateOrderItem(order);
            await orderList.appendChild(await orderItem);
        }

        // Inicjalizuj przyciski "Zamów ponownie" po renderowaniu elementów
        await initializeOrderAgain();
    }
};

export const initializeOrders = async (memberData: Member): Promise<any> => {
    const customerNip = memberData.customFields.nip;
    const orders = await fetchOrdersByNip(customerNip);
    await renderOrders(orders);
}