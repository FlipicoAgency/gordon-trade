import * as XLSX from 'xlsx';
import type {Order} from "../types/orders-b2b";
import {generateOrderItem} from "./dashboard/orders";
import type {OrderProduct, ProductInCart, Product} from "../types/cart";
import type {Member} from "./memberstack";
import {fetchCategories, fetchProductDetails} from "./cartItems";
import {categoryMap} from "./cartItems";

const orderedAgainModal = document.querySelector('#re-ordered') as HTMLElement;
const orderList = document.querySelector('.order_list') as HTMLElement;

const getTodayDate = (): string => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0'); // Dodaj zero na początku, jeśli potrzeba
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Miesiące są indeksowane od 0
    const year = today.getFullYear();
    return `${day}.${month}.${year}`;
};

// Funkcja pomocnicza do czyszczenia i formatowania danych z Excela
export const cleanAndFormatData = (data: Record<string, any>): Record<string, any> => {
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

export const fetchOrdersByNip = async (customerNip: string): Promise<any> => {
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
        console.error('Błąd podczas pobierania zamówień:', error);
        return null;
    }
};

async function fetchNewOrder(customerNip: string) {
    try {
        // Pobierz zaktualizowane zamówienia
        const orders = await fetchOrdersByNip(customerNip);

        if (!orders) {
            console.error('Nie udało się pobrać nowych zamówień.');
            return;
        }

        // Pobierz istniejące zamówienia z localStorage
        const existingOrders = JSON.parse(localStorage.getItem('orders') || '{}') as Record<string, Order>;

        // Pobierz istniejące Order ID
        const existingOrderIds = Object.values(existingOrders).map((order: Order) => order["Order ID"]);

        // Filtruj nowe zamówienia
        const newOrders = Object.values(orders as Record<string, Order>).filter(
            (order: Order) => !existingOrderIds.includes(order["Order ID"])
        );

        if (newOrders.length === 0) {
            console.log('Brak nowych zamówień do dodania.');
            return;
        }

        // Dodaj nowe zamówienia do localStorage
        const updatedOrders = { ...existingOrders, ...orders };
        localStorage.setItem('orders', JSON.stringify(updatedOrders));

        // Dodaj nowe zamówienia do listy
        for (const newOrder of newOrders) {
            const orderItem = await generateOrderItem(newOrder as Order);
            orderList.appendChild(orderItem);
        }

        console.log('Nowe zamówienia zostały dodane do listy.');
    } catch (error) {
        console.error('Błąd podczas dodawania nowych zamówień do listy:', error);
    }
}

export async function addNewOrderToExcel(
    items: ProductInCart[] | Order,
    order?: Order,
    memberData?: Member
) {
    try {
        // Przygotuj dane do wysłania do arkusza
        const formattedData = Array.isArray(items)
            ? items.map((product, index) => [
                index === 0 ? memberData?.customFields.nip : '',
                index === 0 ? String(Math.floor(100000000 + Math.random() * 900000000)) : '', // Generuj losowe Order ID
                product.fieldData.name || '',
                product.id || '',
                product.variant || '',
                product.quantity || '',
                index === 0 ? items.reduce((sum, item) => sum + item.fieldData.cena * item.quantity, 0).toFixed(2) : '', // Całkowita wartość zamówienia
                index === 0 ? getTodayDate() : '', // Data zamówienia
                '', // FV amount netto
                '', // FV number
                '', // FV PDF
                index === 0 ? 'Oczekiwanie na płatność' : '', // Status płatności
                index === 0 ? 'Oczekiwanie na płatność' : '', // Status dostawy
                // '', // Estimated time of departure
                // '', // Fastest possible shipping date
                // '', // Estimated time of arrival
                // '', // Extended delivery date
                '', // Comments
            ])
            : items.products.map((product, index) => [
                index === 0 ? items["Customer NIP"] : '',
                index === 0 ? String(Math.floor(100000000 + Math.random() * 900000000)) : '', // Generuj losowe Order ID
                product.name || '',
                product.id || '',
                product.variant || '',
                product.quantity || '',
                index === 0 ? items["Order value"] : '',
                index === 0 ? getTodayDate() : '',
                '', // FV amount netto
                '', // FV number
                '', // FV PDF
                index === 0 ? 'Oczekiwanie na płatność' : '',
                index === 0 ? 'Oczekiwanie na płatność' : '',
                // '', // Estimated time of departure
                // '', // Fastest possible shipping date
                // '', // Estimated time of arrival
                // '', // Extended delivery date
                '', // Comments
            ]);

        console.log('Formatted data:', formattedData);

        // Wyślij dane do backendu
        const response = await fetch('https://gordon-trade.onrender.com/api/sheets/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values: formattedData }),
        });

        if (!response.ok) {
            throw new Error('Nie udało się dodać danych do arkusza.');
        }

        console.log('Dane zostały dodane do arkusza.');

        if (order && orderedAgainModal) {
            orderedAgainModal.style.display = 'flex';
            orderedAgainModal.style.opacity = '0';
            orderedAgainModal.style.transition = 'opacity 0.5s ease';

            setTimeout(() => {
                orderedAgainModal.style.opacity = '1';
            }, 10);

            setTimeout(() => {
                orderedAgainModal.style.opacity = '0';
                setTimeout(() => {
                    orderedAgainModal.style.display = 'none';
                }, 500);
            }, 1500);
        }

        if (order) {
            await fetchNewOrder(order["Customer NIP"]);
        }
    } catch (error) {
        console.error('Błąd podczas dodawania zamówienia do arkusza:', error);
    }
}

const generateExcelFile = (products: Product[]): void => {
    // Przygotuj dane do Excela
    const data = products.map(product => ({
        Nazwa: product.fieldData.name,
        Kategoria: categoryMap[product.fieldData.kategoria] || 'Nieznana kategoria',
        Wariant: '',
        Cena: `${product.fieldData.cena.toFixed(2)} zł`,
        SKU: product.fieldData.sku,
        Dostępność: product.fieldData.produktNiedostepny ? 'Brak na stanie' : 'W magazynie',
    }));

    // Utwórz arkusz Excela
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Oferta');

    // Wygeneruj dane w formacie array
    const excelData = XLSX.write(workbook, {bookType: 'xlsx', type: 'array'});

    // Konwersja na Blob
    const excelBlob = new Blob([excelData], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});

    // Utwórz link do pobrania pliku
    const url = window.URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oferta.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
};

export const initializeGenerateOffer = async (productsToOffer: string[]): Promise<void> => {
    // Dodaj obsługę przycisku "Pobierz ofertę"
    const generateOfferButton = document.getElementById('generate-offer') as HTMLButtonElement;
    if (generateOfferButton) {
        generateOfferButton.addEventListener('click', async () => {
            const products = await Promise.all(
                productsToOffer.map(productId => fetchProductDetails(productId))
            );
            const validProducts = products.filter(product => product !== null) as Product[];
            await fetchCategories();
            generateExcelFile(validProducts);
        });
    }
}