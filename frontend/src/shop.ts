import {fetchExchangeRates, initializeAddToCartButtons} from "./cartItems";
import type {Member} from './memberstack';
import {getMemberData, getMemberJSON, initializeFavoriteState, updateMemberJSON} from './memberstack';
import {initializeGenerateOffer} from "./excel";

// Funkcja do wykrywania języka
function detectLanguage(): string {
    const path = window.location.pathname; // Pobiera ścieżkę URL
    const language = path.split('/')[1]; // Pobiera pierwszy segment ścieżki
    const supportedLanguages = ['pl', 'en', 'cs', 'hu'];

    return supportedLanguages.includes(language) ? language : 'pl'; // Domyślnie 'pl'
}

export async function calculatePromoPercentage(productItems: Array<HTMLElement>, translations: Record<string, string>, language: string): Promise<void> {
    const member: Member | null = await getMemberData();
    let specialPrices: Record<string, string> = {};

    if (member) {
        const memberMetadata = member?.metaData;
        //console.log('Metadata:', memberMetadata);

        // Extract special prices from metadata if available
        specialPrices = memberMetadata || {};
    } else {
        console.warn("User not logged in or metadata not available. Special prices won't be applied.");
    }

    // Pobierz kursy walut
    const exchangeRates = await fetchExchangeRates();
    if (!exchangeRates) {
        console.error("Could not fetch exchange rates. Skipping currency conversion.");
        return;
    }

    // Wybierz odpowiedni kurs na podstawie języka
    let conversionRate = 1; // Domyślnie w złotówkach
    let currencySymbol = "zł";

    switch (language) {
        case "cs":
            // @ts-ignore
            conversionRate = exchangeRates["EUR"] || 1;
            currencySymbol = "EUR";
            break;
        case "hu":
            // @ts-ignore
            conversionRate = exchangeRates["EUR"] || 1;
            currencySymbol = "EUR";
            break;
        case "en":
            // @ts-ignore
            conversionRate = exchangeRates["EUR"] || 1;
            currencySymbol = "EUR";
            break;
        default:
            conversionRate = 1; // Złotówki
            currencySymbol = "zł";
            break;
    }

    // Select all product items
    //const productItems = document.querySelectorAll<HTMLDivElement>('.product_item-wrapper');

    productItems.forEach((productItem) => {
        const id = productItem.querySelector<HTMLElement>('[data-commerce-product-id]')?.getAttribute('data-commerce-product-id');
        const promo = productItem.querySelector<HTMLElement>('[data-price="promo"]');
        const normal = productItem.querySelector<HTMLElement>('[data-price="normal"]');
        const tagline = productItem.querySelector<HTMLElement>('.promo-tagline');
        const span = productItem.querySelector<HTMLSpanElement>('.promo-percentage');
        const carton = productItem.querySelector<HTMLElement>('[data-price="carton"]');
        const cartonPrice = productItem.querySelector<HTMLElement>('[data-price="carton-price"]');
        const currencyElements = productItem.querySelectorAll<HTMLElement>('[data-price="currency"]');

        if (!id || !promo || !normal || !tagline || !span) {
            console.warn(`Skipping product item due to missing elements or ID.`);
            return;
        }

        // Parse prices and apply conversion
        const normalPrice = parseFloat(normal.textContent?.trim() || '') / conversionRate;
        const cartonRealPrice = parseFloat(cartonPrice?.textContent?.trim() || '') / conversionRate;
        let promoPrice = parseFloat(promo.textContent?.trim() || '') / conversionRate;

        normal.textContent = String(normalPrice.toFixed(2));
        promo.textContent = String(promoPrice.toFixed(2));
        if (carton && cartonPrice) cartonPrice.textContent = String(cartonRealPrice.toFixed(2));
        currencyElements.forEach((currencyElement) => {
            currencyElement.textContent = `\u00A0${currencySymbol}`;
        });

        // Check if there's a special price for this product
        if (specialPrices[id]) {
            promoPrice = parseFloat(specialPrices[id]) / conversionRate;
            promo.textContent = `${promoPrice.toFixed(2)} ${currencySymbol}`;
            promo.classList.remove('w-dyn-bind-empty');
            normal.style.display = 'none';
            if (carton) carton.style.display = 'none';
            //console.log(`Special price applied for product ${id}: ${promoPrice}`);
        }

        if (!isNaN(promoPrice) && !isNaN(normalPrice) && normalPrice > 0 && !promo.classList.contains('w-dyn-bind-empty')) {
            // Calculate percentage
            const percentage = Math.round(((promoPrice - normalPrice) / normalPrice) * 100);

            // Update UI elements
            span.textContent = Math.abs(percentage) + '%' + (specialPrices[id] ? ` ${translations.specialPriceText}` : '');
            tagline.style.display = 'block';
        } else {
            //console.warn(`Invalid prices for product ${id}: normal (${normalPrice}), promo (${promoPrice}).`);
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    // @ts-ignore
    if (window.isShopInitialized) return; // Sprawdź, czy shop.js został już zainicjalizowany
    // @ts-ignore
    window.isShopInitialized = true; // Ustaw flagę po inicjalizacji

    const language = detectLanguage();

    const { default: translations } = await import(`../translations/${language}.json`, {
        assert: { type: "json" },
    });

    const selectAllButton = document.getElementById("select-all") as HTMLAnchorElement;
    const selectedCountOutput = document.querySelector('[data-output-select="quantity"]') as HTMLDivElement;
    let isMassSelecting = false;

    /**
     * Pomocnicza funkcja, która sprawdza, czy dany productItem wymaga wariantu
     * i czy wariant jest prawidłowo wybrany. Jeśli tak, zwraca true, w przeciwnym
     * razie false.
     */
    function canCheckCheckbox(productItem: HTMLElement): boolean {
        // Sprawdź select z wariantem (o ile istnieje i ma validate="true")
        const variantSelect = productItem.querySelector<HTMLSelectElement>(
            'select[data-input="variant"][validate="true"]'
        );
        if (variantSelect && variantSelect.value === "") {
            // Wariant jest wymagany, ale nie wybrano go
            return false;
        }

        // Sprawdź ewentualną grupę pill (aria-checked="true")
        const optionPillGroup = productItem.querySelector<HTMLDivElement>(
            'div[data-input="pill-group"]'
        );
        if (optionPillGroup) {
            const selectedPill = optionPillGroup.querySelector<HTMLDivElement>(
                'div[aria-checked="true"]'
            );
            if (!selectedPill) {
                // Tu również mamy wymagany wariant (pill), ale nie został wybrany
                return false;
            }
        }

        // Jeśli dotarliśmy tutaj, to znaczy, że nie ma wymogu wariantu
        // lub wariant został wybrany prawidłowo.
        return true;
    }

    function updateSelectedCount(count: number) {
        console.log(`Aktualna liczba zaznaczonych produktów: ${count}`);

        if (count > 0) {
            selectedCountOutput.textContent = `Wybrano ${count} elementów`;
            selectedCountOutput.classList.remove("hide");
            selectAllButton.textContent = "Odznacz wszystkie";
            console.log("Zaktualizowano licznik: liczba wybranych elementów > 0");
        } else {
            selectedCountOutput.classList.add("hide");
            selectAllButton.textContent = "Zaznacz wszystkie";
            console.log("Licznik schowany: brak zaznaczonych elementów");
        }
    }

    // Obsługa przycisku „Zaznacz wszystkie / Odznacz wszystkie”
    if (!selectAllButton || !selectedCountOutput) {
        console.warn("Nie znaleziono przycisku 'Zaznacz wszystkie' lub pola z licznikiem zaznaczonych produktów.");
    } else {
        selectAllButton.addEventListener("click", (event) => {
            event.preventDefault();

            // Pobierz wszystkie aktualnie widoczne checkboxy w przefiltrowanych produktach
            const checkboxes = document.querySelectorAll<HTMLInputElement>(
                '.product_form input[type="checkbox"]'
            );

            if (checkboxes.length === 0) {
                console.warn("Nie znaleziono żadnych checkboxów do zaznaczenia.");
                return;
            }

            // Sprawdź, czy JAKIKOLWIEK checkbox jest zaznaczony
            const anyChecked = Array.from(checkboxes).some((checkbox) => checkbox.checked);
            console.log(`Czy jakikolwiek checkbox jest zaznaczony? ${anyChecked}`);

            if (anyChecked) {
                // ODZNACZ wszystkie
                checkboxes.forEach((checkbox) => {
                    checkbox.checked = false;

                    // Usuwamy klasę w--redirected-checked, aby checkbox zniknął wizualnie
                    checkbox.previousElementSibling?.classList.remove('w--redirected-checked');
                    checkbox.dispatchEvent(new Event("change"));
                });
                console.log("Odznaczono wszystkie checkboxy");
            } else {
                // ZAZNACZ tylko te, gdzie nie jest wymagany (lub już wybrany) wariant
                // Zaznacz wszystko
                isMassSelecting = true;
                checkboxes.forEach((checkbox) => {
                    const productItem = checkbox.closest(".product_item") as HTMLElement;
                    if (!productItem) return; // Brak pewności co do struktury, bezpieczeństwo

                    // Jeżeli produkt można zaznaczyć (wariant wybrany lub niewymagany)
                    if (canCheckCheckbox(productItem)) {
                        checkbox.checked = true;
                        checkbox.previousElementSibling?.classList.add('w--redirected-checked');

                        // Wywołujemy event, aby onChange dodało CMS ID do selectedItems
                        checkbox.dispatchEvent(new Event("change"));
                    } else {
                        // Jeżeli wariant jest wymagany, a nie został wybrany – pomijamy
                        checkbox.checked = false;
                        checkbox.previousElementSibling?.classList.remove('w--redirected-checked');
                        // Również dispatchEvent, aby zachować spójność stanu
                        // checkbox.dispatchEvent(new Event("change"));
                        console.log("Pominięto produkt wymagający wariantu (nie zaznaczony).");
                    }
                });
                isMassSelecting = false;
                console.log("Zaznaczono wszystkie checkboxy (oprócz tych wymagających wariant).");
            }

            // Na koniec faktycznie policz, ile jest CHECKED
            const currentlyChecked = document.querySelectorAll('.product_form input[type="checkbox"]:checked');
            updateSelectedCount(currentlyChecked.length);
        });
    }

    // Array to hold selected CMS IDs
    let selectedItems: string[] = [];
    updateSelectedCount(selectedItems.length);

    // Function to calculate JSON size in bytes
    const calculateJSONSize = (json: any): number =>
        new Blob([JSON.stringify(json)]).size;

    // Initialize the checkboxes after items are fully loaded
    function initializeCheckboxes(): void {
        // Upewnij się, że selectedItems jest tablicą
        if (!Array.isArray(selectedItems)) {
            console.error('selectedItems is not an array. Initializing as an empty array.');
            selectedItems = [];
        }

        try {
            // Pobierz wszystkie checkboxy
            const checkboxes = document.querySelectorAll<HTMLInputElement>(
                '.product_form input[type="checkbox"]'
            );

            if (!checkboxes.length) {
                console.warn('No checkboxes found to initialize.');
                return;
            }

            checkboxes.forEach((checkbox) => {
                // Szukamy nadrzędnego .product_item
                const productItem = checkbox.closest('.product_item') as HTMLElement;
                if (!productItem) {
                    console.warn('Checkbox is not inside a product_item container.');
                    return;
                }

                // Zczytujemy CMS ID (lub product ID)
                const cmsId = productItem.querySelector<HTMLElement>(
                    '[data-commerce-product-id]'
                )?.getAttribute('data-commerce-product-id');

                // Nasłuchujemy zmiany stanu (check/uncheck)
                checkbox.addEventListener('change', () => {
                    try {
                        if (checkbox.checked) {
                            // Jeśli użytkownik RĘCZNIE zaznacza checkbox,
                            // sprawdź, czy można to zrobić (wariant wybrany?).
                            if (!canCheckCheckbox(productItem)) {
                                // Wariant nie jest wybrany, a jest wymagany
                                if (!isMassSelecting) {
                                    alert('Proszę wybrać wariant przed dodaniem produktu do listy.');
                                }

                                // Krótki timeout, aby usunąć styl "w--redirected-checked"
                                // i faktycznie odznaczyć checkbox
                                setTimeout(() => {
                                    checkbox.checked = false;
                                    checkbox.previousElementSibling?.classList.remove('w--redirected-checked');
                                }, 0);
                                return;
                            }

                            // Jeżeli można zaznaczyć i mamy cmsId, dodajemy do selectedItems
                            // UWAGA: Poniżej masz logikę łączenia ID i wariantu w itemWithVariant,
                            // jeśli coś takiego stosujesz:
                            let selectedVariant: string | null = null;

                            const variantSelect = productItem.querySelector<HTMLSelectElement>(
                                'select[data-input="variant"]'
                            );
                            if (variantSelect && variantSelect.value) {
                                selectedVariant = variantSelect.value;
                            }

                            // Sprawdź pille
                            const optionPillGroup = productItem.querySelector<HTMLDivElement>(
                                'div[data-input="pill-group"]'
                            );
                            if (optionPillGroup) {
                                const selectedPill = optionPillGroup.querySelector<HTMLDivElement>(
                                    'div[aria-checked="true"]'
                                );
                                if (selectedPill) {
                                    selectedVariant = selectedPill.getAttribute('data-variant-value') || null;
                                }
                            }

                            const itemWithVariant = `${cmsId}${selectedVariant ? `|${selectedVariant}` : ''}`;

                            if (!selectedItems.includes(itemWithVariant)) {
                                selectedItems.push(itemWithVariant);
                                console.log(`Item added: ${itemWithVariant}`);
                            } else {
                                console.warn(`Item already in the list: ${itemWithVariant}`);
                            }
                        } else {
                            // Jeśli użytkownik odznacza
                            let selectedVariant: string | null = null;
                            // (Możesz powtórzyć logikę variantSelect/optionPillGroup,
                            //  jeśli chcesz zawsze identyfikować produkt w 100% tak samo)
                            const itemWithVariant = `${cmsId}${selectedVariant ? `|${selectedVariant}` : ''}`;

                            const index = selectedItems.indexOf(itemWithVariant);
                            if (index > -1) {
                                selectedItems.splice(index, 1);
                                console.log(`Item removed: ${itemWithVariant}`);
                            }
                        }

                        // Na koniec zawsze aktualizuj licznik
                        updateSelectedCount(selectedItems.length);

                        // (debug) Podgląd wybranych elementów
                        console.log('Updated Selected Items:', selectedItems);
                    } catch (error) {
                        console.error('Error handling checkbox change:', error);
                    }
                });
            });
        } catch (error) {
            console.error('Error during checkbox initialization:', error);
        }
    }

    await initializeGenerateOffer(selectedItems, language)

    // @ts-ignore
    window.fsAttributes = window.fsAttributes || [];
    // @ts-ignore
    window.fsAttributes.push([
        'cmsload',
        // @ts-ignore
        async (listInstances) => {
            //console.log('cmsload Successfully loaded!');

            const [listInstance] = listInstances;

            const productItems = document.querySelectorAll<HTMLDivElement>('.product_item-wrapper');
            // zamiana NodeList na tablicę
            const productItemsArray = Array.from(productItems);

            await calculatePromoPercentage(productItemsArray, translations, language);
            await initializeAddToCartButtons(translations, language);
            await initializeFavoriteState();
            await initializeCheckboxes();

            // @ts-ignore
            listInstance.on('renderitems', async (renderedItems) => {
                // 1. Wyciągnij elementy DOM z tablicy
                // @ts-ignore
                const itemElements = renderedItems.map((item) => item.element);

                // 2. Przekaż tablicę elementów do calculatePromoPercentage
                await calculatePromoPercentage(itemElements, translations, language);

                await initializeAddToCartButtons(translations, language);
                await initializeFavoriteState();
                await initializeCheckboxes();
            });

            async function onCmsLoad() {
                try {
                    // Wait for the rendering queue to finish
                    await listInstance.renderingQueue;
                    //console.log('Wszystko załadowane!');

                    // Wait for the rendering queue to finish
                    const productItems = await listInstance.items;

                    const categorySet = new Set<string>();
                    const tagSet = new Set<string>();

                    productItems.forEach((item: { element: HTMLElement }) => {
                        const categoryElement = item.element.querySelector<HTMLElement>('[fs-cmsfilter-field="Kategoria"]');

                        const priceNormal = item.element.querySelector<HTMLElement>('[data-price="normal"]')?.textContent;
                        const pricePromo = item.element.querySelector<HTMLElement>('[data-price="promo"]')?.textContent;

                        if (priceNormal || pricePromo) {
                            // Tworzymy nowy element span priceElement
                            const priceElement = document.createElement('span');
                            priceElement.style.display = 'none'; // Ukrywamy element
                            priceElement.setAttribute('fs-cmsfilter-field', 'Cena');
                            priceElement.setAttribute('fs-cmssort-field', 'Cena');

                            const promoElement = document.createElement('span');
                            promoElement.style.display = 'none'; // Ukrywamy element
                            promoElement.setAttribute('fs-cmsfilter-field', 'Promocja');
                            promoElement.textContent = 'true';

                            // Dodajemy odpowiednią wartość do elementu
                            if (pricePromo) {
                                priceElement.textContent = pricePromo; // Ustawiamy cenę promocyjną, jeśli jest dostępna
                                item.element.appendChild(promoElement); // Dodaj element span promoElement
                            } else if (priceNormal) {
                                priceElement.textContent = priceNormal; // Ustawiamy cenę normalną, jeśli nie ma promocyjnej
                            }

                            // Dodajemy nowy element do `item.element`
                            item.element.appendChild(priceElement);
                        }

                        const tags = item.element.querySelector<HTMLElement>('[data-product="tags"]')?.textContent?.trim().split(',');
                        if (tags) {
                            //console.log('Tagi:', tags);

                            tags.forEach(tag => {
                                // Tworzymy nowy element span dla każdego tagu
                                const tagElement = document.createElement('span');
                                tagElement.style.display = 'none';
                                tagElement.setAttribute('fs-cmsfilter-field', 'Tag');
                                tagElement.textContent = tag.trim(); // Dodajemy treść tagu
                                if (tagElement.textContent !== '') tagSet.add(tagElement.textContent);

                                // Dodajemy nowy element do `item.element`
                                item.element.appendChild(tagElement);
                            });
                        }

                        // Safely check textContent and add trimmed value to the set if it exists
                        if (categoryElement?.textContent?.trim()) {
                            categorySet.add(categoryElement.textContent.trim());
                        }
                    });

                    // Function to create filter items
                    function createFilterItem(value: string, filterField: string): HTMLElement {
                        const filterItem = document.createElement('div');
                        filterItem.className = 'filters3_item';
                        const label = document.createElement('label');
                        label.className = 'w-checkbox filters3_form-checkbox1';

                        const divCheckbox = document.createElement('div');
                        divCheckbox.className = 'w-checkbox-input w-checkbox-input--inputType-custom filters3_form-checkbox1-icon';

                        const inputCheckbox = document.createElement('input');
                        inputCheckbox.type = 'checkbox';
                        inputCheckbox.name = 'filter';
                        inputCheckbox.style.opacity = '0';
                        inputCheckbox.style.position = 'absolute';
                        inputCheckbox.style.zIndex = '-1';

                        const span = document.createElement('span');
                        span.className = 'filters3_form-checkbox1-label w-form-label';
                        span.textContent = value;
                        span.setAttribute('fs-cmsfilter-field', filterField);

                        // Dodaj styl CSS dynamicznie
                        span.style.display = 'inline-block';
                        span.style.whiteSpace = 'nowrap'; // Zapobiega zawijaniu tekstu
                        span.style.overflow = 'hidden'; // Ukrywa nadmiar tekstu
                        span.style.textOverflow = 'ellipsis'; // Dodaje wielokropek na końcu tekstu

                        // Element to display the count of results
                        const resultsCount = document.createElement('span');
                        resultsCount.className = 'filter-results-count';
                        resultsCount.style.marginLeft = '10px';
                        resultsCount.style.fontWeight = 'bold';
                        resultsCount.textContent = '0'; // Initial results count

                        label.appendChild(divCheckbox);
                        label.appendChild(inputCheckbox);
                        label.appendChild(span);
                        label.appendChild(resultsCount); // Add result element
                        filterItem.appendChild(label);

                        return filterItem;
                    }

                    // Add filter items to #lista-kategoria
                    const categoryList = document.getElementById('lista-kategoria');
                    if (categoryList) {
                        Array.from(categorySet)
                            .sort((a, b) => a.localeCompare(b)) // Use localeCompare for sorting strings
                            .forEach((category) => {
                                const filterItem = createFilterItem(category, 'Kategoria');
                                categoryList.appendChild(filterItem);
                            });
                    } else {
                        console.error('Element #lista-kategoria not found');
                    }

                    // Add filter items to #lista-tag
                    const tagList = document.getElementById('lista-tag');
                    if (tagList) {
                        Array.from(tagSet)
                            .sort((a, b) => a.localeCompare(b)) // Use localeCompare for sorting strings
                            .forEach((tag) => {
                                const filterItem = createFilterItem(tag, 'Tag');
                                tagList.appendChild(filterItem);
                            });
                    } else {
                        console.error('Element #lista-tag not found');
                    }

                    // @ts-ignore
                    window.fsAttributes.cmsfilter.init();
                    // @ts-ignore
                    window.fsAttributes.push([
                        'cmsfilter',
                        // @ts-ignore
                        (filterInstances) => {
                            //console.log('cmsfilter Successfully loaded!');

                            const [filterInstance] = filterInstances;
                            const filtersData = filterInstance.filtersData;

                            function updateItemCount() {
                                //console.log('filtersData:', filtersData);  // Debugowanie

                                // @ts-ignore
                                filtersData.forEach(function (element) {
                                    if (element.filterKeys.includes('kategoria') || element.filterKeys.includes('tag')) {
                                        const elements = element.elements;
                                        // @ts-ignore
                                        elements.forEach(function (element) {
                                            const filterValue = element.value;
                                            const resultsNumber = element.resultsCount;
                                            //console.log('filterValue:', filterValue, 'resultsNumber:', resultsNumber);  // Debugowanie

                                            // Znajdź elementy z fs-cmsfilter-field i dopasowanym tekstem
                                            const matchingElements = Array.from(document.querySelectorAll('[fs-cmsfilter-field]')).filter(
                                                function (el) {
                                                    // @ts-ignore
                                                    return el.textContent.trim().includes(filterValue);
                                                }
                                            );

                                            //console.log('matchingElements:', matchingElements);  // Debugowanie

                                            matchingElements.forEach(function (matchingElement) {
                                                const resultCountElement = matchingElement.nextElementSibling;
                                                if (resultCountElement && resultCountElement.classList.contains('filter-results-count')) {
                                                    resultCountElement.textContent = resultsNumber;
                                                }
                                            });
                                        });
                                    }
                                });
                            }

                            updateItemCount();

                            // @ts-ignore
                            filterInstance.listInstance.on('renderitems', (renderedItems) => {
                                updateItemCount();
                            });
                        },
                    ]);
                } catch (error) {
                    console.error('Error during CMS load handling:', error);
                }
            }

            await onCmsLoad();
        },
    ]);
});
