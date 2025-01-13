declare global {
    interface Window {
        $memberstackDom: {
            getCurrentMember: () => Promise<{ data: Member | null }>;
            getMemberJSON: () => Promise<{ data: any }>;
            updateMemberJSON: (data: { json: any }) => Promise<void>;
        };
    }
}

export interface Member {
    id: string;
    verified: boolean;
    createdAt: string;
    profileImage: string | null;
    lastLogin: string;
    auth: {
        email: string;
        hasPassword: boolean;
        providers: string[];
    };
    metaData: Record<string, any>;
    customFields: {
        "nip": string,
        "name": string,
        "phone": string,
        "rabat": string,
        "saldo": string,
        "last-name": string,
        "first-name": string,
        "company-zip": string,
        "company-city": string,
        "company-name": string,
        "company-address": string
    };
    permissions: string[];
    stripeCustomerId: string | null;
    loginRedirect: string;
    teams: {
        belongsToTeam: boolean;
        ownedTeams: any[];
        joinedTeams: any[];
    };
    planConnections: {
        id: string;
        active: boolean;
        status: string;
        planId: string;
        type: string;
        payment: any | null;
    }[];
    _comments: {
        isModerator: boolean;
    };
}

export async function getMemberData(): Promise<Member | null> {
    try {
        const memberResponse = await window.$memberstackDom.getCurrentMember();
        return memberResponse?.data;
    } catch (error) {
        console.error("Failed to fetch Memberstack data:", error);
        return null;
    }
}

export async function getMemberJSON(): Promise<any> {
    try {
        const jsonResponse = await window.$memberstackDom.getMemberJSON();
        return jsonResponse || null;
    } catch (error) {
        console.error("Failed to fetch Member JSON:", error);
        return null;
    }
}

export async function updateMemberJSON(data: { json: any }): Promise<void> {
    try {
        await window.$memberstackDom.updateMemberJSON(data);
    } catch (error) {
        console.error("Failed to update Member JSON:", error);
    }
}

// Function to toggle visibility of child elements based on `isFavorite`
export const updateFavoriteButtonState = (button: HTMLElement, isFavorite: boolean): void => {
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
export const handleFavoriteButtonClick = async (button: HTMLElement): Promise<void> => {
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
export const initializeFavoriteState = async (): Promise<void> => {
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