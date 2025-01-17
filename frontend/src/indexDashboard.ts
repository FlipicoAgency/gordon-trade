import type {Member} from './memberstack';
import {getMemberData} from './memberstack';
import {fetchContainers} from "./dashboard/container-orders";
import {initializeFavorites} from './dashboard/favorites';
import {initializeOrders} from "./dashboard/orders";
import {initializeUppy} from "./dashboard/product-pricing";

// Funkcja do wykrywania języka
function detectLanguage(): string {
    const path = window.location.pathname; // Pobiera ścieżkę URL
    const language = path.split('/')[1]; // Pobiera pierwszy segment ścieżki
    const supportedLanguages = ['pl', 'en', 'cs', 'hu'];

    return supportedLanguages.includes(language) ? language : 'pl'; // Domyślnie 'pl'
}

document.addEventListener("DOMContentLoaded", async () => {
    // @ts-ignore
    if (window.isWebflowInitialized || window.location.href.includes('panel-2b2')) return;
    // @ts-ignore
    window.isWebflowInitialized = true; // Ustaw flagę, aby zapobiec wielokrotnemu uruchamianiu

    const language = detectLanguage();

    const { default: translations } = await import(`../translations/${language}.json`, {
        assert: { type: "json" },
    });

    const memberData: Member | null = await getMemberData();

    if (!memberData) {
        console.error("Brak danych użytkownika z Memberstack.");
        return;
    }

    const userBalance = document.getElementById('user-balance') as HTMLElement;
    if (userBalance) userBalance.textContent = (memberData.customFields.saldo ? memberData.customFields.saldo : "0") + " zł";


    const mapWrapper = document.getElementById('container-map-wrapper') as HTMLElement;
    const listWrapper = document.getElementById('container-list-wrapper') as HTMLElement;
    const mapButton = document.getElementById('container-map') as HTMLElement;
    const listButton = document.getElementById('container-list') as HTMLElement;

    function showMap(): void {
        if (mapWrapper) mapWrapper.style.display = 'block';
        if (listWrapper) listWrapper.style.display = 'none';
    }

    function showList(): void {
        if (mapWrapper) mapWrapper.style.display = 'none';
        if (listWrapper) listWrapper.style.display = 'block';
    }

    mapButton?.addEventListener('click', showMap);
    listButton?.addEventListener('click', showList);

    // Inicjalizacja - pokazujemy tylko mapę na starcie
    showMap();

    await fetchContainers(memberData, translations);
    await initializeOrders(memberData, translations);
    await initializeFavorites(translations);
    await initializeUppy(memberData, translations);
});