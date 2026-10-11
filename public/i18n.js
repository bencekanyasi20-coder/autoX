'use strict';
// Only source literals enter this dictionary. Interpolated posts, names and drafts
// are joined afterwards by html(), so saved content is never translated.
(() => {
  const pairs = `
Közzététel most: azonnali küldés megerősítéssel. Mentés a sorba: piszkozat vagy időzítés.|Publish now: immediate sending after confirmation. Save to queue: draft or scheduled post.
Közzététel most|Publish now
Élő közzétételhez csatlakoztasd a saját X-fiókodat.|Connect your own X account before publishing.
Most közzéteszed az X-en? Ez élő, fizetős API-művelet lehet.|Publish on X now? This is a live API action and may incur charges.
Azonnali közzétételhez töröld az időzítést.|Clear the scheduled time to publish now.
Az első 100 találat látható. Nincs automatikus továbblapozás; szűkítsd a keresést a további API-költségek korlátozásához.|Showing the first 100 results. No automatic pagination; narrow your search to limit further API costs.
Lekéred az X aktuális adatait? Ez fizetős API-kéréseket indíthat. Egy teljes szinkron több tucat lapozott kérést is jelenthet.|Fetch current data from X? This may incur API charges. One full sync may make dozens of paginated requests.
X-adatok frissítése: kizárólag kézzel, külön jóváhagyással. Az oldal megnyitása és a felső Frissítés gomb csak helyi adatokat olvas.|X data sync: manual only, with separate confirmation. Opening the app and the top Refresh button only read saved local data.
A bejegyzések betöltődtek. Néhány hivatkozott poszt adata hiányos lehet az X válaszában; a válaszok és újraközlések besorolása emiatt pontatlan lehet.|Posts have loaded. Some referenced post details may be missing from X's response, so reply and repost classification may be inaccurate.
Áttekintés|Overview
Analitika|Analytics
Követők|Followers
Válaszok|Replies
Küldési sor|Queue
Minták|Patterns
Leadlista|Leads
Beállítások|Settings
Export és MCP|Export and MCP
Várakozó|Waiting
Piszkozatok|Drafts
Piszkozat|Draft
Megválaszolt|Replied
Kihagyott|Ignored
Időzítve|Scheduled
Küldés alatt|Sending
Elküldve|Sent
Bizonytalan|Uncertain
Sikertelen|Failed
Megkeresve|Contacted
Releváns|Qualified
Ügyfél|Customer
Lezárt|Closed
Új|New
Nincs időpont|No date
Neve nem érhető el|Name unavailable
Ismeretlen szerző|Unknown author
A kiszolgáló nem értelmezhető választ adott.|The server returned an unreadable response.
Kérés sikertelen (|Request failed (
Mentve a helyi munkatérben.|Saved in the local workspace.
A helyi állapot újraolvasása is sikertelen:|Reloading the local state also failed:
Bejegyzések|Posts
Követettek|Following
Az X-adatok frissítése sikertelen.|X data refresh failed.
A mentett adatok hiányosak vagy elavultak lehetnek.|Saved data may be incomplete or outdated.
Az X API-kredit hiányzik vagy elfogyott. Ellenőrizd az X fejlesztői konzol számlázását és kreditegyenlegét, majd indíts kézi szinkronizálást.|X API credit is missing or exhausted. Check billing and your credit balance in the X developer console, then run a manual sync.
MUNKATÉR|WORKSPACE
Személyes munkatér|Personal workspace
Mintaadatok · demó|Sample data · demo
X-fiók még nincs csatlakoztatva|X account not connected yet
Mintaadatok|Sample data
Szüneteltetve|Paused
X csatlakoztatva|X connected
Helyi mód|Local mode
Automatizálás folytatása|Resume automation
Automatizálás szüneteltetése|Pause automation
Háttérművelet hibája:|Background operation failed:
Demó · szintetikus mintaadatok. A profilok és bejegyzések nem valósak; az élő X-hivatkozások és műveletek a demóban nem használhatók.|Demo · synthetic sample data. Profiles and posts are fictional; live X links and actions are unavailable in the demo.
Szintetikus minta; nincs hozzá valós X-bejegyzés.|Synthetic sample; no real X post exists for it.
Időszak|Period
naphoz képest|days
az előző|compared with the previous
Előző időszak: nincs összevethető adat|Previous period: no comparable data
Megtekintések|Impressions
Interakciós arány|Engagement rate
Új követők egyenlege|Net new followers
Publikált bejegyzések|Published posts
A megtekintési grafikonhoz még nincs elérhető adat. Csatlakoztasd és frissítsd az X-fiókodat.|No impression data is available for the chart yet. Connect and sync your X account.
A publikálási napokra összesített megtekintések|Impressions grouped by publication date
megtekintés|impressions
Az aktuális célod|Your current goal
ELÉRÉS ·|REACH ·
NAP|DAYS
% teljesítve|% complete
Még nincs mérhető haladás|No measurable progress yet
Cél szerkesztése|Edit goal
Válaszra vár|Awaiting reply
Időzített bejegyzések|Scheduled posts
Következő lépés|Next step
Nézd át a beérkezett válaszokat|Review incoming replies
Írd meg a következő bejegyzésed|Write your next post
Bejegyzés megnyitása X-en|Open post on X
Megtekintés|Impressions
Interakció|Engagement
Arány|Rate
Itt jelennek meg a bejegyzéseid|Your posts will appear here
Frissítsd a saját posztjaidat az X-kapcsolat beállítása után.|Sync your posts after connecting your X account.
Szinkronizálás|Sync
Egy jó nap a növekedéshez.|A good day to grow.
A fiókod, a beszélgetéseid és a következő ötleted.|Your account, your conversations and your next idea.
Minden egy helyen. A saját gépeden.|Everything in one place. On your computer.
Csatlakoztasd az X-fiókodat, vagy ismerd meg a felületet jelölt mintaadatokkal.|Connect your X account or explore the workspace with clearly marked sample data.
X-kapcsolat beállítása|Set up X connection
Mintaadatok kipróbálása|Try sample data
Mintaadatokat látsz. Ezek nem a saját fiókod eredményei.|You are viewing sample data. These are not your account results.
Kilépés a demóból|Exit demo
Elérés áttekintése|Reach overview
A publikálási naponként összesített aktuális metrika; nem az adott napon keletkezett elérés. A hiányzó adatot — jelöli.|Current cumulative metrics grouped by publication date; not reach earned on that date. Missing data is shown as —.
Hogyan teljesítenek a bejegyzéseid?|How are your posts performing?
Legjobb bejegyzések|Top posts
Összes elemzése|Analyze all
Értsd meg, mi működik a közönségednél.|Understand what works for your audience.
Megtekintések időben|Impressions over time
UTC publikálási napokra csoportosított aktuális összesített metrikák. A hiányzó megtekintések nem nullák.|Current cumulative metrics grouped by UTC publication date. Missing impressions are not zero.
Bejegyzések teljesítménye|Post performance
Rendezés|Sort by
Publikálási időminták|Publication time patterns
A mentett bejegyzésekből számítva, UTC szerint. Kis mintánál ez támpont.|Calculated from saved posts in UTC. Small samples offer guidance only.
poszt|posts
Még nincs időminta|No time patterns yet
A saját bejegyzések frissítése után jelenik meg.|Available after syncing your posts.
Valódi kapcsolatok. Átlátható változások.|Real connections. Clear changes.
Kölcsönös|Mutual
Nem követ vissza|Not following back
Változások|Changes
Keresés név vagy felhasználónév alapján|Search by name or username
Követők szűrése|Filter followers
Az első teljes letöltés alapállapotot rögzít. Követővesztés csak ismételt, teljes ellenőrzés után jelenik meg.|The first complete sync establishes a baseline. Lost followers appear only after repeated complete checks.
Kapcsolati változások|Relationship changes
Kapcsolatok|Connections
Mind olvasottnak jelölése|Mark all as read
Követni kezdett|Started following
Már nem követ|No longer following
· új|· new
Még nincs változás|No changes yet
A következő teljes szinkronizálások összehasonlításából készül a napló.|The log compares subsequent complete syncs.
követő|followers
Kikövetés|Unfollow
Követés|Follow
Nincs megjeleníthető kapcsolat|No connections to display
Frissítsd a követőlistádat, vagy válassz másik szűrőt.|Sync your followers or choose another filter.
Beszélgetés:|Conversation:
eredeti szál megnyitása|open original thread
Megnyitás X-en|Open on X
Válaszod|Your reply
Írj személyes, hasznos választ…|Write a personal, helpful reply…
Piszkozat mentése|Save draft
AI-javaslat|AI suggestion
Küldési sorba|Add to queue
Kihagyás|Ignore
Vissza a várakozókhoz|Back to waiting
Beszélgetések, amik számítanak.|Conversations that matter.
Válaszolj átgondoltan, a saját hangodon.|Reply thoughtfully, in your own voice.
Kérdések összegzése|Summarize questions
Összes|All
Tiszta a postaládád|Your inbox is clear
A frissítés betölti az elérhető említéseket. A beszélgetések teljes mélysége az X API-hozzáférésedtől függ.|Sync loads available mentions. Conversation depth depends on your X API access.
Választervezet|Reply draft
Kapcsolódj a beszélgetéshez…|Join the conversation…
AI-válasz|AI reply
Válasz a sorba|Queue reply
Inspiráció mentése|Save inspiration
Lead mentése|Save lead
Találd meg a következő beszélgetést.|Find your next conversation.
Keress témára, kérdésre vagy azokra, akiknek segíthetsz.|Search for a topic, a question or people you can help.
Keresés az X-en|Search X
Keresőkifejezés|Search query
Például:|For example:
Keresés|Search
Nyelv|Language
Bármely nyelv|Any language
Magyar|Hungarian
Angol|English
Német|German
Elérhető friss bejegyzések|Available recent posts
Elmúlt nap|Past day
Elmúlt 3 nap|Past 3 days
Elmúlt 7 nap|Past 7 days
Válaszok kizárása|Exclude replies
Már megválaszoltak elrejtése|Hide already replied
Mentett keresések|Saved searches
Aktuális keresés mentése|Save current search
Keresés törlése|Delete search
Mentsd el a témákat, amelyekhez gyakran visszatérsz.|Save topics you return to often.
találat ·|results ·
Nem találtunk bejegyzést|No posts found
Próbálj tágabb keresést, vagy ellenőrizd a hozzáférést.|Try a broader search or check your access.
A jó kapcsolat egy beszélgetéssel kezdődik.|A good connection starts with a conversation.
A keresés akkor indul, amikor megnyomod a Keresés gombot.|Search starts when you press Search.
Mentett elem|Saved item
Törlés|Delete
Eredeti bejegyzés|Original post
Szerkesztés a Studioban|Edit in Studio
A könyvtárad még üres|Your library is empty
Ments inspirációt az Engage találatai közül, vagy adj hozzá saját anyagot.|Save inspiration from Engage results or add your own material.
Az ötlettől a következő posztig.|From idea to your next post.
Írj, finomíts és tervezz a saját hangodon.|Write, refine and plan in your own voice.
OpenAI csatlakoztatva|OpenAI connected
AI-kulcs nincs beállítva|AI key not configured
Íróasztal|Writing desk
Mit szeretnél megírni?|What would you like to write?
Egy rövid bejegyzés arról, amit ma tanultam a terméképítésről…|A short post about what I learned today while building a product…
Formátum|Format
Bejegyzés|Post
Válasz|Reply
Átírás|Rewrite
Ötletek|Ideas
Termékkontextus|Product context
Nincs kiválasztva|None selected
Termék|Product
Tervezet készítése|Create draft
Szerkeszthető tervezet|Editable draft
Írj ide saját szöveget, vagy készíts AI-tervezetet…|Write your own text here or generate an AI draft…
Mentés inspirációként|Save as inspiration
Másolás|Copy
karakter|characters
A te hangod|Your voice
Még nincs megadva stílusleírás. Írd le, hogyan fogalmazol, kinek írsz és mit szeretnél kerülni.|No style description yet. Describe how you write, who you write for and what to avoid.
Stílus beállítása|Set your style
A kontextus számít.|Context matters.
A saját stílusod, a mentett inspirációk és a kiválasztott termék segítik a tervezetet. Küldés előtt mindig átnézheted.|Your style, saved inspiration and selected product guide the draft. You can always review it before sending.
Termék vagy szolgáltatás|Product or service
Név|Name
A terméked neve|Your product name
Mit kínálsz, és kinek?|What do you offer, and to whom?
Probléma, megoldás, célközönség, hivatkozás…|Problem, solution, audience, link…
Termék mentése|Save product
Inspirációs könyvtár|Inspiration library
Mentett termékek|Saved products
Mentett írói munkamenetek és kérdéscsoportok|Saved writing sessions and question groups
Típus|Type
Új bejegyzés|New post
Privát üzenet · kézi küldés|Direct message · manual send
Címzett / bejegyzésazonosító|Recipient / post ID
Válaszhoz poszt ID, DM-hez @felhasználónév|Post ID for replies, @username for DMs
Szöveg|Text
Mi jár a fejedben?|What is on your mind?
Időzítés (opcionális)|Schedule (optional)
A helyi gépnek és az alkalmazásnak futnia kell.|Your computer and the application must be running.
Feltöltött médiaazonosítók|Uploaded media IDs
Opcionális X média ID, vesszővel elválasztva|Optional X media IDs, separated by commas
Legfeljebb 4 kép; DM-nél kézzel csatold az X-en.|Up to 4 images; attach DM images manually on X.
Kép csatolása|Attach image
Kép feltöltése az X-re|Upload image to X
PNG, JPEG vagy WebP · legfeljebb 5 MB|PNG, JPEG or WebP · up to 5 MB
Mentés a sorba|Save to queue
Új tervezet|New draft
Piszkozatot mentünk. Időzítéshez külön jóváhagyást kérünk.|A draft will be saved. Scheduling requires separate approval.
Privát üzenet|Direct message
Időzítés:|Scheduled:
csatolt kép|attached images
Másold a szöveget, nyisd meg az X-et, válaszd ki a címzettet, és illeszd be az üzenetet.|Copy the text, open X, select the recipient and paste your message.
Ellenőrizd az X-en, megjelent-e. A program nem próbálja újra automatikusan.|Check X to see whether it was published. The app will not retry automatically.
Szöveg másolása|Copy text
Szerkesztés|Edit
Küldés most|Send now
Elküldöttként jelölés|Mark as sent
Időzítés törlése|Cancel schedule
Minden gondolatnak legyen jó időzítése.|Give every idea the right timing.
Automatizálás szünetel|Automation paused
Helyi időzítő|Local scheduler
Az időzített posztot és választ a futó program küldi. A privát üzenetet az X-en tudod elküldeni; a szöveg másolható.|Scheduled posts and replies are sent while the app runs. Send direct messages on X; you can copy their text.
A sorod még üres|Your queue is empty
Ments egy tervezetet itt, vagy küldd át a Studio és a Válaszok felületről.|Save a draft here or add one from Studio or Replies.
Figyelj meg. Tanulj. Alakítsd a sajátodra.|Observe. Learn. Make it your own.
Nyilvános fiókok és saját tartalmak mintái.|Patterns from public accounts and your own content.
Fiók elemzése|Analyze account
X felhasználónév|X username
@felhasználónév|@username
Elemzés betöltése|Load analysis
Saját posztjaim elemzése|Analyze my posts
Nyilvános posztokat kér le. AI-értelmezés külön gombbal indítható.|Loads public posts. Start AI interpretation with a separate button.
Fiók|Account
· minták|· patterns
bejegyzés|posts
Tekintsd át a bejegyzéseket, vagy kérj AI-összefoglalót a hangnemről, témákról és nyitómondatokról.|Review the posts or request an AI summary of tone, topics and opening lines.
Minták összefoglalása|Summarize patterns
Elemzés mentése|Save analysis
Kinek a tartalmából tanulnál?|Whose content would you like to learn from?
Írj be egy nyilvános felhasználónevet. Az elérhető adatok az X-hozzáférésedtől függnek.|Enter a public username. Available data depends on your X access.
Mentett elemzések|Saved analyses
Kapcsolatokból lehetőségek.|Turn connections into opportunities.
Nyilvános beszélgetésekből mentett kapcsolatok és saját jegyzeteid.|Contacts saved from public conversations, with your own notes.
Új kapcsolat|New contact
Jegyzet|Notes
Miért releváns? Mi legyen a következő lépés?|Why are they relevant? What is the next step?
Kapcsolat mentése|Save contact
Státusz|Status
Mentés|Save
DM tervezet|DM draft
Még nincs mentett kapcsolat|No saved contacts yet
Az Engage találatoknál menthetsz szerzőket, vagy felvehetsz saját kapcsolatot.|Save authors from Engage results or add your own contacts.
A saját munkatér, a saját ritmusod.|Your workspace, your own pace.
X-kapcsolat|X connection
Nincs csatlakoztatott fiók|No connected account
Csatlakoztatva|Connected
Nincs kapcsolat|Not connected
OAuth Client Secret (ha szükséges)|OAuth Client Secret (if required)
Üresen hagyva változatlan|Leave blank to keep unchanged
Felhasználói Access Token (opcionális)|User Access Token (optional)
Felhasználói jogosultságú token szükséges; alkalmazás-bearer önmagában nem elég.|A user-authorized token is required; an app-only bearer token is insufficient.
Kapcsolati beállítások mentése|Save connection settings
X-fiók csatlakoztatása|Connect X account
Gyors beállítás|Quick setup
Az <a|On the <a
X Developer felületén|X Developer console
engedélyezd az OAuth 2.0 felhasználói hozzáférést.|enable OAuth 2.0 user access.
Add meg ezt a visszahívási címet:|Set this callback URL:
Mentsd a Client ID-t, majd kattints a csatlakoztatásra.|Save the Client ID, then click Connect.
Engedélyezés után az Áttekintésen indíts szinkronizálást.|After authorization, run a sync on Overview.
Az elérhető végpontokat és díjakat a saját X API-csomagod határozza meg.|Available endpoints and fees depend on your X API plan.
Automatizálás|Automation
Engedélyezve|Enabled
Szünet|Paused
Aktív|Active
Az időzített küldéshez a gépnek és ennek a programnak futnia kell. A szüneteltetés az időzített küldést állítja meg. X-adatfrissítés csak kézzel indul.|Your computer and this app must be running for scheduled sends. Pausing stops scheduled sends. X data sync is manual only.
OpenAI és saját stílus|OpenAI and your style
API-kulcs|API key
Beállítva|Configured
Nincs beállítva|Not configured
OpenAI API-kulcs|OpenAI API key
Modell|Model
Saját stílusleírás|Your writing style
Kinek írsz? Hogyan fogalmazol? Mit kerüljön a javaslat?|Who do you write for? How do you write? What should suggestions avoid?
AI-beállítások mentése|Save AI settings
Az AI-kérés a gombra kattintva, jóváhagyás után indul. A saját OpenAI-fiókodban költsége lehet.|AI requests start after you click and approve. They may incur charges in your OpenAI account.
Célok és korlátok|Goals and limits
Eléréscél a kiválasztott időszakra|Reach goal for the selected period
Háttérfrissítés (perc)|Background sync (minutes)
0 = csak kézi; automatikusan minimum 5 perc. Az API-használatnak költsége lehet.|0 = manual only; automatic sync uses at least 5 minutes. API usage may incur charges.
Napi API-küldési korlát|Daily API send limit
Célok mentése|Save goals
Helyi adatok|Local data
Az adatok és a szerveroldali titkok a saját gépeden maradnak. A kulcsokat a felület nem olvassa vissza.|Data and server-side secrets stay on your computer. The interface never reads keys back.
Adatkönyvtár:|Data directory:
Adatok exportálása|Export data
Kilépés a mintaadatokból|Exit sample data
Adataid, szabadon.|Your data, freely available.
Helyi export és olvasási hozzáférés a mentett munkatérhez.|Local export and read access to your saved workspace.
Munkatér exportálása|Export workspace
A JSON a teljes mentett munkateret, a CSV a bejegyzések elérhető metrikáit tartalmazza. A titkos kulcsok nem részei az exportnak.|JSON contains the entire saved workspace; CSV contains available post metrics. Secret keys are excluded from exports.
JSON letöltése|Download JSON
Bejegyzések CSV|Posts CSV
beérkezett elem|inbox items
elem a küldési sorban|queued items
A hiányzó metrikák az exportban is hiányzó adatok.|Missing metrics remain missing in exports.
Piszkozatokkal és feldolgozási státusszal.|Includes drafts and processing status.
A bizonytalan küldések állapota is megmarad.|Uncertain send status is preserved too.
Helyi MCP · csak olvasás|Local MCP · read only
Az MCP-felület a helyben mentett adatok olvasására szolgál. A csatlakozás pontos indítóparancsát az alkalmazás README-je tartalmazza.|The MCP interface reads locally saved data. See the application README for the exact connection command.
Meglévő adatokra támaszkodik|Uses existing data
Az elemzések frissessége az utolsó sikeres szinkronizálástól függ. Az MCP nem indít önálló küldést.|Analysis freshness depends on the last successful sync. MCP does not initiate sends.
Analitika és bejegyzések|Analytics and posts
Időszakok, rangsorok és rendelkezésre álló metrikák.|Periods, rankings and available metrics.
Kapcsolatok és válaszok|Contacts and replies
Mentett állapot, változásnapló és munkalista.|Saved state, change log and work list.
A mentett piszkozatok és időzítések szövege.|Text of saved drafts and scheduled items.
Előbb add meg az OpenAI API-kulcsot a Beállításokban.|First add your OpenAI API key in Settings.
AI-javaslat készítése az OpenAI API-val? Ez a saját API-fiókodban költséget jelenthet.|Generate an AI suggestion using the OpenAI API? This may incur charges in your API account.
Írj szöveget a tervezetbe.|Enter some text in the draft.
Tervezet mentve a küldési sorba.|Draft saved to the queue.
Mintaadatok betöltve. Ezek szintetikus adatok.|Sample data loaded. These are synthetic data.
Kilépsz a demóból? A mintaadatokat eltávolítjuk; ezután saját fiókot csatlakoztathatsz.|Exit the demo? Sample data will be removed; you can then connect your account.
Üres saját munkatér megnyitva.|Opened your empty personal workspace.
Szinkronizálás befejezve.|Sync complete.
Élő X-művelet:|Live X action:
követed|follow
kiköveted|unfollow
ezt a fiókot?|this account?
Kapcsolat módosítva.|Connection updated.
Nincs feldolgozásra váró kérdés.|No questions are awaiting processing.
Csoportosítsd a beérkezett kérdéseket témánként. Minden csoporthoz adj rövid, szerkeszthető válaszmintát. A termékkontextust csak releváns esetben használd; ne találj ki állításokat.|Group incoming questions by topic. Give each group a short, editable sample reply in English. Use product context only when relevant; do not invent claims.
Beérkezett kérdések ·|Incoming questions ·
Írj egy hasznos, személyes választ a bejegyzésre. Ha van tervezet, finomítsd.|Write a helpful, personal reply to the post in English. Refine the draft if one exists.
Válasz elmentve.|Reply saved.
Jóváhagyod ennek a bejegyzésnek vagy válasznak az azonnali, élő elküldését az X-en?|Approve sending this post or reply live on X immediately?
Ellenőrizted az X-en, hogy ezt az elemet már elküldted?|Have you checked X to confirm this item has already been sent?
Törlöd ezt az elemet a helyi küldési sorból?|Delete this item from the local queue?
Küldési művelet feldolgozva. Ellenőrizd az elem állapotát.|Send action processed. Check the item status.
Küldési sor frissítve.|Queue updated.
Szöveg másolva.|Text copied.
Meglévő tervezet szerkesztése. A mentés ezt az elemet frissíti.|Editing an existing draft. Saving will update this item.
Új piszkozatot mentünk. Időzítéshez külön jóváhagyást kérünk.|A new draft will be saved. Scheduling requires separate approval.
Válassz ki egy képet.|Select an image.
Legfeljebb 5 MB méretű PNG, JPEG vagy WebP kép tölthető fel.|Upload a PNG, JPEG or WebP image up to 5 MB.
A DM-hez az X-en csatold a képet.|Attach the image to the DM on X.
Legfeljebb 4 kép csatolható.|You can attach up to 4 images.
Feltöltöd ezt a képet az X-fiókod médiatárába? Ez élő X API-művelet.|Upload this image to your X account media library? This is a live X API action.
Feltöltés folyamatban…|Uploading…
A képfájl nem olvasható.|The image file could not be read.
A feltöltés nem adott médiaazonosítót.|The upload returned no media ID.
Feltöltve:|Uploaded:
Kép csatolva a tervezethez.|Image attached to the draft.
A feltöltés sikertelen. Válassz képet és próbáld újra.|Upload failed. Select an image and try again.
A tervezet még üres.|The draft is still empty.
Saját tervezet|My draft
Írj érdemi választ. Kapcsolódj a bejegyzéshez, ne reklámozz kéretlenül.|Write a meaningful reply in English. Relate to the post; do not advertise unsolicited.
Inspiráció|Inspiration
A szerző adatai nem érhetők el ehhez a találathoz.|Author details are unavailable for this result.
Előbb adj meg keresőkifejezést.|Enter a search query first.
Törlöd a mentett elemet?|Delete the saved item?
Elemezd a fiók bejegyzéseinek témáit, hangnemét, nyitómondat-típusait és beszélgetési mintáit. Csak a kapott adatból következtess; adj adaptálható ötleteket.|Analyze the topics, tone, opening line types and conversation patterns in this account's posts. Infer only from the supplied data; suggest adaptable ideas in English.
Előbb készíts összefoglalót az elemzéshez.|Generate an analysis summary first.
Fiókelemzés|Account analysis
Folytatod a jóváhagyott időzített küldéseket?|Resume approved scheduled sends?
Automatizálás folytatva.|Automation resumed.
Időzített küldés szüneteltetve.|Scheduled sends paused.
A DM kézi küldésű, ezért nem időzíthető.|DMs are sent manually and cannot be scheduled.
Válassz jövőbeli időpontot.|Choose a future date and time.
A válaszhoz számból álló X-bejegyzésazonosító szükséges.|Replies require a numeric X post ID.
Add meg a DM címzettjét.|Enter the DM recipient.
Jóváhagyod az automatikus élő X-küldést ekkor:|Approve automatic live sending on X at:
? A programnak futnia kell.|? The application must be running.
Jóváhagyott időzítés elmentve.|Approved schedule saved.
Piszkozat elmentve.|Draft saved.
Engedélyezed az automatikus háttérfrissítést? Ez X API-kéréseket indít, amelyeknek költsége lehet.|Enable automatic background sync? It makes X API requests that may incur charges.
Beállítások elmentve.|Settings saved.
Ez szintetikus mintaadat. Saját X-hivatkozásokhoz lépj ki a demóból és csatlakoztasd a fiókodat.|These are synthetic sample data. Exit the demo and connect your account to use your own X links.
Helyi adatok frissítve.|Local data refreshed.
A munkatér nem tölthető be|Could not load workspace
Ellenőrizd, hogy a helyi kiszolgáló fut-e.|Check that the local server is running.
Újrapróbálás|Retry
nap|days
Ugrás a tartalomhoz|Skip to content
autoX kezdőlap|autoX home
SZEMÉLYES MUNKATÉR|PERSONAL WORKSPACE
Fő navigáció|Main navigation
Helyben, a saját gépeden|Locally, on your computer
Munkatér|Workspace
Helyi adatok újraolvasása|Reload local data
Frissítés|Refresh
Munkatér betöltése…|Loading workspace…
privát béta|private beta
Használati útmutató|User guide
Te döntesz minden küldésről.|You decide every send.
Személyes X munkatér: analitika, kapcsolatok, válaszok és tartalomtervezés helyben.|Personal X workspace: local analytics, connections, replies and content planning.
`.trim().split('\n').map(line => { const separator=line.indexOf('|'); return [line.slice(0,separator),line.slice(separator+1)]; });
  const dictionary = Object.fromEntries(pairs);
  const pattern = new RegExp('(?<![\\p{L}\\p{N}_])(?:' + pairs.map(([key]) => key).sort((a,b)=>b.length-a.length).map(key=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')(?![\\p{L}\\p{N}_])', 'gu');
  let language = 'hu';
  function translate(source) { return language === 'en' ? String(source).replace(pattern, match=>dictionary[match]) : String(source); }
  function html(parts, ...values) { return parts.reduce((result, part, i)=>result+translate(part)+(i<values.length?values[i]:''), ''); }
  function setLanguage(value) { language=value==='en'?'en':'hu'; }
  window.XautoI18n = {translate, html, setLanguage, get language(){return language;}, get locale(){return language==='en'?'en-US':'hu-HU';}, dictionary};
})();
