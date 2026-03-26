// =============================================================================
// Bathroom Task Library v3 -- domain-specific positions for bathroom renovation
// =============================================================================

export type TaskPriority = 'required' | 'likely' | 'conditional' | 'optional'
export type ScopeGroup = 'required' | 'likely' | 'confirmation_needed' | 'optional'
export type LaborOrMaterial = 'labor' | 'material' | 'both'

export interface BathroomTask {
  id: string
  name: string
  category: string
  unit: string
  priority: TaskPriority
  when: string
  dependsOn?: string[]
  scopeGroup: ScopeGroup
  confirmationQuestion?: string
  appliesWhen?: string
  notApplicableWhen?: string
  laborOrMaterial?: LaborOrMaterial
  estimateDefault?: { qtyFormula?: string; vatRate: number }
}

export interface TaskCategory {
  id: string
  name: string
  icon: string
  sortOrder: number
}

export const BATHROOM_CATEGORIES: TaskCategory[] = [
  { id: 'preparation',   name: 'Organizacja i zabezpieczenie',    icon: 'clipboard', sortOrder: 1 },
  { id: 'demolition',    name: 'Demontaz i rozbiorki',            icon: 'hammer',    sortOrder: 2 },
  { id: 'substrate',     name: 'Przygotowanie podloza',           icon: 'brush',     sortOrder: 3 },
  { id: 'screed',        name: 'Wylewki i szlichty i spadki',     icon: 'ruler',     sortOrder: 4 },
  { id: 'waterproofing', name: 'Hydroizolacja',                   icon: 'droplet',   sortOrder: 5 },
  { id: 'drywall',       name: 'Zabudowy GK i obudowy i rewizje', icon: 'grid',      sortOrder: 6 },
  { id: 'plumbing',      name: 'Instalacja wod-kan',              icon: 'pipe',      sortOrder: 7 },
  { id: 'electrical',    name: 'Instalacja elektryczna',          icon: 'bolt',      sortOrder: 8 },
  { id: 'ventilation',   name: 'Wentylacja',                      icon: 'wind',      sortOrder: 9 },
  { id: 'underfloor',    name: 'Ogrzewanie podlogowe',            icon: 'heat',      sortOrder: 10 },
  { id: 'wall_tiling',   name: 'Okladziny scienne',               icon: 'wall',      sortOrder: 11 },
  { id: 'floor_tiling',  name: 'Okladziny podlogowe',             icon: 'floor',     sortOrder: 12 },
  { id: 'large_format',  name: 'Wielki format',                   icon: 'square',    sortOrder: 13 },
  { id: 'decoration',    name: 'Mozaika i dekor i szklane',       icon: 'star',      sortOrder: 14 },
  { id: 'profiles',      name: 'Profile i obrobki i docinki',     icon: 'cut',       sortOrder: 15 },
  { id: 'grouting',      name: 'Fugowanie',                       icon: 'paint',     sortOrder: 16 },
  { id: 'silicone',      name: 'Silikonowanie i uszczelnienia',   icon: 'seal',      sortOrder: 17 },
  { id: 'painting',      name: 'Malowanie i tynki dekoracyjne',   icon: 'palette',   sortOrder: 18 },
  { id: 'fixtures',      name: 'Bialy montaz',                    icon: 'toilet',    sortOrder: 19 },
  { id: 'fittings',      name: 'Armatura',                        icon: 'wrench',    sortOrder: 20 },
  { id: 'glass',         name: 'Szklo i kabiny i walk-in',        icon: 'glass',     sortOrder: 21 },
  { id: 'accessories',   name: 'Meble i lustra i akcesoria',      icon: 'mirror',    sortOrder: 22 },
  { id: 'sealing',       name: 'Odbior i regulacje i sprzatanie', icon: 'check',     sortOrder: 23 },
]

