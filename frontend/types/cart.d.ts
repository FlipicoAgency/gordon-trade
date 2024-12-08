export interface Product {
    id: string; // Identyfikator produktu
    cmsLocaleId: string; // Identyfikator lokalizacji CMS
    lastPublished: string | null; // Data ostatniej publikacji (ISO8601) lub null
    lastUpdated: string; // Data ostatniej aktualizacji (ISO8601)
    createdOn: string; // Data utworzenia (ISO8601)
    isArchived: boolean; // Czy produkt jest zarchiwizowany
    isDraft: boolean; // Czy produkt jest wersją roboczą
    fieldData: {
        cena: number; // Cena produktu
        iloscWKartonie: number; // Ilość produktów w kartonie
        procentZnizki: number; // Procent zniżki
        stanMagazynowy: number; // Stan magazynowy
        wagaKarton: number; // Waga jednego kartonu (pole `1-karton---waga`)
        wymiaryKarton: string; // Wymiary kartonu (pole `1-karton---wymiary-2`)
        name: string; // Nazwa produktu
        opis: string; // Opis produktu w formacie HTML
        tagi: string; // Tagi produktu
        ean?: string; // Kod EAN (może być opcjonalny)
        sku: string; // Kod SKU
        miniatura: {
            fileId: string; // ID pliku miniatury
            url: string; // URL obrazu
            alt: string | null; // Alternatywny tekst dla obrazu
        };
        galeria: Array<{
            fileId: string; // ID pliku obrazu w galerii
            url: string; // URL obrazu w galerii
            alt: string | null; // Alternatywny tekst dla obrazu
        }>;
        slug: string; // Przyjazny adres URL produktu
        kategoria: string; // Identyfikator kategorii produktu
        promocja: boolean; // Czy produkt jest w promocji
        produktNiedostepny: boolean; // Czy produkt jest niedostępny
        wMagazynie: boolean; // Czy produkt jest dostępny w magazynie
        produktWyrozniony: boolean; // Czy produkt jest wyróżniony
        produktWidocznyNaStronie: boolean; // Czy produkt jest widoczny na stronie
    };
}

export interface ProductInCart extends Product {
    quantity: number;
    variant?: string | null;
}

export interface OrderProduct {
    name: string;
    id: string;
    quantity: string;
    variant?: string | null;
    orderValue?: string;
    estimatedFreight?: string;
    capacity?: string;
}

export interface Category {
    id: string;
    cmsLocaleId: string;
    lastPublished: string;
    lastUpdated: string;
    createdOn: string;
    isArchived: boolean;
    isDraft: boolean;
    fieldData: {
        name: string;
        slug: string;
        zdjecie: {
            fileId: string;
            url: string;
            alt: string | null;
        };
        ikona: {
            fileId: string;
            url: string;
            alt: string | null;
        };
    };
}