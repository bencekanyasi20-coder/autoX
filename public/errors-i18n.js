/* Translate only application-generated errors, never arbitrary user text. */
(function () {
  'use strict';
  const messages = {
    'Az X-szinkron külön jóváhagyást igényel, mert API-költséget okozhat.': 'X sync requires separate confirmation because it may incur API charges.',
    'Érvénytelen X-azonosító.': 'Invalid X ID.',
    'A program küldés közben állt le. Ellenőrizd X-en, mielőtt újra küldenél.': 'The app stopped while sending. Check X before sending again.',
    'Ez bemutató adat. Lépj ki a demóból és csatlakoztasd az X-fiókodat.': 'This is demo data. Exit the demo and connect your X account.',
    'Előbb csatlakoztasd és szinkronizáld az X-fiókodat.': 'Connect and sync your X account first.',
    'Várd meg a folyamatban lévő X-művelet végét.': 'Wait for the current X operation to finish.',
    'Az X-kulcs másik fiókhoz tartozik. Csatlakoztasd az eredeti fiókot, vagy használj külön adatmappát.': 'The X key belongs to another account. Connect the original account or use a separate data folder.',
    'A küldés szünetel. A Beállításokban indíthatod újra.': 'Sending is paused. Resume it in Settings.',
    'Elérted a helyi napi küldési korlátot.': 'You reached the local daily write limit.',
    'Egy küldés vagy belépés már folyamatban van.': 'Sending or sign-in is already in progress.',
    'Nem található a tervezet.': 'Draft not found.',
    'Ez az elem már elküldött vagy bizonytalan állapotú.': 'This item has already been sent or its outcome is uncertain.',
    'A privát üzenetet az X-en nyisd meg és küldd el.': 'Open and send the direct message on X.',
    'Az X nem adott vissza posztazonosítót. Ellenőrizd X-en.': 'X returned no post ID. Check X.',
    'Már folyamatban van egy frissítés vagy belépés.': 'A sync or sign-in is already in progress.',
    'A bemutató adatokat nem szinkronizáljuk az X-szel.': 'Demo data cannot be synced with X.',
    'Ismeretlen frissítési típus.': 'Unknown sync type.',
    'Másik X-fiókhoz külön adatmappa szükséges. A meglévő adatokat nem írjuk felül.': 'Another X account requires a separate data folder. Existing data will not be overwritten.',
    'Az időpont több mint 15 perce elmúlt. Ellenőrizd, majd küldd el kézzel.': 'The scheduled time passed more than 15 minutes ago. Review it and send manually.',
    'A művelet sikertelen.': 'The operation failed.',
    'JSON kérés szükséges.': 'A JSON request is required.',
    'Túl nagy kérés.': 'Request too large.',
    'JSON objektum szükséges.': 'A JSON object is required.',
    'Érvénytelen JSON kérés.': 'Invalid JSON request.',
    'Érvénytelen helyi cím.': 'Invalid local address.',
    'Más oldalról érkező kérés tiltva.': 'Requests from another site are blocked.',
    'Lejárt vagy érvénytelen X-belépés. Indítsd újra.': 'X sign-in expired or is invalid. Start again.',
    'Az X-belépés nem fejeződött be.': 'X sign-in was not completed.',
    'Nem található.': 'Not found.',
    'Nem támogatott művelet.': 'Unsupported operation.',
    'Frissítsd az oldalt a művelethez.': 'Refresh the page to continue.',
    'Előbb lépj ki a demóból.': 'Exit the demo first.',
    'Add meg az X OAuth Client ID-t a Beállításokban.': 'Enter the X OAuth Client ID in Settings.',
    'Élő fiók helyére nem tölthető demó.': 'Demo data cannot replace a live account.',
    'Nincs aktív demó.': 'No demo is active.',
    'Adj meg keresést.': 'Enter a search query.',
    'Várd meg a belépés végét.': 'Wait for sign-in to finish.',
    'Érvénytelen X felhasználónév.': 'Invalid X username.',
    'Add meg az OpenAI-kulcsot a Beállításokban.': 'Enter your OpenAI key in Settings.',
    'Adj meg egy kérést.': 'Enter a request.',
    'Egy követési művelet vagy belépés folyamatban van.': 'A follow operation or sign-in is in progress.',
    'A követési művelet hiányzik.': 'The follow action is missing.',
    'Nem található a válasz.': 'Reply not found.',
    'Érvénytelen állapot.': 'Invalid status.',
    'Várd meg a folyamatban lévő küldést a sor szerkesztése előtt.': 'Wait for sending to finish before editing the queue.',
    'Írj szöveget a tervezethez.': 'Enter text for the draft.',
    'Érvénytelen tervezettípus.': 'Invalid draft type.',
    'Adj meg X felhasználónevet vagy azonosítót a DM-hez.': 'Enter an X username or ID for the direct message.',
    'A DM küldése kézi művelet.': 'Direct messages must be sent manually.',
    'Jövőbeli időpontot adj meg.': 'Enter a future date and time.',
    'Bemutató adatokkal nem időzíthető élő küldés.': 'Live sending cannot be scheduled with demo data.',
    'Ezt az elemet már nem lehet módosítani.': 'This item can no longer be edited.',
    'Várd meg a folyamatban lévő küldés végét.': 'Wait for sending to finish.',
    'Nem található az elem.': 'Item not found.',
    'Folyamatban lévő küldés nem módosítható.': 'An item being sent cannot be edited.',
    'Elküldött vagy bizonytalan elemet nem lehet új küldésre visszaállítani. Előbb ellenőrizd az X-et.': 'A sent or uncertain item cannot be reset for sending again. Check X first.',
    'Ismeretlen művelet.': 'Unknown operation.',
    'Érvénytelen gyűjtemény.': 'Invalid collection.',
    'Érvénytelen elem.': 'Invalid item.',
    'Túl nagy elem.': 'Item too large.',
    'A képfeltöltés nem érhető el.': 'Image upload is unavailable.',
    'Várd meg a folyamatban lévő feltöltést vagy belépést.': 'Wait for the upload or sign-in to finish.',
    'PNG/JPEG/WebP kép szükséges.': 'A PNG, JPEG or WebP image is required.',
    'A Windows kulcstároló nem indítható.': 'The Windows credential store could not be started.',
    'A Windows kulcstároló művelete sikertelen.': 'The Windows credential store operation failed.',
    'A mentett kulcsok Windows alatt olvashatók.': 'Saved keys can only be read on Windows.',
    'Tartós kulcsmentéshez Windows szükséges.': 'Windows is required to save keys persistently.'
  };
  function translate(message, language) {
    if (language !== 'en' || typeof message !== 'string') return message;
    if (Object.hasOwn(messages, message)) return messages[message];
    // Enumerate server-owned keys; arbitrary suffixes must never be rewritten.
    const setting = /^Érvénytelen beállítás: (language|goal|syncMinutes|dailyWriteLimit|style|model|niche|paused|xClientId|xClientSecret|xAccessToken|openaiKey)$/.exec(message);
    if (setting && setting[0] === message) return 'Invalid setting: ' + setting[1];
    return message;
  }
  window.XautoErrors = Object.freeze({ translate });
})();
