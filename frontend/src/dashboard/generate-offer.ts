import * as XLSX from 'xlsx';
import type {Product} from "../cartItems";
import {fetchProductDetails} from "../cartItems";
import {categoryMap} from "./favorites";

const generateExcelFile = (products: Product[]): void => {
    // Przygotuj dane do Excela
    const data = products.map(product => ({
        Nazwa: product.fieldData.name,
        Kategoria: categoryMap[product.fieldData.kategoria] || 'Nieznana kategoria',
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

export const initializeGenerateOffer = async (favorites: string[]): Promise<void> => {
    // Dodaj obsługę przycisku "Pobierz ofertę"
    const generateOfferButton = document.getElementById('generate-offer') as HTMLButtonElement;
    if (generateOfferButton) {
        generateOfferButton.addEventListener('click', async () => {
            const products = await Promise.all(
                favorites.map(productId => fetchProductDetails(productId))
            );
            const validProducts = products.filter(product => product !== null) as Product[];
            generateExcelFile(validProducts);
        });
    }
}