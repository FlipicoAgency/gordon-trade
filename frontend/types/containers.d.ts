import type {OrderProduct} from "./cart";

export interface Status {
    name: string;
    position: string;
    procent: string;
}

export interface Container {
    "Customer NIP": string;
    "Order ID": string;
    "Container No1": string;
    "Container No2": string;
    "Container type": string;
    "Products": OrderProduct[];
    "FV PDF": string;
    "FV amount (netto)": string;
    "FV No": string;
    "Loading port": string;
    "Delivery status": Status;
    "Estimated time of departure": string;
    "Fastest possible shipping date": string;
    "Estimated time of arrival": string;
    "Extended delivery date": string;
    "Personalization": string;
    "Quality control photos": string;
    "Change in transportation cost": string;
    "Periodicity": string;
    "Available to buy": string;
    "OFFER XLS": string;
}