import {fetchProductDetails} from "../cartItems";
import type {Member} from "../memberstack";
import type {OrderProduct, Product, ProductInCart} from "../../types/cart";
import type {Order} from "../../types/orders-b2b";
import {addNewOrderToExcel, fetchOrdersByNip} from "../excel";

const noResultElement = document.querySelector('[orders="none"]') as HTMLElement;
const orderList = document.querySelector('.order_list') as HTMLElement;

/**
 * Funkcja obsługująca ponowne złożenie zamówienia.
 * @param button Element przycisku, który został kliknięty.
 * @param memberData
 */
async function handleOrderAgain(button: HTMLElement, memberData: Member, translations: Record<string, string>, language: string) {
    const orderId = button.getAttribute('data-order-id');
    if (!orderId) {
        console.error('Brak ID zamówienia dla tego przycisku.');
        return;
    }

    try {
        // 1. Pobierz dane zamówień z localStorage
        const ordersData = localStorage.getItem('orders');
        if (!ordersData) {
            console.error('Brak danych zamówień w localStorage.');
            return;
        }

        const orders: Record<string, Order> = JSON.parse(ordersData);
        const foundOrder = Object.values(orders).find(order => order["Order ID"] === orderId);

        if (!foundOrder) {
            console.error(`Nie znaleziono zamówienia o ID: ${orderId}`);
            return;
        }

        // Przetwórz zamówienie
        const order: Order = foundOrder;

        // Sprawdź, czy zamówienie zawiera produkty
        if (!order.products || !Array.isArray(order.products) || order.products.length === 0) {
            console.error(`Zamówienie o ID: ${orderId} nie zawiera produktów.`);
            return;
        }

        // Przygotuj produkty do przetworzenia
        const items: Awaited<null | ProductInCart>[] = await Promise.all(order.products.map(async (product: OrderProduct) => {
            const productDetails: Product | null = await fetchProductDetails(product.id, language);
            if (!productDetails) {
                console.error(`Nie udało się pobrać szczegółów produktu o ID: ${product.id}`);
                return null;
            }

            // parseInt(...) dla ilości
            const parsedQuantity = parseInt(product.quantity, 10) || 1;

            // parseFloat(...) dla ceny (usuwając " zł" i ewentualnie przecinek)
            let parsedPrice = 0;
            if (product.price && product.price.trim() !== '') {
                const cleaned = product.price.replace(' zł', '').replace(',', '.');
                const tmp = parseFloat(cleaned);
                if (!isNaN(tmp)) {
                    parsedPrice = tmp;
                }
            }

            return {
                ...productDetails,
                variant: product.variant || null,
                quantity: parsedQuantity,
                price: parsedPrice,
            } as ProductInCart;
        }));

        // Filtruj produkty, które zostały poprawnie załadowane
        const validItems: ProductInCart[] = items.filter(item => item !== null) as ProductInCart[];

        if (validItems.length === 0) {
            console.error('Brak poprawnych produktów do przetworzenia.');
            return;
        }

        console.log('Items to process:', validItems);

        // Dodaj zamówienie do Excela
        await addNewOrderToExcel(validItems, memberData, translations, language, order);

        // Wyślij nowe zamówienie za pomocą Make
        await sendNewOrderViaMake(validItems, memberData);

        console.log('Zamówienie zostało pomyślnie ponownie złożone.');
    } catch (error) {
        console.error('Błąd podczas obsługi ponownego składania zamówienia:', error);
    }
}

/**
 * Funkcja wysyłająca zamówienie do Make.
 * @param items Produkty w zamówieniu.
 * @param memberData Dane członka (rabaty, itp.).
 */
