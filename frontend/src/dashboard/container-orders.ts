import type {Member} from '../memberstack';

export async function fetchContainers(memberData: Member) {
    // Rozpocznij pomiar czasu wykonywania skryptu
    const startTime: number = performance.now();

    try {
        // Wysłanie webhooka na Make
        const response = await fetch("https://gordon-trade.onrender.com/api/kontenery", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(memberData),
        });

        // Sprawdzenie czy odpowiedź jest OK
        if (!response.ok) throw new Error("Network response was not ok");

        // Parsowanie odpowiedzi z webhooka
        const data: any[] = await response.json();
        //console.log('data: ', data);

        // Kontenery do dodawania elementów
        const listWrapper = document.getElementById('container-list-stacked') as HTMLElement;
        const mapWrapper = document.getElementById('map-wrapper') as HTMLElement;

        // Funkcja do konwersji daty do formatu "DD.MM.YYYY"
        function formatDate(dateString: string): string {
            const date = new Date(dateString);
            return date.toLocaleDateString('pl-PL');
        }

        // Mapa wartości `procent` na klasy procentowe
        const progressMap: Record<string, string> = {
            "197c2aedb805a5bbf2ae9d588cb522f0": "is-5",
            "95662bcff985304218500ce12656f683": "is-10",
            "b241f5e08d227da80ce07bf656b139d9": "is-15",
            "e9f68956f050ff5091c5789ccfc0fe09": "is-20",
            "314805d298b0e2b5e7fa1138758598fc": "is-25",
            "878522ecb78bbc5f0ebbada20a89330d": "is-30",
            "540adf87b6cd62137011a61c31e77d6e": "is-35",
            "dd4eb0bf69142a9f7bc497c9b697d09c": "is-40",
            "9e8bf282f5e125d9270f4198f3639d82": "is-45",
            "b25036f70727db647efad30ac11836f6": "is-50",
            "d802819558e296132f28654568286639": "is-55",
            "5bd5d4d84149bca647ecbd425938ae57": "is-60",
            "f4082b821aa0597ddfe531e0d434d97a": "is-65",
            "bdc7b00257d7cb4f4e838b15e823e491": "is-70",
            "81408a2f977f26468a67a2c89e119b57": "is-75",
            "ac1e6945b1ce93fb502ab3da26dfecbf": "is-80",
            "f0390e8736e8a22dfad94ce16a67c1ed": "is-85",
            "a14a53d3c94eb1c517d0aa936bba8a9f": "is-90",
            "f20989757bd2c997ec7a28e03e41eaa6": "is-95",
            "45ffc2eacc723dfa5e0777d81c3d62a3": "is-100"
        };

        // SVG ikony
        const icons: Record<string, string> = {
            default: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--tabler" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="12" r="9"></circle></g></svg>`,
            success: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--tabler" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="m9 12l2 2l4-4"></path></g></svg>`,
            error: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--tabler" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4m0 4h.01"></path></g></svg>`
        };

        function generateShipItem(data: Record<string, any>): void {
            const position: string = data.array?.[0]?.array?.[0]?.fieldData?.position || "";
            const statusName: string = data.array?.[0]?.array?.[0]?.fieldData?.name || "";
            const shipNumber: string = data.fieldData.name || "";
            const loadDate: string = formatDate(data.fieldData["data-zaladunku"]);
            const departureDate: string = formatDate(data.fieldData["data-wyjscia"]);
            const arrivalDate: string = formatDate(data.fieldData["data-przybycia"]);
            const zawartosc: any[] = data.Products || [];

            // Element map-ship
            const mapShip = document.createElement("div");
            mapShip.className = "map-ship";
            mapShip.style.cssText = position;

            // Informacje o statusie
            const mapShippingInfo = document.createElement("div");
            mapShippingInfo.className = "map-shipping-info";
            //mapShippingInfo.style.opacity = "0"; // initial state

            // Dodanie nazwy statusu
            const divBlock = document.createElement("div");
            divBlock.className = "div-block";
            divBlock.innerHTML = `<div>${statusName}</div>`;
            mapShippingInfo.appendChild(divBlock);

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
            mapShippingInfo.appendChild(zawartoscList);

            // Informacje o numerze rejsu i datach
            const divBlock2 = document.createElement("div");
            divBlock2.className = "div-block-2";
            divBlock2.innerHTML = `
              <div class="text-style-muted">Numer rejsu:</div><div>${shipNumber}</div>
              <div class="text-style-muted">Data załadunku:</div><div>${loadDate}</div>
              <div class="text-style-muted">Data wyjścia:</div><div>${departureDate}</div>
              <div class="text-style-muted">Data przybycia:</div><div>${arrivalDate}</div>
          `;

            mapShippingInfo.appendChild(divBlock2);
            mapShip.appendChild(mapShippingInfo);

            // Licznik
            const counter = document.createElement("div");
            counter.className = "text-size-tiny text-weight-bold";
            counter.innerText = "1"; // Możesz zmodyfikować, jeśli licznik zależy od czegoś

            // Ikona
            const iconEmbed = document.createElement("div");
            iconEmbed.className = "icon-embed-xxsmall w-embed";
            iconEmbed.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--tabler" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24">
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 20a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1M4 18l-1-5h18l-2 4M5 13V7h8l4 6M7 7V3H6"></path>
              </svg>
          `;

            // Złożenie całego elementu
            mapShip.appendChild(counter);
            mapShip.appendChild(iconEmbed);
            mapWrapper.appendChild(mapShip);

            // Dodajemy event listener na kliknięcie do map-ship
            mapShip.addEventListener("click", (event) => {
                event.stopPropagation(); // Zapobiega zamknięciu modala od razu po otwarciu

                // Usuwamy klasę 'active' ze wszystkich innych elementów map-shipping-info
                document.querySelectorAll(".map-shipping-info").forEach(el => {
                    el.classList.remove("active");
                });

                // Przełączanie klasy 'active' dla pierwszego dziecka mapShip (czyli mapShippingInfo)
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

        // Iteracja przez dane webhooka
        data.forEach((item) => {
            const fieldData = item.fieldData;

            // Sprawdź, czy userId z localStorage zgadza się z userId z webhooka
            if (fieldData["data-ms-member-klient-id"] !== memberData.id) return;

            // Utwórz znacznik na mapie
            generateShipItem(item);

            // Wybierz klasę procentową na podstawie wartości "procent"
            const progressClass = progressMap[item.array[0].array[0].fieldData.procent] || "is-0";
            const isComplete = progressClass === "is-100";
            const isError = fieldData["error"] === true;

            // Wybierz odpowiednią ikonę na podstawie warunku
            const iconSVG = isComplete ? icons.success : (isError ? icons.error : icons.default);

            // Tworzenie elementu listy
            const htmlElement = document.createElement("a");
            htmlElement.href = "#";
            htmlElement.classList.add("stacked-list4_item", "w-inline-block");
            htmlElement.innerHTML = `
                <div class="stacked-list4_content-top">
                    <div class="text-size-small">Numer kontenera: <span class="text-weight-semibold text-style-link">${fieldData.name}</span></div>
                    <div class="text-size-small">Planowana dostawa: <span class="text-weight-semibold">${formatDate(fieldData["planowana-dostawa"])}</span></div>
                </div>
                <div class="stacked-list4_progress">
                    <div class="stacked-list4_progress-bar ${progressClass} ${isError ? 'is-error' : ''}">
                        <div class="stacked-list4_progress-dot ${isComplete ? 'is-success' : ''} ${isError ? 'is-error' : ''}">
                            <div class="stacked-list4_progress-status-text ${isComplete ? 'is-success' : ''} ${isError ? 'is-error' : ''}">${item.array[0].array[0].fieldData.name}</div>
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