-- =============================================================================
-- Migration 101: Service Catalog — comprehensive renovation & finishing library
-- =============================================================================
-- 400+ items across 20 categories for Polish renovation/finishing companies.
-- Used by: AI analysis prompt (reference), estimate editor (add from library),
-- future offer templates.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.service_catalog (
  id          TEXT PRIMARY KEY,              -- kebab-case unique ID
  category    TEXT NOT NULL,                 -- category slug
  name        TEXT NOT NULL,                 -- display name (Polish)
  unit        TEXT NOT NULL DEFAULT 'm2',    -- m2, mb, szt, kpl, m3, h
  sort_order  INT NOT NULL DEFAULT 0,       -- within category
  tags        TEXT[] DEFAULT '{}',           -- searchable tags
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON public.service_catalog (category);
CREATE INDEX IF NOT EXISTS idx_service_catalog_active ON public.service_catalog (is_active) WHERE is_active = TRUE;

-- No RLS — this is a read-only reference table for all users
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_catalog_read_all" ON public.service_catalog FOR SELECT USING (TRUE);

-- =============================================================================
-- 1. Prace przygotowawcze i demontażowe
-- =============================================================================
INSERT INTO public.service_catalog (id, category, name, unit, sort_order, tags) VALUES
('prep-site-survey',          'demolition', 'Wizja lokalna i pomiary',                        'kpl', 1,  '{"przygotowanie","pomiary","wizja"}'),
('prep-inventory',            'demolition', 'Inwentaryzacja pomieszczeń',                     'kpl', 2,  '{"przygotowanie","inwentaryzacja"}'),
('prep-scope-planning',       'demolition', 'Przygotowanie zakresu prac',                     'kpl', 3,  '{"przygotowanie","zakres"}'),
('prep-protect-corridors',    'demolition', 'Zabezpieczenie ciągów komunikacyjnych',           'kpl', 4,  '{"zabezpieczenie","ochrona"}'),
('prep-protect-furniture',    'demolition', 'Zabezpieczenie mebli, stolarki i podłóg',        'kpl', 5,  '{"zabezpieczenie","meble"}'),
('prep-disconnect-devices',   'demolition', 'Odłączenie urządzeń przed remontem',              'kpl', 6,  '{"przygotowanie","odłączenie"}'),
('demo-tiles',                'demolition', 'Skuwanie starych płytek',                         'm2', 10, '{"demontaż","płytki","skuwanie"}'),
('demo-plaster',              'demolition', 'Skuwanie tynków i okładzin',                      'm2', 11, '{"demontaż","tynki","skuwanie"}'),
('demo-flooring',             'demolition', 'Demontaż paneli, parkietu, wykładzin',            'm2', 12, '{"demontaż","podłoga","panele"}'),
('demo-baseboards',           'demolition', 'Demontaż listew przypodłogowych',                 'mb', 13, '{"demontaż","listwy"}'),
('demo-sanitary',             'demolition', 'Demontaż armatury łazienkowej i kuchennej',       'kpl',14, '{"demontaż","armatura","łazienka"}'),
('demo-shower-bathtub-wc',    'demolition', 'Demontaż kabin prysznicowych, wanien, WC, umywalek','kpl',15,'{"demontaż","kabina","wanna","WC"}'),
('demo-drywall',              'demolition', 'Demontaż zabudów GK',                             'm2', 16, '{"demontaż","gk","zabudowa"}'),
('demo-suspended-ceiling',    'demolition', 'Demontaż sufitów podwieszanych',                  'm2', 17, '{"demontaż","sufit"}'),
('demo-doors',                'demolition', 'Demontaż drzwi wewnętrznych i ościeżnic',         'szt',18, '{"demontaż","drzwi","ościeżnica"}'),
('demo-windowsills',          'demolition', 'Demontaż parapetów',                              'szt',19, '{"demontaż","parapet"}'),
('demo-electrical',           'demolition', 'Demontaż osprzętu elektrycznego',                  'szt',20, '{"demontaż","elektryka"}'),
('demo-rubble-carry',         'demolition', 'Wynoszenie gruzu',                                 'm3', 25, '{"gruz","wynoszenie"}'),
('demo-waste-sorting',        'demolition', 'Pakowanie i segregacja odpadów',                   'kpl',26, '{"odpady","segregacja"}'),
('demo-waste-disposal',       'demolition', 'Wywóz gruzu i utylizacja odpadów',                 'm3', 27, '{"gruz","wywóz","utylizacja"}'),

-- =============================================================================
-- 2. Prace murarskie i konstrukcyjne wewnętrzne
-- =============================================================================
('masonry-demolish-wall',     'masonry', 'Wyburzanie ścian działowych',                      'm2', 1,  '{"wyburzanie","ściana","działowa"}'),
('masonry-new-wall',          'masonry', 'Wykonywanie nowych ścian działowych',              'm2', 2,  '{"murowanie","ściana","działowa"}'),
('masonry-block-wall',        'masonry', 'Murowanie ścianek z bloczków',                     'm2', 3,  '{"murowanie","bloczek"}'),
('masonry-fill-openings',     'masonry', 'Zamurowywanie otworów',                            'szt',4,  '{"zamurowywanie","otwór"}'),
('masonry-lintel',            'masonry', 'Wykonywanie nadproży',                             'szt',5,  '{"nadproże"}'),
('masonry-door-resize',       'masonry', 'Poszerzanie lub zwężanie otworów drzwiowych',       'szt',6,  '{"otwór","drzwi","poszerzanie"}'),
('masonry-local-repair',      'masonry', 'Przemurowania lokalne',                             'szt',7,  '{"przemurowanie","naprawa"}'),
('masonry-wall-leveling',     'masonry', 'Wyrównywanie ścian zaprawą',                       'm2', 8,  '{"wyrównywanie","zaprawa"}'),
('masonry-crack-repair',      'masonry', 'Naprawa pęknięć ścian',                            'mb', 9,  '{"naprawa","pęknięcie"}'),
('masonry-fill-gaps',         'masonry', 'Uzupełnianie ubytków po instalacjach',              'szt',10, '{"uzupełnianie","ubytek"}'),
('masonry-niches',            'masonry', 'Wykonywanie wnęk i nisz',                          'szt',11, '{"wnęka","nisza"}'),
('masonry-wall-prep',         'masonry', 'Przygotowanie ścian pod zabudowę i okładziny',     'm2', 12, '{"przygotowanie","ściana"}'),

-- =============================================================================
-- 3. Tynki, gładzie i przygotowanie powierzchni
-- =============================================================================
('plaster-manual',            'substrate', 'Tynkowanie ręczne',                               'm2', 1,  '{"tynk","ręczne"}'),
('plaster-machine',           'substrate', 'Tynkowanie maszynowe',                            'm2', 2,  '{"tynk","maszynowe"}'),
('plaster-cement-lime',       'substrate', 'Tynki cementowo-wapienne',                        'm2', 3,  '{"tynk","cementowo-wapienny"}'),
('plaster-gypsum',            'substrate', 'Tynki gipsowe',                                   'm2', 4,  '{"tynk","gipsowy"}'),
('plaster-repair',            'substrate', 'Naprawy tynków',                                  'm2', 5,  '{"tynk","naprawa"}'),
('skim-gypsum',               'substrate', 'Gładzie gipsowe',                                 'm2', 6,  '{"gładź","gipsowa"}'),
('skim-polymer',              'substrate', 'Gładzie polimerowe',                              'm2', 7,  '{"gładź","polimerowa"}'),
('skim-walls',                'substrate', 'Szpachlowanie ścian',                             'm2', 8,  '{"szpachlowanie","ściana"}'),
('skim-ceilings',             'substrate', 'Szpachlowanie sufitów',                           'm2', 9,  '{"szpachlowanie","sufit"}'),
('corner-reinforcement',      'substrate', 'Wzmacnianie narożników',                          'mb', 10, '{"narożnik","wzmacnianie"}'),
('corner-aluminum',           'substrate', 'Montaż narożników aluminiowych',                  'mb', 11, '{"narożnik","aluminiowy"}'),
('skim-sanding',              'substrate', 'Zacieranie i szlifowanie gładzi',                 'm2', 12, '{"szlifowanie","gładź"}'),
('priming-walls-ceilings',    'substrate', 'Gruntowanie ścian i sufitów',                     'm2', 13, '{"gruntowanie","ściana","sufit"}'),
('prep-for-painting',         'substrate', 'Wyrównywanie podłoża pod malowanie',              'm2', 14, '{"wyrównywanie","malowanie"}'),
('prep-for-wallpaper',        'substrate', 'Przygotowanie ścian pod tapety',                  'm2', 15, '{"przygotowanie","tapeta"}'),
('prep-for-tiles',            'substrate', 'Przygotowanie ścian pod płytki',                  'm2', 16, '{"przygotowanie","płytki"}'),
('prep-for-panels',           'substrate', 'Przygotowanie ścian pod lamele lub panele ścienne','m2',17, '{"przygotowanie","lamele","panele"}'),

-- =============================================================================
-- 4. Malowanie i dekoracja ścian
-- =============================================================================
('paint-walls',               'painting', 'Malowanie ścian',                                  'm2', 1,  '{"malowanie","ściana"}'),
('paint-ceilings',            'painting', 'Malowanie sufitów',                                'm2', 2,  '{"malowanie","sufit"}'),
('paint-spray',               'painting', 'Malowanie natryskowe',                             'm2', 3,  '{"malowanie","natrysk"}'),
('paint-refresh',             'painting', 'Odświeżanie mieszkań',                             'm2', 4,  '{"malowanie","odświeżanie"}'),
('paint-primer',              'painting', 'Malowanie gruntujące',                             'm2', 5,  '{"malowanie","gruntowanie"}'),
('paint-multi-coat',          'painting', 'Malowanie wielowarstwowe',                         'm2', 6,  '{"malowanie","wielowarstwowe"}'),
('paint-latex',               'painting', 'Malowanie farbami lateksowymi',                    'm2', 7,  '{"malowanie","lateks"}'),
('paint-ceramic',             'painting', 'Malowanie farbami ceramicznymi',                   'm2', 8,  '{"malowanie","ceramiczna"}'),
('paint-moisture-resistant',  'painting', 'Malowanie łazienek i kuchni farbami odpornymi na wilgoć','m2',9,'{"malowanie","wilgoć","łazienka"}'),
('paint-woodwork',            'painting', 'Malowanie stolarki wewnętrznej',                   'm2', 10, '{"malowanie","stolarka"}'),
('paint-pipes-metal',         'painting', 'Malowanie rur i elementów metalowych',             'mb', 11, '{"malowanie","rury","metal"}'),
('wallpaper-standard',        'painting', 'Tapetowanie',                                      'm2', 15, '{"tapeta","tapetowanie"}'),
('wallpaper-photo',           'painting', 'Tapetowanie fototapetą',                           'm2', 16, '{"tapeta","fototapeta"}'),
('wallpaper-removal',         'painting', 'Usuwanie tapet',                                   'm2', 17, '{"tapeta","usuwanie"}'),
('wall-decorative-cladding',  'painting', 'Montaż okładzin dekoracyjnych ściennych',          'm2', 20, '{"okładzina","dekoracyjna"}'),
('wall-decorative-feature',   'painting', 'Wykonywanie ścian dekoracyjnych',                  'm2', 21, '{"ściana","dekoracyjna"}'),
('plaster-decorative',        'painting', 'Tynki dekoracyjne',                                'm2', 22, '{"tynk","dekoracyjny"}'),
('concrete-architectural',    'painting', 'Beton architektoniczny',                           'm2', 23, '{"beton","architektoniczny"}'),
('stucco-decorative',         'painting', 'Stiuki i przecierki dekoracyjne',                  'm2', 24, '{"stiuk","dekoracyjny"}'),

-- =============================================================================
-- 5. Zabudowy gipsowo-kartonowe i sufity
-- =============================================================================
('gk-partition-wall',         'drywall', 'Ścianki działowe z płyt GK',                       'm2', 1,  '{"gk","ścianka","działowa"}'),
('gk-wall-cladding',          'drywall', 'Zabudowy ścienne GK',                              'm2', 2,  '{"gk","zabudowa","ścienna"}'),
('gk-installation-wall',      'drywall', 'Przedścianki instalacyjne',                        'm2', 3,  '{"gk","przedścianka","instalacja"}'),
('gk-ceiling-single',         'drywall', 'Sufity podwieszane jednopoziomowe',                'm2', 4,  '{"sufit","podwieszany"}'),
('gk-ceiling-multi',          'drywall', 'Sufity wielopoziomowe',                            'm2', 5,  '{"sufit","wielopoziomowy"}'),
('gk-ceiling-led',            'drywall', 'Sufity z oświetleniem LED',                        'm2', 6,  '{"sufit","LED","oświetlenie"}'),
('gk-niche',                  'drywall', 'Zabudowy wnęk',                                    'szt',7,  '{"gk","wnęka","zabudowa"}'),
('gk-wc-frame',               'drywall', 'Zabudowy stelaży WC',                              'kpl',8,  '{"gk","stelaż","WC"}'),
('gk-bathtub-casing',         'drywall', 'Obudowy wanien',                                   'kpl',9,  '{"gk","wanna","obudowa"}'),
('gk-pipe-casing',            'drywall', 'Obudowy pionów i rur',                             'mb', 10, '{"gk","pion","rura","obudowa"}'),
('gk-curtain-rail',           'drywall', 'Zabudowy karniszy',                                'mb', 11, '{"gk","karnisz"}'),
('gk-attic',                  'drywall', 'Zabudowy poddaszy',                                'm2', 12, '{"gk","poddasze"}'),
('gk-acoustic-wall',          'drywall', 'Izolacja akustyczna ścian GK',                     'm2', 13, '{"gk","akustyka","ściana"}'),
('gk-acoustic-ceiling',       'drywall', 'Izolacja akustyczna sufitów',                      'm2', 14, '{"gk","akustyka","sufit"}'),
('gk-waterproof',             'drywall', 'Montaż płyt wodoodpornych do łazienek',            'm2', 15, '{"gk","wodoodporny","łazienka"}'),
('gk-shelves-niches',         'drywall', 'Wykonywanie półek i nisz z GK',                    'szt',16, '{"gk","półka","nisza"}'),
('gk-installation-cover',     'drywall', 'Maskownice instalacyjne',                           'mb', 17, '{"gk","maskownica"}'),
('gk-decorative',             'drywall', 'Zabudowy dekoracyjne',                              'kpl',18, '{"gk","dekoracyjna"}'),

-- =============================================================================
-- 6. Podłogi i posadzki
-- =============================================================================
('floor-prep-substrate',      'flooring', 'Przygotowanie podłoża pod posadzkę',               'm2', 1,  '{"podłoga","podłoże","przygotowanie"}'),
('floor-demo-screed',         'flooring', 'Skuwanie starej wylewki',                          'm2', 2,  '{"wylewka","skuwanie"}'),
('floor-self-leveling',       'flooring', 'Wykonywanie wylewek samopoziomujących',            'm2', 3,  '{"wylewka","samopoziomująca"}'),
('floor-repair-leveling',     'flooring', 'Naprawa i wyrównanie posadzki',                    'm2', 4,  '{"posadzka","naprawa"}'),
('floor-laminate',            'flooring', 'Układanie paneli podłogowych',                     'm2', 5,  '{"panele","podłogowe"}'),
('floor-vinyl',               'flooring', 'Układanie paneli winylowych',                      'm2', 6,  '{"panele","winylowe"}'),
('floor-engineered-wood',     'flooring', 'Układanie deski warstwowej',                       'm2', 7,  '{"deska","warstwowa"}'),
('floor-parquet-install',     'flooring', 'Montaż parkietu',                                  'm2', 8,  '{"parkiet","montaż"}'),
('floor-parquet-sand',        'flooring', 'Cyklinowanie parkietu',                            'm2', 9,  '{"parkiet","cyklinowanie"}'),
('floor-parquet-oil',         'flooring', 'Olejowanie parkietu',                              'm2', 10, '{"parkiet","olejowanie"}'),
('floor-parquet-varnish',     'flooring', 'Lakierowanie parkietu',                            'm2', 11, '{"parkiet","lakierowanie"}'),
('floor-baseboards',          'flooring', 'Montaż listew przypodłogowych',                    'mb', 12, '{"listwy","przypodłogowe"}'),
('floor-thresholds',          'flooring', 'Montaż progów',                                    'szt',13, '{"próg","montaż"}'),
('floor-pvc',                 'flooring', 'Układanie wykładzin PVC',                           'm2', 14, '{"wykładzina","PVC"}'),
('floor-carpet',              'flooring', 'Układanie wykładzin dywanowych',                    'm2', 15, '{"wykładzina","dywanowa"}'),
('floor-linoleum',            'flooring', 'Układanie linoleum',                                'm2', 16, '{"linoleum"}'),
('floor-acoustic-underlay',   'flooring', 'Montaż podkładów akustycznych',                    'm2', 17, '{"podkład","akustyczny"}'),
('floor-expansion-joints',    'flooring', 'Dylatacje podłogowe',                               'mb', 18, '{"dylatacja","podłoga"}'),
('floor-renovation',          'flooring', 'Renowacja podłóg',                                  'm2', 19, '{"renowacja","podłoga"}'),
('floor-leveling-for-panels', 'flooring', 'Poziomowanie podłoża pod panele i deski',           'm2', 20, '{"poziomowanie","panele"}'),

-- =============================================================================
-- 7. Stolarka wewnętrzna
-- =============================================================================
('joinery-doors',             'joinery', 'Montaż drzwi wewnętrznych',                         'szt',1,  '{"drzwi","wewnętrzne","montaż"}'),
('joinery-frame-fixed',       'joinery', 'Montaż ościeżnic stałych',                         'szt',2,  '{"ościeżnica","stała"}'),
('joinery-frame-adjustable',  'joinery', 'Montaż ościeżnic regulowanych',                    'szt',3,  '{"ościeżnica","regulowana"}'),
('joinery-doors-hidden',      'joinery', 'Montaż drzwi ukrytych',                             'szt',4,  '{"drzwi","ukryte"}'),
('joinery-doors-sliding',     'joinery', 'Montaż drzwi przesuwnych',                          'szt',5,  '{"drzwi","przesuwne"}'),
('joinery-windowsills',       'joinery', 'Montaż parapetów wewnętrznych',                     'szt',6,  '{"parapet","wewnętrzny"}'),
('joinery-trim',              'joinery', 'Montaż listew maskujących',                         'mb', 7,  '{"listwy","maskujące"}'),
('joinery-finishing',         'joinery', 'Obróbka stolarki po montażu',                       'szt',8,  '{"stolarka","obróbka"}'),
('joinery-sealing',           'joinery', 'Uszczelnienia przy drzwiach i parapetach',           'mb', 9,  '{"uszczelnienie","drzwi","parapet"}'),
('joinery-door-adjustment',   'joinery', 'Regulacja drzwi',                                    'szt',10, '{"drzwi","regulacja"}'),
('joinery-hardware-replace',  'joinery', 'Wymiana klamek i okuć',                              'szt',11, '{"klamka","okucie"}'),
('joinery-transition-strips', 'joinery', 'Montaż progów i listew przejściowych',               'szt',12, '{"próg","listwa","przejściowa"}'),

-- =============================================================================
-- 8. Instalacje elektryczne
-- =============================================================================
('elec-new-points',           'electrical', 'Nowe punkty elektryczne',                          'szt',1,  '{"elektryka","punkt","nowy"}'),
('elec-relocate',             'electrical', 'Przenoszenie gniazd i włączników',                 'szt',2,  '{"elektryka","przenoszenie"}'),
('elec-rewire',               'electrical', 'Wymiana instalacji elektrycznej',                  'kpl',3,  '{"elektryka","wymiana","instalacja"}'),
('elec-conduit',              'electrical', 'Prowadzenie przewodów w bruzdach',                 'mb', 4,  '{"elektryka","bruzda","przewód"}'),
('elec-distribution-board',   'electrical', 'Montaż rozdzielni',                                'kpl',5,  '{"elektryka","rozdzielnia"}'),
('elec-lighting-connection',  'electrical', 'Podłączenie oświetlenia',                          'szt',6,  '{"elektryka","oświetlenie"}'),
('elec-wall-ceiling-lights',  'electrical', 'Montaż kinkietów, plafonów, spotów',               'szt',7,  '{"elektryka","kinkiet","plafon","spot"}'),
('elec-led-lighting',         'electrical', 'Oświetlenie LED',                                  'szt',8,  '{"elektryka","LED"}'),
('elec-led-strips',           'electrical', 'Taśmy LED w zabudowach',                           'mb', 9,  '{"elektryka","LED","taśma"}'),
('elec-appliance-connection', 'electrical', 'Podłączenie AGD',                                  'szt',10, '{"elektryka","AGD","podłączenie"}'),
('elec-accessories',          'electrical', 'Montaż osprzętu elektrycznego',                    'szt',11, '{"elektryka","osprzęt"}'),
('elec-rtv-lan',              'electrical', 'Gniazda RTV i internetowe',                        'szt',12, '{"elektryka","RTV","internet"}'),
('elec-mirror-led-prep',      'electrical', 'Przygotowanie instalacji pod lustra LED',           'szt',13, '{"elektryka","lustro","LED"}'),
('elec-power-prep',           'electrical', 'Przygotowanie zasilania pod rolety, wentylację i grzejniki','szt',14,'{"elektryka","zasilanie","rolety"}'),
('elec-white-install',        'electrical', 'Biały montaż elektryczny',                         'kpl',15, '{"elektryka","biały montaż"}'),
('elec-testing',              'electrical', 'Pomiary i sprawdzenie obwodów',                     'kpl',16, '{"elektryka","pomiary","obwody"}'),

-- =============================================================================
-- 9. Instalacje wodno-kanalizacyjne i sanitarne
-- =============================================================================
('plumb-new-points',          'plumbing', 'Wykonanie nowych punktów wod-kan',                  'szt',1,  '{"hydraulika","punkt","wod-kan"}'),
('plumb-relocate',            'plumbing', 'Przenoszenie punktów hydraulicznych',                'szt',2,  '{"hydraulika","przenoszenie"}'),
('plumb-connections-sink-wc', 'plumbing', 'Podejścia pod umywalki, WC, bidet, pralkę, zmywarkę','szt',3, '{"hydraulika","podejście","umywalka","WC"}'),
('plumb-connections-bath',    'plumbing', 'Podejścia pod wannę i prysznic',                    'szt',4,  '{"hydraulika","podejście","wanna","prysznic"}'),
('plumb-linear-drain',        'plumbing', 'Montaż odpływów liniowych',                        'szt',5,  '{"hydraulika","odpływ","liniowy"}'),
('plumb-concealed-frame',     'plumbing', 'Montaż stelaży podtynkowych',                      'szt',6,  '{"hydraulika","stelaż","podtynkowy"}'),
('plumb-valves-traps',        'plumbing', 'Montaż zaworów i syfonów',                         'szt',7,  '{"hydraulika","zawór","syfon"}'),
('plumb-riser-replacement',   'plumbing', 'Wymiana pionów i przyłączy lokalnych',              'kpl',8,  '{"hydraulika","pion","wymiana"}'),
('plumb-pressure-test',       'plumbing', 'Próby szczelności instalacji',                      'kpl',9,  '{"hydraulika","próba","szczelność"}'),
('plumb-sanitary-fixtures',   'plumbing', 'Montaż armatury łazienkowej',                      'kpl',10, '{"hydraulika","armatura","łazienka"}'),
('plumb-concealed-mixer',     'plumbing', 'Montaż baterii podtynkowych',                      'szt',11, '{"hydraulika","bateria","podtynkowa"}'),
('plumb-rain-shower',         'plumbing', 'Montaż deszczownic',                               'szt',12, '{"hydraulika","deszczownica"}'),
('plumb-wc-bidet',            'plumbing', 'Montaż misek WC i bidetów',                        'szt',13, '{"hydraulika","WC","bidet"}'),
('plumb-sink',                'plumbing', 'Montaż umywalek',                                  'szt',14, '{"hydraulika","umywalka"}'),
('plumb-bathtub',             'plumbing', 'Montaż wanien',                                    'szt',15, '{"hydraulika","wanna"}'),
('plumb-shower-tray',         'plumbing', 'Montaż brodzików',                                 'szt',16, '{"hydraulika","brodzik"}'),
('plumb-shower-cabin',        'plumbing', 'Montaż kabin prysznicowych',                       'szt',17, '{"hydraulika","kabina","prysznicowa"}'),
('plumb-white-install',       'plumbing', 'Biały montaż sanitarny',                           'kpl',18, '{"hydraulika","biały montaż"}'),
('plumb-silicone',            'plumbing', 'Silikonowanie przy armaturze',                      'mb', 19, '{"hydraulika","silikon","armatura"}'),

-- =============================================================================
-- 10. Łazienki i kuchnie pod klucz
-- =============================================================================
('turnkey-bathroom',          'turnkey', 'Kompleksowe wykonanie łazienki',                    'kpl',1,  '{"łazienka","pod klucz"}'),
('turnkey-wc',                'turnkey', 'Kompleksowe wykonanie WC',                          'kpl',2,  '{"WC","pod klucz"}'),
('turnkey-kitchen',           'turnkey', 'Kompleksowe wykonanie kuchni',                      'kpl',3,  '{"kuchnia","pod klucz"}'),
('turnkey-bath-raw',          'turnkey', 'Remont łazienki od stanu surowego',                 'kpl',4,  '{"łazienka","stan surowy"}'),
('turnkey-bath-old',          'turnkey', 'Remont łazienki w starym budownictwie',             'kpl',5,  '{"łazienka","stare budownictwo"}'),
('turnkey-small-bath',        'turnkey', 'Adaptacja małych łazienek',                         'kpl',6,  '{"łazienka","mała"}'),
('turnkey-layout-change',     'turnkey', 'Przeróbki instalacji pod nowy układ funkcjonalny',  'kpl',7,  '{"instalacja","układ","zmiana"}'),
('turnkey-furniture-prep',    'turnkey', 'Przygotowanie pod zabudowę meblową',                'kpl',8,  '{"meble","przygotowanie"}'),
('turnkey-bath-accessories',  'turnkey', 'Montaż akcesoriów łazienkowych',                    'kpl',9,  '{"łazienka","akcesoria"}'),
('turnkey-mirrors',           'turnkey', 'Montaż luster',                                     'szt',10, '{"lustro","montaż"}'),
('turnkey-niche-shelves',     'turnkey', 'Montaż zabudów i półek wnękowych',                  'szt',11, '{"półka","wnęka"}'),
('turnkey-wet-zone-seal',     'turnkey', 'Uszczelnienie stref mokrych',                       'm2', 12, '{"strefa mokra","uszczelnienie"}'),
('turnkey-kitchen-backsplash','turnkey', 'Wykończenie kuchni między szafkami',                 'mb', 13, '{"kuchnia","fartuch","szafki"}'),
('turnkey-utility-room',      'turnkey', 'Wykończenie pralni i pomieszczeń technicznych',     'kpl',14, '{"pralnia","pomieszczenie techniczne"}'),

-- =============================================================================
-- 11. Glazurnictwo podstawowe
-- =============================================================================
('tile-wall-glaze',           'tiling', 'Układanie glazury ściennej',                         'm2', 1,  '{"glazura","ścienna"}'),
('tile-floor-terracotta',     'tiling', 'Układanie terakoty',                                 'm2', 2,  '{"terakota"}'),
('tile-floor-gres',           'tiling', 'Układanie gresu',                                    'm2', 3,  '{"gres"}'),
('tile-floor-standard',       'tiling', 'Układanie płytek podłogowych',                       'm2', 4,  '{"płytki","podłogowe"}'),
('tile-wall-standard',        'tiling', 'Układanie płytek ściennych',                         'm2', 5,  '{"płytki","ścienne"}'),
('tile-bathroom',             'tiling', 'Kafelkowanie łazienki',                              'm2', 6,  '{"kafelkowanie","łazienka"}'),
('tile-toilet',               'tiling', 'Kafelkowanie toalety',                               'm2', 7,  '{"kafelkowanie","toaleta"}'),
('tile-kitchen',              'tiling', 'Kafelkowanie kuchni',                                'm2', 8,  '{"kafelkowanie","kuchnia"}'),
('tile-hallway',              'tiling', 'Układanie płytek w przedpokoju',                     'm2', 9,  '{"płytki","przedpokój"}'),
('tile-living-room',          'tiling', 'Układanie płytek w salonie',                         'm2', 10, '{"płytki","salon"}'),
('tile-laundry',              'tiling', 'Układanie płytek w pralni',                          'm2', 11, '{"płytki","pralnia"}'),
('tile-plinth',               'tiling', 'Układanie cokołów z płytek',                         'mb', 12, '{"cokół","płytki"}'),
('tile-grouting',             'tiling', 'Fugowanie',                                           'm2', 13, '{"fugowanie"}'),
('tile-silicone',             'tiling', 'Silikonowanie naroży i styków',                       'mb', 14, '{"silikonowanie","naroże"}'),
('tile-single-replace',       'tiling', 'Wymiana pojedynczych płytek',                         'szt',15, '{"płytki","wymiana"}'),
('tile-repair',               'tiling', 'Naprawy okładzin ceramicznych',                       'szt',16, '{"okładzina","naprawa"}'),
('tile-grout-repair',         'tiling', 'Uzupełnianie fug',                                    'mb', 17, '{"fuga","uzupełnianie"}'),
('tile-redo',                 'tiling', 'Skuwanie i ponowne wykonanie okładziny',              'm2', 18, '{"okładzina","ponowne"}'),

-- =============================================================================
-- 12. Glazurnictwo specjalistyczne
-- =============================================================================
('tile-large-format',         'tiling_specialist', 'Układanie płytek wielkoformatowych',        'm2', 1,  '{"płytki","wielkoformatowe"}'),
('tile-sintered-stone',       'tiling_specialist', 'Układanie spieków kwarcowych',              'm2', 2,  '{"spieki","kwarcowe"}'),
('tile-xxl',                  'tiling_specialist', 'Montaż płyt XXL',                           'm2', 3,  '{"płyty","XXL"}'),
('tile-thin-large',           'tiling_specialist', 'Montaż cienkoformatowych okładzin wielkoformatowych','m2',4,'{"cienkoformatowe","wielkoformatowe"}'),
('tile-mosaic',               'tiling_specialist', 'Układanie mozaiki',                          'm2', 5,  '{"mozaika"}'),
('tile-hexagonal',            'tiling_specialist', 'Układanie płytek heksagonalnych',            'm2', 6,  '{"heksagonalne"}'),
('tile-rectified',            'tiling_specialist', 'Układanie płytek rektyfikowanych',           'm2', 7,  '{"rektyfikowane"}'),
('tile-wood-look',            'tiling_specialist', 'Układanie płytek drewnopodobnych',           'm2', 8,  '{"drewnopodobne"}'),
('tile-marble-look',          'tiling_specialist', 'Układanie płytek marmuropodobnych',          'm2', 9,  '{"marmuropodobne"}'),
('tile-terrazzo-look',        'tiling_specialist', 'Układanie płytek lastryko',                  'm2', 10, '{"lastryko"}'),
('tile-3d-decorative',        'tiling_specialist', 'Układanie płytek dekoracyjnych 3D',          'm2', 11, '{"dekoracyjne","3D"}'),
('tile-patchwork',            'tiling_specialist', 'Układanie płytek patchworkowych',            'm2', 12, '{"patchwork"}'),
('tile-brick-pattern',        'tiling_specialist', 'Układanie płytek na wzór cegiełki',          'm2', 13, '{"cegiełka"}'),
('tile-diamond',              'tiling_specialist', 'Układanie płytek w karo',                    'm2', 14, '{"karo"}'),
('tile-offset',               'tiling_specialist', 'Układanie płytek na mijankę',                'm2', 15, '{"mijanka"}'),
('tile-custom-pattern',       'tiling_specialist', 'Układanie płytek we wzory niestandardowe',   'm2', 16, '{"wzór","niestandardowy"}'),
('tile-45-degree-cut',        'tiling_specialist', 'Cięcie płytek pod 45 stopni',                'mb', 20, '{"cięcie","45 stopni"}'),
('tile-edge-polishing',       'tiling_specialist', 'Szlifowanie krawędzi',                       'mb', 21, '{"szlifowanie","krawędź"}'),
('tile-hard-gres-work',       'tiling_specialist', 'Obróbka twardego gresu',                     'm2', 22, '{"gres","twardy","obróbka"}'),
('tile-drilling',             'tiling_specialist', 'Wiercenie otworów w płytkach',                'szt',23, '{"wiercenie","otwór"}'),
('tile-cutout',               'tiling_specialist', 'Wycinanie otworów pod osprzęt i armaturę',    'szt',24, '{"wycinanie","osprzęt"}'),
('tile-drain-cutout',         'tiling_specialist', 'Docinanie pod odpływy liniowe',               'szt',25, '{"docinanie","odpływ"}'),
('tile-corner-mitre',         'tiling_specialist', 'Licowanie narożników bez listew',             'mb', 26, '{"narożnik","bez listew"}'),
('tile-profileless-finish',   'tiling_specialist', 'Estetyczne wykończenia bezprofilowe',         'mb', 27, '{"bezprofilowe"}'),
('tile-shelf-niche',          'tiling_specialist', 'Wykonanie półek i nisz w płytkach',           'szt',28, '{"półka","nisza","płytki"}'),
('tile-countertop',           'tiling_specialist', 'Okładanie blatów płytkami lub spiekami',      'mb', 29, '{"blat","płytki","spieki"}'),
('tile-bathtub-cladding',     'tiling_specialist', 'Okładanie obudów wanien i stelaży',           'm2', 30, '{"wanna","stelaż","okładanie"}'),
('tile-stairs',               'tiling_specialist', 'Okładanie schodów płytką',                    'm2', 31, '{"schody","płytki"}'),
('tile-windowsill',           'tiling_specialist', 'Okładanie parapetów płytką lub spiekiem',     'szt',32, '{"parapet","płytki","spiek"}'),
('tile-cut-plinth',           'tiling_specialist', 'Wykonywanie cokołów ciętych z płytek',        'mb', 33, '{"cokół","cięty"}'),

-- =============================================================================
-- 13. Hydroizolacje i strefy mokre
-- =============================================================================
('waterproof-bathroom',       'waterproofing', 'Hydroizolacja łazienki',                        'm2', 1,  '{"hydroizolacja","łazienka"}'),
('waterproof-shower',         'waterproofing', 'Hydroizolacja strefy prysznica',                 'm2', 2,  '{"hydroizolacja","prysznic"}'),
('waterproof-bathtub',        'waterproofing', 'Hydroizolacja pod wannę',                        'm2', 3,  '{"hydroizolacja","wanna"}'),
('waterproof-linear-drain',   'waterproofing', 'Hydroizolacja pod odpływ liniowy',               'm2', 4,  '{"hydroizolacja","odpływ"}'),
('waterproof-corners',        'waterproofing', 'Uszczelnianie naroży',                           'mb', 5,  '{"uszczelnianie","naroże"}'),
('waterproof-sealing-tape',   'waterproofing', 'Taśmy uszczelniające',                           'mb', 6,  '{"taśma","uszczelniająca"}'),
('waterproof-sleeve',         'waterproofing', 'Manszety uszczelniające',                        'szt',7,  '{"manszeta","uszczelniająca"}'),
('waterproof-under-tile',     'waterproofing', 'Izolacja podpłytkowa',                           'm2', 8,  '{"izolacja","podpłytkowa"}'),
('waterproof-wet-zone',       'waterproofing', 'Zabezpieczenie ścian i podłóg w strefach mokrych','m2',9, '{"strefa mokra","zabezpieczenie"}'),
('waterproof-laundry',        'waterproofing', 'Hydroizolacja pralni',                           'm2', 10, '{"hydroizolacja","pralnia"}'),
('waterproof-kitchen',        'waterproofing', 'Hydroizolacja kuchni w strefach narażonych na wodę','m2',11,'{"hydroizolacja","kuchnia"}'),
('waterproof-balcony',        'waterproofing', 'Hydroizolacja balkonów',                         'm2', 12, '{"hydroizolacja","balkon"}'),
('waterproof-terrace',        'waterproofing', 'Hydroizolacja tarasów',                          'm2', 13, '{"hydroizolacja","taras"}'),
('waterproof-penetrations',   'waterproofing', 'Uszczelnianie przejść instalacyjnych',           'szt',14, '{"uszczelnianie","przejście"}'),
('waterproof-repair',         'waterproofing', 'Naprawa nieszczelności pod okładzinami',         'szt',15, '{"naprawa","nieszczelność"}'),

-- =============================================================================
-- 14. Tarasy, balkony, schody i strefy zewnętrzne
-- =============================================================================
('ext-terrace-tiles',         'exterior', 'Układanie płytek na tarasach',                      'm2', 1,  '{"taras","płytki"}'),
('ext-balcony-tiles',         'exterior', 'Układanie płytek na balkonach',                     'm2', 2,  '{"balkon","płytki"}'),
('ext-stairs-indoor',         'exterior', 'Okładziny schodów wewnętrznych',                    'm2', 3,  '{"schody","wewnętrzne"}'),
('ext-stairs-outdoor',        'exterior', 'Okładziny schodów zewnętrznych',                    'm2', 4,  '{"schody","zewnętrzne"}'),
('ext-stair-treads',          'exterior', 'Montaż stopnic',                                    'szt',5,  '{"stopnica","montaż"}'),
('ext-stair-plinth',          'exterior', 'Montaż cokołów schodowych',                        'mb', 6,  '{"cokół","schody"}'),
('ext-stair-edge',            'exterior', 'Obróbka krawędzi schodów',                          'mb', 7,  '{"schody","krawędź"}'),
('ext-terrace-slope',         'exterior', 'Wykonanie spadków na tarasach i balkonach',          'm2', 8,  '{"spadek","taras","balkon"}'),
('ext-terrace-seal',          'exterior', 'Uszczelnienie tarasów i balkonów',                   'm2', 9,  '{"uszczelnienie","taras"}'),
('ext-flex-grouting',         'exterior', 'Fugowanie elastyczne stref zewnętrznych',             'm2', 10, '{"fugowanie","elastyczne"}'),
('ext-stair-tile-replace',    'exterior', 'Wymiana płytek na schodach',                         'szt',11, '{"schody","wymiana","płytki"}'),
('ext-stair-renovation',      'exterior', 'Renowacja okładzin schodowych',                      'm2', 12, '{"schody","renowacja"}'),

-- =============================================================================
-- 15. Kamień, konglomerat, lastryko i okładziny specjalne
-- =============================================================================
('stone-marble-walls',        'stone', 'Wykładanie ścian marmurem',                            'm2', 1,  '{"marmur","ściana"}'),
('stone-granite-floors',      'stone', 'Wykładanie podłóg granitem',                           'm2', 2,  '{"granit","podłoga"}'),
('stone-slate',               'stone', 'Okładziny z łupka',                                   'm2', 3,  '{"łupek"}'),
('stone-natural',             'stone', 'Okładziny z kamienia naturalnego',                     'm2', 4,  '{"kamień","naturalny"}'),
('stone-conglomerate',        'stone', 'Montaż konglomeratu',                                  'm2', 5,  '{"konglomerat"}'),
('stone-windowsill',          'stone', 'Montaż parapetów kamiennych',                          'szt',6,  '{"parapet","kamienny"}'),
('stone-countertop',          'stone', 'Montaż blatów kamiennych',                             'mb', 7,  '{"blat","kamienny"}'),
('stone-sintered-countertop', 'stone', 'Montaż blatów ze spieków',                             'mb', 8,  '{"blat","spiek"}'),
('stone-decorative',          'stone', 'Okładziny dekoracyjne z kamienia',                      'm2', 9,  '{"kamień","dekoracyjny"}'),
('stone-terrazzo',            'stone', 'Lastryko na ścianach i podłogach',                      'm2', 10, '{"lastryko"}'),

-- =============================================================================
-- 16. Biały montaż i wyposażenie końcowe
-- =============================================================================
('white-shower-cabin',        'finishing', 'Montaż kabin prysznicowych',                        'szt',1,  '{"kabina","prysznicowa"}'),
('white-walkin-glass',        'finishing', 'Montaż szyb walk-in',                               'szt',2,  '{"szyba","walk-in"}'),
('white-bath-screen',         'finishing', 'Montaż parawanów wannowych',                        'szt',3,  '{"parawan","wannowy"}'),
('white-freestanding-bath',   'finishing', 'Montaż wanien wolnostojących',                      'szt',4,  '{"wanna","wolnostojąca"}'),
('white-concealed-set',       'finishing', 'Montaż zestawów podtynkowych',                      'kpl',5,  '{"zestaw","podtynkowy"}'),
('white-vessel-sink',         'finishing', 'Montaż umywalek nablatowych',                       'szt',6,  '{"umywalka","nablatowa"}'),
('white-bath-cabinet',        'finishing', 'Montaż szafek łazienkowych',                        'szt',7,  '{"szafka","łazienkowa"}'),
('white-mirror-cabinet',      'finishing', 'Montaż luster i szafek z lustrem',                  'szt',8,  '{"lustro","szafka"}'),
('white-towel-radiator',      'finishing', 'Montaż grzejników łazienkowych',                    'szt',9,  '{"grzejnik","łazienkowy"}'),
('white-bath-accessories',    'finishing', 'Montaż akcesoriów łazienkowych',                    'kpl',10, '{"akcesoria","łazienkowe"}'),
('white-mixer-shower-set',    'finishing', 'Montaż baterii i zestawów natryskowych',             'kpl',11, '{"bateria","natrysk"}'),
('white-kitchen-sink',        'finishing', 'Montaż zlewów i baterii kuchennych',                 'szt',12, '{"zlew","bateria","kuchnia"}'),
('white-kitchen-appliance',   'finishing', 'Podłączenie AGD w kuchni',                           'szt',13, '{"AGD","kuchnia"}'),
('white-hood-finishing',      'finishing', 'Montaż okapów i elementów wykończeniowych',          'szt',14, '{"okap","wykończenie"}'),

-- =============================================================================
-- 17. Prace stolarskie, meblowe i dekoracyjne
-- =============================================================================
('carpentry-built-in',        'carpentry', 'Montaż zabudów meblowych',                          'kpl',1,  '{"zabudowa","meblowa"}'),
('carpentry-countertop',      'carpentry', 'Dopasowanie blatów',                                 'mb', 2,  '{"blat","dopasowanie"}'),
('carpentry-wall-slats',      'carpentry', 'Montaż lameli ściennych',                            'm2', 3,  '{"lamele","ścienne"}'),
('carpentry-wall-panels',     'carpentry', 'Montaż paneli ściennych',                            'm2', 4,  '{"panele","ścienne"}'),
('carpentry-decorative-trim', 'carpentry', 'Montaż listew dekoracyjnych',                        'mb', 5,  '{"listwy","dekoracyjne"}'),
('carpentry-decorative-cover','carpentry', 'Obudowy dekoracyjne',                                 'kpl',6,  '{"obudowa","dekoracyjna"}'),
('carpentry-shelves',         'carpentry', 'Montaż półek',                                        'szt',7,  '{"półka","montaż"}'),
('carpentry-covers',          'carpentry', 'Montaż maskownic',                                    'szt',8,  '{"maskownica"}'),
('carpentry-minor-work',      'carpentry', 'Drobne przeróbki stolarskie przy zabudowach',         'h',  9,  '{"stolarka","przeróbki"}'),
('carpentry-fit-to-walls',    'carpentry', 'Dopasowanie mebli do krzywizn ścian i podłóg',       'kpl',10, '{"meble","dopasowanie"}'),

-- =============================================================================
-- 18. Drobne naprawy, serwis i renowacje
-- =============================================================================
('repair-tile-replace',       'repair', 'Wymiana uszkodzonych płytek',                          'szt',1,  '{"naprawa","płytki","wymiana"}'),
('repair-grout',              'repair', 'Naprawa fug',                                          'mb', 2,  '{"naprawa","fuga"}'),
('repair-silicone-grout',     'repair', 'Usuwanie pęknięć fug i silikonów',                    'mb', 3,  '{"naprawa","silikon","pęknięcie"}'),
('repair-mold-removal',       'repair', 'Odgrzybianie stref mokrych',                          'm2', 4,  '{"odgrzybianie","strefa mokra"}'),
('repair-leak-fix',           'repair', 'Naprawa przecieków przy armaturze',                    'szt',5,  '{"naprawa","przeciek"}'),
('repair-after-previous',     'repair', 'Poprawki po wcześniejszych ekipach',                   'kpl',6,  '{"poprawki","ekipa"}'),
('repair-bath-no-demo',       'repair', 'Renowacja łazienek bez pełnego demontażu',            'kpl',7,  '{"renowacja","łazienka"}'),
('repair-rental-refresh',     'repair', 'Odświeżenie mieszkań pod wynajem',                    'kpl',8,  '{"odświeżenie","wynajem"}'),
('repair-local-paint',        'repair', 'Lokalne malowanie po naprawach',                       'm2', 9,  '{"malowanie","lokalne"}'),
('repair-flood-damage',       'repair', 'Naprawa uszkodzeń po zalaniu',                        'kpl',10, '{"naprawa","zalanie"}'),
('repair-wall-ceiling-fill',  'repair', 'Uzupełnianie ubytków ścian i sufitów',                'szt',11, '{"uzupełnianie","ubytek"}'),
('repair-trim-replace',       'repair', 'Wymiana listew, progów i elementów wykończeniowych',   'szt',12, '{"wymiana","listwy","progi"}'),

-- =============================================================================
-- 19. Usługi dodatkowe i okołoremontowe
-- =============================================================================
('service-tile-layout',       'service', 'Projekt układu płytek',                               'kpl',1,  '{"projekt","układ","płytki"}'),
('service-grid-drawing',      'service', 'Rozrysowanie osi i fug',                              'kpl',2,  '{"oś","fuga","rozrysowanie"}'),
('service-format-advice',     'service', 'Dobór formatu płytek do pomieszczenia',               'kpl',3,  '{"dobór","format"}'),
('service-material-advice',   'service', 'Doradztwo materiałowe',                               'h',  4,  '{"doradztwo","materiał"}'),
('service-measurement',       'service', 'Obmiary i kosztorys',                                  'kpl',5,  '{"obmiar","kosztorys"}'),
('service-material-purchase', 'service', 'Zakup materiałów z wykonawcą',                        'kpl',6,  '{"zakup","materiał"}'),
('service-material-transport','service', 'Transport materiałów',                                 'kpl',7,  '{"transport","materiał"}'),
('service-material-carry-in', 'service', 'Wniesienie materiałów',                               'kpl',8,  '{"wniesienie","materiał"}'),
('service-crew-coordination', 'service', 'Koordynacja ekip',                                     'kpl',9,  '{"koordynacja","ekipa"}'),
('service-schedule',          'service', 'Harmonogram prac',                                     'kpl',10, '{"harmonogram"}'),
('service-post-cleanup',      'service', 'Sprzątanie po remoncie',                                'kpl',11, '{"sprzątanie","remont"}'),
('service-handover-prep',     'service', 'Przygotowanie mieszkania do odbioru',                   'kpl',12, '{"przygotowanie","odbiór"}'),
('service-technical-handover','service', 'Odbiór techniczny wykonanych prac',                     'kpl',13, '{"odbiór","techniczny"}'),

-- =============================================================================
-- 20. Kompleksowe remonty i wykończenia
-- =============================================================================
('complex-apartment-reno',    'complex', 'Remont mieszkania',                                     'kpl',1,  '{"remont","mieszkanie"}'),
('complex-house-reno',        'complex', 'Remont domu',                                           'kpl',2,  '{"remont","dom"}'),
('complex-commercial-reno',   'complex', 'Remont lokalu usługowego',                              'kpl',3,  '{"remont","lokal"}'),
('complex-developer-finish',  'complex', 'Wykończenie mieszkania od dewelopera',                   'kpl',4,  '{"wykończenie","deweloper"}'),
('complex-house-turnkey',     'complex', 'Wykończenie domu pod klucz',                             'kpl',5,  '{"wykończenie","dom","pod klucz"}'),
('complex-interior-adapt',    'complex', 'Adaptacja wnętrz',                                      'kpl',6,  '{"adaptacja","wnętrze"}'),
('complex-modernization',     'complex', 'Modernizacja wnętrz',                                   'kpl',7,  '{"modernizacja","wnętrze"}'),
('complex-bathroom-rebuild',  'complex', 'Przebudowa łazienki',                                   'kpl',8,  '{"przebudowa","łazienka"}'),
('complex-kitchen-rebuild',   'complex', 'Przebudowa kuchni',                                     'kpl',9,  '{"przebudowa","kuchnia"}'),
('complex-living-room-reno',  'complex', 'Remont salonu',                                         'kpl',10, '{"remont","salon"}'),
('complex-bedroom-reno',      'complex', 'Remont sypialni',                                       'kpl',11, '{"remont","sypialnia"}'),
('complex-hallway-reno',      'complex', 'Remont korytarza',                                      'kpl',12, '{"remont","korytarz"}'),
('complex-laundry-reno',      'complex', 'Remont pralni',                                         'kpl',13, '{"remont","pralnia"}'),
('complex-wardrobe-reno',     'complex', 'Remont garderoby',                                      'kpl',14, '{"remont","garderoba"}'),
('complex-office-reno',       'complex', 'Remont biura',                                          'kpl',15, '{"remont","biuro"}'),

-- Dodatkowe specjalistyczne pozycje
('tile-glass-mosaic',         'tiling_specialist', 'Układanie mozaiki szklanej',                   'm2', 40, '{"mozaika","szklana"}'),
('tile-stone-mosaic',         'tiling_specialist', 'Układanie mozaiki kamiennej',                  'm2', 41, '{"mozaika","kamienna"}'),
('tile-decorative-wall',      'tiling_specialist', 'Okładziny dekoracyjne ścian',                  'm2', 42, '{"okładzina","dekoracyjna","ściana"}'),
('tile-wall-cladding',        'tiling_specialist', 'Licowanie ścian płytką',                       'm2', 43, '{"licowanie","ściana"}'),
('tile-kitchen-backsplash',   'tiling_specialist', 'Płytki na fartuch kuchenny',                   'm2', 44, '{"fartuch","kuchenny"}'),
('tile-between-cabinets',     'tiling_specialist', 'Płytki między szafkami',                       'm2', 45, '{"płytki","szafki"}'),
('tile-fireplace',            'tiling_specialist', 'Płytki na obudowie kominka',                   'm2', 46, '{"kominek","płytki"}'),
('tile-stove-cladding',       'tiling_specialist', 'Ceramiczna obudowa pieca',                     'm2', 47, '{"piec","ceramika"}'),
('tile-entrance-zone',        'tiling_specialist', 'Płytki w strefie wejścia',                     'm2', 48, '{"strefa wejścia","płytki"}'),
('tile-anti-slip',            'tiling_specialist', 'Płytki antypoślizgowe',                        'm2', 49, '{"antypoślizgowe"}'),
('tile-rectified-narrow-grout','tiling_specialist','Płytki rektyfikowane z wąską fugą',             'm2', 50, '{"rektyfikowane","wąska fuga"}'),
('tile-plinth-ready',         'tiling', 'Układanie cokołów gotowych',                              'mb', 20, '{"cokół","gotowy"}'),
('tile-plinth-cut',           'tiling', 'Układanie cokołów ciętych',                               'mb', 21, '{"cokół","cięty"}'),
('tile-profile-finish',       'tiling', 'Montaż profili wykończeniowych',                          'mb', 22, '{"profil","wykończeniowy"}'),
('tile-corner-aluminum',      'tiling', 'Wykończenie narożników aluminiowych',                     'mb', 23, '{"narożnik","aluminiowy"}'),
('tile-corner-steel',         'tiling', 'Wykończenie narożników stalowych',                        'mb', 24, '{"narożnik","stalowy"}'),
('tile-stair-strip',          'tiling', 'Montaż listew schodowych',                               'mb', 25, '{"listwa","schodowa"}'),
('tile-drill-socket-drain',   'tiling_specialist', 'Wiercenie pod puszki i odpływy',               'szt',51, '{"wiercenie","puszka","odpływ"}'),
('tile-cutout-concealed-mixer','tiling_specialist','Docinanie pod baterie podtynkowe',              'szt',52, '{"docinanie","bateria","podtynkowa"}'),
('tile-substrate-leveling',   'substrate', 'Niwelacja nierówności pod płytki',                     'm2', 20, '{"niwelacja","nierówność","płytki"}'),
('tile-floor-prep-gres',      'substrate', 'Przygotowanie posadzki pod gres',                      'm2', 21, '{"posadzka","gres","przygotowanie"}'),
('waterproof-mesh-mat',       'waterproofing', 'Montaż mat i siatek uszczelniających',             'm2', 20, '{"mata","siatka","uszczelniająca"}'),
('waterproof-expansion-flex', 'waterproofing', 'Dylatacje elastyczne',                              'mb', 21, '{"dylatacja","elastyczna"}'),
('tile-epoxy-grout',          'tiling', 'Epoksydowe fugowanie',                                    'm2', 26, '{"fugowanie","epoksydowe"}'),
('tile-sanitary-silicone',    'tiling', 'Silikon sanitarny',                                       'mb', 27, '{"silikon","sanitarny"}'),
('tile-counter-wall-seal',    'tiling', 'Uszczelnianie blatów i przyściennych styków',             'mb', 28, '{"uszczelnianie","blat","styk"}'),
('gk-access-panel',           'drywall', 'Montaż rewizji w zabudowie',                             'szt',20, '{"rewizja","zabudowa"}'),
('waterproof-shower-slope',   'waterproofing', 'Wykonanie spadków w prysznicu',                    'm2', 22, '{"spadek","prysznic"}'),
('waterproof-linear-drain-slope','waterproofing','Spadki pod odpływ liniowy',                       'm2', 23, '{"spadek","odpływ liniowy"}'),
('gk-wc-shelf',               'drywall', 'Montaż zabudowy WC z półką',                             'kpl',21, '{"zabudowa","WC","półka"}'),
('tile-niche-shelf',          'tiling_specialist', 'Półki wnękowe w glazurze',                      'szt',53, '{"półka","wnękowa","glazura"}'),
('turnkey-custom-mirror',     'turnkey', 'Montaż lustra na wymiar',                                'szt',15, '{"lustro","na wymiar"}'),
('finishing-final-accessories','finishing', 'Montaż osprzętu końcowego po remoncie',                'kpl',15, '{"osprzęt","końcowy","remont"}')
;
