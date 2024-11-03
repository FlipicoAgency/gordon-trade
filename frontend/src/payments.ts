import {
  type CartItem,
  fetchCartData,
  getSessionID,
  renderCheckoutItems,
} from './cartItems';

declare const STRIPE_KEY: string;
declare const STRIPE_ACCOUNT_ID: string;

// Funkcja pobierająca wybraną metodę dostawy oraz obliczająca liczbę paczek dla InPost
const getSelectedShippingMethod = (cartItems: CartItem[]) => {
  const selectedRadio = document.querySelector<HTMLInputElement>('input[name="Dostawa"]:checked');

  if (selectedRadio) {
    let baseCost = parseFloat(
      selectedRadio.nextElementSibling?.nextElementSibling?.textContent?.replace(' ZŁ', '') || '0'
    );
    const choice = selectedRadio.nextElementSibling?.textContent || 'Brak wyboru';

    return { choice, cost: baseCost };
  }

  return { choice: 'Brak wyboru', cost: 0 }; // Domyślny koszt dostawy, jeśli nic nie jest wybrane
};

// Funkcja aktualizująca wyświetlanie kosztów
const updateCostsDisplay = (
  productsCost: number,
  taxCost: number,
  shippingChoice: string,
  shippingCost: number,
  totalCost: number,
  couponAmount: number
) => {
  const productsCostElement = document.querySelector<HTMLElement>('.products-cost');
  if (productsCostElement) {
    productsCostElement.textContent = `${productsCost.toFixed(2)} zł`;
  }

  const taxElementValue = document.querySelector<HTMLElement>('.tax');
  if (taxElementValue) {
    taxElementValue.textContent = `${taxCost.toFixed(2)} zł`;
  }

  const shipmentElementChoice = document.querySelector<HTMLElement>('.shipment-method-choice');
  if (shipmentElementChoice) {
    shipmentElementChoice.textContent = `${shippingChoice}`;
  }

  const shipmentElementValue = document.querySelector<HTMLElement>('.shipment-method-value');
  if (shipmentElementValue) {
    shipmentElementValue.textContent = `${shippingCost.toFixed(2)} zł`;
  }

  const couponAmountElement = document.querySelector<HTMLElement>('.coupon-amount');
  if (couponAmountElement) {
    couponAmountElement.textContent = `${couponAmount} zł`;
  }

  const totalCostElement = document.querySelector<HTMLElement>('.total-cost');
  if (totalCostElement) {
    totalCostElement.textContent = `${totalCost.toFixed(2)} zł`;
  }
};

// Funkcja pobierająca dane formularza
const getFormData = () => {
  const email = document.querySelector<HTMLInputElement>('#Email')?.value || '';
  const name = document.querySelector<HTMLInputElement>('#wf-ecom-shipping-name')?.value || '';
  const address =
    document.querySelector<HTMLInputElement>('#wf-ecom-shipping-address')?.value || '';
  const city = document.querySelector<HTMLInputElement>('#wf-ecom-shipping-city')?.value || '';
  //const state = document.querySelector<HTMLInputElement>('#wf-ecom-shipping-state')?.value || '';
  const zip = document.querySelector<HTMLInputElement>('#wf-ecom-shipping-zip')?.value || '';
  const country =
    document.querySelector<HTMLSelectElement>('#wf-ecom-shipping-country')?.value || 'Poland';
  const nip = document.querySelector<HTMLInputElement>('#nip')?.value || '';
  const phone = document.querySelector<HTMLInputElement>('#Telefon')?.value || '';
  const additionalInfo =
    document.querySelector<HTMLInputElement>('#DodatkoweInformacje')?.value || '';
  const parcelMachine = document.querySelector<HTMLInputElement>('#parcel-field')?.value || '';
  const companyName = document.querySelector<HTMLInputElement>('#nazwa-firmy')?.value || '';

  return {
    email,
    name,
    address,
    city,
    //state,
    zip,
    country,
    nip,
    phone,
    additionalInfo,
    parcelMachine,
    companyName,
  };
};

