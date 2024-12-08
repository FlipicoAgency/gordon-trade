// Query elements with proper type assertions
import {initializeAddToCartButtons} from "./cartItems";

document.addEventListener("DOMContentLoaded", async () => {
    const promo = document.querySelector<HTMLElement>('[data-price="promo"]');
    const normal = document.querySelector<HTMLElement>('[data-price="normal"]');
    const tagline = document.querySelector<HTMLElement>('.promo-tagline');
    const span = document.querySelector<HTMLSpanElement>('.promo-percentage');

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

    const addToCartForm: HTMLFormElement | null = document.querySelector('.product-header2_default-state');

    if (addToCartForm) {
        addToCartForm.onsubmit = (event: Event) => {
            event.preventDefault(); // Zapobiega domyślnemu działaniu formularza
            event.stopPropagation();
            console.log('Form submission prevented');
            // Tutaj możesz dodać swoją logikę, np. wysyłanie danych do API
        };
    } else {
        console.error('Add to Cart form not found');
    }

    // Pobierz elementy wariantów
    const colorVariantsElement = document.querySelector('[data-variants="color"]');
    const sizeVariantsElement = document.querySelector('[data-variants="size"]');

    // Pobierz select
    const variantSelect = document.querySelector<HTMLElement>('select[data-input="variant"]');
    const variantWrapper = document.querySelector<HTMLElement>('[data-wrapper="variant"]');

    if (variantSelect) {
        // Czyścimy wcześniejsze opcje
        variantSelect.innerHTML = '';

        // Dodaj placeholder dla kolorów, jeśli istnieje
        if (colorVariantsElement && colorVariantsElement.textContent !== '' && variantWrapper) {
            variantWrapper.style.display = 'block';
            variantSelect.setAttribute('validate', 'true');

            const placeholderOption = document.createElement('option');
            placeholderOption.textContent = 'Wybierz kolor';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            variantSelect.appendChild(placeholderOption);

            // Pobierz warianty i dodaj do selecta
            const colorVariants = colorVariantsElement.textContent?.split(',').map(v => v.trim()) || [];
            colorVariants.forEach(color => {
                const option = document.createElement('option');
                option.value = color;
                option.textContent = color;
                variantSelect.appendChild(option);
            });
        }

        // Dodaj placeholder dla rozmiarów, jeśli istnieje
        if (sizeVariantsElement && sizeVariantsElement.textContent !== '' && variantWrapper) {
            variantWrapper.style.display = 'block';
            variantSelect.setAttribute('validate', 'true');

            const placeholderOption = document.createElement('option');
            placeholderOption.textContent = 'Wybierz rozmiar';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            variantSelect.appendChild(placeholderOption);

            // Pobierz warianty i dodaj do selecta
            const sizeVariants = sizeVariantsElement.textContent?.split(',').map(v => v.trim()) || [];
            sizeVariants.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = size;
                variantSelect.appendChild(option);
            });
        }
    } else {
        console.error('Variant select not found');
    }

    await initializeAddToCartButtons();
});