export interface Product {
    id: string;
    cmsLocaleId: string;
    lastPublished: string | null;
    lastUpdated: string;
    createdOn: string;
    isArchived: boolean;
    isDraft: boolean;
    fieldData: {
        priceNormal: number;
        pricePromo: number;
        promo: boolean;
        quantityInBox: number;
        stockNumber: number;
        inStock: boolean;
        weightCarton: number;
        dimensionsCarton: string;
        priceCarton;
        name: string;
        description: string;
        tags: string;
        ean?: string;
        sku: string;
        thumbnail: {
            fileId: string;
            url: string;
            alt: string | null;
        };
        gallery: Array<{
            fileId: string;
            url: string;
            alt: string | null;
        }>;
        slug: string;
        category: string;
        productUnavailable: boolean;
        productFeatured: boolean;
        productVisibleOnPage: boolean;
    };
}

export interface ProductInCart extends Product {
    quantity: number;
    price: number;
    variant?: string | null;
}

export interface OrderProduct {
    name: string;
    id: string;
    quantity: string;
    price: string;
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