import type {Member} from '../memberstack';
import {cleanAndFormatData} from "../excel";
import type {Container, Status} from "../../types/containers";
import type {OrderProduct} from "../../types/cart";
import {getIconPath} from "./orders";

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
        name: "Morze Południowochińskie",
        position: "top: 68%; left: 69%;",
        procent: "is-15",
    },
    {
        name: "Morze Lakkadiwskie",
        position: "top: 68%; left: 56%;",
        procent: "is-25",
    },
    {
        name: "Morze Arabskie",
        position: "top: 65%; left: 46%;",
        procent: "is-35",
    },
    {
        name: "Morze Czerwone",
        position: "top: 50%; left: 33%;",
        procent: "is-50",
    },
    {
        name: "Morze Śródziemne",
        position: "top: 37.5%; left: 23%;",
        procent: "is-65",
    },
    {
        name: "Ocean Atlantycki",
        position: "top: 36%; left: 10%;",
        procent: "is-75",
    },
    {
        name: "Kanał La Manche",
        position: "top: 22%; left: 15%;",
        procent: "is-85",
    },
    {
        name: "Port w Gdańsku",
        position: "top: 18%; left: 23%;",
        procent: "is-100",
    },
];

function formatToContainers(data: any): Container[] {
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
        }));

        // Walidacja kontenera
        if (!order.containerNo1) {
            console.error(`Błąd! Kontener nie posiada ID: ${order}`);
        }

        // Budowanie struktury kontenera
        const deliveryStatus = chooseStatus(order.estimatedDeparture, order.loadingPort);

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
            "Personalization": order.personalization || "Brak",
            "Quality control photos": order.qualityControlPhotos || "Brak",
            "Change in transportation cost": order.changeInTransportationCost || "Brak",
            "Periodicity": order.periodicity || "Brak",
        };
    });
}

function chooseStatus(departureDate: string, loadingPort: string): Status {
    const today = new Date();
    const departure = new Date(departureDate);

    // Oblicz różnicę w dniach między datą wypłynięcia a dzisiejszą datą
    const diffTime = today.getTime() - departure.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    //console.log(`Checking status for departureDate: ${departureDate}, loadingPort: ${loadingPort}, diffDays: ${diffDays}`);

    // Dopasuj lokalizację na podstawie dni
    if (diffDays < 7) {
        const location = locations.find(location => location.name.includes(loadingPort));
        if (location) return location;
    } else if (diffDays >= 7 && diffDays < 14) {
        return locations.find(location => location.name.includes("Południowochińskie"))!;
    } else if (diffDays >= 14 && diffDays < 21) {
        return locations.find(location => location.name.includes("Lakkadiwskie"))!;
    } else if (diffDays >= 21 && diffDays < 28) {
        return locations.find(location => location.name.includes("Arabskie"))!;
    } else if (diffDays >= 28 && diffDays < 35) {
        return locations.find(location => location.name.includes("Czerwone"))!;
    } else if (diffDays >= 35 && diffDays < 42) {
        return locations.find(location => location.name.includes("Śródziemne"))!;
    } else if (diffDays >= 42 && diffDays < 49) {
        return locations.find(location => location.name.includes("Atlantycki"))!;
    } else if (diffDays >= 49 && diffDays < 56) {
        return locations.find(location => location.name.includes("La Manche"))!;
    } else if (diffDays >= 56 && diffDays < 63) {
        return locations.find(location => location.name.includes("Gdańsku"))!;
    } else if (diffDays >= 63) {
        // Status "Zrealizowano" dla ponad 56 dni
        return {
            name: "Zrealizowano",
            position: "top: 0%; left: 0%;",
            procent: "is-100",
        };
    }

    // Ostrzeżenie o nieznanym statusie
    console.error(`Nieznany status dla departureDate: ${departureDate}, loadingPort: ${loadingPort}, diffDays: ${diffDays}`);
    return {
        name: "Nieznany status",
        position: "top: 0%; left: 0%;",
        procent: "is-0%",
    };
}

