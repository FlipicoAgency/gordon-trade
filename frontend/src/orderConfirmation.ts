import { fetchBaselinkerOrder, renderBaselinkerItems, retrievePaymentIntent } from './cartItems';
//import { updateCostsDisplay } from './payments';

const retrieveOrderDetails = async () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectStatus = urlParams.get('redirect_status') ?? '';
    const clientSecret = urlParams.get('payment_intent') ?? '';

    if (redirectStatus === 'succeeded' && clientSecret) {
      const result = await retrievePaymentIntent(clientSecret);

      if (!result) {
        alert(
          'Wystąpił błąd podczas pobierania informacji o zamiarze zapłaty. Skontaktuj się z nami w celu wyjaśnienia sytuacji.'
        );
        console.error('Error retrieving payment intent.');
        return;
      }

      const orderId = result.metadata?.order_id;
      if (!orderId) {
        alert(
          'Nie znaleźliśmy Twojego zamówienia. Skontaktuj się z nami w celu wyjaśnienia sytuacji.'
        );
        console.error('Order ID not found in payment intent metadata.');
        return;
      }

      try {
        const baselinkerOrderResponse = await fetchBaselinkerOrder(orderId);
        const OrderHtmlElements = getOrderHtmlElements();

        if (OrderHtmlElements) {
          const {
            email,
            name,
            address,
            city,
            zip,
            country,
            nip,
            phone,
            additionalInfo,
            shipmentMethod,
            parcelMachine,
            companyName,
          } = OrderHtmlElements;

          const baselinkerOrder = baselinkerOrderResponse?.orders?.[0];
          if (!baselinkerOrder) {
            console.error('Order not found.');
            return;
          }

          const { products } = baselinkerOrder;

          if (email) email.textContent = baselinkerOrder?.email || '';
          if (name) name.textContent = baselinkerOrder?.delivery_fullname || '';
          if (address) address.textContent = baselinkerOrder?.delivery_address || '';
          if (city) city.textContent = baselinkerOrder?.delivery_city || '';
          if (zip) zip.textContent = baselinkerOrder?.delivery_postcode || '';
          if (country) country.textContent = baselinkerOrder?.delivery_country || '';
          if (phone) phone.textContent = baselinkerOrder?.phone || '';
          if (additionalInfo) additionalInfo.textContent = baselinkerOrder?.user_comments || '';
          if (shipmentMethod) shipmentMethod.textContent = baselinkerOrder?.delivery_method || '';
          if (parcelMachine) parcelMachine.textContent = baselinkerOrder?.delivery_point_id || '';
          if (nip) {
            if (baselinkerOrder?.invoice_nip) {
              nip.textContent = baselinkerOrder.invoice_nip;
            } else {
              nip.parentElement?.remove();
            }
          }
          if (companyName) {
            if (baselinkerOrder?.invoice_company) {
              companyName.textContent = baselinkerOrder.invoice_company;
            } else {
              companyName.parentElement?.remove();
            }
          }

          renderBaselinkerItems(products);

          // Oblicz całkowity koszt produktów w koszyku
          const totalProductCost = products.reduce(
            (acc: number, item: { price_brutto: number; quantity: number }) =>
              acc + item.price_brutto * item.quantity,
            0
          );

          // Oblicz podatek od produktów (23%)
          const taxCost = totalProductCost * 0.23;

          // Oblicz całkowity koszt z uwzględnieniem dostawy, podatku i kuponu
          const totalCost = baselinkerOrder?.payment_done;

          // Upewnij się, że całkowity koszt nie jest ujemny
          const finalTotalCost = Math.max(totalCost, 0);

          // Obliczenie kwoty kuponu z zaokrągleniem do dwóch miejsc po przecinku
          const couponAmount =
            Math.round((totalCost - totalProductCost - baselinkerOrder?.delivery_price) * 100) /
            100;

          // console.log('Total cost: ', totalCost.toFixed(2));
          // console.log('totalProductCost: ', totalProductCost.toFixed(2));
          // console.log('delivery_price: ', baselinkerOrder?.delivery_price.toFixed(2));
          // console.log('coupon amount', couponAmount.toFixed(2));

          // Zaktualizuj wyświetlanie kosztów na stronie
          updateCostsDisplay(
            totalProductCost,
            taxCost,
            baselinkerOrder?.delivery_method,
            baselinkerOrder?.delivery_price,
            finalTotalCost,
            couponAmount
          );
        }
      } catch (error) {
        alert('Wystąpił błąd podczas pobierania zamówienia. Skontaktuj się z nami.');
        console.error('Error fetching Baselinker order:', error);
      }
    } else if (redirectStatus === 'pending') {
      alert(
        'Twoje zamówienie jest nadal przetwarzane. Kliknij OK, aby strona odświeżyła się w przeciągu 10 sekund, aby sprawdzić ponownie status.'
      );

      setTimeout(async () => {
        const result = await retrievePaymentIntent(clientSecret);

        if (!result) {
          alert('Wystąpił błąd podczas pobierania informacji o płatności.');
          return;
        }

        //console.log('RESULT:', result);
        //console.log('RESULT STATUS: ', result.status);

        if (result.status === 'succeeded') {
          //console.log('SUCCEEDED!');
          urlParams.set('redirect_status', 'succeeded');
          const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
          window.location.replace(newUrl);
        } else if (result.status === 'requires_payment_method') {
          //console.log('REQUIRES PAYMENT METHOD!');
          alert('Nie dokończyłeś płatności. Kliknij OK, aby spróbować jeszcze raz.');
          const newUrl = `${window.location.origin}/koszyk`;
          window.location.replace(newUrl);
        }
      }, 10000);
    } else if (redirectStatus === 'cancelled') {
      alert('Anulowałeś płatność. Spróbuj jeszcze raz. Kliknij OK, aby nastąpiło przekierowanie.');
      const newUrl = `${window.location.origin}/koszyk`;
      window.location.replace(newUrl);
    }
  } catch (error) {
    alert('Wystąpił błąd. Skontaktuj się z nami w celu wyjaśnienia sytuacji.');
    console.error('Error retrieving order details:', error);
  }
};

// Funkcja pobierająca dane formularza
const getOrderHtmlElements = () => {
  const email = document.querySelector('#Email');
  const name = document.querySelector('#wf-ecom-shipping-name');
  const address = document.querySelector('#wf-ecom-shipping-address');
  const city = document.querySelector('#wf-ecom-shipping-city');
  //const state = document.querySelector('#wf-ecom-shipping-state');
  const zip = document.querySelector('#wf-ecom-shipping-zip');
  const country = document.querySelector('#wf-ecom-shipping-country');
  const nip = document.querySelector('#nip');
  const phone = document.querySelector('#Telefon');
  const additionalInfo = document.querySelector('#DodatkoweInformacje');
  const shipmentMethod = document.querySelector('#shipment-field');
  const parcelMachine = document.querySelector('#parcel-field');
  const companyName = document.querySelector('#nazwa-firmy');

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
    shipmentMethod,
    parcelMachine,
    companyName,
  };
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

// Wywołanie funkcji po załadowaniu DOM
document.addEventListener('DOMContentLoaded', retrieveOrderDetails);
