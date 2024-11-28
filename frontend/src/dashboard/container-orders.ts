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

function generateShipItem(container: Container): void {
    const position: string = container["Delivery status"].position || "";
    const statusName: string = container["Delivery status"].name || "";
    const shipNumber: string = container["Container No"] || "";
    const loadDate: string = formatDate(container["Estimated time of departure"]) || "";
    const departureDate: string = formatDate(container["Estimated time of departure"]) || "";
    const extendedDeliveryDate: string = container["Extended delivery date"] || "";
    const arrivalDate: string = formatDate(container["Estimated time of arrival"]) || "";
    const zawartosc: OrderProduct[] = container.Products || [];
    const personalization: string = container.Personalization;

    // Element map-wrapper
    const mapWrapper = document.getElementById('map-wrapper') as HTMLElement;

    // Wrapper dla map-dot
    const mapDotWrapper = document.createElement("div");
    mapDotWrapper.className = "map-dot-wrapper";
    mapDotWrapper.style.cssText = position;

    // Dodanie migającego elementu
    const mapDot = document.createElement("div");
    mapDot.className = "map-dot";

    const mapDot2 = document.createElement("div");
    mapDot2.className = "map-dot is-2";

    mapDotWrapper.appendChild(mapDot);
    mapDotWrapper.appendChild(mapDot2);

    // Element map-shipping-wrapper
    const mapShip = document.createElement("div");
    mapShip.className = "map-shipping-wrapper";
    mapShip.style.cssText = position;

    // Element map-shipping-location
    const mapShipLocation = document.createElement("div");
    mapShipLocation.className = "map-shipping-location";

    // Element map-shipping-button
    const mapShipButton = document.createElement("button");
    mapShipButton.className = "map-shipping-button";

    // Informacje o statusie
    const mapShippingInfo = document.createElement("div");
    mapShippingInfo.className = "map-shipping-info";
    const mapShipWrapper = document.createElement("div");
    mapShipWrapper.className = "shipping-wrapper";
    mapShippingInfo.appendChild(mapShipWrapper);
    //mapShippingInfo.style.opacity = "0"; // initial state

    // Dodanie nazwy statusu
    const mapShipHeading = document.createElement("div");
    mapShipHeading.className = "shipping-heading";
    mapShipHeading.innerHTML = `<div>${statusName}</div>`;
    mapShipWrapper.appendChild(mapShipHeading);

    // Lista zawartości
    const zawartoscList = document.createElement("div");
    zawartoscList.className = "w-dyn-list";
    const zawartoscListContainer = document.createElement("div");
    zawartoscListContainer.setAttribute("role", "list");
    zawartoscListContainer.className = "collection-list w-dyn-items";

    zawartosc.forEach(item => {
        const zawartoscItem = document.createElement("div");
        zawartoscItem.setAttribute("role", "listitem");
        zawartoscItem.className = "collection-item w-dyn-item";
        zawartoscItem.innerHTML = `<div class="text-block">${item.name}</div>`;
        zawartoscListContainer.appendChild(zawartoscItem);
    });

    zawartoscList.appendChild(zawartoscListContainer);
    mapShipWrapper.appendChild(zawartoscList);

    // Informacje o numerze rejsu i datach
    const mapShipDetails = document.createElement("div");
    mapShipDetails.className = "shipping-details";
    mapShipDetails.innerHTML = `
      <div class="text-style-muted">Numer rejsu:</div><div>${shipNumber}</div>
      <div class="text-style-muted">Data załadunku:</div><div>${loadDate}</div>
      <div class="text-style-muted">Data wypłynięcia z portu ${container["Loading port"]}:</div><div>${departureDate}</div>
      <div class="text-style-muted">Przewidywana dostawa do Polski:</div><div>${arrivalDate}</div>
      <div class="text-style-muted">Personalizacja:</div><div>${personalization}</div>
  `;

    // Dodanie informacji o opóźnieniu, jeśli istnieje
    if (extendedDeliveryDate) {
        const delayInfo = document.createElement("div");
        delayInfo.className = "delay-info";
        const extendedDate = new Date(extendedDeliveryDate);
        const estimatedDate = new Date(container["Estimated time of arrival"]);
        const delayDays = Math.ceil((extendedDate.getTime() - estimatedDate.getTime()) / (1000 * 60 * 60 * 24));

        delayInfo.innerHTML = `
          <div class="text-style-error">Opóźnienie:</div>
          <div class="text-style-bold">Zamówienie opóźnione o ${delayDays} dni</div>
        `;
        mapShipDetails.appendChild(delayInfo);
    }

    mapShipWrapper.appendChild(mapShipDetails);
    mapShip.appendChild(mapShippingInfo);

    // Lokalizacja
    const location = document.createElement("div");
    location.className = "text-size-tiny text-weight-bold text-style-nowrap";
    location.innerText = `${statusName}`;

    // Licznik
    const counter = document.createElement("div");
    counter.className = "text-size-tiny text-weight-bold";
    counter.innerText = "1"; // Możesz zmodyfikować, jeśli licznik zależy od czegoś

    // Ikona
    const iconEmbed = document.createElement("div");
    iconEmbed.className = "icon-1x1-xxsmall";
    iconEmbed.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" fill="currentColor" viewBox="0 0 256 256"><path d="M222.33,106.79,212,103.35V56a20,20,0,0,0-20-20H140V24a12,12,0,0,0-24,0V36H64A20,20,0,0,0,44,56v47.35l-10.33,3.44a20,20,0,0,0-13.67,19V152c0,64.63,100.8,90.57,105.09,91.64a11.94,11.94,0,0,0,5.82,0C135.2,242.57,236,216.63,236,152V125.77A20,20,0,0,0,222.33,106.79ZM68,60H188V95.35L131.79,76.62a11.85,11.85,0,0,0-7.58,0L68,95.35Zm144,92c0,36.69-58.08,60.43-84,67.59-25.94-7.17-84-30.9-84-67.59V128.65l72-24V168a12,12,0,0,0,24,0V104.65l72,24Z"></path></svg>
  `;

    // Złożenie całego elementu
    mapShip.appendChild(mapShipLocation);
    mapShip.appendChild(mapShipButton);
    mapShipLocation.appendChild(location);
    mapShipButton.appendChild(counter);
    mapShipButton.appendChild(iconEmbed);
    mapWrapper.appendChild(mapDotWrapper);
    mapWrapper.appendChild(mapShip);

    // Dodajemy event listener na kliknięcie do map-ship
    mapShip.addEventListener("click", (event) => {
        event.stopPropagation(); // Zapobiega zamknięciu modala od razu po otwarciu

        // Usuwamy klasę 'active' ze wszystkich innych elementów map-shipping-info / 
        document.querySelectorAll(".map-shipping-wrapper, .map-shipping-info").forEach(el => {
            el.classList.remove("active");
        });

        // Przełączanie klasy 'active' dla pierwszego dziecka mapShip (czyli mapShippingInfo)
        mapShip.classList.toggle("active");
        mapShippingInfo.classList.toggle("active");
    });

    // Dodaj event listener na dokument do zamykania modal po kliknięciu poza nim
    document.addEventListener("click", (event) => {
        // Sprawdzenie, czy kliknięcie było poza mapShippingInfo
        if (!mapShip.contains(event.target as Node)) {
            mapShippingInfo.classList.remove("active");
        }
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
    htmlElement.innerHTML = `
                <div class="stacked-list4_content-top">
                    <div class="text-size-small">Numer kontenera: <span class="text-weight-semibold text-style-link">${container["Container No"]}</span></div>
                    <div class="text-size-small">Planowana dostawa: <span class="text-weight-semibold">${formatDate(container["Estimated time of arrival"])}</span></div>
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
            generateShipItem(container);

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