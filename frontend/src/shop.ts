import { handleAddToCart } from "./cartItems";

document.addEventListener("DOMContentLoaded", async () => {
    interface Memberstack {
        getCurrentMember(): Promise<{ data: Member | null }>;
        getMemberJSON(): Promise<{ data: any }>;
        updateMemberJSON(data: { json: any }): Promise<void>;
    }

    interface Member {
        id: string;
        email: string;
    }

    const addToCartButtons = document.querySelectorAll<HTMLElement>('.addtocartbutton');
    addToCartButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();

            try {
                await handleAddToCart(button);
            } catch (error) {
                console.error('Error adding to cart:', error);
            }
        });
    });

    // Type-safe access to `window.$memberstackDom`
    const memberstack = (window as any).$memberstackDom as Memberstack;

    // Function to calculate JSON size in bytes
    const calculateJSONSize = (json: any): number =>
        new Blob([JSON.stringify(json)]).size;

    // Function to update button state (add/remove "is-active" class)
    const updateFavoriteButtonState = (button: HTMLElement, isFavorite: boolean): void => {
        const productId = button.getAttribute("data-commerce-product-id");
        button.classList.toggle("is-active", isFavorite);
    };

    // Handle favorite button click
    const handleFavoriteButtonClick = async (button: HTMLElement): Promise<void> => {
        const productId = button.getAttribute("data-commerce-product-id");
        if (!productId) {
            console.error("Product ID not found on button element.");
            return;
        }

        try {
            const memberJson = await memberstack.getMemberJSON();
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
            await memberstack.updateMemberJSON({ json: updatedJson });

            updateFavoriteButtonState(button, !isFavorite);
        } catch (error) {
            console.error("Error handling favorite button click:", error);
        }
    };

    // Initialize favorite button states
    const initializeFavoritesState = async (): Promise<void> => {
        try {
            const { data: member } = await memberstack.getCurrentMember();
            if (!member) {
                console.error("User not logged in. Skipping favorites initialization.");
                return;
            }

            let memberJson = await memberstack.getMemberJSON();

            // Check if memberJson.data is null and initialize it if necessary
            if (!memberJson.data) {
                console.warn("Member JSON is null. Initializing new data structure.");
                memberJson.data = { favorites: [] }; // Initialize with an empty favorites array
                await memberstack.updateMemberJSON({ json: memberJson.data });
                memberJson = await memberstack.getMemberJSON(); // Refresh after update
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