export const BATHROOM_TASKS: BathroomTask[] = [

  // preparation
  { id: 'prep_site_protection',   name: 'Zabezpieczenie ciagow komunikacyjnych i stolarki', category: 'preparation', unit: 'kpl.', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przed rozpoczeciem prac',            laborOrMaterial: 'labor' },
  { id: 'prep_material_staging',  name: 'Organizacja dostaw i sklad materialow',            category: 'preparation', unit: 'kpl.', priority: 'likely',      scopeGroup: 'likely',              when: 'Przy wiekszych remontach',                 laborOrMaterial: 'labor' },
  { id: 'prep_dust_barrier',      name: 'Zabezpieczenie przed pylem (folia, tasma)',         category: 'preparation', unit: 'kpl.', priority: 'likely',      scopeGroup: 'likely',              when: 'Remont w zamieszkalym budynku',            laborOrMaterial: 'both' },
  { id: 'prep_floor_protection',  name: 'Zabezpieczenie podlogi na korytarzu',              category: 'preparation', unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Ciezki transport materialow',              laborOrMaterial: 'both' },

  // demolition - pomiary
  { id: 'measure_inventory',      name: 'Pomiar / inwentaryzacja / trasowanie',             category: 'demolition',  unit: 'kpl.', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze na poczatku remontu',               laborOrMaterial: 'labor', estimateDefault: { vatRate: 23 } },
  { id: 'measure_axis_layout',    name: 'Trasowanie osi wyposazenia i instalacji',          category: 'demolition',  unit: 'kpl.', priority: 'required',    scopeGroup: 'required',            when: 'Przed montazem instalacji i plytek',       laborOrMaterial: 'labor' },
  { id: 'measure_photo_doc',      name: 'Dokumentacja fotograficzna stanu przed remontem', category: 'demolition',  unit: 'kpl.', priority: 'likely',      scopeGroup: 'likely',              when: 'Zalecane dla odbioru szkod',               laborOrMaterial: 'labor' },

  // demolition - demontaz
  { id: 'demo_tiles_wall',        name: 'Demontaz starych plytek sciennych',                category: 'demolition',  unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Plytki scienne do wymiany',                laborOrMaterial: 'labor', appliesWhen: 'remont starej lazienki', estimateDefault: { qtyFormula: 'wall_area', vatRate: 23 } },
  { id: 'demo_tiles_floor',       name: 'Demontaz starych plytek podlogowych',              category: 'demolition',  unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Plytki podlogowe do wymiany',              laborOrMaterial: 'labor', appliesWhen: 'remont starej lazienki', estimateDefault: { qtyFormula: 'floor_area', vatRate: 23 } },
  { id: 'demo_fixtures',          name: 'Demontaz starej ceramiki i armatury',              category: 'demolition',  unit: 'kpl.', priority: 'likely',      scopeGroup: 'likely',              when: 'Wymiana bialego montazu',                  laborOrMaterial: 'labor', appliesWhen: 'remont starej lazienki' },
  { id: 'demo_bathtub',           name: 'Demontaz wanny / brodzika',                        category: 'demolition',  unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Zmiana wanny na prysznic lub wymiana',     confirmationQuestion: 'Czy niszczymy stara wanne lub brodzik?', laborOrMaterial: 'labor' },
  { id: 'demo_drywall',           name: 'Demontaz starych zabudow GK',                      category: 'demolition',  unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Stare zabudowy do wymiany',                laborOrMaterial: 'labor', estimateDefault: { vatRate: 23 } },
  { id: 'demo_screed',            name: 'Skucie wylewki podlogowej',                        category: 'demolition',  unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Zla wylewka lub zmiana spadkow',           confirmationQuestion: 'Czy wylewka wymaga skucia?', laborOrMaterial: 'labor', estimateDefault: { qtyFormula: 'floor_area', vatRate: 23 } },
  { id: 'demo_plaster_walls',     name: 'Skucie tynku sciennego',                           category: 'demolition',  unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Zly tynk lub grzyb',                       confirmationQuestion: 'Czy tynk scienny wymaga skucia?', laborOrMaterial: 'labor', estimateDefault: { qtyFormula: 'wall_area', vatRate: 23 } },
  { id: 'demo_floor_adhesive',    name: 'Frezowanie kleju po starej podlodze',              category: 'demolition',  unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Reszki kleju po demontazu plytek',         laborOrMaterial: 'labor', estimateDefault: { qtyFormula: 'floor_area', vatRate: 23 } },
  { id: 'demo_partition_wall',    name: 'Wyburzenie sciany dzialowej',                      category: 'demolition',  unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Zmiana ukladu pomieszczenia',              confirmationQuestion: 'Czy wyburzamy sciane dzialowa?', laborOrMaterial: 'labor' },
  { id: 'demo_door_frame',        name: 'Demontaz oscieznicy / skrzydla drzwiowego',        category: 'demolition',  unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Zmiana drzwi lazienki',                    laborOrMaterial: 'labor' },
  { id: 'debris_removal',         name: 'Wywoz gruzu i odpadow',                            category: 'demolition',  unit: 'kpl.', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy demontazu',                    laborOrMaterial: 'both', estimateDefault: { vatRate: 23 } },
  { id: 'debris_container',       name: 'Kontener na gruz (wynajem)',                       category: 'demolition',  unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Duzy rozmiar remontu',                     laborOrMaterial: 'material' },
  { id: 'debris_hazmat',          name: 'Utylizacja odpadow niebezpiecznych',               category: 'demolition',  unit: 'kpl.', priority: 'optional',    scopeGroup: 'optional',            when: 'Stare materialy zawieraja substancje szkodliwe', laborOrMaterial: 'both' },

  // substrate
  { id: 'substrate_repair_local',    name: 'Naprawy lokalne podloza (uzupelnienia, peki)',     category: 'substrate', unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Ubytki po demontazu plytek lub tynku',     laborOrMaterial: 'both',   estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'substrate_grind_floor',     name: 'Szlifowanie / odpylenie podlogi przed plytka',    category: 'substrate', unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Przed wylewka lub klejeniem plytek',       laborOrMaterial: 'labor',  estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'substrate_leveling',        name: 'Wyrownanie podloza (wylewka / szlichta)',          category: 'substrate', unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Nierowne podloze po demontazu',            laborOrMaterial: 'both',   estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'substrate_priming',         name: 'Gruntowanie podloza pod plytki',                  category: 'substrate', unit: 'm2',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przed ukladaniem plytek',           laborOrMaterial: 'both',   estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'substrate_wall_priming',    name: 'Gruntowanie scian pod plytki / malowanie',        category: 'substrate', unit: 'm2',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przed ukladaniem plytek sciennych', laborOrMaterial: 'both',   estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'substrate_plastering',      name: 'Tynkowanie / wyrownanie scian gipsem',            category: 'substrate', unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Sciany wymagaja wyrownania',               confirmationQuestion: 'Czy sciany wymagaja recznego tynkowania?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'substrate_plaster_machine', name: 'Tynkowanie maszynowe gipsem',                    category: 'substrate', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Duze powierzchnie scian do wyrownania',    laborOrMaterial: 'both',   estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'substrate_gk_walls',        name: 'Plyta GK na ruszcie zamiast tynku',              category: 'substrate', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Alternatywa dla tynku na trudnych scianach', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },

  // screed
  { id: 'screed_float',              name: 'Szlichta cementowa / wylewka tradycyjna',         category: 'screed',    unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Po skuciu wylewki lub na nowym podlozu',   laborOrMaterial: 'both',   estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'screed_self_leveling',      name: 'Masa samopoziomujaca',                            category: 'screed',    unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Wyrownanie malych roznic poziomow',        laborOrMaterial: 'both',   estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'screed_shower_slope',       name: 'Wykonanie spadkow pod natrysk / odplyw liniowy', category: 'screed',    unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Prysznic z odplywem podlogowym',           confirmationQuestion: 'Czy bedzie odplyw liniowy lub podlogowy?', dependsOn: ['plumb_shower_drain'], laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wet_zone_area', vatRate: 8 } },
  { id: 'screed_heated_layer',       name: 'Wylewka na ogrzewanie podlogowe',                category: 'screed',    unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Ogrzewanie podlogowe elektryczne lub wodne', dependsOn: ['underfloor_mat'], laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'screed_fiber',              name: 'Wylewka zbrojona wloknem',                       category: 'screed',    unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Podloze narazone na pekanie',              laborOrMaterial: 'both',   estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },

  // waterproofing
  { id: 'waterproof_floor',          name: 'Hydroizolacja podlogi lazienki (I warstwa)',      category: 'waterproofing', unit: 'm2', priority: 'required',   scopeGroup: 'required',            when: 'Zawsze na podlodze lazienki',              dependsOn: ['tile_floor'], laborOrMaterial: 'both',   estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'waterproof_floor_2',        name: 'Hydroizolacja podlogi lazienki (II warstwa)',     category: 'waterproofing', unit: 'm2', priority: 'likely',     scopeGroup: 'likely',              when: 'Zalecana II warstwa przy duzym ryzyku',    dependsOn: ['waterproof_floor'], laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'waterproof_wet',            name: 'Hydroizolacja strefy natrysku (sciany)',          category: 'waterproofing', unit: 'm2', priority: 'required',   scopeGroup: 'required',            when: 'Zawsze w strefach mokrych',               appliesWhen: 'prysznic lub wanna w projekcie', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wet_zone_area', vatRate: 8 } },
  { id: 'waterproof_bath_walls',     name: 'Hydroizolacja scian przy wannie',                category: 'waterproofing', unit: 'm2', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Sciany przy wannie',                      appliesWhen: 'wanna w projekcie', confirmationQuestion: 'Czy beda plytki i hydroizolacja scian przy wannie?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wet_zone_area', vatRate: 8 } },
  { id: 'waterproof_tape',           name: 'Tasmy uszczelniajace (narozniki, przejscia)',     category: 'waterproofing', unit: 'mb', priority: 'required',   scopeGroup: 'required',            when: 'Zawsze przy hydroizolacji',               dependsOn: ['waterproof_wet'], laborOrMaterial: 'both', estimateDefault: { vatRate: 8 } },
  { id: 'waterproof_collar',         name: 'Kolnierze uszczelniajace (odplyw, rury)',         category: 'waterproofing', unit: 'szt.', priority: 'required', scopeGroup: 'required',            when: 'Przy przejsciach instalacyjnych',          dependsOn: ['waterproof_floor'], laborOrMaterial: 'both' },
  { id: 'waterproof_drain_seal',     name: 'Uszczelnienie odpływu liniowego / punktowego',   category: 'waterproofing', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Odplyw liniowy lub podlogowy',           dependsOn: ['plumb_shower_drain'], confirmationQuestion: 'Czy bedzie odplyw liniowy?', laborOrMaterial: 'both' },
  { id: 'waterproof_check',          name: 'Kontrola ciaglosci hydroizolacji przed plytkami', category: 'waterproofing', unit: 'kpl.', priority: 'likely',  scopeGroup: 'likely',              when: 'Przed polozeniem plytek mokrych',          laborOrMaterial: 'labor' },

  // drywall
  { id: 'gk_pipe_casing',       name: 'Zabudowa pionow instalacyjnych (GK)',           category: 'drywall', unit: 'mb',   priority: 'likely',      scopeGroup: 'likely',              when: 'Widoczne piony kanalizacyjne / wodne',     laborOrMaterial: 'both' },
  { id: 'gk_inspection',        name: 'Rewizja serwisowa (drzwiczki)',                 category: 'drywall', unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Przy zabudowie pionow / instalacji',       dependsOn: ['gk_pipe_casing'], laborOrMaterial: 'both' },
  { id: 'gk_wc_frame',          name: 'Zabudowa stelaza WC podtynkowego',             category: 'drywall', unit: 'kpl.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'WC podtynkowe',                            confirmationQuestion: 'Czy bedzie WC podtynkowe?', dependsOn: ['fix_wc_concealed'], laborOrMaterial: 'both' },
  { id: 'gk_niche',             name: 'Wykonanie wneki / polki z GK',                 category: 'drywall', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Wneka na kosmetyki / polka',               confirmationQuestion: 'Czy bedzie wneka z GK?', laborOrMaterial: 'both' },
  { id: 'gk_ceiling',           name: 'Sufit podwieszany GK',                         category: 'drywall', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Ukrycie instalacji / oswietlenie punktowe', confirmationQuestion: 'Czy bedzie sufit podwieszany?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'gk_boiler_casing',     name: 'Obudowa kotla / bojlera',                      category: 'drywall', unit: 'kpl.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Kociol / bojler w lazience',               confirmationQuestion: 'Czy jest kociol lub bojler do obudowania?', laborOrMaterial: 'both' },
  { id: 'gk_bathtub_casing',    name: 'Obudowa wanny plytami GK',                     category: 'drywall', unit: 'kpl.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Wanna bez gotowej obudowy',                appliesWhen: 'wanna wolnostojaca lub bez obudowy', laborOrMaterial: 'both' },
  { id: 'gk_column_casing',     name: 'Obudowa slupa / kolumny instalacyjnej',        category: 'drywall', unit: 'kpl.', priority: 'optional',    scopeGroup: 'optional',            when: 'Slup lub kolumna w lazience',              laborOrMaterial: 'both' },
  { id: 'gk_technical_closure', name: 'Zamkniecie wneki technicznej',                 category: 'drywall', unit: 'kpl.', priority: 'optional',    scopeGroup: 'optional',            when: 'Nisza techniczna do zamkniecia',           laborOrMaterial: 'both' },

  // plumbing
  { id: 'plumb_cold_point',     name: 'Przeroba / przesuniecie punktu zimnej wody',   category: 'plumbing', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Zmiana ukladu urzadzen sanitarnych',       confirmationQuestion: 'Czy przerabiamy punkty wodne?', laborOrMaterial: 'both' },
  { id: 'plumb_hot_point',      name: 'Przeroba / przesuniecie punktu cieplej wody',  category: 'plumbing', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Zmiana ukladu urzadzen sanitarnych',       dependsOn: ['plumb_cold_point'], laborOrMaterial: 'both' },
  { id: 'plumb_sewer_point',    name: 'Przeroba / przesuniecie punktu kanalizacji',   category: 'plumbing', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Zmiana polozenia WC, umywalki lub prysznica', confirmationQuestion: 'Czy przerabiamy kanalizacje?', laborOrMaterial: 'both' },
  { id: 'plumb_shower_drain',   name: 'Montaz odpływu liniowego / punktowego',        category: 'plumbing', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Prysznic z odplywem podlogowym lub liniowym', confirmationQuestion: 'Czy bedzie odplyw liniowy lub podlogowy?', laborOrMaterial: 'both' },
  { id: 'plumb_bathtub',        name: 'Podlaczenie wanny',                            category: 'plumbing', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Wanna w projekcie',                        dependsOn: ['fix_bathtub'], laborOrMaterial: 'labor' },
  { id: 'plumb_basin_supply',   name: 'Podejscie wodne do umywalki',                  category: 'plumbing', unit: 'szt.', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy umywalce',                     dependsOn: ['fix_basin'], laborOrMaterial: 'labor' },
  { id: 'plumb_wc_supply',      name: 'Podejscie wodne do WC',                        category: 'plumbing', unit: 'szt.', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy WC',                           dependsOn: ['fix_wc'], laborOrMaterial: 'labor' },
  { id: 'plumb_mixing_valve',   name: 'Montaz baterii podtynkowej',                   category: 'plumbing', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Bateria podtynkowa w projekcie',           confirmationQuestion: 'Czy bedzie bateria podtynkowa?', laborOrMaterial: 'both' },
  { id: 'plumb_radiator',       name: 'Montaz grzejnika lazienkowego / drabinki',     category: 'plumbing', unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Grzejnik lazienkowy w projekcie',          laborOrMaterial: 'both' },
  { id: 'plumb_pressure_test',  name: 'Proba cisnieniowa instalacji wodnej',          category: 'plumbing', unit: 'kpl.', priority: 'likely',      scopeGroup: 'likely',              when: 'Po przerobieniu instalacji wodnej',        laborOrMaterial: 'labor' },

  // electrical
  { id: 'elec_socket_points',   name: 'Nowe punkty gniazdkowe',                       category: 'electrical', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Nowe gniazdka lub zmiana polozenia',       confirmationQuestion: 'Czy dodajemy nowe gniazdka?', laborOrMaterial: 'both' },
  { id: 'elec_lighting_points', name: 'Nowe punkty oswietleniowe',                    category: 'electrical', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Nowe oswietlenie lub zmiana polozenia',    confirmationQuestion: 'Czy przerabiamy oswietlenie?', laborOrMaterial: 'both' },
  { id: 'elec_lighting',        name: 'Montaz opraw oswietleniowych (LED, halogeny)', category: 'electrical', unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Nowe oswietlenie w lazience',              laborOrMaterial: 'both' },
  { id: 'elec_niche_light',     name: 'Montaz LED we wnece / szafce',                 category: 'electrical', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Wneka lub szafka z oswietleniem',          appliesWhen: 'wneka lub podswietlana szafka', laborOrMaterial: 'both' },
  { id: 'elec_mirror_light',    name: 'Podlaczenie oswietlenia lustra',               category: 'electrical', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Lustro z oswietleniem',                    dependsOn: ['acc_mirror'], laborOrMaterial: 'both' },
  { id: 'elec_underfloor',      name: 'Mata grzewcza podlogowa (elektryczna)',        category: 'electrical', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Ogrzewanie podlogowe elektryczne',         confirmationQuestion: 'Czy bedzie elektryczna mata grzewcza?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'elec_thermostat',      name: 'Montaz sterownika / termostatu ogrzewania',    category: 'electrical', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Ogrzewanie podlogowe lub grzejnik el.',    dependsOn: ['elec_underfloor'], laborOrMaterial: 'both' },
  { id: 'elec_fan',             name: 'Montaz wentylatora lazienkowego',              category: 'electrical', unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Lazienka bez okna lub z wentylacja mech.', laborOrMaterial: 'both' },
  { id: 'elec_circuit_breaker', name: 'Zabezpieczenie obwodu elektrycznego lazienki', category: 'electrical', unit: 'kpl.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Nowa instalacja lub zmiana obwodu',        laborOrMaterial: 'both' },

  // ventilation
  { id: 'vent_fan_exchange',    name: 'Wymiana wentylatora',                          category: 'ventilation', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Stary wentylator do wymiany',             confirmationQuestion: 'Czy wentylator jest do wymiany?', laborOrMaterial: 'both' },
  { id: 'vent_duct',            name: 'Montaz / przeroba przewodow wentylacyjnych',   category: 'ventilation', unit: 'mb',   priority: 'optional',    scopeGroup: 'optional',            when: 'Zmiana trasy wentylacji',                 laborOrMaterial: 'both' },
  { id: 'vent_grille',          name: 'Montaz kratki wentylacyjnej',                  category: 'ventilation', unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Kratka wentylacyjna w plytce lub scianie', laborOrMaterial: 'both' },
  { id: 'vent_timer',           name: 'Wentylator z timerem / czujnikiem wilgoci',    category: 'ventilation', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Wentylacja automatyczna',                 laborOrMaterial: 'both' },

  // underfloor
  { id: 'underfloor_mat',       name: 'Mata / kabel grzewczy elektryczny',            category: 'underfloor',  unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Ogrzewanie podlogowe elektryczne',         confirmationQuestion: 'Czy bedzie ogrzewanie podlogowe?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'underfloor_water',     name: 'Petla ogrzewania podlogowego wodnego',         category: 'underfloor',  unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Ogrzewanie podlogowe wodne',               confirmationQuestion: 'Czy bedzie wodne ogrzewanie podlogowe?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },

  // wall_tiling
  { id: 'tile_wall_full',        name: 'Ukladanie plytek sciennych (pelna wysokosc)',            category: 'wall_tiling',  unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Plytki do sufitu',                         laborOrMaterial: 'both', appliesWhen: 'plytki scienne do sufitu', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'tile_wall_partial',     name: 'Ukladanie plytek sciennych (czesciowa wys.)',            category: 'wall_tiling',  unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Plytki do pewnej wysokosci',               confirmationQuestion: 'Do jakiej wysokosci ida plytki na scianach?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'tile_wall_diagonal',    name: 'Ukladanie plytek sciennych w karo / uklad dekoracyjny', category: 'wall_tiling',  unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Uklad karo lub wzorowy',                   confirmationQuestion: 'Czy plytki ida w uklad karo?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'tile_wall_niche',       name: 'Ukladanie plytek w wnece',                              category: 'wall_tiling',  unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Wneka wykonana z plytki',                  dependsOn: ['gk_niche'], laborOrMaterial: 'both' },
  { id: 'tile_wall_window',      name: 'Obrobka glifu okiennego plytka',                        category: 'wall_tiling',  unit: 'mb',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Okno w lazience',                          confirmationQuestion: 'Czy okno lazienkowe bedzie oblozowane plytka?', laborOrMaterial: 'both' },

  // floor_tiling
  { id: 'tile_floor',            name: 'Ukladanie plytek podlogowych (standard)',                category: 'floor_tiling', unit: 'm2',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze w lazience',                        laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'tile_floor_diagonal',   name: 'Ukladanie plytek podlogowych w karo',                   category: 'floor_tiling', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Uklad karo podlogi',                       confirmationQuestion: 'Czy plytki podlogowe ida w karo?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'tile_floor_herring',    name: 'Ukladanie plytek w jodelte',                            category: 'floor_tiling', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Uklad jodelta na podlodze',                confirmationQuestion: 'Czy plytki ida w jodelte?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },

  // large_format
  { id: 'lf_wall',               name: 'Ukladanie plytek wielkoformatowych na scianie',         category: 'large_format', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Plytka pow. 60x60 cm na scianie',          confirmationQuestion: 'Czy plytki scienne sa wielkoformatowe (60x60+)?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'lf_floor',              name: 'Ukladanie plytek wielkoformatowych na podlodze',        category: 'large_format', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Plytka pow. 60x60 cm na podlodze',        confirmationQuestion: 'Czy plytki podlogowe sa wielkoformatowe?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'lf_substrate_primer',   name: 'Podklad pod wielki format (wzmocniony)',                category: 'large_format', unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Wymagany specjalny podklad dla WF',        dependsOn: ['lf_floor'], laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'lf_adhesive_premium',   name: 'Klej klasy premium / elastyczny do WF',                category: 'large_format', unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Plytki wielkoformatowe i ciezkie',         dependsOn: ['lf_wall'], laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },

  // decoration
  { id: 'tile_mosaic',           name: 'Ukladanie mozaiki / dekorow',                          category: 'decoration',   unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Dekor / mozaika w projekcie',              confirmationQuestion: 'Czy bedzie mozaika lub dekor ceramiczny?', laborOrMaterial: 'both' },
  { id: 'tile_glass_brick',      name: 'Montaz cegletek szklanych',                            category: 'decoration',   unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Cegielki szklane w projekcie',             laborOrMaterial: 'both' },
  { id: 'tile_relief',           name: 'Ukladanie plytek reliefowych / 3D',                    category: 'decoration',   unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Dekoracyjna plytka reliefowa',             laborOrMaterial: 'both' },
  { id: 'tile_feature_wall',     name: 'Scianka dekoracyjna / akcentowa',                      category: 'decoration',   unit: 'kpl.', priority: 'optional',    scopeGroup: 'optional',            when: 'Jedna sciana akcentowa',                   confirmationQuestion: 'Czy bedzie scianka akcentowa?', laborOrMaterial: 'both' },

  // profiles
  { id: 'profile_corner',        name: 'Listwy naroznikowe (aluminium / PVC)',                 category: 'profiles',     unit: 'mb',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze w naroznikach plytki',              dependsOn: ['tile_wall_full', 'tile_wall_partial'], laborOrMaterial: 'both', estimateDefault: { vatRate: 8 } },
  { id: 'profile_edge',          name: 'Listwy krawedzowe / wykonczeniowe',                    category: 'profiles',     unit: 'mb',   priority: 'likely',      scopeGroup: 'likely',              when: 'Krawedzie plytki zakonczeniowe',           dependsOn: ['tile_wall_full'], laborOrMaterial: 'both' },
  { id: 'profile_expansion',     name: 'Dylatacje / szczeliny ekspansyjne',                    category: 'profiles',     unit: 'mb',   priority: 'likely',      scopeGroup: 'likely',              when: 'Przy duzych powierzchniach lub przejsciach', laborOrMaterial: 'both' },
  { id: 'cut_openings',          name: 'Ciecia otworow w plytce (pod rury, gniazdka)',         category: 'profiles',     unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Przy otworach na instalacje',              laborOrMaterial: 'labor' },
  { id: 'cut_complex',           name: 'Docinki trudne (luki, wcecia, nieregularne)',          category: 'profiles',     unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Skomplikowane krawedzie',                  laborOrMaterial: 'labor' },
  { id: 'tile_cove_base',        name: 'Cokolik z plytki',                                     category: 'profiles',     unit: 'mb',   priority: 'optional',    scopeGroup: 'optional',            when: 'Cokol z plytki zamiast listwy',            laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'perimeter', vatRate: 8 } },
  { id: 'tile_threshold',        name: 'Prog / listwa progowa',                                category: 'profiles',     unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Przejscie miedzy pomieszczeniami',         laborOrMaterial: 'both' },
  { id: 'tile_window_sill',      name: 'Parapet / glif okienny z plytki',                      category: 'profiles',     unit: 'mb',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Okno w lazience',                          dependsOn: ['tile_wall_window'], laborOrMaterial: 'both' },

  // grouting
  { id: 'grout_wall',           name: 'Fugowanie plytek sciennych',                       category: 'grouting', unit: 'm2',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze po ulozeniu plytek sciennych',      dependsOn: ['tile_wall_full', 'tile_wall_partial'], laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'grout_floor',          name: 'Fugowanie plytek podlogowych',                     category: 'grouting', unit: 'm2',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze po ulozeniu plytek podlogowych',    dependsOn: ['tile_floor'], laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'grout_epoxy',          name: 'Fugowanie epoksydowe (odpornosc na srodki)',       category: 'grouting', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Premium / wysoka odpornosc na zabrudzenia', confirmationQuestion: 'Czy uzywamy fugi epoksydowej?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'grout_lf',             name: 'Fugowanie wielkoformatowe (spoiny 1-2 mm)',        category: 'grouting', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Wielki format z waska fuga',               dependsOn: ['lf_floor', 'lf_wall'], laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },

  // silicone
  { id: 'seal_silicone',        name: 'Silikonowanie (wanna, brodzik, umywalka, WC)',    category: 'silicone', unit: 'mb',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze na styku ceramiki',                 laborOrMaterial: 'both', estimateDefault: { vatRate: 8 } },
  { id: 'seal_acrylic',         name: 'Uszczelnienie akrylowe (narozniki, przejscia)',   category: 'silicone', unit: 'mb',   priority: 'likely',      scopeGroup: 'likely',              when: 'Na nieregularnych stykach',                laborOrMaterial: 'both' },
  { id: 'seal_silicone_color',  name: 'Silikon kolorowy / dedykowany do fugi',           category: 'silicone', unit: 'mb',   priority: 'optional',    scopeGroup: 'optional',            when: 'Silikon w kolorze fugi',                   laborOrMaterial: 'both' },
  { id: 'seal_expansion_fill',  name: 'Wypelnienie dylatacji masa trwala',               category: 'silicone', unit: 'mb',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Dylatacje podlogowe',                      laborOrMaterial: 'both' },

  // painting
  { id: 'paint_ceiling',        name: 'Malowanie sufitu (farba lazienkowa)',              category: 'painting', unit: 'm2',   priority: 'likely',      scopeGroup: 'likely',              when: 'Sufit nie pokryty plytkami',               laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'paint_walls',          name: 'Malowanie scian (strefy bez plytek)',             category: 'painting', unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Sciany czesciowo bez plytek',              confirmationQuestion: 'Czy sciany ponad plytkami beda malowane?', laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'paint_gk',             name: 'Malowanie plyt GK / sufitu podwieszanego',        category: 'painting', unit: 'm2',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Sufit podwieszany do malowania',           dependsOn: ['gk_ceiling'], laborOrMaterial: 'both', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'paint_decorative',     name: 'Tynk dekoracyjny / efektowy na scianach',        category: 'painting', unit: 'm2',   priority: 'optional',    scopeGroup: 'optional',            when: 'Dekoracyjny tynk strukturalny',            confirmationQuestion: 'Czy bedzie tynk dekoracyjny?', laborOrMaterial: 'both' },

  // fixtures
  { id: 'fix_wc',               name: 'Montaz miski WC stojacej (kompakt)',               category: 'fixtures', unit: 'szt.', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze w lazience',                        notApplicableWhen: 'osobne WC podtynkowe', laborOrMaterial: 'labor' },
  { id: 'fix_wc_concealed',     name: 'Montaz WC podtynkowego (z przyciskiem)',           category: 'fixtures', unit: 'kpl.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'WC podtynkowe',                            confirmationQuestion: 'Czy bedzie WC podtynkowe ze stelazem?', dependsOn: ['gk_wc_frame'], laborOrMaterial: 'both' },
  { id: 'fix_wc_button',        name: 'Montaz przycisku splukujacego WC',                category: 'fixtures', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'WC podtynkowe',                            dependsOn: ['fix_wc_concealed'], laborOrMaterial: 'labor' },
  { id: 'fix_basin',            name: 'Montaz umywalki',                                  category: 'fixtures', unit: 'szt.', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze w lazience',                        laborOrMaterial: 'labor' },
  { id: 'fix_basin_double',     name: 'Montaz umywalki podwojnej',                       category: 'fixtures', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Dwie umywalki w projekcie',                confirmationQuestion: 'Czy beda dwie umywalki?', laborOrMaterial: 'labor' },
  { id: 'fix_basin_countertop', name: 'Montaz umywalki nablatowej',                      category: 'fixtures', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Umywalka nablatowa',                       confirmationQuestion: 'Czy umywalka bedzie nablatowa?', laborOrMaterial: 'labor' },
  { id: 'fix_shower_tray',      name: 'Montaz brodzika prysznicowego',                   category: 'fixtures', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Prysznic z brodzikiem',                    confirmationQuestion: 'Czy bedzie brodzik akrylowy?', laborOrMaterial: 'labor' },
  { id: 'fix_bathtub',          name: 'Montaz wanny + obudowa',                          category: 'fixtures', unit: 'kpl.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Wanna w projekcie',                        confirmationQuestion: 'Czy bedzie wanna?', laborOrMaterial: 'labor' },
  { id: 'fix_bathtub_freestand',name: 'Montaz wanny wolnostojacej',                      category: 'fixtures', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Wanna wolnostojaca premium',               confirmationQuestion: 'Czy bedzie wanna wolnostojaca?', laborOrMaterial: 'labor' },
  { id: 'fix_bidet',            name: 'Montaz bidetu',                                    category: 'fixtures', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Bidet w projekcie',                        laborOrMaterial: 'labor' },
  { id: 'fix_bidet_seat',       name: 'Montaz deski WC z funkcja bidetu',                category: 'fixtures', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Elektroniczna deska WC',                   laborOrMaterial: 'labor' },
  { id: 'fix_urinal',           name: 'Montaz pisuaru',                                   category: 'fixtures', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Pisuar w projekcie',                       laborOrMaterial: 'labor' },

  // fittings
  { id: 'fit_basin_tap',        name: 'Montaz baterii umywalkowej',                       category: 'fittings', unit: 'szt.', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy umywalce',                     dependsOn: ['fix_basin'], laborOrMaterial: 'labor' },
  { id: 'fit_shower_set',       name: 'Montaz zestawu prysznicowego (deszczownica+reczny)', category: 'fittings', unit: 'kpl.', priority: 'likely',   scopeGroup: 'likely',              when: 'Prysznic w projekcie',                     laborOrMaterial: 'both' },
  { id: 'fit_shower_concealed', name: 'Montaz baterii prysznicowej podtynkowej',          category: 'fittings', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Bateria prysznicowa podtynkowa',           confirmationQuestion: 'Czy bateria prysznicowa bedzie podtynkowa?', dependsOn: ['plumb_mixing_valve'], laborOrMaterial: 'labor' },
  { id: 'fit_bathtub_tap',      name: 'Montaz baterii wannowej',                          category: 'fittings', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Wanna w projekcie',                        dependsOn: ['fix_bathtub'], laborOrMaterial: 'labor' },
  { id: 'fit_angle_valves',     name: 'Montaz zaworow katowych',                          category: 'fittings', unit: 'szt.', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy urzadzeniach sanitarnych',     laborOrMaterial: 'labor' },
  { id: 'fit_thermostatic',     name: 'Montaz baterii termostatycznej',                   category: 'fittings', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Bateria termostatyczna premium',           laborOrMaterial: 'both' },
  { id: 'fit_radiator_tap',     name: 'Montaz zaworow grzejnikowych',                     category: 'fittings', unit: 'kpl.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Grzejnik wodny lazienkowy',                dependsOn: ['plumb_radiator'], laborOrMaterial: 'labor' },

  // glass
  { id: 'glass_shower_door',    name: 'Montaz drzwi / sciany kabiny prysznicowej',        category: 'glass',    unit: 'kpl.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Kabina prysznicowa z drzwiami',            confirmationQuestion: 'Czy bedzie kabina prysznicowa?', laborOrMaterial: 'both' },
  { id: 'glass_walkin',         name: 'Montaz szyby / scianki walk-in',                   category: 'glass',    unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Prysznic walk-in',                         confirmationQuestion: 'Czy bedzie prysznic walk-in?', laborOrMaterial: 'both' },
  { id: 'glass_bath_screen',    name: 'Parawan wannowy',                                   category: 'glass',    unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Wanna z parawanem',                        dependsOn: ['fix_bathtub'], laborOrMaterial: 'labor' },
  { id: 'glass_seal_walkin',    name: 'Uszczelnienie / profile walk-in',                  category: 'glass',    unit: 'mb',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Prysznic walk-in',                         dependsOn: ['glass_walkin'], laborOrMaterial: 'both' },

  // accessories
  { id: 'acc_mirror',           name: 'Montaz lustra',                                    category: 'accessories', unit: 'szt.', priority: 'likely',   scopeGroup: 'likely',              when: 'Standardowe wyposazenie',                  laborOrMaterial: 'labor' },
  { id: 'acc_mirror_cabinet',   name: 'Montaz szafki lustrzanej',                         category: 'accessories', unit: 'szt.', priority: 'optional', scopeGroup: 'optional',            when: 'Szafka z lustrem',                         confirmationQuestion: 'Czy bedzie szafka lustrzana?', laborOrMaterial: 'labor' },
  { id: 'acc_vanity',           name: 'Montaz szafki podumywalkowej / mebla lazienkowego', category: 'accessories', unit: 'kpl.', priority: 'optional', scopeGroup: 'optional',           when: 'Meble lazienkowe',                         confirmationQuestion: 'Czy beda meble lazienkowe?', laborOrMaterial: 'labor' },
  { id: 'acc_countertop',       name: 'Montaz blatu / lady do umywalki',                  category: 'accessories', unit: 'szt.', priority: 'optional', scopeGroup: 'optional',            when: 'Blat pod umywalke',                        laborOrMaterial: 'labor' },
  { id: 'acc_towel_rail',       name: 'Montaz wieszaka na reczniki',                      category: 'accessories', unit: 'szt.', priority: 'likely',   scopeGroup: 'likely',              when: 'Standardowe wyposazenie',                  laborOrMaterial: 'labor' },
  { id: 'acc_towel_ring',       name: 'Montaz kolka na recznik',                          category: 'accessories', unit: 'szt.', priority: 'optional', scopeGroup: 'optional',            when: 'Dodatkowe akcesoria',                      laborOrMaterial: 'labor' },
  { id: 'acc_shelf',            name: 'Montaz polki / organizer',                         category: 'accessories', unit: 'szt.', priority: 'optional', scopeGroup: 'optional',            when: 'Dodatkowe przechowywanie',                 laborOrMaterial: 'labor' },
  { id: 'acc_toilet_paper',     name: 'Montaz uchwytu na papier',                         category: 'accessories', unit: 'szt.', priority: 'likely',   scopeGroup: 'likely',              when: 'Standardowe wyposazenie',                  laborOrMaterial: 'labor' },
  { id: 'acc_soap_dish',        name: 'Montaz dozownika / mydelniczki',                   category: 'accessories', unit: 'szt.', priority: 'optional', scopeGroup: 'optional',            when: 'Dodatkowe akcesoria',                      laborOrMaterial: 'labor' },
  { id: 'acc_robe_hook',        name: 'Montaz hakow na szlafroki',                        category: 'accessories', unit: 'szt.', priority: 'optional', scopeGroup: 'optional',            when: 'Haki przy drzwiach lub scianie',           laborOrMaterial: 'labor' },
  { id: 'acc_toilet_brush',     name: 'Montaz pojemnika na szczotke WC',                  category: 'accessories', unit: 'szt.', priority: 'optional', scopeGroup: 'optional',            when: 'Opcjonalnie przy WC',                      laborOrMaterial: 'labor' },

  // sealing
  { id: 'seal_inspection',         name: 'Odbior techniczny / przegladanie szczelnosci',  category: 'sealing', unit: 'kpl.', priority: 'likely',   scopeGroup: 'likely',              when: 'Po zakonczeniu prac',                         laborOrMaterial: 'labor' },
  { id: 'seal_drain_test',          name: 'Proba odplywow i instalacji wodnej',            category: 'sealing', unit: 'kpl.', priority: 'required', scopeGroup: 'required',            when: 'Zawsze przed odbiorem',                       laborOrMaterial: 'labor' },
  { id: 'seal_fixture_adjust',      name: 'Regulacja armatury i zawieszen',               category: 'sealing', unit: 'kpl.', priority: 'required', scopeGroup: 'required',            when: 'Zawsze po montazu armatury',                  laborOrMaterial: 'labor' },
  { id: 'seal_grout_clean',         name: 'Czyszczenie po fugowaniu / plytki powykonawcze', category: 'sealing', unit: 'kpl.', priority: 'required', scopeGroup: 'required',          when: 'Zawsze po fugowaniu',                         laborOrMaterial: 'labor' },
  { id: 'seal_cleanup',             name: 'Sprzatanie powykonawcze',                      category: 'sealing', unit: 'kpl.', priority: 'required', scopeGroup: 'required',            when: 'Zawsze na koniec',                            laborOrMaterial: 'labor' },
  { id: 'seal_client_walkthrough',  name: 'Odbior z inwestorem',                          category: 'sealing', unit: 'kpl.', priority: 'likely',   scopeGroup: 'likely',              when: 'Na zakonczenie remontu',                      laborOrMaterial: 'labor' },
]

// -- Helpers --

export function getTasksByCategory(categoryId: string): BathroomTask[] {
  return BATHROOM_TASKS.filter(t => t.category === categoryId)
}

export function getRequiredTasks(): BathroomTask[] {
  return BATHROOM_TASKS.filter(t => t.priority === 'required')
}

export function getLikelyTasks(): BathroomTask[] {
  return BATHROOM_TASKS.filter(t => t.priority === 'required' || t.priority === 'likely')
}

export function getTaskById(id: string): BathroomTask | undefined {
  return BATHROOM_TASKS.find(t => t.id === id)
}

export function buildLibraryPromptBlock(): string {
  const lines: string[] = ['BIBLIOTEKA TYPOWYCH POZYCJI LAZIENKOWYCH:']
  for (const cat of BATHROOM_CATEGORIES) {
    const tasks = getTasksByCategory(cat.id)
    if (tasks.length === 0) continue
    lines.push(`\n## ${cat.name}`)
    for (const t of tasks) {
      const prio = t.priority === 'required' ? '[OBOWIAZKOWA]'
        : t.priority === 'likely' ? '[PRAWDOPODOBNA]'
        : t.priority === 'conditional' ? '[WARUNKOWA]'
        : '[OPCJONALNA]'
      const deps = t.dependsOn?.length ? ` (wymaga: ${t.dependsOn.join(', ')})` : ''
      const cond = t.appliesWhen ? ` [jezeli: ${t.appliesWhen}]` : ''
      lines.push(`- ${t.id}: ${t.name} (${t.unit}) ${prio}${deps}${cond} -- ${t.when}`)
    }
  }
  return lines.join('\n')
}

// -- Coverage Engine --

export interface CoverageResult {
  missingRequired: BathroomTask[]
  missingLikely: BathroomTask[]
  unconfirmed: BathroomTask[]
  brokenDependencies: Array<{ task: BathroomTask; missingDep: string }>
  coveragePercent: number
}

export function checkCoverage(presentIds: Set<string>): CoverageResult {
  const requiredTasks = BATHROOM_TASKS.filter(t => t.scopeGroup === 'required')
  const likelyTasks   = BATHROOM_TASKS.filter(t => t.scopeGroup === 'likely')
  const confirmTasks  = BATHROOM_TASKS.filter(t => t.scopeGroup === 'confirmation_needed')

  const missingRequired = requiredTasks.filter(t => !presentIds.has(t.id))
  const missingLikely   = likelyTasks.filter(t => !presentIds.has(t.id))
  const unconfirmed     = confirmTasks.filter(t => !presentIds.has(t.id))

  const brokenDependencies: CoverageResult['brokenDependencies'] = []
  for (const id of presentIds) {
    const task = getTaskById(id)
    if (!task?.dependsOn) continue
    const allDepsMissing = task.dependsOn.every(d => !presentIds.has(d))
    if (allDepsMissing && task.dependsOn.length > 0) {
      brokenDependencies.push({ task, missingDep: task.dependsOn[0] })
    }
  }

  const totalRequired = requiredTasks.length
  const presentRequired = totalRequired - missingRequired.length
  const coveragePercent = totalRequired > 0 ? Math.round((presentRequired / totalRequired) * 100) : 100

  return { missingRequired, missingLikely, unconfirmed, brokenDependencies, coveragePercent }
}

// -- Quantity Hints --

export interface QuantityHints {
  floor_m2: number | null
  wall_tile_m2: number | null
  paint_m2: number | null
  ceiling_m2: number | null
  perimeter_mb: number | null
  wet_zone_m2: number | null
  fixture_count: number | null
}

export function calculateQuantityHints(
  area_m2?: number,
  ceiling_height_m?: number,
  tile_coverage?: 'full' | 'partial' | 'none',
  has_shower?: boolean,
  has_bathtub?: boolean,
  sink_count?: number,
): QuantityHints {
  const floor = area_m2 ?? null
  const height = ceiling_height_m ?? 2.6
  const side = floor ? Math.sqrt(floor) : null
  const perimeter = side ? Math.round(side * 4 * 10) / 10 : null

  let wall_tile: number | null = null
  let paint: number | null = null

  if (perimeter && height) {
    const totalWall = perimeter * height
    if (tile_coverage === 'full') {
      wall_tile = Math.round(totalWall * 10) / 10
      paint = null
    } else if (tile_coverage === 'partial') {
      wall_tile = Math.round(totalWall * 0.6 * 10) / 10
      paint = Math.round(totalWall * 0.4 * 10) / 10
    } else if (tile_coverage === 'none') {
      wall_tile = null
      paint = Math.round(totalWall * 10) / 10
    } else {
      wall_tile = Math.round(totalWall * 0.7 * 10) / 10
      paint = Math.round(totalWall * 0.3 * 10) / 10
    }
  }

  let wet_zone: number | null = null
  if (has_shower || has_bathtub) {
    wet_zone = 0
    if (has_shower) wet_zone += 1.2
    if (has_bathtub) wet_zone += 1.6
    wet_zone = Math.round(wet_zone * 10) / 10
  }

  const fixture_count = sink_count != null
    ? sink_count + (has_shower ? 1 : 0) + (has_bathtub ? 1 : 0) + 1
    : null

  return {
    floor_m2: floor,
    wall_tile_m2: wall_tile,
    paint_m2: paint,
    ceiling_m2: floor,
    perimeter_mb: perimeter,
    wet_zone_m2: wet_zone,
    fixture_count,
  }
}