// Get the "Next" button
const nextButton = document.querySelector<HTMLButtonElement>('a[data-form="next-btn"]');

// Get the "Pay" button
const payButton = document.querySelector<HTMLInputElement>('a[data-form="submit-btn-normal"]');

// Get the step one wrapper
const stepOneWrapper = document.querySelector<HTMLDivElement>('div[data-step="1"]');

// Get the boolean about items input
const isItemsInput = document.querySelector<HTMLInputElement>('#is-items');

// Get the NIP input
const nipInput = document.querySelector<HTMLInputElement>('#nip'); // Pobiera pole NIP
nipInput?.removeAttribute('required');

// Get the company checkbox
const companyCheckbox = document.querySelector<HTMLInputElement>('#Company');
companyCheckbox?.addEventListener('change', () => {
  if (companyCheckbox.checked) {
    nipInput?.setAttribute('required', 'true'); // Ustawia pole NIP jako wymagane
  } else {
    nipInput?.removeAttribute('required'); // Usuwa wymaganie wypełnienia pola NIP
  }
});

// Funkcja do sprawdzenia, czy wszystkie wymagane pola są wypełnione
const checkRequiredFields = () => {
  if (!stepOneWrapper || !nextButton || !isItemsInput) return;

  // Znajdź wszystkie wymagane pola w stepOneWrapper
  const requiredFields = stepOneWrapper.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    'input[required], select[required]'
  );

  // Sprawdź, czy wszystkie wymagane pola są wypełnione
  const allFieldsFilled = Array.from(requiredFields).every((field) => field.value.trim() !== '');

  // Sprawdź, czy isItemsInput ma wartość "true"
  const isCartValid = isItemsInput.value === 'true';

  // Włącz lub wyłącz przycisk "Next" w zależności od tego, czy wszystkie pola są wypełnione oraz isItemsInput jest "true"
  const shouldEnableNextButton = allFieldsFilled && isCartValid;

  if (shouldEnableNextButton) {
    nextButton.disabled = false;
    nextButton.style.cursor = 'pointer';
    nextButton.style.opacity = '1';
    nextButton.style.pointerEvents = 'auto'; // Przywraca możliwość klikania
    nextButton.style.display = 'block'; // Upewnia się, że przycisk jest widoczny
  } else {
    nextButton.disabled = true;
    nextButton.style.cursor = 'not-allowed';
    nextButton.style.opacity = '0.5';
    nextButton.style.pointerEvents = 'none'; // Blokuje możliwość klikania
    nextButton.style.display = 'none'; // Ukrywa przycisk, gdy nie spełnia warunków
  }
};

// Funkcja inicjalizująca nasłuchiwanie zmian w polach formularza
const initFieldListeners = () => {
  if (!stepOneWrapper) return;

  // Znajdź wszystkie wymagane pola w stepOneWrapper
  const requiredFields = stepOneWrapper.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    'input[required], select[required]'
  );

  // Dodaj nasłuchiwanie na wszystkie wymagane pola
  requiredFields.forEach((field) => {
    field.addEventListener('input', checkRequiredFields);
  });

  // Dodaj nasłuchiwanie na zmiany w isItemsInput
  if (isItemsInput) {
    isItemsInput.addEventListener('input', checkRequiredFields);
  }

  // Początkowo sprawdź stan przycisku "Next"
  checkRequiredFields();
};

// Get the step two wrapper
const stepTwoWrapper = document.querySelector<HTMLDivElement>('div[data-step="2"]');

const toggleSteps = async () => {
  if (stepOneWrapper && stepTwoWrapper) {
    stepOneWrapper.style.display = 'none';
    stepTwoWrapper.style.display = 'flex';
    //stepTwoWrapper.scrollIntoView({ behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    console.error('One of the step wrappers is not found.');
  }
};

