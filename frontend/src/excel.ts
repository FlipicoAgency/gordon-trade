import ExcelJS from 'exceljs';
import type {Order} from "../types/orders-b2b";
import {generateOrderItem} from "./dashboard/orders";
import type {ProductInCart} from "../types/cart";
import type {Member} from "./memberstack";
import {categoryMap, fetchCategories, fetchProductDetails} from "./cartItems";

const currencyMap: Record<string, string> = {
    pl: 'zł',
    cs: 'EUR',
    hu: 'EUR',
    en: 'EUR',
};

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
            `https://koszyk.gordontrade.pl/api/sheets/orders?nip=${encodeURIComponent(customerNip)}`,
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
        //console.log('raw data:', rawData);

        // Oczyszczanie i formatowanie danych
        //console.log('Zamówienia:', cleanData);

        return cleanAndFormatData(rawData);
    } catch (error) {
        console.error('Błąd podczas pobierania zamówień:', error);
        return null;
    }
};

async function fetchNewOrder(customerNip: string, translations: Record<string, string>, language: string) {
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
            console.error('Brak nowych zamówień do dodania.');
            return;
        }

        // Dodaj nowe zamówienia do localStorage
        const updatedOrders = { ...existingOrders, ...orders };
        localStorage.setItem('orders', JSON.stringify(updatedOrders));

        // Dodaj nowe zamówienia do listy
        for (const newOrder of newOrders) {
            try {
                const orderItem = await generateOrderItem(newOrder, translations, language);
                if (orderItem) {
                    orderList.appendChild(orderItem);
                }
            } catch (error) {
                console.error(`Błąd podczas generowania zamówienia:`, error);
            }
        }

        console.log('Nowe zamówienia zostały dodane do listy.');
    } catch (error) {
        console.error('Błąd podczas dodawania nowych zamówień do listy:', error);
    }
}

