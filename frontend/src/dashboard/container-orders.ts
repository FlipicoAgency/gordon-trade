import type {Member} from '../memberstack';
import {cleanAndFormatData} from "./orders";

interface Status {
    name: string;
    position: string;
    procent: string;
}

interface OrderProduct {
    quantity: number;
    name: string;
    orderValue: number;
    estimatedFreight: number;
    capacity: number;
}

interface Container {
    "Customer NIP": string;
    "Order ID": string;
    "Container No": string;
    "Products": OrderProduct[];
    "FV amount (netto)": string;
    "FV No": string;
    "Loading port": string;
    "Delivery status": Status;
    "Estimated time of departure": string;
    "Fastest possible shipping date": string;
    "Estimated time of arrival": string;
    "Extended delivery date": string;
    "Personalization": string;
}

// SVG ikony
const icons: Record<string, string> = {
    default: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--tabler" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="12" r="9"></circle></g></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--tabler" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="m9 12l2 2l4-4"></path></g></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--tabler" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4m0 4h.01"></path></g></svg>`
};

// Funkcja do konwersji daty do formatu "DD.MM.YYYY"
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL');
}

const locations: Status[] = [
    {
        name: "Ningbo",
        position: "top: 41%; left: 73%;",
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
        position: "top: 40%; left: 79%;",
        procent: "is-0",
    },
    {
        name: "Shenzhen",
        position: "top: 52%; left: 66%;",
        procent: "is-0",
    },
    {
        name: "Morze Południowochińskie",
        position: "top: 71%; left: 67.75%;",
        procent: "is-15",
    },
    {
        name: "Morze Lakkadiwskie",
        position: "top: 66%; left: 61%;",
        procent: "is-25",
    },
    {
        name: "Morze Arabskie",
        position: "top: 64%; left: 47%;",
        procent: "is-35",
    },
    {
        name: "Morze Czerwone",
        position: "top: 50%; left: 33%;",
        procent: "is-50",
    },
    {
        name: "Morze Śródziemne",
        position: "top: 45%; left: 40%;",
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
    return Object.values(data).map((order: any) => {
        // Mapowanie produktów
        const products: OrderProduct[] = order.products.map((product: any) => ({
            name: product.name,
            quantity: parseInt(product.quantity, 10),
            orderValue: parseFloat(product.orderValue.replace("$", "")),
            estimatedFreight: parseFloat(product.EstimatedFreight.trim()),
            capacity: parseFloat(product.Capacity.trim()),
        }));

        // Wybór statusu na podstawie daty wypłynięcia
        const deliveryStatus = chooseStatus(order["Estimated time of departure"], order["Loading port"]);

        // Budowanie struktury kontenera
        return {
            "Customer NIP": order["Customer NIP"],
            "Order ID": order["Order ID"],
            "Container No": order["Container No"],
            "Products": products,
            "FV amount (netto)": order["FV amount (netto)"].trim(),
            "FV No": order["FV No"],
            "Loading port": order["Loading port"],
            "Delivery status": deliveryStatus,
            "Estimated time of departure": order["Estimated time of departure"],
            "Fastest possible shipping date": order["Fastest possible shipping date"],
            "Estimated time of arrival": order["Estimated time of arrival"],
            "Extended delivery date": order["Extended delivery date"],
            "Personalization": order["Personalization"] || "Brak",
        };
    });
}

function chooseStatus(departureDate: string, loadingPort: string): Status {
    const today = new Date();
    const departure = new Date(departureDate);

    // Oblicz różnicę w dniach między datą wypłynięcia a dzisiejszą datą
    const diffTime = today.getTime() - departure.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Dopasuj lokalizację na podstawie dni
    if (diffDays < 7) {
        return locations.find(location => location.name.includes(loadingPort))!;
    } else if (diffDays >= 7 && diffDays < 14) {
        return locations.find(location => location.name.includes("Południowochińskie"))!;
    } else if (diffDays <= 14) {
        return locations.find(location => location.name.includes("Lakkadiwskie"))!;
    } else if (diffDays <= 21) {
        return locations.find(location => location.name.includes("Arabskie"))!;
    } else if (diffDays <= 28) {
        return locations.find(location => location.name.includes("Czerwone"))!;
    } else if (diffDays <= 35) {
        return locations.find(location => location.name.includes("Śródziemne"))!;
    } else if (diffDays <= 42) {
        return locations.find(location => location.name.includes("Atlantycki"))!;
    } else if (diffDays <= 49) {
        return locations.find(location => location.name.includes("La Manche"))!;
    } else if (diffDays <= 56) {
        return locations.find(location => location.name.includes("Gdańsku"))!;
    }

    // Jeśli nic nie pasuje, zwróć ostatni status
    return {
        name: "Nieznany status",
        position: "top: 0%; left: 0%;",
        procent: "is-0%",
    };
}

function showOrderInfo(container: Container, containers: Container[]): void {
    const mapWrapper = document.getElementById("map-wrapper") as HTMLElement;

    // Usuń istniejący element modala, jeśli istnieje
    const existingElement = mapWrapper.querySelector(".map-shipping-info");
    if (existingElement) {
        mapWrapper.removeChild(existingElement);
    }

    // Filtruj kontenery z tym samym statusem
    const containersInSameStatus = containers.filter(
        c => c["Delivery status"].name === container["Delivery status"].name
    );

    // Tworzenie elementu głównego modala
    const modalWrapper = document.createElement("div");
    modalWrapper.className = "map-shipping-info active";

    // Nagłówek modala
    modalWrapper.innerHTML = `
        <div class="shipping-wrapper">
            <div class="shipping-header" style="display: flex; justify-content: space-between">
                <div class="shipping-heading">${container["Delivery status"].name} (${containersInSameStatus.length})</div>
                <button class="modal1_close-button w-inline-block" style="background-color: var(--base-color-brand--main-600)">
                    <img src="https://cdn.prod.website-files.com/624380709031623bfe4aee60/624380709031623afe4aee7e_icon_close-modal.svg" loading="lazy" alt="Close button">
                </button>
            </div>
        </div>
    `;

    mapWrapper.appendChild(modalWrapper);

    // Sekcja kontenerów o tym samym statusie
    const containerListWrapper = document.createElement("div");
    containerListWrapper.className = "container-list";

    containersInSameStatus.forEach(sameStatusContainer => {
        const extendedDeliveryDate = sameStatusContainer["Extended delivery date"];
        let delayInfoHTML = "";

        // Obliczanie opóźnienia
        if (extendedDeliveryDate) {
            const extendedDate = new Date(extendedDeliveryDate);
            const estimatedDate = new Date(sameStatusContainer["Estimated time of arrival"]);
            const delayDays = Math.ceil((extendedDate.getTime() - estimatedDate.getTime()) / (1000 * 60 * 60 * 24));
            delayInfoHTML = `
                <div class="delay-info">
                    <div class="text-style-error">Opóźnienie:</div>
                    <div class="text-style-bold">Zamówienie opóźnione o ${delayDays} dni</div>
                </div>
            `;
        }

        // Lista produktów w kontenerze
        const productListHTML = sameStatusContainer.Products.map(
            item => `<div class="collection-item w-dyn-item"><div class="text-block">${item.name}</div></div>`
        ).join("");

        // Dane kontenera
        const containerHTML = `
            <div class="container-item">
                <div class="text-style-muted">Numer kontenera:</div>
                <div><strong>${sameStatusContainer["Container No"]}</strong></div>
                <div class="w-dyn-list">
                    <div class="collection-list w-dyn-items" role="list">
                        ${productListHTML}
                    </div>
                </div>
                <div class="text-style-muted">Planowana dostawa:</div>
                <div>${formatDate(sameStatusContainer["Estimated time of arrival"])}</div>
                ${delayInfoHTML}
            </div>
        `;

        // Dodanie kontenera do listy
        const containerElement = document.createElement("div");
        containerElement.className = "container-wrapper";
        containerElement.innerHTML = containerHTML;

        containerListWrapper.appendChild(containerElement);
    });

    console.log('jestem tu', containerListWrapper);

    const shippingWrapper = modalWrapper.querySelector('.shipping-wrapper');
    if (shippingWrapper) {
        shippingWrapper.appendChild(containerListWrapper);
    } else {
        console.error("Shipping wrapper not found in the modal.");
    }

    // Obsługa przycisku zamknięcia
    const closeButton = modalWrapper.querySelector(".modal1_close-button") as HTMLButtonElement;
    closeButton.addEventListener("click", () => {
        if (modalWrapper.parentElement === mapWrapper) {
            mapWrapper.removeChild(modalWrapper);
        }
    });

    // Zamknięcie przy kliknięciu poza elementem
    const handleOutsideClick = (event: MouseEvent) => {
        if (!modalWrapper.contains(event.target as Node)) {
            if (modalWrapper.parentElement === mapWrapper) {
                mapWrapper.removeChild(modalWrapper);
            }
            document.removeEventListener("click", handleOutsideClick);
        }
    };

    // Ustawienie nasłuchiwania kliknięcia poza elementem
    setTimeout(() => {
        document.addEventListener("click", handleOutsideClick);
    }, 0);
}

function countContainersWithSameStatus(containers: Container[], statusName: string): number {
    return containers.filter(container => container["Delivery status"].name === statusName).length;
}

function generateShipItem(container: Container, containers: Container[]): void {
    const position: string = container["Delivery status"].position || "";
    const statusName: string = container["Delivery status"].name || "";
    const mapWrapper = document.getElementById("map-wrapper") as HTMLElement;

    // Liczba kontenerów w tym samym statusie
    const containersInSameStatus = countContainersWithSameStatus(containers, statusName);

    // Generowanie struktury HTML
    const newElement = document.createElement("div");
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
    mapWrapper.appendChild(newElement);

    // Obsługa zdarzeń
    const mapShippingButton = newElement.querySelector(".map-shipping-button") as HTMLElement;

    mapShippingButton.addEventListener("click", (event) => {
        event.stopPropagation();
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
    const htmlElement = document.createElement("a");
    htmlElement.href = "#";
    htmlElement.classList.add("stacked-list4_item", "w-inline-block");

    // Sprawdzenie, czy pole "Extended delivery date" nie jest puste
    const extendedDeliveryDate = container["Extended delivery date"];
    const delayInfoHTML = extendedDeliveryDate
        ? `<div class="text-size-small">Zamówienie opóźnione: <span class="text-weight-semibold">${formatDate(extendedDeliveryDate)}</span></div>`
        : ""; // Jeśli puste, ustawiamy pusty string

    htmlElement.innerHTML = `
        <div class="stacked-list4_content-top">
            <div class="text-size-small">Numer kontenera: <span class="text-weight-semibold text-style-link">${container["Container No"]}</span></div>
            <div class="text-size-small">Planowana dostawa: <span class="text-weight-semibold">${formatDate(container["Estimated time of arrival"])}</span></div>
            ${delayInfoHTML} <!-- Dodawanie informacji o opóźnieniu tylko jeśli istnieje -->
         </div>
        <div class="stacked-list4_progress">
            <div class="stacked-list4_progress-bar ${progressClass} ${isError ? 'is-error' : ''}">
                <div class="stacked-list4_progress-dot ${isComplete ? 'is-success' : ''} ${isError ? 'is-error' : ''}">
                    <div class="stacked-list4_progress-status-text ${isComplete ? 'is-success' : ''} ${isError ? 'is-error' : ''}">${container["Delivery status"].name}</div>
                    <div class="icon-embed-custom1 w-embed">
                        ${iconSVG}
                    </div>
                </div>
            </div>
        </div>
        <div class="stacked-list4_content-bottom">
            <div class="text-size-small">Chiny</div>
            <div class="text-size-small">Polska</div>
        </div>
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
        console.log('Kontenery:', containers);

        // Iteracja przez kontenery
        containers.forEach((container: Container) => {
            console.log('Status name:', container["Delivery status"].name);

            // Utwórz znacznik na mapie
            generateShipItem(container, containers);

            // Utwórz element w liście
            generateShipListItem(container);
        });

        console.log("Webhook sent and response processed successfully");
    } catch (error) {
        console.error("Error in fetching or processing webhook response:", error);
    }

    // Zakończ pomiar czasu
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    console.log(`Czas wykonania skryptu: ${executionTime.toFixed(2)} ms`);
}