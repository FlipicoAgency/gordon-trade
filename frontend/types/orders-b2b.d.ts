import type {OrderProduct} from "./cart";

export interface Order {
    products: OrderProduct[];
    "Customer NIP": string;
    "Order ID": string;
    "Product name": string;
    "Product ID": string;
    Quantity: string;
    "Product price": string;
    "Order value": string;
    "Order date": string;
    "FV amount (netto)": string;
    "FV number": string;
    "FV PDF": string;
    "Payment status": string;
    "Delivery status": string;
    "Estimated time of departure": string;
    "Fastest possible shipping date": string;
    "Estimated time of arrival": string;
    "Extended delivery date": string;
    "Recurring order": string;
    Comments: string;
}