function showOrderInfo(container: Container, containers: Container[]): void {
    const mapWrapper = document.getElementById("map-wrapper") as HTMLElement;

    // Usuń istniejący element modala, jeśli istnieje
    mapWrapper.querySelector(".map-shipping-info")?.remove();

    // Filtruj kontenery z tym samym statusem
    const containersInSameStatus = containers.filter(
        c => c["Delivery status"].name === container["Delivery status"].name
    );

    // Oblicz listę kontenerów o tym samym statusie
    const containerListHTML = containersInSameStatus.map(sameStatusContainer => {
        const delayInfoHTML = sameStatusContainer["Extended delivery date"]
            ? ` <div class="text-style-muted">Opóźnienie:</div>
                <div>${
                Math.ceil(
                    (new Date(sameStatusContainer["Extended delivery date"]).getTime() -
                        new Date(sameStatusContainer["Estimated time of arrival"]).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
            } dni</div>`
            : "";

        const productListHTML = sameStatusContainer.Products.map(
            item => `
                <div class="shipping-collection-item">
                    <div class="text-style-ellipsis">${item.name}</div>
                    ${item.variant ? `<div class="text-weight-normal text-style-muted">Wariant: <span>${item.variant}</span></div>` : ''}
                </div>`
        ).join("");

        return `
            <div class="shipping-details-item">
                <div class="text-style-muted">Numer kontenera:</div>
                <div class="text-weight-semibold">${sameStatusContainer["Container No1"]}</div>
                <div class="shipping-collection-list">
                    ${productListHTML}
                </div>
                <div class="text-style-muted">Personalizacja:</div>
                <div>${sameStatusContainer.Personalization}</div>
                <div class="text-style-muted">Cykliczność:</div>
                <div>${sameStatusContainer.Periodicity === 'Yes' ? 'Tak' : 'Nie'}</div>
                <div class="text-style-muted">Zmiana kosztu transportu:</div>
                <div>${sameStatusContainer["Change in transportation cost"]}</div>
                <div class="text-style-muted">Planowana dostawa:</div>
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

function generateShipItem(container: Container, containers: Container[]): void {
    const statusName: string = container["Delivery status"].name || "";

    // Sprawdzenie czy status to "Zrealizowano", w takim przypadku pomijamy generowanie ship item
    if (statusName === "Zrealizowano") {
        //console.log(`Zrealizowany! Pomijanie generowania ship item dla kontenera ${container["Container No1"]} o statusie: ${statusName}`);
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
        showOrderInfo(container, containers);
    });
}

function generateShipListItem(container: Container): void {
    // Kontenery do dodawania elementów
    const listWrapper = document.getElementById('container-list-stacked') as HTMLElement;

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
    const delayInfoHTML = extendedDeliveryDate
        ? `<div class="text-size-small">Zamówienie opóźnione: <span class="text-weight-semibold">${formatDate(extendedDeliveryDate)}</span></div>`
        : ""; // Jeśli puste, ustawiamy pusty string

    htmlElement.innerHTML = `
        <div class="stacked-list4_content-top">
            <div class="text-size-small">Numer kontenera: <span class="text-weight-semibold text-color-brand">${container["Container No1"]}</span></div>
            <div class="stacked-list4_info">
                <div class="text-size-small">Planowana dostawa: <span class="text-weight-semibold">${formatDate(container["Estimated time of arrival"])}</span></div>
                ${delayInfoHTML} <!-- Dodawanie informacji o opóźnieniu tylko jeśli istnieje -->
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
        <div class="stacked-list4_content-bottom">
            <div class="text-size-small">Chiny</div>
            <div class="text-size-small">${container["Delivery status"].name === 'Zrealizowano' ? 'Zrealizowano' : 'Polska'}</div>
        </div>
        ${container["Quality control photos"] !== 'Brak' ? `
        <div class="stacked-list4_content-button">
            <a href="${container["Quality control photos"]}" class="button">Zdjęcia kontroli jakości</a>
        </div>` : ''}
        ${container["FV PDF"] !== 'Brak' ? `
            <div class="stacked-list4_content-button">
                <a href="${container["FV PDF"]}" class="button is-link is-icon w-inline-block" target="_blank" rel="noopener noreferrer">
                    <div class="order_download_faktura">Pobierz fakturę</div>
                    <div class="link-chevron"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="${getIconPath('is-arrow-right')}" fill="currentColor"></path></svg></div>
                </a>
            </div>
        ` : ''}
    `;

    // Dodajemy nowo utworzony element do kontenera
    listWrapper.appendChild(htmlElement);
}

export async function fetchContainers(memberData: Member) {
    // Rozpocznij pomiar czasu wykonywania skryptu
    const startTime: number = performance.now();

    try {
        // Wysłanie webhooka na Make
        const response = await fetch(
            `https://gordon-trade.onrender.com/api/sheets/containers?nip=${encodeURIComponent(memberData.customFields.nip)}`,
            {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        // Sprawdzenie czy odpowiedź jest OK
        if (!response.ok) throw new Error("Network response was not ok");

        const rawData = await response.json();

        // Oczyszczanie i formatowanie danych
        const cleanData = cleanAndFormatData(rawData);
        //console.log('Zamówienia:', cleanData);

        const containers: Container[] = formatToContainers(cleanData);
        //console.log('Kontenery:', containers);

        // Iteracja przez kontenery
        containers.forEach((container: Container) => {
            //console.log('Status name:', container["Delivery status"].name);

            // Utwórz znacznik na mapie
            generateShipItem(container, containers);

            // Utwórz element w liście
            generateShipListItem(container);
        });

        //console.log("Webhook sent and response processed successfully");
    } catch (error) {
        console.error("Error in fetching or processing webhook response:", error);
    }

    // Zakończ pomiar czasu
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    //console.log(`Czas wykonania skryptu: ${executionTime.toFixed(2)} ms`);
}