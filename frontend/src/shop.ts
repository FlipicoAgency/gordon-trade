import {initializeAddToCartButtons} from "./cartItems";
import {getMemberData, getMemberJSON, updateMemberJSON} from './memberstack';
import {initializeGenerateOffer} from "./excel";

document.addEventListener("DOMContentLoaded", async () => {
    // Array to hold selected CMS IDs
    const selectedItems: string[] = [];

    // Function to calculate JSON size in bytes
    const calculateJSONSize = (json: any): number =>
        new Blob([JSON.stringify(json)]).size;

    // Function to toggle visibility of child elements based on `isFavorite`
    const updateFavoriteButtonState = (button: HTMLElement, isFavorite: boolean): void => {
        const lineIcon = button.querySelector<HTMLElement>(".is-line");
        const fillIcon = button.querySelector<HTMLElement>(".is-fill");

        if (lineIcon) {
            lineIcon.style.display = isFavorite ? "none" : "block";
        }
        if (fillIcon) {
            fillIcon.style.display = isFavorite ? "block" : "none";
        }
    };

    // Handle favorite button click
    const handleFavoriteButtonClick = async (button: HTMLElement): Promise<void> => {
        const productId = button.getAttribute("data-commerce-product-id");
        if (!productId) {
            console.error("Product ID not found on button element.");
            return;
        }

        try {
            const memberJson = await getMemberJSON();
            let favorites: string[] = memberJson.data?.favorites || []; // Safely initialize array

            const isFavorite = favorites.includes(productId);

            if (isFavorite) {
                // Remove product from favorites
                favorites = favorites.filter((id) => id !== productId);
            } else {
                // Add product to favorites
                favorites.push(productId);
            }

            // Ensure the correct structure before updating
            const updatedJson = {
                ...memberJson.data,
                favorites, // Update the favorite array
            };
            await updateMemberJSON({ json: updatedJson });

            updateFavoriteButtonState(button, !isFavorite);
        } catch (error) {
            console.error("Error handling favorite button click:", error);
        }
    };

    // Initialize favorite button states
    const initializeFavoritesState = async (): Promise<void> => {
        try {
            const member = await getMemberData();
            if (!member) {
                console.error("User not logged in. Skipping favorites initialization.");
                return;
            }

            let memberJson = await getMemberJSON();

            // Check if memberJson.data is null and initialize it if necessary
            if (!memberJson.data) {
                console.warn("Member JSON is null. Initializing new data structure.");
                memberJson.data = { favorites: [] }; // Initialize with an empty favorites array
                await updateMemberJSON({ json: memberJson.data });
                memberJson = await getMemberJSON(); // Refresh after update
            }

            const favorites: string[] = memberJson.data.favorites || [];

            document.querySelectorAll<HTMLElement>(".favoritebutton").forEach((button) => {
                const productId = button.getAttribute("data-commerce-product-id");
                if (productId) {
                    const isFavorite = favorites.includes(productId);
                    updateFavoriteButtonState(button, isFavorite);
                }
            });

            const buttons = document.querySelectorAll<HTMLElement>(".favoritebutton");
            buttons.forEach((button) => {
                button.addEventListener("click", () => handleFavoriteButtonClick(button));
            });
        } catch (error) {
            console.error("Error initializing:", error);
        }
    };

    // Initialize the checkboxes after items are fully loaded
    const initializeCheckboxes = (): void => {
        // Select all checkboxes
        const checkboxes = document.querySelectorAll<HTMLInputElement>(
            '.product_form_checkbox-field input[type="checkbox"]'
        );

        checkboxes.forEach((checkbox) => {
            // Get the associated CMS ID
            const cmsId = checkbox.closest('.product_item')?.querySelector<HTMLElement>(
                '[data-commerce-product-id]'
            )?.getAttribute('data-commerce-product-id');

            if (cmsId) {
                // Add event listener for checkbox change
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        // Add to selectedItems if not already present
                        if (!selectedItems.includes(cmsId)) {
                            selectedItems.push(cmsId);
                        }
                    } else {
                        // Remove from selectedItems if unchecked
                        const index = selectedItems.indexOf(cmsId);
                        if (index > -1) {
                            selectedItems.splice(index, 1);
                        }
                    }

                    // Log the updated array (for debugging)
                    console.log('Selected Items:', selectedItems);
                });
            }
        });
    };

    // Attach event listener to the "Generate Offer" button
    const initializeGenerateOfferButton = (): void => {
        const generateOfferButton = document.getElementById('generate-offer') as HTMLButtonElement;
        if (generateOfferButton) {
            generateOfferButton.addEventListener('click', () => {
                // Pass the selectedItems array to initializeGenerateOffer
                initializeGenerateOffer(selectedItems).catch((error) => {
                    console.error('Error generating offer:', error);
                });
            });
        }
    };

    function calculatePromoPercentage(): void {
        // Select all product items
        const productItems = document.querySelectorAll<HTMLDivElement>('.product_item-wrapper');

        productItems.forEach((productItem) => {
            // Query elements with proper type assertions
            const promo = productItem.querySelector<HTMLElement>('[data-price="promo"]');
            const normal = productItem.querySelector<HTMLElement>('[data-price="normal"]');
            const tagline = productItem.querySelector<HTMLElement>('.promo-tagline');
            const span = productItem.querySelector<HTMLSpanElement>('.promo-percentage');

            // Ensure all required elements are present
            if (promo && normal && tagline && span) {
                // Extract and parse text content to numbers
                const promoPrice = parseFloat(promo.textContent?.trim() || '');
                const normalPrice = parseFloat(normal.textContent?.trim() || '');

                if (!isNaN(promoPrice) && !isNaN(normalPrice) && normalPrice > 0 && !promo.classList.contains('w-dyn-bind-empty')) {
                    // Calculate percentage
                    const percentage = Math.round(((promoPrice - normalPrice) / normalPrice) * 100);

                    // Update span content and display tagline
                    span.textContent = Math.abs(percentage) + '%';
                    tagline.style.display = 'block';
                }
            }
        });
    }

    initializeGenerateOfferButton();

    // @ts-ignore
    window.fsAttributes = window.fsAttributes || [];
    // @ts-ignore
    window.fsAttributes.push([
        'cmsload',
        // @ts-ignore
        (listInstances) => {
            //console.log('cmsload Successfully loaded!');

            const [listInstance] = listInstances;

            calculatePromoPercentage();
            initializeAddToCartButtons();
            initializeFavoritesState();
            initializeCheckboxes();

            // @ts-ignore
            listInstance.on('renderitems', (renderedItems) => {
                calculatePromoPercentage();
                initializeAddToCartButtons();
                initializeFavoritesState();
                initializeCheckboxes();
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
                            // Tworzymy nowy element span
                            const priceElement = document.createElement('span');
                            priceElement.style.display = 'none'; // Ukrywamy element
                            priceElement.setAttribute('fs-cmsfilter-field', 'Cena');
                            priceElement.setAttribute('fs-cmssort-field', 'Cena');

                            // Dodajemy odpowiednią wartość do elementu
                            if (pricePromo) {
                                priceElement.textContent = pricePromo; // Ustawiamy cenę promocyjną, jeśli jest dostępna
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

            onCmsLoad();
        },
    ]);
});
