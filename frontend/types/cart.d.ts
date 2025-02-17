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
        priceCarton: number;
        saleOnlyInFullCartons: boolean;
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
        productFeatured: boolean;
    };
}

export interface ProductInCart extends Product {
    quantity: number;
    price: number;
    lineCost: number;
    variant?: string | null;
}

export interface OrderProduct {
    name: string;
    id: string;
    variant?: string | null;
    quantity: string;
    price: string;
    sku?: string;
    image: string;
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