// Funkcja do zarządzania stanem przycisku "Zapłać"
const handlePaymentButtonState = async (cartItems: CartItem[]) => {
  if (!cartItems) {
    if (payButton) {
      payButton.disabled = true;
      payButton.style.cursor = 'not-allowed';
      payButton.style.opacity = '0.5';
    }
    if (isItemsInput) {
      isItemsInput.value = ''; // Jeśli koszyk jest pusty, pozostaw pole puste
    }
    alert(
      'Twój koszyk jest pusty. Dodaj przedmioty do koszyka przed przejściem do następnego kroku.'
    );
    window.location.href = '/sklep';
  } else {
    if (payButton) {
      payButton.disabled = false;
      payButton.style.cursor = 'pointer';
      payButton.style.opacity = '1';
    }
    if (isItemsInput) {
      isItemsInput.value = 'true'; // Jeśli są przedmioty w koszyku, ustaw wartość na "true"
    }
  }
};

const isValidNIP = (nip: string): boolean => {
  const nipRegex = /^\d{10}$/;
  return nipRegex.test(nip);
};

const init = async () => {
  const form = document.querySelector<HTMLFormElement>('[data-element="payment_form"]');
  if (!form) {
    console.error(
      'Payment form element could not be found. Ensure that the form has the correct data-element attribute.'
    );
    return;
  }

  // Prevent enter form submission
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent the default form submission
    }
  });

  const cartItems = await fetchCartData();
  if (cartItems.length !== 0) {
    initFieldListeners();
    await handlePaymentButtonState(cartItems);

    const createPaymentIntent = async (
      totalCost: number,
      cartItems: CartItem[],
      shippingCost: number,
      shippingChoice: string,
      taxCost: number,
      formData: any,
      sessionID: string
    ) => {
      try {
        // Tworzenie PaymentIntent za pomocą Stripe
        const response = await fetch('https://koszyk.deckline.pl/api/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            total_amount: Math.round(totalCost * 100), // Stripe obsługuje kwoty w groszach
            currency: 'PLN',
            items: cartItems.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            })),
            shipping_cost: Math.round(shippingCost * 100),
            tax_cost: Math.round(taxCost * 100),
            customer_email: formData.email,
            customer_name: formData.name,
            shipping_address: {
              address_line1: formData.address,
              address_line2: formData.parcelMachine,
              city: formData.city,
              postal_code: formData.zip,
              country: formData.country,
            },
            nip: formData.nip,
            phone: formData.phone,
            additional_info: formData.additionalInfo,
            shipping_choice: shippingChoice,
            company_name: formData.companyName,
            sessionID: sessionID,
          }),
        });

        const data = await response.json();
        return data;
      } catch (err) {
        console.error('Error creating payment intent:', err);
        return null;
      }
    };

    // Global variables to keep track of coupon discount
    let appliedCouponAmount = 0;
    const appliedCouponType = null;
    let currentTotalCost = 0;

    // Funkcja obsługująca zmianę metody dostawy i aktualizację kosztów
    const handleShippingMethodChange = async (couponAmount = appliedCouponAmount) => {
      //console.log('KUPON JUŻ W FUNKCJI HANDLE SHIPPING: ', couponAmount);

      try {
        // Pobierz wybraną metodę dostawy
        const { choice: shippingChoice, cost: shippingCost } = getSelectedShippingMethod(cartItems);

        // Sprawdź, czy koszyk jest wypełniony
        if (!cartItems || cartItems.length === 0) {
          console.error('Koszyk jest pusty.');
          return { totalProductCost: 0, totalCost: 0, shippingChoice, shippingCost, taxCost: 0 };
        }

        // Oblicz całkowity koszt produktów w koszyku
        const totalProductCost = cartItems.reduce(
          (acc: number, item: CartItem) => acc + item.price * item.quantity,
          0
        );

        // Oblicz podatek od produktów (23%)
        const taxCost = totalProductCost * 0.23;

        // Oblicz całkowity koszt z uwzględnieniem dostawy, podatku i kuponu
        const totalCost = totalProductCost + shippingCost - couponAmount;

        // Upewnij się, że całkowity koszt nie jest ujemny
        const finalTotalCost = Math.max(totalCost, 0);
        currentTotalCost = finalTotalCost; // Update the global current total cost

        // Zaktualizuj wyświetlanie kosztów na stronie
        updateCostsDisplay(
          totalProductCost,
          taxCost,
          shippingChoice,
          shippingCost,
          finalTotalCost,
          couponAmount
        );

        // Zwróć obliczone wartości dla dalszego użycia
        return {
          totalProductCost,
          totalCost: finalTotalCost,
          shippingChoice,
          shippingCost,
          taxCost,
        };
      } catch (error) {
        console.error('Błąd podczas obliczania kosztów:', error);
        // Zwróć domyślne wartości w przypadku błędu
        return {
          totalProductCost: 0,
          totalCost: 0,
          shippingChoice: 'Brak wyboru',
          shippingCost: 0,
          taxCost: 0,
        };
      }
    };

    // Funkcja frontendowa, która sprawdza kupon z backendem
    const checkCoupon = async (couponCode: string) => {
      try {
        const response = await fetch('https://koszyk.deckline.pl/api/validate-coupon', {
          credentials: 'include', // Dodaj credentials
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ couponCode }),
        });

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error checking coupon:', error);
        return { isValid: false, discountType: null, amount: 0 };
      }
    };

    document.getElementById('apply-coupon')?.addEventListener('click', async () => {
      // Pobierz pole kuponu i sprawdź, czy istnieje
      const couponInput = document.getElementById('coupon-code') as HTMLInputElement | null;
      const feedbackElement = document.getElementById('coupon-feedback') as HTMLElement | null;

      if (!couponInput || !feedbackElement) {
        console.error('Nie znaleziono elementu formularza kuponu.');
        return;
      }

      const couponCode = couponInput.value.trim();

      // Sprawdzenie kuponu za pomocą funkcji frontendowej
      const { isValid, discountType, amount } = await checkCoupon(couponCode);

      if (!isValid) {
        feedbackElement.textContent = 'Nieprawidłowy kupon.';
        feedbackElement.style.display = 'block';
        return;
      }

      // Format the discount message based on the discount type
      const discountMessage =
        discountType === 'fixed' ? `Zniżka: ${(amount / 100).toFixed(2)} zł` : `Zniżka: ${amount}%`;

      // Display the feedback message with the discount details
      feedbackElement.textContent = `Kupon został dodany. ${discountMessage}`;
      feedbackElement.style.display = 'block';

      const { totalCost } = await handleShippingMethodChange();

      // Store the coupon details globally
      appliedCouponAmount =
        discountType === 'percentage' ? totalCost * (amount / 100) : amount / 100;
      //console.log('KUPON PRZED DODANIEM (CLICK): ', appliedCouponAmount);
      await handleShippingMethodChange();
    });

    // Dostawy
    const shippingMethodInputs =
      document.querySelectorAll<HTMLInputElement>('input[name="Dostawa"]');

    const palletDelivery = Array.from(shippingMethodInputs).find(
      (input) => input.value === 'Dostawa Spedycyjna'
    );

    shippingMethodInputs.forEach((input) => {
      if (cartItems.some((item) => item.length > 60)) {
        // Czy dostawa do paczkomatów?
        if (
          input.value === '66b3793346ac0078df04ddcc' ||
          input.value === '66b3793346ac0078df04ddce' ||
          input.value === 'Kurier'
        ) {
          input.closest('.shipping-method')?.remove();
        }
      } else {
        palletDelivery?.closest('.shipping-method')?.remove();
      }
      // Dodaj nasłuchiwanie na zmianę metody dostawy
      input.addEventListener('change', () => handleShippingMethodChange());
    });

    renderCheckoutItems(cartItems);

    nextButton?.addEventListener('click', async () => {
      // Sprawdź ponownie stan koszyka przed kontynuowaniem
      if (cartItems.length === 0) {
        alert(
          'Twój koszyk jest pusty. Dodaj przedmioty do koszyka przed przejściem do następnego kroku.'
        );
        window.location.href = '/sklep';
        return;
      }

      const formData = getFormData();

      const { totalCost, shippingChoice, shippingCost, taxCost } =
        await handleShippingMethodChange();

      // Sprawdzenie, czy suma produktów w koszyku wynosi więcej niż 2.00 zł
      if (totalCost <= 2.0) {
        alert('Suma produktów w koszyku musi wynosić więcej niż 2.00 zł, aby kontynuować.');
        return;
      }

      // Pobierz wartość pola parcel-field
      const parcelField =
        document.querySelector<HTMLInputElement>('#parcel-field')?.value.trim() || '';

      // Sprawdź, czy użytkownik wybrał paczkomat InPost lub DHL i czy pole paczkomatu jest wypełnione
      const isParcelRequired =
        shippingChoice.includes('PACZKOMAT INPOST') || shippingChoice.includes('AUTOMAT DHL');
      const isParcelFieldFilled = parcelField !== '';

      if (isParcelRequired && !isParcelFieldFilled) {
        alert('Zaznaczyłeś opcję paczkomatów, lecz nie wybrałeś żadnego punktu.');
        return;
      }

      const isNipRequired = companyCheckbox?.checked; // Sprawdza, czy zaznaczono zakup jako firma
      const isNipFieldFilled = nipInput?.value.trim() !== ''; // Sprawdza, czy NIP jest wypełniony
      const isNIPValid = nipInput?.value ? isValidNIP(nipInput.value.trim()) : true; // Walidacja poprawności NIP, jeśli pole jest wypełnione

      if (isNipRequired && (!isNipFieldFilled || !isNIPValid)) {
        if (!isNipFieldFilled) {
          alert('Zaznaczyłeś opcję zakupu jako firma, lecz nie uzupełniłeś NIP.');
        } else {
          alert('Podany NIP jest niepoprawny.');
        }
        return;
      }

      toggleSteps();

      /* RETRIEVE SESSION ID FROM BACKEND */
      const sessionID = await getSessionID();
      //console.log('SESSION ID: ', sessionID);

      const payment_intent = await createPaymentIntent(
        //access_token,
        totalCost,
        cartItems,
        shippingCost,
        shippingChoice,
        taxCost,
        formData,
        sessionID
      );
      //console.log('Front payment intent: ', payment_intent);
      if (!payment_intent) {
        console.error('Payment intent is missing.');
        return;
      }

      //console.log({ payment_intent });
      //console.log('CLIENT SECRET: ', payment_intent.client_secret);

      const stripeElement = document.querySelector<HTMLElement>('[data-element="stripe"]');
      if (!stripeElement) {
        console.error(
          'Stripe element could not be found. Ensure that the element has the correct data-element attribute.'
        );
        return;
      }

      const elements = stripe.elements({
        clientSecret: payment_intent.client_secret,
      });

      const paymentElement = elements.create('payment');
      paymentElement.mount(stripeElement);

      form.addEventListener(
        'submit',
        async (e) => {
          e.preventDefault();
          e.stopPropagation();

          await elements.submit();

          const result = await stripe.confirmPayment({
            elements,
            clientSecret: payment_intent.client_secret,
            redirect: 'always',
            confirmParams: {
              return_url: 'https://www.deckline.pl/potwierdzenie-zamowienia',
            },
          });

          //console.log({ result });

          const formSuccess = document.querySelector<HTMLElement>('.w-form-done');
          const formFail = document.querySelector<HTMLElement>('.w-form-fail');
          const formContainer = document.querySelector<HTMLElement>('.container-medium');

          if (result.error) {
            //console.error(result.error.message);
            if (formFail) {
              formFail.textContent = `Płatność nieudana: ${result.error.message}`;
              formFail.style.display = 'block';
            }
            if (formSuccess) formSuccess.style.display = 'none';
          } else {
            //console.log('Płatność udana');
            if (formSuccess) {
              formSuccess.textContent = 'Płatność zakończona sukcesem!';
              formSuccess.style.display = 'block';
            }
            if (formFail) formFail.style.display = 'none';
            if (formContainer) formContainer.style.display = 'none';
          }
        },
        true
      );

      //console.log({ isLoggedIn });
    });
  } else {
    alert('Musisz coś dodać do koszyka, aby przejść do płatności.');
    window.location.href = '/sklep';
    return;
  }
};

document.addEventListener('DOMContentLoaded', init);
