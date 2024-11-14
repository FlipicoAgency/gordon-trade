import memberstackAdmin from "@memberstack/admin";

// Inicjalizacja Memberstacka z kluczem API
const memberstackConfig = {
    memberstackSecretKey: 'sk_sb_2612076c66d651e8bc1e',
};

const memberstack = memberstackAdmin.init(memberstackConfig.memberstackSecretKey);

// Funkcja do aktualizacji użytkownika w Memberstack
export async function updateMemberstackUser(userId, order) {
    try {
        const response = await memberstack.members.update({
            id: userId,
            data: {
                json: {
                    orders: order
                }
            }
        });

        if (response.error) {
            console.error(`Memberstack update failed: ${response.error}`);
            throw new Error(`Memberstack update failed: ${response.error}`);
        }

        return response;
    } catch (error) {
        console.error(`Error updating Memberstack user: ${error.message}`);
        throw new Error(`Error updating Memberstack user: ${error.message}`);
    }
}


