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
        return memberResponse?.data || null;
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