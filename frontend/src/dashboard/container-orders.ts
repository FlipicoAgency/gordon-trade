import type {Member} from '../memberstack';
import {cleanAndFormatData} from "../excel";
import type {Container, Status} from "../../types/containers";
import type {OrderProduct} from "../../types/cart";
import {getIconPath} from "./orders";

function mapYesNo(value: string, translations: Record<string, string>): string {
    if (value === "Tak") {
        return translations.yes;  // w polskim pl.json = "Tak", w angielskim en.json = "Yes"
    }
    if (value === "Nie") {
        return translations.no;   // w polskim pl.json = "Nie", w angielskim en.json = "No"
    }
    return value;
}

// SVG ikony
const icons: Record<string, string> = {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"></path></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256"><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"></path></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"></path></svg>`
};

// Funkcja do konwersji daty do formatu "DD.MM.YYYY"
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL');
}

function formatToContainers(data: any, locations: Status[], translations: Record<string, string>, pending: boolean): Container[] {
    //console.log(data);

    return Object.values(data).map((order: any) => {
        // Mapowanie produktów
        const products: OrderProduct[] = order.products.map((product: any) => ({
            name: product.name,
            variant: product.variant,
            quantity: product.quantity,
            orderValue: product.orderValue,
            estimatedFreight: product.estimatedFreight,
            capacity: product.capacity,
            sku: product.sku,
            image: product.image,
        }));

        // Walidacja kontenera
        if (!order.containerNo1 && !pending) {
            console.error(`Błąd! Kontener nie posiada ID: ${order}`);
        }

        // Budowanie struktury kontenera
        const deliveryStatus = chooseStatus(order.estimatedDeparture, order.estimatedArrival, order.loadingPort, locations, translations, pending);

        return {
            "Customer NIP": order.customerNip,
            "Order ID": order.orderId,
            "Container No1": order.containerNo1,
            "Container No2": order.containerNo2,
            "Container type": order.containerType,
            "Products": products,
            "FV PDF": order.fvPdf || "Brak",
            "FV amount (netto)": order.fvAmountNetto || 0,
            "FV No": order.fvNo || "Brak",
            "Loading port": order.loadingPort || "Brak",
            "Delivery status": deliveryStatus,
            "Estimated time of departure": order.estimatedDeparture || "Brak",
            "Fastest possible shipping date": order.fastestShipping || "Brak",
            "Estimated time of arrival": order.estimatedArrival || "Brak",
            "Extended delivery date": order.extendedDelivery || "Brak",
            "Quality control photos": order.qualityControlPhotos || "Brak",
            "Change in transportation cost": order.changeInTransportationCost || "Brak",
            "Personalization": mapYesNo(order.personalization || translations.none, translations),
            "Periodicity": mapYesNo(order.periodicity || translations.none, translations),
            "Available to buy": mapYesNo(order.available || translations.none, translations),
            "OFFER XLS": order.xls
        };
    });
}

function chooseStatus(departureDate: string, arrivalDate: string, loadingPort: string, locations: Status[], translations: Record<string, string>, pending: boolean): Status {
    if (pending) {
        return {
            name: translations.statusAwaiting,
            position: "top: 0%; left: 0%;",
            procent: "is-0",
        };
    }

    const today = new Date();
    const departure = new Date(departureDate);
    const arrival = new Date(arrivalDate);

    // Oblicz różnicę w dniach między datą wypłynięcia a dzisiejszą datą
    const diffTime = today.getTime() - departure.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    //console.log(`Checking status for departureDate: ${departureDate}, loadingPort: ${loadingPort}, diffDays: ${diffDays}`);

    // Dopasuj lokalizację na podstawie dni
    if (diffDays < 7) {
        const location = locations.find(location => location.name.includes(loadingPort));
        if (location) return location;
    } else if (diffDays >= 7 && diffDays < 14) {
        return locations.find(location => location.name.includes(translations.southChinaSea))!;
    } else if (diffDays >= 14 && diffDays < 21) {
        return locations.find(location => location.name.includes(translations.lakshadweepSea))!;
    } else if (diffDays >= 21 && diffDays < 28) {
        return locations.find(location => location.name.includes(translations.arabianSea))!;
    } else if (diffDays >= 28 && diffDays < 35) {
        return locations.find(location => location.name.includes(translations.redSea))!;
    } else if (diffDays >= 35 && diffDays < 42) {
        return locations.find(location => location.name.includes(translations.mediterraneanSea))!;
    } else if (diffDays >= 42 && diffDays < 49) {
        return locations.find(location => location.name.includes(translations.atlanticOcean))!;
    } else if (diffDays >= 49 && diffDays < 56) {
        return locations.find(location => location.name.includes(translations.englishChannel))!;
    } else if (diffDays >= 56 && diffDays < 63) {
        return locations.find(location => location.name.includes(translations.portGdansk))!;
    } else if (diffDays >= 63) {
        // Jeśli diffDays >= 63, ale dzisiejsza data jest wcześniejsza niż arrivalDate
        if (today < arrival) {
            return locations.find(location => location.name.includes(translations.portGdansk))!;
        }
        // Jeśli diffDays >= 63 i dzisiejsza data jest równa lub późniejsza niż arrivalDate
        return {
            name: translations.statusCompleted,
            position: "top: 0%; left: 0%;",
            procent: "is-100",
        };
    }

    // Ostrzeżenie o nieznanym statusie
    console.error(`Nieznany status dla departureDate: ${departureDate}, loadingPort: ${loadingPort}, diffDays: ${diffDays}`);
    return {
        name: translations.statusUnknown,
        position: "top: 0%; left: 0%;",
        procent: "is-0%",
    };
}

function showOrderInfo(container: Container, containers: Container[], translations: Record<string, string>): void {
    const mapWrapper = document.getElementById("map-wrapper") as HTMLElement;

    // Usuń istniejący element modala, jeśli istnieje
    mapWrapper.querySelector(".map-shipping-info")?.remove();

    // Filtruj kontenery z tym samym statusem
    const containersInSameStatus = containers.filter(
        c => c["Delivery status"].name === container["Delivery status"].name
    );

    // Oblicz listę kontenerów o tym samym statusie
    const containerListHTML = containersInSameStatus.map(sameStatusContainer => {
        // Pobierz daty i sprawdź, czy są poprawne
        const extendedDeliveryDate =
            sameStatusContainer["Extended delivery date"] !== "Brak"
                ? sameStatusContainer["Extended delivery date"]
                : null;
        const estimatedArrivalDate =
            sameStatusContainer["Estimated time of arrival"] !== "Brak"
                ? sameStatusContainer["Estimated time of arrival"]
                : null;


        // Oblicz liczbę dni opóźnienia
        const delayDays =
            extendedDeliveryDate && estimatedArrivalDate
                ? Math.ceil(
                    (new Date(extendedDeliveryDate).getTime() - new Date(estimatedArrivalDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
                : null;

        // Przygotuj HTML opóźnienia, jeśli istnieje
        const delayInfoHTML =
            delayDays !== null
                ? `<div class="text-style-muted">${translations.delay}</div>
                   <div>${delayDays} ${translations.days}</div>`
                : "";

        // Walidacja i renderowanie `Change in transportation cost`
        const transportationCostChange =
            sameStatusContainer["Change in transportation cost"] !== "Brak"
                ? `<div class="text-style-muted">${translations.changeTransportationCost}</div>
                   <div>${sameStatusContainer["Change in transportation cost"]}</div>`
                : ``;

        const productListHTML = sameStatusContainer.Products.map(
            item => `
                <div class="shipping-collection-item">
                    <div class="text-style-ellipsis">
                        ${item.name}${Number(item.quantity) > 1 ? ` (${item.quantity} pcs)` : ""}
                    </div>
                    ${item.variant !== 'Brak' ? `<div class="text-weight-normal text-style-muted">${translations.variant} <span>${item.variant}</span></div>` : ''}
                </div>`
        ).join("");

        return `
            <div class="shipping-details-item">
                <div class="text-style-muted">${translations.containerNumber}</div>
                <div class="text-weight-semibold">${sameStatusContainer["Container No1"]}</div>
                <div class="shipping-collection-list">
                    ${productListHTML}
                </div>
                <div class="text-style-muted">${translations.personalization}</div>
                <div>${sameStatusContainer.Personalization}</div>
                <div class="text-style-muted">${translations.periodicity}</div>
                <div>${sameStatusContainer.Periodicity}</div>
                ${transportationCostChange}
                <div class="text-style-muted">${translations.plannedDelivery}</div>
                <div>${formatDate(sameStatusContainer["Estimated time of arrival"])}</div>
                ${delayInfoHTML}
            </div>
        `;
    }).join("");

    // Tworzenie całego HTML modala
    const modalHTML = `
        <div class="map-shipping-info">
            <div class="shipping-wrapper">
                <div class="map-product-parameter">
                    <div class="text-weight-semibold">${container["Delivery status"].name} (${containersInSameStatus.length})</div>
                    <button class="shipping-modal-close-button">
                        <div class="icon-1x1-xsmall">
                            <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-x">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                                <path d="M18 6l-12 12"></path>
                                <path d="M6 6l12 12"></path>
                                </svg>
                        </div>
                    </button>
                </div>
                <div class="shipping-details">
                    ${containerListHTML}
                </div>
            </div>
        </div>
    `;


    // Dodanie modala do wrappera
    mapWrapper.insertAdjacentHTML('afterbegin', modalHTML);

    // Pobierz nowo utworzony modal i obsłuż zamknięcie
    const modalWrapper = mapWrapper.querySelector(".map-shipping-info") as HTMLElement;
    modalWrapper.querySelector(".shipping-modal-close-button")?.addEventListener("click", () => {
        modalWrapper.remove();
    });

    // Zamknięcie przy kliknięciu poza modalem
    const handleOutsideClick = (event: MouseEvent) => {
        if (!modalWrapper.contains(event.target as Node)) {
            modalWrapper.remove();
            document.removeEventListener("click", handleOutsideClick);
        }
    };

    setTimeout(() => {
        document.addEventListener("click", handleOutsideClick);
    }, 0);
}

function countContainersWithSameStatus(containers: Container[], statusName: string): number {
    return containers.filter(container => container["Delivery status"].name === statusName).length;
}

function generateShipItem(container: Container, containers: Container[], translations: Record<string, string>): void {
    const statusName: string = container["Delivery status"].name || "";

    // Sprawdzenie czy status to "Zrealizowano", w takim przypadku pomijamy generowanie ship item
    if (statusName === translations.statusCompleted || statusName === translations.statusUnknown) {
        console.log(`Pomijanie generowania ship item dla kontenera ${container["Container No1"]} o statusie: ${statusName}`);
        return;
    }

    const position: string = container["Delivery status"].position || "";
    const mapWrapper = document.getElementById("map-wrapper") as HTMLElement;

    // Liczba kontenerów w tym samym statusie
    const containersInSameStatus = countContainersWithSameStatus(containers, statusName);

    // Generowanie struktury HTML
    const newElement = document.createElement("div");
    newElement.classList.add("map-pin");
    newElement.innerHTML = `
        <div class="map-dot-wrapper" style="${position}">
            <div class="map-dot"></div>
            <div class="map-dot is-2"></div>
        </div>
        <div class="map-shipping-wrapper" style="${position}">
            <div class="map-shipping-location">
                <div class="text-size-tiny text-weight-bold text-style-nowrap">${statusName}</div>
            </div>
            <button class="map-shipping-button">
                <div class="text-size-tiny text-weight-bold">${containersInSameStatus}</div>
                <div class="icon-1x1-xxsmall">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M222.33,106.79,212,103.35V56a20,20,0,0,0-20-20H140V24a12,12,0,0,0-24,0V36H64A20,20,0,0,0,44,56v47.35l-10.33,3.44a20,20,0,0,0-13.67,19V152c0,64.63,100.8,90.57,105.09,91.64a11.94,11.94,0,0,0,5.82,0C135.2,242.57,236,216.63,236,152V125.77A20,20,0,0,0,222.33,106.79ZM68,60H188V95.35L131.79,76.62a11.85,11.85,0,0,0-7.58,0L68,95.35Zm144,92c0,36.69-58.08,60.43-84,67.59-25.94-7.17-84-30.9-84-67.59V128.65l72-24V168a12,12,0,0,0,24,0V104.65l72,24Z"></path>
                    </svg>
                </div>
            </button>
        </div>
    `;
    mapWrapper.querySelector(".map-shipping-info.hide")?.remove();
    mapWrapper.querySelector(".map-pin.hide")?.remove();
    mapWrapper.appendChild(newElement);

    // Obsługa zdarzeń
    const mapShippingButton = newElement.querySelector(".map-shipping-button") as HTMLElement;

    mapShippingButton.addEventListener("click", (event) => {
        //event.stopPropagation();
        showOrderInfo(container, containers, translations);
    });
}

function generateShipListItem(container: Container, translations: Record<string, string>, listWrapper: HTMLElement, pending: boolean): void {
    const statusName: string = container["Delivery status"].name || "";

    // Sprawdzenie czy status to "Zrealizowano", w takim przypadku pomijamy generowanie ship item
    if (statusName === translations.statusCompleted || statusName === translations.statusUnknown) {
        console.log(`Pomijanie generowania ship item dla kontenera ${container["Container No1"]} o statusie: ${statusName}`);
        return;
    }

    // Wybierz klasę procentową na podstawie wartości "procent"
    const progressClass = container["Delivery status"].procent || "is-0";
    const isComplete = progressClass === "is-100";
    const isError = container["Extended delivery date"] !== '';

    // Wybierz odpowiednią ikonę na podstawie warunku
    const iconSVG = isComplete ? icons.success : (isError ? icons.error : icons.default);

    // Tworzenie elementu listy
    const htmlElement = document.createElement("div");
    htmlElement.classList.add("stacked-list4_item", "w-inline-block");

    // Sprawdzenie, czy pole "Extended delivery date" nie jest puste
    const extendedDeliveryDate = container["Extended delivery date"];
    const delayInfoHTML = extendedDeliveryDate !== "Brak"
    ? `<div class="text-size-small">${translations.orderDelayed} <span class="text-weight-semibold">${formatDate(extendedDeliveryDate)}</span></div>`
    : "";

    htmlElement.innerHTML = `
        <div class="stacked-list4_content-top">
            ${pending ? 
                `<div class="text-size-small">${translations.plannedDeparture} <span class="text-weight-semibold text-color-brand">${container["Estimated time of departure"]}</span></div>` 
                    : `<div class="text-size-small">${translations.containerNumber} <span class="text-weight-semibold text-color-brand">${container["Container No1"]}</span></div>`}
            <div class="stacked-list4_info">
                <div class="text-size-small">${translations.plannedDelivery} <span class="text-weight-semibold">${formatDate(container["Estimated time of arrival"])}</span></div>
                ${delayInfoHTML}
            </div>
         </div>
        <div class="stacked-list4_progress ${isError ? 'is-error' : ''}">
            <div class="stacked-list4_progress-bar ${progressClass} ${isError ? 'is-error' : ''}">
                <div class="stacked-list4_progress-dot ${isComplete ? 'is-success' : ''} ${isError ? 'is-error' : ''}">
                    <div class="stacked-list4_progress-status-text ${isComplete ? 'is-success' : ''} ${isError ? 'is-error' : ''}">${container["Delivery status"].name}</div>
                    <div class="icon-1x1-xsmall">
                        ${iconSVG}
                    </div>
                </div>
            </div>
        </div>
        <div class="stacked-list4_content-middle">
            <div class="text-size-small">${translations.china}</div>
            <div class="text-size-small">${container["Delivery status"].name === translations.statusCompleted ? translations.statusCompleted : translations.poland}</div>
        </div>
        <div class="stacked-list4_content-bottom">
            <div class="shipping-collection-list is-list">
                ${container.Products.map((item: any) => {
                    return `
                        <div class="shipping-collection-item">
                            <div class="text-style-ellipsis">
                                ${item.name}${Number(item.quantity) > 1 ? ` (${item.quantity} pcs)` : ""}
                            </div>
                            ${item.variant !== 'Brak' ? `<div class="text-weight-normal text-style-muted">${translations.variant} <span>${item.variant}</span></div>` : ''}
                            ${item.sku ? `<div class="text-weight-normal text-style-muted">SKU: <span>${item.sku}</span></div>` : ''}
                            ${item.image ? `<img class="order_product_image" alt=${item.name} src=${item.image}>` : ''}
                        </div>
                    `; 
                }).join('')}
            </div>
        </div>
        <div class="stacked-list4_content-button">
            ${container["Quality control photos"] !== 'Brak' ? `
                <a href="${container["Quality control photos"]}" class="button is-link is-icon w-inline-block" target="_blank" rel="noopener noreferrer">
                    <div>${translations.qualityControlPhotos}</div>
                    <div class="link-chevron"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="${getIconPath('is-arrow-right')}" fill="currentColor"></path></svg></div>
                </a>
            ` : ''}
            ${container["FV PDF"] !== 'Brak' ? `
                <a href="${container["FV PDF"]}" class="button is-link is-icon w-inline-block" target="_blank" rel="noopener noreferrer">
                    <div class="order_download_faktura">${translations.downloadInvoice}</div>
                    <div class="link-chevron"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="${getIconPath('is-arrow-right')}" fill="currentColor"></path></svg></div>
                </a>
            ` : ''}
            ${container["OFFER XLS"] && pending ? `
                <a href="${container["OFFER XLS"]}" class="button is-link is-icon w-inline-block" target="_blank" rel="noopener noreferrer">
                    <div class="order_download_faktura">${translations.downloadXls}</div>
                    <div class="link-chevron"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="${getIconPath('is-arrow-right')}" fill="currentColor"></path></svg></div>
                </a>
            ` : ''}
        </div>
    `;

    // Dodajemy nowo utworzony element do kontenera
    listWrapper.appendChild(htmlElement);
}

export async function fetchContainers(translations: Record<string, string>, isGordon: boolean, memberData?: Member, nip?: number, pending?: boolean) {
    const locations: Status[] = [
        {
            name: "Ningbo",
            position: "top: 44%; left: 74%;",
            procent: "is-0",
        },
        {
            name: "Tianjin",
            position: "top: 15%; left: 73%;",
            procent: "is-0",
        },
        {
            name: "Qingdao",
            position: "top: 27%; left: 77%;",
            procent: "is-0",
        },
        {
            name: "Shanghai",
            position: "top: 40%; left: 77%;",
            procent: "is-0",
        },
        {
            name: "Shenzhen",
            position: "top: 51%; left: 69%;",
            procent: "is-0",
        },
        {
            name: translations.southChinaSea,
            position: "top: 68%; left: 69%;",
            procent: "is-15",
        },
        {
            name: translations.lakshadweepSea,
            position: "top: 68%; left: 56%;",
            procent: "is-25",
        },
        {
            name: translations.arabianSea,
            position: "top: 65%; left: 46%;",
            procent: "is-35",
        },
        {
            name: translations.redSea,
            position: "top: 50%; left: 33%;",
            procent: "is-50",
        },
        {
            name: translations.mediterraneanSea,
            position: "top: 37.5%; left: 23%;",
            procent: "is-65",
        },
        {
            name: translations.atlanticOcean,
            position: "top: 36%; left: 10%;",
            procent: "is-75",
        },
        {
            name: translations.englishChannel,
            position: "top: 22%; left: 15%;",
            procent: "is-85",
        },
        {
            name: translations.portGdansk,
            position: "top: 18%; left: 23%;",
            procent: "is-100",
        },
    ];

    let listWrapper: HTMLElement;

    if (isGordon && pending === false) {
        listWrapper = document.getElementById('container-list-stacked-sea') as HTMLElement;
    } else if (!isGordon && pending === false) {
        listWrapper = document.getElementById('container-list-stacked') as HTMLElement;
    } else if (!isGordon && pending === true) {
        listWrapper = document.getElementById('container-list-stacked-pending') as HTMLElement;
    } else {
        console.error("Nieznany stan dla parametrów isGordon:", isGordon, "oraz pending:", pending);
        return; // Wyjdź z funkcji, jeśli parametry są nieprawidłowe
    }

    try {
        // Tworzenie URL z warunkiem dla pending
        const baseUrl = `https://koszyk.gordontrade.pl/api/sheets/containers?nip=${memberData ? encodeURIComponent(memberData.customFields.nip) : nip}`;
        const url = pending ? `${baseUrl}&pending=true` : baseUrl;

        // Wysłanie webhooka na Make
        const response = await fetch(url,
            {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        // Sprawdzenie czy odpowiedź jest OK
        if (!response.ok) throw new Error("Network response was not ok");

        const rawData = await response.json();

        const filteredContainers = isGordon
            // @ts-ignore
            ? rawData.filter(container => container.available === "Tak")
            : rawData;

        // Oczyszczanie i formatowanie danych
        const cleanData = cleanAndFormatData(filteredContainers);
        //console.log('Zamówienia:', cleanData);

        const containers: Container[] = formatToContainers(cleanData, locations, translations, pending);
        console.log('Kontenery:', containers);

        // Iteracja przez kontenery
        containers.forEach((container: Container) => {
            //console.log('Status name:', container["Delivery status"].name);

            if (!isGordon) {
                // Utwórz znacznik na mapie
                generateShipItem(container, containers, translations);
            }

            // Utwórz element w liście
            generateShipListItem(container, translations, listWrapper, pending);
        });

        //console.log("Webhook sent and response processed successfully");
    } catch (error) {
        console.error("Error in fetching or processing webhook response:", error);
    }
}