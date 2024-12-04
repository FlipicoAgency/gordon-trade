import {initializeAddToCartButtons} from "./cartItems";
import {getMemberData, getMemberJSON, updateMemberJSON} from './memberstack';

document.addEventListener("DOMContentLoaded", async () => {
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

    // @ts-ignore
    window.fsAttributes = window.fsAttributes || [];
    // @ts-ignore
    window.fsAttributes.push([
        'cmsload',
        // @ts-ignore
        (listInstances) => {
            console.log('cmsload Successfully loaded!');

            const [listInstance] = listInstances;

            calculatePromoPercentage();
            initializeAddToCartButtons();
            initializeFavoritesState();

            // @ts-ignore
            listInstance.on('renderitems', (renderedItems) => {
                calculatePromoPercentage();
                initializeAddToCartButtons();
                initializeFavoritesState();
            });

            async function onCmsLoad() {
                try {
                    // Wait for the rendering queue to finish
                    const productItems = await listInstance.items;

                    const categorySet = new Set<string>();
                    const tagSet = new Set<string>();

                    productItems.forEach((item: { element: HTMLElement }) => {
                        const categoryElement = item.element.querySelector<HTMLElement>('[fs-cmsfilter-field="category"]');
                        const tagElement = item.element.querySelector<HTMLElement>('[fs-cmsfilter-field="tag"]');

                        // Safely check textContent and add trimmed value to the set if it exists
                        if (categoryElement?.textContent?.trim()) {
                            categorySet.add(categoryElement.textContent.trim());
                        }

                        if (tagElement?.textContent?.trim()) {
                            tagSet.add(tagElement.textContent.trim());
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
                                const filterItem = createFilterItem(category, 'category');
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
                                const filterItem = createFilterItem(tag, 'tag');
                                tagList.appendChild(filterItem);
                            });
                    } else {
                        console.error('Element #lista-tag not found');
                    }


                } catch (error) {
                    console.error('Error during CMS load handling:', error);
                }
            }

            onCmsLoad();
        },
    ]);

    /*
    // @ts-ignore
    window.fsAttributes.cmsfilter.destroy();
    // @ts-ignore
    window.fsAttributes.cmsfilter.init();
    */
});
