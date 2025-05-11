import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import ImageEditor from '@uppy/image-editor';
import Transloadit from '@uppy/transloadit';
import type { AssemblyResponse } from '@uppy/transloadit';
import type {Member} from '../memberstack';

type Locale = {
    strings: {
        [key: string]: string | { [key: string]: string };
    };
    pluralize: (n: number) => number;
};

declare global {
    interface Window {
        encodedImages: Array<{ ssl_url: string }>;
        pl_PL?: Locale; // Optional as it may be loaded dynamically
    }
}

window.encodedImages = [];

// Funkcja do wstrzykiwania CSS
function injectUppyCSS() {
    const cssLink = document.createElement('link');
    cssLink.href = 'https://releases.transloadit.com/uppy/v3.21.0/uppy.min.css';
    cssLink.rel = 'stylesheet';
    cssLink.type = 'text/css';
    document.head.appendChild(cssLink);
}

// Funkcja do formatowania liczby zdjęć
function formatujLiczbeZdjec(liczba: number, translations: Record<string, string>): string {
    if (liczba === 1) return translations.photosOne;
    if ([2, 3, 4].includes(liczba % 10) && ![12, 13, 14].includes(liczba % 100)) return `${liczba} ${translations.photosFew}`;
    return `${liczba} ${translations.photosMany}`;
}

// Funkcja inicjalizująca Uppy
export async function initializeUppy(memberData: Member, translations: Record<string, string>) {
    try {
        const form = document.getElementById('wf-form-Wycena') as HTMLFormElement;
        if (!form) {
            console.error('Form with id "wf-form-Wycena" not found');
            return;
        }

        injectUppyCSS();

        const response = await fetch('https://cdn.prod.website-files.com/671f56de2f5de134f0f39123/674b3353713557a76c180971_pl_PL.txt');
        let jsCode = await response.text();

        jsCode = jsCode.replace('export default', '');

        // Evaluate the script and explicitly assign `pl_PL` to `window.pl_PL`
        const scriptFunction = new Function(`${jsCode}; window.pl_PL = pl_PL;`);
        scriptFunction();

        if (typeof window.pl_PL !== 'undefined') {
            const browseId = `browse`;
            const browseElement = form.querySelector('.upload-images') as HTMLElement;

            if (browseElement) browseElement.id = browseId;

            const uppy = new Uppy({
                //debug: true,
                restrictions: {
                    maxNumberOfFiles: 25,
                },
                locale: window.pl_PL,
            })
                .use(Transloadit, {
                    waitForEncoding: true,
                    alwaysRunAssembly: true,
                    assemblyOptions: {
                        params: {
                            template_id: 'd88626a621bc4fe2a136a53fa515c378',
                            auth: {
                                key: 'OIsmHgSeU6rCebQH27EytZunhvrf2CZb',
                            },
                        },
                    },
                })
                .use(Dashboard, {
                    trigger: `#${browseId}`,
                    proudlyDisplayPoweredByUppy: false,
                    closeModalOnClickOutside: true,
                })
                // @ts-ignore
                .use(ImageEditor, {target: Dashboard})
                .on('complete', ({ transloadit }) => {
                    // @ts-ignore
                    transloadit.forEach((assembly: AssemblyResponse) => {
                        if (assembly.results && assembly.results['compressed-image']) {
                            window.encodedImages = window.encodedImages.concat(assembly.results['compressed-image']);

                            const uploadText = form.querySelector('.upload-quantity') as HTMLElement;
                            if (uploadText) {
                                uploadText.textContent = formatujLiczbeZdjec(window.encodedImages.length, translations);
                            }
                        }
                    });
                })
                .on('error', (error: Error) => {
                    console.error(error.message);
                });
            setupFormSubmission(form, memberData);
        } else {
            console.error('pl_PL is not defined');
        }
    } catch (error) {
        console.error('Błąd podczas ładowania pliku locale:', error);
    }
}

// Obsługa wysyłania formularza
function setupFormSubmission(form: HTMLFormElement, memberData: Member) {
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const formData = new FormData(form);
        const encodedImages = window.encodedImages;

        console.log('Encoded Images:', encodedImages);

        const imageUrls = encodedImages.map((image) => image.ssl_url).join(',');
        formData.append('imageUrls', imageUrls);
        formData.append('memberData', JSON.stringify(memberData));
        formData.forEach((value, key) => {
            console.log(`${key}:`, value);
        });

        const action = 'https://hook.eu2.make.com/ey0oofllpglvwpgbjm0pw6t0yvx37cnd';

        fetch(action, {
            method: 'POST',
            body: formData,
        })
            .then((response) => {
                if (response.ok) {
                    console.log('Formularz został wysłany pomyślnie');
                    form.style.display = 'none';
                    const successMessage = form.parentElement?.querySelector('.w-form-done') as HTMLElement;
                    if (successMessage) successMessage.style.display = 'block';
                } else {
                    console.error('Wystąpił błąd podczas wysyłania formularza');
                    const errorMessage = form.parentElement?.querySelector('.w-form-fail') as HTMLElement;
                    if (errorMessage) errorMessage.style.display = 'block';
                }
            })
            .catch((error) => {
                console.error('Wystąpił błąd:', error);
                const errorMessage = form.parentElement?.querySelector('.w-form-fail') as HTMLElement;
                if (errorMessage) errorMessage.style.display = 'block';
            });
    });
}
