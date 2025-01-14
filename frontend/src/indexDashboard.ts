import type {Member} from './memberstack';
import {getMemberData} from './memberstack';
import {fetchContainers} from "./dashboard/container-orders";
import {initializeFavorites} from './dashboard/favorites';
import {initializeOrders} from "./dashboard/orders";
import {initializeUppy} from "./dashboard/product-pricing";

document.addEventListener("DOMContentLoaded", async () => {
    const memberData: Member | null = await getMemberData();

    if (!memberData) {
        console.error("Brak danych użytkownika z Memberstack.");
        return;
    }

    const userBalance = document.getElementById('user-balance') as HTMLElement;
    userBalance.textContent = (memberData.customFields.saldo ? memberData.customFields.saldo : "0") + " zł";


    const mapWrapper = document.getElementById('container-map-wrapper') as HTMLElement;
    const listWrapper = document.getElementById('container-list-wrapper') as HTMLElement;
    const mapButton = document.getElementById('container-map') as HTMLElement;
    const listButton = document.getElementById('container-list') as HTMLElement;

    function showMap(): void {
        mapWrapper.style.display = 'block';
        listWrapper.style.display = 'none';
    }

    function showList(): void {
        mapWrapper.style.display = 'none';
        listWrapper.style.display = 'block';
    }

    mapButton.addEventListener('click', showMap);
    listButton.addEventListener('click', showList);

    // Inicjalizacja - pokazujemy tylko mapę na starcie
    showMap();

    await fetchContainers(memberData);
    await initializeOrders(memberData);
    await initializeFavorites();
    await initializeUppy(memberData);
});