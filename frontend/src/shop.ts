import {initializeAddToCartButtons} from "./cartItems";
import {getMemberData, getMemberJSON, updateMemberJSON} from './memberstack';

document.addEventListener("DOMContentLoaded", async () => {
    initializeAddToCartButtons();

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

            document.querySelectorAll<HTMLElement>(".favouritebutton").forEach((button) => {
                const productId = button.getAttribute("data-commerce-product-id");
                if (productId) {
                    const isFavorite = favorites.includes(productId);
                    updateFavoriteButtonState(button, isFavorite);
                }
            });

            const buttons = document.querySelectorAll<HTMLElement>(".favouritebutton");
            buttons.forEach((button) => {
                button.addEventListener("click", () => handleFavoriteButtonClick(button));
            });
        } catch (error) {
            console.error("Error initializing:", error);
        }
    };

    // Initialize
    await initializeFavoritesState();
});