async function sendNewOrderViaMake(items: ProductInCart[], memberData: Member) {
    const makeUrl = 'https://hook.eu2.make.com/ey0oofllpglvwpgbjm0pw6t0yvx37cnd';

    try {
        const payload = {
            items: items.map(item => ({
                id: item.id,
                name: item.fieldData.name,
                sku: item.fieldData.sku,
                quantity: item.quantity,
                pricePerUnit: item.price.toFixed(2),
                totalPrice: (item.price * item.quantity).toFixed(2),
                variant: item.variant,
                url: item.fieldData.thumbnail,
            })),
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

        console.log('Zamówienie zostało wysłane do Make.');
    } catch (error) {
        console.error('Błąd podczas wysyłania zamówienia do Make:', error);
    }
}

async function initializeOrderAgain(memberData: Member, translations: Record<string, string>, language: string) {
    const orderAgainButtons = document.querySelectorAll<HTMLElement>('[orders="again"]');

    orderAgainButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();

            try {
                await handleOrderAgain(button, memberData, translations, language);
            } catch (error) {
                console.error('Error ordering again:', error);
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

export function getIconPath(iconType: string): string {
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

export async function generateOrderItem(order: Order, translations: Record<string, string>, language: string) {
    const orderValue = order["Order value"];
    const numericOrderValue = parseFloat(orderValue);

    //console.log('order value:', orderValue);
    // Sprawdź, czy orderValue jest prawidłowe
    // if (orderValue <= 0) {
    //     console.error('Nieprawidłowa wartość zamówienia:', order["Order value"]);
    //     return; // Zakończ, jeśli wartość zamówienia jest nieprawidłowa
    // }

    // Stwórz element <li> dla zamówienia
    const li = document.createElement('li');
    li.className = 'order_list_item';

    // Dodaj szczegóły zamówienia
    li.innerHTML = `
        <div class="order_row">
            <div class="order_top-wrapper">
                <div class="margin-vertical margin-xsmall">
                    <div class="order_details">
                        <div class="heading-style-h6">${translations.orderNumberLabel} <span class="order_number text-color-brand">${order['Order ID']}</span></div>
                        <div class="order_details_grid">
                            <div class="order_details_grid_item">
                                <div class="text-size-small">${translations.orderDateLabel}</div>
                            </div>
                            <div class="order_details_grid_item">
                                <div class="text-size-small">${order['Order date']}</div>
                            </div>
                            <div class="order_details_grid_item">
                                <div class="text-size-small">${translations.orderValueLabel}</div>
                            </div>
                            <div class="order_details_grid_item">
                                <div class="text-size-small">${numericOrderValue.toFixed(2)} zł</div>
                            </div>
                            <!--
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
                                ${createOrderParameter(
                                    'is-no-payment',
                                    'is-warning',
                                    'Oczekiwanie na płatność',
                                    order['Payment status'] === 'Oczekiwanie na płatność'
                                )}
                                ${createOrderParameter(
                                    'is-no-payment',
                                    'is-info',
                                    'Złożono zapytanie',
                                    order['Payment status'] === 'Złożono zapytanie'
                                )}
                            </div>
                            -->
                            <div class="order_details_grid_item">
                                <div class="text-size-small">${translations.paymentStatusLabel}</div>
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
                                    ${createOrderParameter(
                                        'is-no-payment',
                                        'is-info',
                                        'Złożono zapytanie',
                                        order['Delivery status'] === 'Złożono zapytanie'
                                    )}
                                </div>       
                            </div>   
                            <!--
                            <div class="order_details_grid_item">
                                <div class="text-size-small">Planowana data dostawy:</div>
                            </div>
                             <div class="order_details_grid_item">
                                <div class="text-size-small">${order['Estimated time of arrival'] || 'Nieznana'}</div>
                            </div>
                            <div class="order_details_grid_item">
                                <div class="text-size-small">Przedłużona data dostawy?</div>
                            </div>
                             <div class="order_details_grid_item">
                                <div class="text-size-small">${order['Extended delivery date'] ? `${translations.yes}, ${order['Extended delivery date']}` : translations.no}</div>
                            </div>     
                            <div class="order_details_grid_item">
                                <div class="text-size-small">Zamówienie cykliczne?</div>
                            </div>
                             <div class="order_details_grid_item">
                                <div class="text-size-small">${order['Recurring order'] ? `Tak` : 'Nie'}</div>
                            </div>
                            -->             
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Znajdź element `order_top-wrapper`, gdzie mają być dodane produkty
    const orderTopWrapper = li.querySelector('.order_top-wrapper');
    if (!orderTopWrapper) {
        throw new Error('Nie znaleziono elementu .order_top-wrapper w li!');
    }

    // Dodaj produkty do zamówienia
    for (const product of order.products) {
        const productDetails: Product = await fetchProductDetails(product.id, language);

        const productQuantity = Number(product.quantity);
        const productPrice = Number(product.price.replace(' zł', '').replace(',', ''));
        const productTotal = productQuantity * productPrice;

        const productDiv = document.createElement('div');
        productDiv.className = 'order_product';
        productDiv.innerHTML = `
            <img loading="lazy" src="${productDetails.fieldData.thumbnail?.url}" alt="${productDetails.fieldData.thumbnail?.alt || productDetails.fieldData.name}" class="order_product_image">
            <div class="order_product_group">
                <div class="order_product_details">
                    <a href="/produkty/${productDetails.fieldData.slug}" class="text-weight-semibold text-style-2lines">${productDetails.fieldData.name}</a>
                    <div class="order_product_details_grid">
                        <div class="order_details_grid_item">
                            <div class="text-size-small">${translations.quantityOfProducts}</div>
                        </div>
                        <div class="order_details_grid_item">
                            <div class="text-size-small">${productQuantity}</div>
                        </div>
                        <div class="order_details_grid_item">
                            <div class="text-size-small">${translations.pricePerUnit}</div>
                        </div>
                        <div class="order_details_grid_item">
                            <div class="text-size-small">${productPrice.toFixed(2)} zł</div>
                        </div>
                        <div class="order_details_grid_item">
                            <div class="text-size-small">SKU:</div>
                        </div>
                        <div class="order_details_grid_item">
                            <div class="text-size-small">${productDetails.fieldData.sku}</div>
                        </div>
                        ${product.variant ? `
                        <div class="order_details_grid_item">
                            <div class="text-size-small">${translations.variant}</div>
                        </div>
                        <div class="order_details_grid_item">
                            <div class="text-size-small">${product.variant}</div>
                        </div>` : ''}
                    </div>
                </div>
                <div class="order_product_price">
                    <div class="heading-style-h6 text-color-brand">${productTotal.toFixed(2)} zł</div>
                </div>
            </div>
        `;
        orderTopWrapper.appendChild(productDiv);
    }

    // Dodaj divider
    const dividerDiv = document.createElement('div');
    dividerDiv.className = 'divider';
    orderTopWrapper.appendChild(dividerDiv);

    // Dodaj przycisk "Zamów ponownie"
    const actionDiv = document.createElement('div');
    actionDiv.className = 'order_again';
    actionDiv.innerHTML = `
        <div class="margin-vertical margin-xsmall">
            <div class="button is-secondary is-small" orders="again" data-order-id="${order["Order ID"]}">
                <div>${translations.reorderButton}</div>
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
                <div class="text-size-small">${translations.togetherLabel}</div>
                <div class="heading-style-h5">${numericOrderValue.toFixed(2)} zł</div>
            </div>
            ${order['FV PDF'] ? `
                <div class="button-group">
                    <a href="${order['FV PDF']}" class="button is-link is-icon w-inline-block" target="_blank" rel="noopener noreferrer">
                        <div class="order_download_faktura">${translations.downloadInvoice}</div>
                        <div class="link-chevron"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="${getIconPath('is-arrow-right')}" fill="currentColor"></path></svg></div>
                    </a>
                </div>
            ` : ''}
        </div>
    `;

    li.appendChild(footerDiv);

    return li;
}

const renderOrders = async (orders: Record<string, Order>, memberData: Member, translations: Record<string, string>, language: string): Promise<void> => {
    orderList.innerHTML = ''; // Wyczyść istniejącą listę

    // Konwersja obiektu na tablicę
    const orderArray = Object.values(orders);

    if (orderArray.length === 0) {
        noResultElement.style.display = 'flex';
    } else {
        noResultElement.style.display = 'none';

        for (const order of orderArray) {
            try {
                const orderItem = await generateOrderItem(order, translations, language);
                if (orderItem) {
                    orderList.appendChild(orderItem);
                }
            } catch (error) {
                console.error(`Błąd podczas generowania zamówienia:`, error);
            }
        }

        // Inicjalizuj przyciski "Zamów ponownie" po renderowaniu elementów
        await initializeOrderAgain(memberData, translations, language);
    }
};

export const initializeOrders = async (memberData: Member, translations: Record<string, string>, language: string): Promise<any> => {
    const customerNip = memberData.customFields.nip;
    const orders = await fetchOrdersByNip(customerNip);

    // Zapisz zamówienia w localStorage
    localStorage.setItem('orders', JSON.stringify(orders));

    await renderOrders(orders, memberData, translations, language);
}