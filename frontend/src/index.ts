// Import funkcji z modułu `cartItems`
import { initializeCart } from './cartItems';

const init = async () => {
  /*
  // Funkcja do połączenia z serwerem WebSocket
  async function connectToServer() {
    console.log('Rozpoczynam próbę połączenia z serwerem WebSocket');

    try {
      const sessionId = await getSessionID();
      console.log('Otrzymano ID sesji:', sessionId);

      const ws = new WebSocket(
        `wss://stripe-finsweet-backend.onrender.com/ws?sessionId=${sessionId}`
      );

      return new Promise((resolve, reject) => {
        // Logowanie stanu WebSocket
        ws.onopen = () => {
          console.log('Połączenie WebSocket zostało otwarte');
          resolve(ws);
        };

        ws.onerror = (error) => {
          console.error('Błąd WebSocket:', error);
          reject(error);
        };

        ws.onclose = (event) => {
          console.log('Połączenie WebSocket zostało zamknięte', event);
          reject(new Error('Połączenie WebSocket zostało zamknięte'));
        };

        // Sprawdzanie stanu WebSocket co 100ms
        const timer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            clearInterval(timer);
            console.log('WebSocket jest gotowy do użycia');
          } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            clearInterval(timer);
            console.log('WebSocket jest zamknięty lub w trakcie zamykania');
            reject(new Error('WebSocket jest zamknięty lub w trakcie zamykania'));
          }
        }, 100);
      });
    } catch (error) {
      console.error(
        'Błąd podczas próby uzyskania ID sesji lub łączenia się z serwerem WebSocket:',
        error
      );
      throw error;
    }
  }

  // Główna funkcja
  (async function () {
    try {
      const ws = await connectToServer();

      ws.onopen = () => {
        console.log('Połączenie z serwerem WebSocket zostało nawiązane');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Otrzymano wiadomość:', message);

          if (message.action === 'clearCart') {
            clearCart(); // Wywołanie funkcji opróżniającej koszyk
          }
        } catch (parseError) {
          console.error('Błąd podczas parsowania wiadomości WebSocket:', parseError);
        }
      };

      ws.onclose = () => {
        console.log('Połączenie WebSocket zostało zamknięte');
      };

      ws.onerror = (error) => {
        console.error('Błąd WebSocket:', error);
      };
    } catch (error) {
      console.error('Błąd podczas łączenia z serwerem WebSocket:', error);
    }
  })();
  */

  // Obsługa funkcji Webflow
  window.Webflow ||= [];
  window.Webflow.push(async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectStatus = urlParams.get('redirect_status') ?? '';
      const paymentIntent = urlParams.get('payment_intent') ?? '';
      const storedPaymentIntent = localStorage.getItem('payment_intent') ?? '';

      if (redirectStatus === 'succeeded') {
        if (paymentIntent !== storedPaymentIntent) {
          // Nowe zamówienie: odśwież stronę, jeśli payment_intent jest różny
          localStorage.setItem('payment_intent', paymentIntent);
          setTimeout(() => {
            window.location.reload();
          }, 2000); // Możesz dostosować czas opóźnienia w milisekundach
        } else {
          // Jeśli payment_intent jest ten sam i operacja już została wykonana
          await initializeCart();
        }
      } else {
        // Jeśli redirect_status nie jest 'succeeded', od razu obsłuż koszyk
        await initializeCart();
      }
    } catch (error) {
      console.error('Błąd podczas obsługi Webflow:', error);
    }
  });
};

// Inicjalizacja
init();