export async function addNewOrderToExcel(
    items: ProductInCart[] | Order,
    memberData: Member | null,
    translations: Record<string, string>,
    language: string,
    order?: Order,
) {
    try {
        const currency = currencyMap[language] || 'zł'; // Dodajemy walutę tutaj

        // Przygotuj dane do wysłania do arkusza
        const formattedData = Array.isArray(items)
            ? items.map((product, index) => [
                index === 0 ? memberData?.customFields.nip : '',
                index === 0 ? memberData?.customFields["company-name"] : '',
                index === 0 ? String(Math.floor(100000000 + Math.random() * 900000000)) : '', // Generuj losowe Order ID
                product.fieldData.sku || '',
                product.fieldData.name || '',
                product.id || '',
                product.variant || '',
                product.quantity || '',
                `${product.price.toFixed(2)} ${currency}`, // <-- TU dodajemy walutę!
                index === 0
                    ? items
                    .reduce((sum, item) => sum + (item.price * item.quantity), 0)
                    .toFixed(2) + ` ${currency}` // <-- Tutaj też!
                    : '',
                index === 0 ? getTodayDate() : '', // Data zamówienia
                '', // FV amount netto
                '', // FV number
                '', // FV PDF
                index === 0 ? 'Złożono zapytanie' : '', // Status płatności
                // index === 0 ? 'Złożono zapytanie' : '', // Status dostawy
                // '', // Estimated time of departure
                // '', // Fastest possible shipping date
                // '', // Estimated time of arrival
                // '', // Extended delivery date
                '', // Comments
            ])
            : items.products.map((product, index) => [
                index === 0 ? items["Customer NIP"] : '',
                index === 0 ? items["Customer Name"] : '',
                index === 0 ? String(Math.floor(100000000 + Math.random() * 900000000)) : '', // Generuj losowe Order ID
                product.sku || '',
                product.name || '',
                product.id || '',
                product.variant || '',
                product.quantity || '',
                `${product.price} ${currency}`,
                index === 0 ? items["Order value"] + ` ${currency}` : '',
                index === 0 ? getTodayDate() : '',
                '', // FV amount netto
                '', // FV number
                '', // FV PDF
                index === 0 ? 'Złożono zapytanie' : '',
                // index === 0 ? 'Złożono zapytanie' : '',
                // '', // Estimated time of departure
                // '', // Fastest possible shipping date
                // '', // Estimated time of arrival
                // '', // Extended delivery date
                '', // Comments
            ]);

        console.log('Formatted data:', formattedData);

        // Wyślij dane do backendu
        const response = await fetch('https://koszyk.gordontrade.pl/api/sheets/orders', {
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
            await fetchNewOrder(order['Customer NIP'], translations, language);
        }
    } catch (error) {
        console.error('Błąd podczas dodawania zamówienia do arkusza:', error);
    }
}

async function fetchImageAsArrayBuffer(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Błąd pobierania obrazu: ${url}`);
    }
    return await response.arrayBuffer();
}

const generateExcelFile = async (products: ProductInCart[]): Promise<void> => {
    // Oddzielnie przechowujemy URL-e obrazów
    const imageUrls = products.map(product => product.fieldData.thumbnail.url);

    // Przygotuj dane do Excela, bez URL w kolumnie "Zdjęcie"
    const data = products.map(product => ({
        "Nazwa": product.fieldData.name,
        "Kategoria": categoryMap[product.fieldData.category],
        // "Wariant": product.variant || '',
        "Cena": `${product.fieldData.pricePromo > 0 ? product.fieldData.pricePromo.toFixed(2) : product.fieldData.priceNormal.toFixed(2)} zł`,
        "SKU": product.fieldData.sku,
        "EAN": product.fieldData.ean,
        "Dostępność": product.fieldData.inStock ? "Brak na stanie" : "W magazynie",
        "Zdjęcie": '', // Pusta komórka, obraz wstawimy za chwilę
        "Ilość w kartonie": product.fieldData.quantityInBox,
        "Cena za sztukę przy zakupie pełnego kartonu": product.fieldData.priceCarton
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Oferta');

    // Dodaj nagłówki
    const headers = Object.keys(data[0]);
    worksheet.columns = headers.map(header => ({
        header,
        key: header,
        width: header.length + 10
    }));

    // Dodaj dane
    data.forEach(row => {
        worksheet.addRow(row);
    });

    // Styl komórek, wierszy i nagłówków
    worksheet.eachRow((row, rowNumber) => {
        row.height = 66;
        row.eachCell(cell => {
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            if (rowNumber === 1) {
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'C0C0C0' }
                };
            }
        });
    });

    // Dostosowanie szerokości kolumn
    (worksheet.columns as ExcelJS.Column[]).forEach(column => {
        let maxLength = 10;
        column.eachCell({ includeEmpty: true }, cell => {
            const val = cell.value;
            if (val && val.toString().length > maxLength) {
                maxLength = val.toString().length;
            }
        });
        column.width = maxLength + 2;
    });

    // Wstawianie obrazów
    const imageColIndex = headers.indexOf("Zdjęcie") + 1;
    if (imageColIndex > 0) {
        const imageBuffers = await Promise.all(imageUrls.map(url => fetchImageAsArrayBuffer(url)));

        imageBuffers.forEach((buffer, i) => {
            const rowNumber = i + 2; // Dane od drugiego wiersza
            const imageId = workbook.addImage({
                buffer: new Uint8Array(buffer),
                extension: 'png'
            });

            // twoCell anchor - obraz będzie "przyklejony" do komórki
            // tl: top-left komórki,
            // br: bottom-right ustawia granice tak, by obraz wypełnił dokładnie tę komórkę.
            worksheet.addImage(imageId, {
                editAs: 'twoCell',
                // @ts-ignore
                tl: { col: imageColIndex - 1, row: rowNumber - 1 },
                // @ts-ignore
                br: { col: imageColIndex, row: rowNumber }
            });
        });
    }

    // Eksport pliku
    const buffer = await workbook.xlsx.writeBuffer();
    const excelBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oferta.xlsx';
    a.click();
    URL.revokeObjectURL(url);
};

export const initializeGenerateOffer = async (productsToOffer: string[], language: string): Promise<void> => {
    // Dodaj obsługę przycisku "Pobierz ofertę"
    const generateOfferButton = document.getElementById('generate-offer') as HTMLButtonElement;
    if (generateOfferButton) {
        generateOfferButton.addEventListener('click', async () => {
            // // Rozdziel ID i warianty
            // const products = await Promise.all(
            //     productsToOffer.map(async (productIdWithVariant) => {
            //         const [productId, variant] = productIdWithVariant.split('|');
            //         const product = await fetchProductDetails(productId, language);
            //
            //         // Dodaj wariant, jeśli istnieje
            //         if (product && variant) {
            //             product.variant = variant;
            //         }
            //
            //         return product;
            //     })
            // );
            const products = await Promise.all(
                productsToOffer.map(async (productId) => {
                    return await fetchProductDetails(productId, language);
                })
            );

            // Filtruj tylko poprawne produkty
            const validProducts = products.filter(product => product !== null) as ProductInCart[];
            await fetchCategories();
            await generateExcelFile(validProducts);
        });
    }
};
