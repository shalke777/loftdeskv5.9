/**
 * Compact reference list of canonical service names for the AI prompt.
 * Selected ~80 most common items across all 20 categories.
 * The AI should prefer these exact names in suggested_estimate_items[].name.
 *
 * Format: "name | unit" — one per line, grouped by trade.
 * Kept compact to avoid bloating the prompt (GPT-4o quality degrades >200 lines).
 */
export const CATALOG_REFERENCE = `
KATALOG NAZW — używaj tych nazw w suggested_estimate_items[].name (lub zbliżonych):

DEMONTAŻE:
Skuwanie starych płytek | m2
Skuwanie tynków i okładzin | m2
Demontaż paneli, parkietu, wykładzin | m2
Demontaż listew przypodłogowych | mb
Demontaż armatury łazienkowej i kuchennej | kpl
Demontaż kabin prysznicowych, wanien, WC, umywalek | kpl
Demontaż drzwi wewnętrznych i ościeżnic | szt
Demontaż osprzętu elektrycznego | szt
Wynoszenie gruzu | m3
Wywóz gruzu i utylizacja odpadów | m3

TYNKI I GŁADZIE:
Tynkowanie maszynowe | m2
Gładzie gipsowe | m2
Szpachlowanie ścian | m2
Szpachlowanie sufitów | m2
Gruntowanie ścian i sufitów | m2

MALOWANIE:
Malowanie ścian | m2
Malowanie sufitów | m2

ZABUDOWY GK:
Ścianki działowe z płyt GK | m2
Sufity podwieszane jednopoziomowe | m2
Zabudowy stelaży WC | kpl
Obudowy wanien | kpl
Obudowy pionów i rur | mb

PODŁOGI:
Wykonywanie wylewek samopoziomujących | m2
Układanie paneli podłogowych | m2
Układanie paneli winylowych | m2
Montaż listew przypodłogowych | mb
Montaż progów | szt

STOLARKA:
Montaż drzwi wewnętrznych | szt
Montaż ościeżnic regulowanych | szt
Montaż parapetów wewnętrznych | szt

ELEKTRYKA:
Nowe punkty elektryczne | szt
Przenoszenie gniazd i włączników | szt
Podłączenie oświetlenia | szt
Montaż osprzętu elektrycznego | szt
Gniazda RTV i internetowe | szt
Podłączenie AGD | szt
Taśmy LED w zabudowach | mb

HYDRAULIKA:
Wykonanie nowych punktów wod-kan | szt
Podejścia pod umywalki, WC, bidet, pralkę, zmywarkę | szt
Podejścia pod wannę i prysznic | szt
Montaż odpływów liniowych | szt
Montaż stelaży podtynkowych | szt
Montaż armatury łazienkowej | kpl
Montaż baterii podtynkowych | szt
Montaż misek WC i bidetów | szt
Montaż umywalek | szt
Montaż wanien | szt
Montaż kabin prysznicowych | szt
Biały montaż sanitarny | kpl
Silikonowanie przy armaturze | mb

GLAZURA:
Układanie płytek podłogowych | m2
Układanie płytek ściennych | m2
Układanie gresu | m2
Fugowanie | m2
Silikonowanie naroży i styków | mb
Układanie płytek wielkoformatowych | m2
Cięcie płytek pod 45 stopni | mb

HYDROIZOLACJA:
Hydroizolacja łazienki | m2
Hydroizolacja strefy prysznica | m2
Izolacja podpłytkowa | m2

BIAŁY MONTAŻ:
Montaż kabin prysznicowych | szt
Montaż szyb walk-in | szt
Montaż zestawów podtynkowych | kpl
Montaż szafek łazienkowych | szt
Montaż luster i szafek z lustrem | szt
Montaż akcesoriów łazienkowych | kpl
Montaż zlewów i baterii kuchennych | szt

NAPRAWY I SERWIS:
Wymiana uszkodzonych płytek | szt
Naprawa fug | mb
Odgrzybianie stref mokrych | m2
`.trim()
