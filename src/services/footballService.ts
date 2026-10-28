import {
  CompetitionMeta,
  FootballMatch,
  FootballMatchesResponse,
  FootballMatchStatus,
  FootballStandingRow,
  FootballStandingsResponse
} from '../types/football';

export const DEFAULT_API_KEY = '3245db41976cfeae9ceed6f34f14fbc2';
const API_STORAGE_KEY = 'alsari_football_api_token';
const CACHE_MATCHES_KEY = 'alsari_football_matches_cache';
const CACHE_DATE_FIXTURES_KEY = 'alsari_football_date_fixtures_cache';
const CACHE_STANDINGS_KEY_PREFIX = 'alsari_football_standings_';

// Free tier rate limits: 10 calls per minute, 100 requests per day on API-Sports
const MAX_CALLS_PER_MINUTE = 10;
const WINDOW_MS = 60 * 1000;

// Comprehensive curated Arabic translations for National Teams (المنتخبات الوطنية)
export const ARABIC_NATIONAL_TEAMS: Record<string, string> = {
  // Arab National Teams
  'Iraq': 'منتخب العراق',
  'Iraq U23': 'منتخب العراق الأولمبي',
  'Iraq U20': 'منتخب العراق للشباب',
  'Iraq Women': 'منتخب العراق للسيدات',
  'Saudi Arabia': 'منتخب السعودية',
  'Saudi Arabia U23': 'منتخب السعودية الأولمبي',
  'Egypt': 'منتخب مصر',
  'Egypt U23': 'منتخب مصر الأولمبي',
  'Morocco': 'منتخب المغرب',
  'Morocco U23': 'منتخب المغرب الأولمبي',
  'Algeria': 'منتخب الجزائر',
  'Tunisia': 'منتخب تونس',
  'Qatar': 'منتخب قطر',
  'United Arab Emirates': 'منتخب الإمارات',
  'UAE': 'منتخب الإمارات',
  'Jordan': 'منتخب الأردن',
  'Palestine': 'منتخب فلسطين',
  'Syria': 'منتخب سوريا',
  'Kuwait': 'منتخب الكويت',
  'Oman': 'منتخب عمان',
  'Bahrain': 'منتخب البحرين',
  'Lebanon': 'منتخب لبنان',
  'Yemen': 'منتخب اليمن',
  'Sudan': 'منتخب السودان',
  'Libya': 'منتخب ليبيا',
  'Mauritania': 'منتخب موريتانيا',
  'Somalia': 'منتخب الصومال',
  'Comoros': 'منتخب جزر القمر',
  'Djibouti': 'منتخب جيبوتي',

  // European Giants
  'France': 'منتخب فرنسا',
  'France U21': 'منتخب فرنسا للشباب',
  'England': 'منتخب إنجلترا',
  'England U21': 'منتخب إنجلترا للشباب',
  'Spain': 'منتخب إسبانيا',
  'Spain U21': 'منتخب إسبانيا للشباب',
  'Germany': 'منتخب ألمانيا',
  'Germany U21': 'منتخب ألمانيا للشباب',
  'Italy': 'منتخب إيطاليا',
  'Italy U21': 'منتخب إيطاليا للشباب',
  'Portugal': 'منتخب البرتغال',
  'Portugal U21': 'منتخب البرتغال للشباب',
  'Netherlands': 'منتخب هولندا',
  'Holland': 'منتخب هولندا',
  'Belgium': 'منتخب بلجيكا',
  'Croatia': 'منتخب كرواتيا',
  'Turkey': 'منتخب تركيا',
  'Türkiye': 'منتخب تركيا',
  'Sweden': 'منتخب السويد',
  'Denmark': 'منتخب الدنمارك',
  'Switzerland': 'منتخب سويسرا',
  'Norway': 'منتخب النرويج',
  'Poland': 'منتخب بولندا',
  'Czech Republic': 'منتخب التشيك',
  'Czechia': 'منتخب التشيك',
  'Austria': 'منتخب النمسا',
  'Scotland': 'منتخب اسكتلندا',
  'Wales': 'منتخب ويلز',
  'Ukraine': 'منتخب أوكرانيا',
  'Serbia': 'منتخب صربيا',
  'Greece': 'منتخب اليونان',
  'Hungary': 'منتخب المجر',
  'Romania': 'منتخب رومانيا',
  'Slovakia': 'منتخب سلوفاكيا',
  'Slovenia': 'منتخب سلوفينيا',
  'Georgia': 'منتخب جورجيا',
  'Albania': 'منتخب ألبانيا',
  'Republic of Ireland': 'منتخب أيرلندا',
  'Ireland': 'منتخب أيرلندا',
  'Northern Ireland': 'منتخب أيرلندا الشمالية',
  'Iceland': 'منتخب آيسلندا',
  'Finland': 'منتخب فنلندا',
  'Bosnia & Herzegovina': 'منتخب البوسنة والهرسك',
  'Bosnia and Herzegovina': 'منتخب البوسنة والهرسك',
  'North Macedonia': 'منتخب مقدونيا الشمالية',
  'Montenegro': 'منتخب الجبل الأسود',
  'Cyprus': 'منتخب قبرص',
  'Luxembourg': 'منتخب لوكسمبورغ',
  'Armenia': 'منتخب أرمينيا',
  'Kazakhstan': 'منتخب كازاخستان',
  'Azerbaijan': 'منتخب أذربيجان',

  // South America
  'Argentina': 'منتخب الأرجنتين',
  'Argentina U23': 'منتخب الأرجنتين الأولمبي',
  'Brazil': 'منتخب البرازيل',
  'Brazil U23': 'منتخب البرازيل الأولمبي',
  'Uruguay': 'منتخب أوروغواي',
  'Colombia': 'منتخب كولومبيا',
  'Chile': 'منتخب تشيلي',
  'Ecuador': 'منتخب الإكوادور',
  'Peru': 'منتخب بيرو',
  'Paraguay': 'منتخب باراغواي',
  'Venezuela': 'منتخب فنزويلا',
  'Bolivia': 'منتخب بوليفيا',

  // North & Central America
  'United States': 'منتخب الولايات المتحدة',
  'USA': 'منتخب الولايات المتحدة',
  'Mexico': 'منتخب المكسيك',
  'Canada': 'منتخب كندا',
  'Costa Rica': 'منتخب كوستاريكا',
  'Panama': 'منتخب بنما',
  'Jamaica': 'منتخب جامايكا',
  'Honduras': 'منتخب هندوراس',

  // Asia & Oceania
  'Japan': 'منتخب اليابان',
  'Japan U23': 'منتخب اليابان الأولمبي',
  'South Korea': 'منتخب كوريا الجنوبية',
  'Korea Republic': 'منتخب كوريا الجنوبية',
  'Australia': 'منتخب أستراليا',
  'Iran': 'منتخب إيران',
  'IR Iran': 'منتخب إيران',
  'Uzbekistan': 'منتخب أوزبكستان',
  'Indonesia': 'منتخب إندونيسيا',
  'Thailand': 'منتخب تايلاند',
  'Vietnam': 'منتخب فيتنام',
  'China': 'منتخب الصين',
  'China PR': 'منتخب الصين',
  'India': 'منتخب الهند',
  'North Korea': 'منتخب كوريا الشمالية',
  'DPR Korea': 'منتخب كوريا الشمالية',
  'Malaysia': 'منتخب ماليزيا',
  'New Zealand': 'منتخب نيوزيلندا',

  // Africa
  'Senegal': 'منتخب السنغال',
  'Nigeria': 'منتخب نيجيريا',
  'Ivory Coast': 'منتخب ساحل العاج',
  'Côte d\'Ivoire': 'منتخب ساحل العاج',
  'Cote d\'Ivoire': 'منتخب ساحل العاج',
  'Cameroon': 'منتخب الكاميرون',
  'Ghana': 'منتخب غانا',
  'Mali': 'منتخب مالي',
  'South Africa': 'منتخب جنوب أفريقيا',
  'DR Congo': 'منتخب الكونغو الديمقراطية',
  'Congo DR': 'منتخب الكونغو الديمقراطية',
  'Burkina Faso': 'منتخب بوركينا فاسو',
  'Guinea': 'منتخب غينيا',
  'Angola': 'منتخب أنغولا',
  'Zambia': 'منتخب زامبيا',
  'Cape Verde': 'منتخب الرأس الأخضر',
  'Uganda': 'منتخب أوغندا',
  'Togo': 'منتخب توغو'
};

// Comprehensive curated Arabic translations for Football Clubs
export const ARABIC_TEAM_NAMES: Record<string, string> = {
  // Merge all national teams
  ...ARABIC_NATIONAL_TEAMS,

  // --- دوري نجوم العراق والأندية العراقية ---
  'Al-Shorta SC': 'الشرطة العراقي',
  'Al Shorta': 'الشرطة العراقي',
  'Al-Shorta': 'الشرطة العراقي',
  'Al Quwa Al Jawiya': 'القوة الجوية',
  'Al-Quwa Al-Jawiya': 'القوة الجوية',
  'Air Force Club': 'القوة الجوية',
  'Al Zawraa': 'الزوراء',
  'Al-Zawraa': 'الزوراء',
  'Al Zawra\'a': 'الزوراء',
  'Al Talaba': 'الطلبة',
  'Al-Talaba': 'الطلبة',
  'Erbil': 'أربيل',
  'Arbil': 'أربيل',
  'Erbil SC': 'أربيل',
  'Zakho': 'زاخو',
  'Zakho SC': 'زاخو',
  'Al Najaf': 'النجف',
  'Al-Najaf': 'النجف',
  'Al Minaa': 'الميناء',
  'Al-Minaa': 'الميناء',
  'Al Mina\'a': 'الميناء',
  'Naft Maysan': 'نفط ميسان',
  'Naft Meisan': 'نفط ميسان',
  'Al Karkh': 'الكرخ',
  'Al-Karkh': 'الكرخ',
  'Naft Al-Basra': 'نفط البصرة',
  'Naft Al Basra': 'نفط البصرة',
  'Naft Al Janoob': 'نفط البصرة',
  'Al Kahrabaa': 'الكهرباء',
  'Al-Kahrabaa': 'الكهرباء',
  'Al Kahraba': 'الكهرباء',
  'Karbala': 'كربلاء',
  'Karbala SC': 'كربلاء',
  'Newroz': 'نوروز',
  'Nowruz': 'نوروز',
  'Duhok': 'دهوك',
  'Dohuk': 'دهوك',
  'Duhok SC': 'دهوك',
  'Al Qasim': 'القاسم',
  'Al-Qasim': 'القاسم',
  'Al Naft': 'النفط',
  'Al-Naft': 'النفط',
  'Al Hudod': 'الحدود',
  'Al-Hudod': 'الحدود',
  'Al Hodood': 'الحدود',
  'Diyala': 'ديالى',
  'Diyala SC': 'ديالى',
  'Al Karma': 'الكرمة',
  'Al-Karma': 'الكرمة',
  'Amanat Baghdad': 'أمانة بغداد',
  'Al Sina\'a': 'الصناعة',
  'Samarra': 'سامراء',
  'Naft Al Wasat': 'نفط الوسط',

  // --- دوري روشن السعودي ---
  'Al-Hilal': 'الهلال السعودي',
  'Al Hilal': 'الهلال السعودي',
  'Al-Hilal Saudi FC': 'الهلال السعودي',
  'Al-Nassr': 'النصر السعودي',
  'Al Nassr': 'النصر السعودي',
  'Al-Nassr FC': 'النصر السعودي',
  'Al-Ittihad': 'الاتحاد السعودي',
  'Al Ittihad': 'الاتحاد السعودي',
  'Al-Ittihad Club': 'الاتحاد السعودي',
  'Al-Ahli': 'الأهلي السعودي',
  'Al Ahli': 'الأهلي السعودي',
  'Al-Ahli Saudi FC': 'الأهلي السعودي',
  'Al Ahli SFC': 'الأهلي السعودي',
  'Al-Shabab': 'الشباب السعودي',
  'Al Shabab': 'الشباب السعودي',
  'Al-Shabab FC': 'الشباب السعودي',
  'Al-Ettifaq': 'الاتفاق السعودي',
  'Al Ettifaq': 'الاتفاق السعودي',
  'Al-Ettifaq FC': 'الاتفاق السعودي',
  'Al-Taawoun': 'التعاون السعودي',
  'Al Taawoun': 'التعاون السعودي',
  'Al-Taawon': 'التعاون السعودي',
  'Al-Fateh': 'الفتح السعودي',
  'Al Fateh': 'الفتح السعودي',
  'Al-Qadsiah': 'القادسية السعودي',
  'Al Qadsiah': 'القادسية السعودي',
  'Al-Qadisiya': 'القادسية السعودي',
  'Damac': 'ضمك',
  'Damac FC': 'ضمك',
  'Damak': 'ضمك',
  'Al-Fayha': 'الفيحاء',
  'Al Fayha': 'الفيحاء',
  'Al-Feiha': 'الفيحاء',
  'Al-Khaleej': 'الخليج السعودي',
  'Al Khaleej': 'الخليج السعودي',
  'Al-Raed': 'الرائد السعودي',
  'Al Raed': 'الرائد السعودي',
  'Al-Wehda': 'الوحدة السعودي',
  'Al Wehda': 'الوحدة السعودي',
  'Al-Okhdood': 'الأخدود السعودي',
  'Al Okhdood': 'الأخدود السعودي',
  'Al-Akhdoud': 'الأخدود السعودي',
  'Al-Orobah': 'العروبة السعودي',
  'Al Orobah': 'العروبة السعودي',
  'Al-Kholood': 'الخلود السعودي',
  'Al Kholood': 'الخلود السعودي',
  'Al-Riyadh': 'الرياض السعودي',
  'Al Riyadh': 'الرياض السعودي',
  'Al-Hazem': 'الحزم السعودي',
  'Al Hazem': 'الحزم السعودي',
  'Al-Tai': 'الطائي',
  'Al Tai': 'الطائي',
  'Abha': 'أبها',
  'Al-Batin': 'الباطن',
  'Al-Faisaly FC': 'الفيصلي السعودي',

  // --- الدوري المصري والدوريات المغاربية ---
  'Al-Ahly': 'الأهلي المصري',
  'Al Ahly': 'الأهلي المصري',
  'Al Ahly SC': 'الأهلي المصري',
  'Al-Ahly Cairo': 'الأهلي المصري',
  'Zamalek': 'الزمالك',
  'Zamalek SC': 'الزمالك',
  'Pyramids FC': 'بيراميدز',
  'Pyramids': 'بيراميدز',
  'Modern Sport': 'مودرن سبورت',
  'Future FC': 'مودرن سبورت',
  'Al Masry': 'المصري البورسعيدي',
  'Al-Masry': 'المصري البورسعيدي',
  'Ismaily': 'الإسماعيلي',
  'Ismaily SC': 'الإسماعيلي',
  'Smouha': 'سموحة',
  'Smouha SC': 'سموحة',
  'Ceramica Cleopatra': 'سيراميكا كليوباترا',
  'ENPPI': 'إنبي',
  'Enppi SC': 'إنبي',
  'ZED FC': 'زد',
  'National Bank of Egypt': 'البنك الأهلي',
  'Tala\'ea El Gaish': 'طلائع الجيش',
  'Al Ittihad Alexandria': 'الاتحاد السكندري',
  'Pharco FC': 'فاركو',
  'Al Mokawloon': 'المقاولون العرب',
  'Arab Contractors': 'المقاولون العرب',
  'El Gouna': 'الجونة',
  'Ghazl El Mahalla': 'غزل المحلة',
  'Baladiyat El Mahalla': 'بلدية المحلة',
  'Haras El Hodood': 'حرس الحدود',
  'Petrojet': 'بتروجيت',

  // شمال أفريقيا والمغرب الكبير
  'Wydad AC': 'الوداد الرياضي',
  'Wydad Casablanca': 'الوداد الرياضي',
  'Raja CA': 'الرجاء الرياضي',
  'Raja Casablanca': 'الرجاء الرياضي',
  'AS FAR': 'الجيش الملكي',
  'FAR Rabat': 'الجيش الملكي',
  'RS Berkane': 'نهضة بركان',
  'FUS Rabat': 'الفتح الرباطي',
  'MAS Fes': 'المغرب الفاسي',
  'Olympic Safi': 'أولمبيك آسفي',
  'Hassania Agadir': 'حسنية أكادير',
  'IR Tanger': 'اتحاد طنجة',
  'Esperance de Tunis': 'الترجي التونسي',
  'Esperance Tunis': 'الترجي التونسي',
  'EST': 'الترجي التونسي',
  'Club Africain': 'النادي الإفريقي',
  'Etoile du Sahel': 'النجم الساحلي',
  'CS Sfaxien': 'النادي الصفاقسي',
  'US Monastir': 'الاتحاد المنستيري',
  'Stade Tunisien': 'الملعب التونسي',
  'CR Belouizdad': 'شباب بلوزداد',
  'MC Alger': 'مولودية الجزائر',
  'JS Kabylie': 'شبيبة القبائل',
  'ES Setif': 'وفاق سطيف',
  'USM Alger': 'اتحاد الجزائر',
  'CS Constantine': 'شباب قسنطينة',
  'Paradou AC': 'نادي بارادو',

  // --- دوري الخليج العربي (الإمارات وقطر والكويت وغيرها) ---
  'Al Ain': 'العين الإماراتي',
  'Al Ain FC': 'العين الإماراتي',
  'Al Wasl': 'الوصل الإماراتي',
  'Shabab Al Ahli': 'شباب الأهلي دبي',
  'Shabab Al-Ahli': 'شباب الأهلي دبي',
  'Sharjah': 'الشارقة الإماراتي',
  'Sharjah FC': 'الشارقة الإماراتي',
  'Al Wahda FC': 'الوحدة الإماراتي',
  'Al Jazira': 'الجزيرة الإماراتي',
  'Al Nasr SC': 'النصر الإماراتي',
  'Ajman': 'عجمان',
  'Baniyas': 'بني ياس',
  'Khorfakkan': 'خورفكان',
  'Al Bataeh': 'البطائح',
  'Ittihad Kalba': 'اتحاد كلباء',
  'Al Sadd': 'السد القطري',
  'Al-Sadd': 'السد القطري',
  'Al Duhail': 'الدحيل القطري',
  'Al-Duhail': 'الدحيل القطري',
  'Al Rayyan': 'الريان القطري',
  'Al-Rayyan': 'الريان القطري',
  'Al Gharafa': 'الغرافة القطري',
  'Al-Gharafa': 'الغرافة القطري',
  'Al Arabi': 'العربي القطري',
  'Al-Arabi': 'العربي القطري',
  'Al Wakrah': 'الوكرة القطري',
  'Qatar SC': 'نادي قطر',
  'Umm Salal': 'أم صلال',
  'Al Shamal': 'الشمال القطري',
  'Al Ahli Doha': 'الأهلي القطري',
  'Al Khor': 'الخور القطري',
  'Al Shahaniya': 'الشحانية',
  'Kuwait SC': 'الكويت الكويتي',
  'Al Qadsia': 'القادسية الكويتي',
  'Al Arabi Kuwait': 'العربي الكويتي',
  'Kazma SC': 'كاظمة الكويتي',
  'Al Salmiya': 'السالمية الكويتي',
  'Riffa SC': 'الرفاع البحريني',
  'Muharraq SC': 'المحرق البحريني',
  'Al Khaldiya': 'الخالدية البحريني',
  'Al Seeb': 'السيب العماني',
  'Dhofar': 'ظفار العماني',
  'Al Nahda': 'النهضة العماني',
  'Al Ansar': 'الأنصار اللبناني',
  'Nejmeh SC': 'النجمة اللبناني',
  'Al Ahed': 'العهد اللبناني',
  'Al Faisaly Amman': 'الفيصلي الأردني',
  'Al Wehdat': 'الوحدات الأردني',
  'Al Hussein Irbid': 'الحسين إربد',
  'Al Ramtha': 'الرمثا الأردني',
  'Jabal Al Mukaber': 'جبل المكبر',
  'Shabab Al Khaleel': 'شباب الخليل',
  'Hilal Al-Quds': 'هلال القدس',
  'Al Hilal Omdurman': 'الهلال السوداني',
  'Al Merrikh': 'المريخ السوداني',
  'Al Ahli Tripoli': 'أهلي طرابلس',
  'Al Ittihad Tripoli': 'اتحاد طرابلس',
  'Al Nasr Benghazi': 'النصر الليبي',

  // --- الدوري الإنجليزي الممتاز (Premier League) ---
  'Arsenal FC': 'أرسنال',
  'Arsenal': 'أرسنال',
  'Manchester City FC': 'مانشستر سيتي',
  'Manchester City': 'مانشستر سيتي',
  'Man City': 'مانشستر سيتي',
  'Liverpool FC': 'ليفربول',
  'Liverpool': 'ليفربول',
  'Aston Villa FC': 'أستون فيلا',
  'Aston Villa': 'أستون فيلا',
  'Tottenham Hotspur FC': 'توتنهام هوتسبير',
  'Tottenham Hotspur': 'توتنهام هوتسبير',
  'Tottenham': 'توتنهام هوتسبير',
  'Chelsea FC': 'تشيلسي',
  'Chelsea': 'تشيلسي',
  'Manchester United FC': 'مانشستر يونايتد',
  'Manchester United': 'مانشستر يونايتد',
  'Man United': 'مانشستر يونايتد',
  'Newcastle United FC': 'نيوكاسل يونايتد',
  'Newcastle United': 'نيوكاسل يونايتد',
  'Newcastle': 'نيوكاسل يونايتد',
  'Brighton & Hove Albion FC': 'برايتون',
  'Brighton and Hove Albion': 'برايتون',
  'Brighton': 'برايتون',
  'West Ham United FC': 'وست هام يونايتد',
  'West Ham United': 'وست هام يونايتد',
  'West Ham': 'وست هام يونايتد',
  'AFC Bournemouth': 'بورنموث',
  'Bournemouth': 'بورنموث',
  'Fulham FC': 'فولهام',
  'Fulham': 'فولهام',
  'Wolverhampton Wanderers FC': 'وولفرهامبتون',
  'Wolverhampton Wanderers': 'وولفرهامبتون',
  'Wolverhampton': 'وولفرهامبتون',
  'Wolves': 'وولفرهامبتون',
  'Everton FC': 'إيفرتون',
  'Everton': 'إيفرتون',
  'Brentford FC': 'برينتفورد',
  'Brentford': 'برينتفورد',
  'Crystal Palace FC': 'كريستال بالاس',
  'Crystal Palace': 'كريستال بالاس',
  'Nottingham Forest FC': 'نوتينغهام فورست',
  'Nottingham Forest': 'نوتينغهام فورست',
  'Leicester City FC': 'ليستر سيتي',
  'Leicester City': 'ليستر سيتي',
  'Leicester': 'ليستر سيتي',
  'Ipswich Town FC': 'إبسويتش تاون',
  'Ipswich Town': 'إبسويتش تاون',
  'Ipswich': 'إبسويتش تاون',
  'Southampton FC': 'ساوثهامبتون',
  'Southampton': 'ساوثهامبتون',
  'Leeds United': 'ليدز يونايتد',
  'Sunderland': 'سندرلاند',
  'Sheffield United': 'شيفيلد يونايتد',
  'Burnley FC': 'بيرنلي',
  'Burnley': 'بيرنلي',
  'West Bromwich Albion': 'وست بروميتش',
  'Norwich City': 'نورويتش سيتي',
  'Watford FC': 'واتفورد',
  'Watford': 'واتفورد',
  'Middlesbrough': 'ميدلزبره',
  'Coventry City': 'كوفنتري سيتي',
  'Blackburn Rovers': 'بلاكبيرن روفرز',
  'Stoke City': 'ستوك سيتي',
  'Hull City': 'هال سيتي',
  'Derby County': 'ديربي كاونتي',
  'Queens Park Rangers': 'كوينز بارك رينجرز',
  'QPR': 'كوينز بارك رينجرز',

  // --- الدوري الإسباني (La Liga) ---
  'Real Madrid CF': 'ريال مدريد',
  'Real Madrid': 'ريال مدريد',
  'FC Barcelona': 'برشلونة',
  'Barcelona': 'برشلونة',
  'Club Atlético de Madrid': 'أتلتيكو مدريد',
  'Atlético Madrid': 'أتلتيكو مدريد',
  'Atletico Madrid': 'أتلتيكو مدريد',
  'Girona FC': 'جيرونا',
  'Girona': 'جيرونا',
  'Athletic Club': 'أتلتيك بيلباو',
  'Athletic Bilbao': 'أتلتيك بيلباو',
  'Real Sociedad de Fútbol': 'ريال سوسيداد',
  'Real Sociedad': 'ريال سوسيداد',
  'Real Betis Balompié': 'ريال بيتيس',
  'Real Betis': 'ريال بيتيس',
  'Villarreal CF': 'فياريال',
  'Villarreal': 'فياريال',
  'Sevilla FC': 'إشبيلية',
  'Sevilla': 'إشبيلية',
  'Valencia CF': 'فالنسيا',
  'Valencia': 'فالنسيا',
  'RC Celta de Vigo': 'سيلتا فيغو',
  'Celta Vigo': 'سيلتا فيغو',
  'Celta de Vigo': 'سيلتا فيغو',
  'RCD Mallorca': 'مايوركا',
  'Mallorca': 'مايوركا',
  'CA Osasuna': 'أوساسونا',
  'Osasuna': 'أوساسونا',
  'Rayo Vallecano de Madrid': 'رايو فاليكانو',
  'Rayo Vallecano': 'رايو فاليكانو',
  'Getafe CF': 'خيتافي',
  'Getafe': 'خيتافي',
  'UD Las Palmas': 'لاس بالماس',
  'Las Palmas': 'لاس بالماس',
  'Deportivo Alavés': 'ألافيس',
  'Alaves': 'ألافيس',
  'Deportivo Alaves': 'ألافيس',
  'RCD Espanyol de Barcelona': 'إسبانيول',
  'RCD Espanyol': 'إسبانيول',
  'Espanyol': 'إسبانيول',
  'Real Valladolid CF': 'بلد الوليد',
  'Real Valladolid': 'بلد الوليد',
  'Valladolid': 'بلد الوليد',
  'CD Leganés': 'ليغانيس',
  'CD Leganes': 'ليغانيس',
  'Leganes': 'ليغانيس',
  'Granada CF': 'غرناطة',
  'Granada': 'غرناطة',
  'Cádiz CF': 'قادش',
  'Cadiz': 'قادش',
  'UD Almería': 'ألميريا',
  'Almeria': 'ألميريا',
  'Elche CF': 'إلتشي',
  'Levante UD': 'ليفانتي',
  'Real Zaragoza': 'ريال سرقسطة',
  'Deportivo La Coruña': 'ديبورتيفو لاكورونيا',
  'Racing Santander': 'راسينغ سانتاندير',
  'Sporting Gijon': 'سبورتينغ خيخون',

  // --- الدوري الإيطالي (Serie A) ---
  'FC Internazionale Milano': 'إنتر ميلان',
  'Inter Milan': 'إنتر ميلان',
  'Inter': 'إنتر ميلان',
  'AC Milan': 'ميلان',
  'Milan': 'ميلان',
  'Juventus FC': 'يوفنتوس',
  'Juventus': 'يوفنتوس',
  'Atalanta BC': 'أتالانتا',
  'Atalanta': 'أتالانتا',
  'SSC Napoli': 'نابولي',
  'Napoli': 'نابولي',
  'AS Roma': 'روما',
  'Roma': 'روما',
  'SS Lazio': 'لاتسيو',
  'Lazio': 'لاتسيو',
  'ACF Fiorentina': 'فيورنتينا',
  'Fiorentina': 'فيورنتينا',
  'Bologna FC 1909': 'بولونيا',
  'Bologna': 'بولونيا',
  'Torino FC': 'تورينو',
  'Torino': 'تورينو',
  'AC Monza': 'مونزا',
  'Monza': 'مونزا',
  'Udinese Calcio': 'أودينيزي',
  'Udinese': 'أودينيزي',
  'Genoa CFC': 'جنوى',
  'Genoa': 'جنوى',
  'Cagliari Calcio': 'كالياري',
  'Cagliari': 'كالياري',
  'Hellas Verona FC': 'هيلاس فيرونا',
  'Hellas Verona': 'هيلاس فيرونا',
  'Verona': 'هيلاس فيرونا',
  'US Lecce': 'ليتشي',
  'Lecce': 'ليتشي',
  'Empoli FC': 'إمبولي',
  'Empoli': 'إمبولي',
  'Parma Calcio 1913': 'بارما',
  'Parma': 'بارما',
  'Como 1907': 'كومو',
  'Como': 'كومو',
  'Venezia FC': 'فينيسيا',
  'Venezia': 'فينيسيا',
  'US Sassuolo Calcio': 'ساسولو',
  'Sassuolo': 'ساسولو',
  'UC Sampdoria': 'سامبدوريا',
  'Sampdoria': 'سامبدوريا',
  'US Salernitana 1919': 'ساليرنيتانا',
  'Palermo FC': 'باليرمو',
  'Spezia Calcio': 'سبيزيا',
  'Brescia Calcio': 'بريشيا',
  'Frosinone Calcio': 'فروزينوني',

  // --- الدوري الألماني (Bundesliga) ---
  'FC Bayern München': 'بايرن ميونخ',
  'Bayern Munich': 'بايرن ميونخ',
  'Bayern': 'بايرن ميونخ',
  'Bayer 04 Leverkusen': 'باير ليفركوزن',
  'Bayer Leverkusen': 'باير ليفركوزن',
  'Leverkusen': 'باير ليفركوزن',
  'Borussia Dortmund': 'بوروسيا دورتموند',
  'Dortmund': 'بوروسيا دورتموند',
  'RB Leipzig': 'لايبزيغ',
  'Leipzig': 'لايبزيغ',
  'Eintracht Frankfurt': 'آينتراخت فرانكفورت',
  'Frankfurt': 'فرانكفورت',
  'VfB Stuttgart': 'شتوتغارت',
  'Stuttgart': 'شتوتغارت',
  'SC Freiburg': 'فرايبورغ',
  'Freiburg': 'فرايبورغ',
  'SV Werder Bremen': 'فيردر بريمن',
  'Werder Bremen': 'فيردر بريمن',
  'Borussia Mönchengladbach': 'مونشنغلادباخ',
  'Borussia Monchengladbach': 'مونشنغلادباخ',
  'Monchengladbach': 'مونشنغلادباخ',
  '1. FC Union Berlin': 'يونيون برلين',
  'Union Berlin': 'يونيون برلين',
  'VfL Wolfsburg': 'فولفسبورغ',
  'Wolfsburg': 'فولفسبورغ',
  'TSG 1899 Hoffenheim': 'هوفنهايم',
  'TSG Hoffenheim': 'هوفنهايم',
  'Hoffenheim': 'هوفنهايم',
  'FC Augsburg': 'أوغسبورغ',
  'Augsburg': 'أوغسبورغ',
  '1. FC Heidenheim 1846': 'هايدنهايم',
  '1. FC Heidenheim': 'هايدنهايم',
  'Heidenheim': 'هايدنهايم',
  '1. FSV Mainz 05': 'ماينتس',
  'Mainz 05': 'ماينتس',
  'Mainz': 'ماينتس',
  'FC St. Pauli': 'سانت باولي',
  'St. Pauli': 'سانت باولي',
  'Holstein Kiel': 'هولشتاين كيل',
  'Kiel': 'هولشتاين كيل',
  'VfL Bochum 1848': 'بوخوم',
  'VfL Bochum': 'بوخوم',
  'Bochum': 'بوخوم',
  'FC Schalke 04': 'شالكه',
  'Schalke': 'شالكه',
  'Hamburger SV': 'هامبورغ',
  'Hertha BSC': 'هيرتا برلين',
  '1. FC Köln': 'كولن',
  'FC Koln': 'كولن',
  'Fortuna Düsseldorf': 'فورتونا دوسلدورف',
  'Hannover 96': 'هانوفر',
  '1. FC Nürnberg': 'نورنبيرغ',
  '1. FC Kaiserslautern': 'كايزرسلاوترن',

  // --- الدوري الفرنسي (Ligue 1) ---
  'Paris Saint-Germain FC': 'باريس سان جيرمان',
  'Paris Saint Germain': 'باريس سان جيرمان',
  'Paris Saint-Germain': 'باريس سان جيرمان',
  'PSG': 'باريس سان جيرمان',
  'Olympique de Marseille': 'مارسيليا',
  'Marseille': 'مارسيليا',
  'AS Monaco FC': 'موناكو',
  'AS Monaco': 'موناكو',
  'Monaco': 'موناكو',
  'Olympique Lyonnais': 'ليون',
  'Lyon': 'ليون',
  'Lille OSC': 'ليل',
  'Lille': 'ليل',
  'OGC Nice': 'نيس',
  'Nice': 'نيس',
  'RC Lens': 'لانس',
  'Lens': 'لانس',
  'Stade Rennais FC 1901': 'رين',
  'Stade Rennais FC': 'رين',
  'Rennes': 'رين',
  'Stade de Reims': 'ستاد ريمس',
  'Reims': 'ريمس',
  'RC Strasbourg Alsace': 'ستراسبورغ',
  'Strasbourg': 'ستراسبورغ',
  'Stade Brestois 29': 'بريست',
  'Brest': 'بريست',
  'FC Nantes': 'نانت',
  'Nantes': 'نانت',
  'Montpellier HSC': 'مونبلييه',
  'Montpellier': 'مونبلييه',
  'Toulouse FC': 'تولوز',
  'Toulouse': 'تولوز',
  'AJ Auxerre': 'أوكسير',
  'Auxerre': 'أوكسير',
  'Angers SCO': 'أنجيه',
  'Angers': 'أنجيه',
  'AS Saint-Étienne': 'سانت إتيان',
  'Saint-Etienne': 'سانت إتيان',
  'Le Havre AC': 'لوهافر',
  'Le Havre': 'لوهافر',
  'FC Girondins de Bordeaux': 'بوردو',
  'Bordeaux': 'بوردو',
  'FC Lorient': 'لوريان',
  'FC Metz': 'ميتز',

  // --- الدوري البرتغالي والهولندي وباقي كبار أوروبا والعالم ---
  'SL Benfica': 'بنفيكا',
  'Benfica': 'بنفيكا',
  'FC Porto': 'بورتو',
  'Porto': 'بورتو',
  'Sporting Clube de Portugal': 'سبورتينغ لشبونة',
  'Sporting CP': 'سبورتينغ لشبونة',
  'Sporting Lisbon': 'سبورتينغ لشبونة',
  'SC Braga': 'سبورتينغ براغا',
  'Braga': 'سبورتينغ براغا',
  'Vitória SC': 'فيتوريا غيماريش',
  'Vitoria Guimaraes': 'فيتوريا غيماريش',
  'Boavista FC': 'بوافيشتا',
  'AFC Ajax': 'أياكس أمستردام',
  'Ajax': 'أياكس أمستردام',
  'PSV Eindhoven': 'آيندهوفن',
  'PSV': 'آيندهوفن',
  'Feyenoord Rotterdam': 'فاينورد',
  'Feyenoord': 'فاينورد',
  'AZ Alkmaar': 'إي زد ألكمار',
  'AZ': 'إي زد ألكمار',
  'FC Twente': 'تفينتي',
  'Twente': 'تفينتي',
  'FC Utrecht': 'أوتريخت',
  'Galatasaray SK': 'غلطة سراي',
  'Galatasaray': 'غلطة سراي',
  'Fenerbahçe SK': 'فنربخشة',
  'Fenerbahce': 'فنربخشة',
  'Beşiktaş JK': 'بشكتاش',
  'Besiktas': 'بشكتاش',
  'Trabzonspor': 'طرابزون سبور',
  'Celtic FC': 'سيلتيك',
  'Celtic': 'سيلتيك',
  'Rangers FC': 'رينجرز',
  'Rangers': 'رينجرز',
  'Shakhtar Donetsk': 'شاختار دونيتسك',
  'Dynamo Kyiv': 'دينامو كييف',
  'Olympiacos FC': 'أولمبياكوس',
  'Olympiacos': 'أولمبياكوس',
  'Panathinaikos': 'باناثينايكوس',
  'PAOK FC': 'باوك',
  'AEK Athens': 'أيك أثينا',
  'FK Crvena Zvezda': 'النجم الأحمر بلغراد',
  'Red Star Belgrade': 'النجم الأحمر بلغراد',
  'FK Partizan': 'بارتيزان بلغراد',
  'GNK Dinamo Zagreb': 'دينامو زغرب',
  'Hajduk Split': 'هايدوك سبليت',
  'AC Sparta Praha': 'سبارتا براغ',
  'Sparta Prague': 'سبارتا براغ',
  'SK Slavia Praha': 'سلافيا براغ',
  'Slavia Prague': 'سلافيا براغ',
  'BSC Young Boys': 'يانغ بويز',
  'Young Boys': 'يانغ بويز',
  'FC Basel 1893': 'بازل',
  'FC Basel': 'بازل',
  'FC Red Bull Salzburg': 'ريد بول سالزبورغ',
  'RB Salzburg': 'ريد بول سالزبورغ',
  'SK Sturm Graz': 'شتورم غراتس',
  'FK Bodø/Glimt': 'بودو غليمت',
  'Bodo/Glimt': 'بودو غليمت',
  'FC Copenhagen': 'كوبنهاغن',
  'Malmö FF': 'مالمو',
  'Malmo FF': 'مالمو',
  'Ferencvárosi TC': 'فيرينتسفاروشي',
  'FCSB': 'ستيوا بوخارست',
  'CFR Cluj': 'كلوج',
  'Qarabağ FK': 'قره باغ',
  'Qarabag': 'قره باغ',
  'Sheriff Tiraspol': 'شريف تيراسبول',

  // --- أمريكا الجنوبية وأمريكا الشمالية ---
  'Inter Miami CF': 'إنتر ميامي',
  'Inter Miami': 'إنتر ميامي',
  'Los Angeles FC': 'لوس أنجلوس إف سي',
  'LAFC': 'لوس أنجلوس إف سي',
  'LA Galaxy': 'لوس أنجلوس غالاكسي',
  'New York City FC': 'نيويورك سيتي',
  'New York Red Bulls': 'نيويورك ريد بولز',
  'Atlanta United FC': 'أتلانتا يونايتد',
  'Seattle Sounders FC': 'سياتل ساوندرز',
  'Columbus Crew': 'كولومبوس كرو',
  'Boca Juniors': 'بوكا جونيورز',
  'River Plate': 'ريفر بليت',
  'Racing Club': 'راسينغ كلوب',
  'Independiente': 'إنديبندينتي',
  'San Lorenzo': 'سان لورينزو',
  'CR Flamengo': 'فلامينغو',
  'Flamengo': 'فلامينغو',
  'SE Palmeiras': 'بالميراس',
  'Palmeiras': 'بالميراس',
  'São Paulo FC': 'ساو باولو',
  'Sao Paulo': 'ساو باولو',
  'Santos FC': 'سانتوس',
  'Santos': 'سانتوس',
  'Fluminense FC': 'فلومينينسي',
  'Fluminense': 'فلومينينسي',
  'Grêmio FBPA': 'غريميو',
  'Gremio': 'غريميو',
  'SC Corinthians Paulista': 'كورينثيانز',
  'Corinthians': 'كورينثيانز',
  'SC Internacional': 'إنترناسيونال',
  'Internacional': 'إنترناسيونال',
  'Clube Atlético Mineiro': 'أتلتيكو مينيرو',
  'Atletico Mineiro': 'أتلتيكو مينيرو',
  'Cruzeiro EC': 'كروزيرو',
  'Cruzeiro': 'كروزيرو',
  'CR Vasco da Gama': 'فاسكو دا غاما',
  'Botafogo FR': 'بوتافوغو',
  'Athletico Paranaense': 'أتلتيكو باراناينسي',
  'CA Peñarol': 'بينيارول',
  'Penarol': 'بينيارول',
  'Club Nacional de Football': 'ناسيونال الأوروغوياني',
  'Nacional': 'ناسيونال',
  'Colo-Colo': 'كولو كولو',
  'Club Olimpia': 'أوليمبيا أسونسيون',
  'Atlético Nacional': 'أتلتيكو ناسيونال'
};

export const SUPPORTED_LEAGUES: CompetitionMeta[] = [
  {
    code: 'PL',
    id: 2021,
    apiSportsId: 39,
    name: 'Premier League',
    arabicName: 'الدوري الإنجليزي الممتاز',
    emblem: 'https://media.api-sports.io/football/leagues/39.png',
    country: 'إنجلترا',
    color: 'from-purple-600 to-indigo-700'
  },
  {
    code: 'PD',
    id: 2014,
    apiSportsId: 140,
    name: 'La Liga',
    arabicName: 'الدوري الإسباني (لا ليغا)',
    emblem: 'https://media.api-sports.io/football/leagues/140.png',
    country: 'إسبانيا',
    color: 'from-amber-500 to-rose-600'
  },
  {
    code: 'CL',
    id: 2001,
    apiSportsId: 2,
    name: 'UEFA Champions League',
    arabicName: 'دوري أبطال أوروبا',
    emblem: 'https://media.api-sports.io/football/leagues/2.png',
    country: 'أوروبا',
    color: 'from-blue-700 to-sky-900'
  },
  {
    code: 'SA',
    id: 2019,
    apiSportsId: 135,
    name: 'Serie A',
    arabicName: 'الدوري الإيطالي (سيريا أ)',
    emblem: 'https://media.api-sports.io/football/leagues/135.png',
    country: 'إيطاليا',
    color: 'from-blue-600 to-teal-700'
  },
  {
    code: 'BL1',
    id: 2002,
    apiSportsId: 78,
    name: 'Bundesliga',
    arabicName: 'الدوري الألماني (بوندسليغا)',
    emblem: 'https://media.api-sports.io/football/leagues/78.png',
    country: 'ألمانيا',
    color: 'from-red-600 to-rose-800'
  },
  {
    code: 'FL1',
    id: 2015,
    apiSportsId: 61,
    name: 'Ligue 1',
    arabicName: 'الدوري الفرنسي (ليغ 1)',
    emblem: 'https://media.api-sports.io/football/leagues/61.png',
    country: 'فرنسا',
    color: 'from-emerald-600 to-cyan-800'
  },
  {
    code: 'SAUDI',
    id: 2099,
    apiSportsId: 307,
    name: 'Saudi Pro League',
    arabicName: 'دوري روشن السعودي',
    emblem: 'https://media.api-sports.io/football/leagues/307.png',
    country: 'السعودية',
    color: 'from-emerald-700 to-teal-800'
  }
];

// Common terms used in team names for translation
const COMMON_FOOTBALL_WORDS: Record<string, string> = {
  'united': 'يونايتد',
  'city': 'سيتي',
  'town': 'تاون',
  'real': 'ريال',
  'sporting': 'سبورتينغ',
  'athletic': 'أتلتيك',
  'atletico': 'أتلتيكو',
  'inter': 'إنتر',
  'internazionale': 'إنتر ميلان',
  'dynamo': 'دينامو',
  'dinamo': 'دينامو',
  'lokomotiv': 'لوكوموتيف',
  'spartak': 'سبارتاك',
  'rovers': 'روفرز',
  'wanderers': 'واندررز',
  'rangers': 'رينجرز',
  'albion': 'ألبيون',
  'hotspur': 'هوتسبير',
  'county': 'كاونتي',
  'villa': 'فيلا',
  'port': 'بورت',
  'saint': 'سان',
  'san': 'سان',
  'santa': 'سانتا',
  'racing': 'راسينغ',
  'olympic': 'أولمبيك',
  'olympique': 'أولمبيك',
  'olympiacos': 'أولمبياكوس',
  'deportivo': 'ديبورتيفو',
  'union': 'يونيون',
  'national': 'ناسيونال',
  'nacional': 'ناسيونال',
  'central': 'سنترال',
  'youth': 'الشباب',
  'juventud': 'الشباب',
  'jeunesse': 'الشباب',
  'red': 'ريد',
  'star': 'ستار',
  'blue': 'بلو',
  'white': 'وايت',
  'black': 'بلاك',
  'green': 'غرين',
  'north': 'نورث',
  'south': 'ساوث',
  'east': 'إيست',
  'west': 'وست',
  'park': 'بارك',
  'road': 'رود',
  'bridge': 'بريدج',
  'valley': 'فالي',
  'hills': 'هيلز',
  'forest': 'فورست',
  'borussia': 'بوروسيا',
  'bayer': 'باير',
  'bayern': 'بايرن',
  'eintracht': 'آينتراخت',
  'werder': 'فيردر',
  'fortuna': 'فورتونا',
  'hertha': 'هيرتا',
  'schalke': 'شالكه',
  'grasshopper': 'غراسهوبرز',
  'young': 'يانغ',
  'boys': 'بويز',
  'club': 'نادي',
  'sports': 'سبورتس',
  'academy': 'أكاديمية',
  'reserve': 'الرديف',
  'reserves': 'الرديف'
};

/**
 * Phonetic Latin to Arabic transliterator for any unmapped club/team name.
 * Transforms English syllables into natural Arabic letters.
 */
function transliterateEnglishWordToPhoneticArabic(word: string): string {
  if (!word) return '';
  const lower = word.toLowerCase();

  // Check common word dictionary
  if (COMMON_FOOTBALL_WORDS[lower]) {
    return COMMON_FOOTBALL_WORDS[lower];
  }

  // Handle common Arabic transliterations like Al- / El-
  if (lower.startsWith('al-') || lower.startsWith('el-')) {
    const rest = lower.substring(3);
    return 'الـ' + transliterateEnglishWordToPhoneticArabic(rest);
  }

  let res = lower;

  // Digraphs & sound patterns
  res = res
    .replace(/sh/g, 'ش')
    .replace(/ch/g, 'تش')
    .replace(/kh/g, 'خ')
    .replace(/th/g, 'ث')
    .replace(/ph/g, 'ف')
    .replace(/gh/g, 'غ')
    .replace(/dh/g, 'ذ')
    .replace(/zh/g, 'ژ')
    .replace(/ck/g, 'ك')
    .replace(/qu/g, 'كوا')
    .replace(/ou/g, 'و')
    .replace(/oo/g, 'و')
    .replace(/ea/g, 'ي')
    .replace(/ee/g, 'ي')
    .replace(/ai/g, 'اي')
    .replace(/ay/g, 'اي')
    .replace(/ei/g, 'اي')
    .replace(/ey/g, 'اي')
    .replace(/oi/g, 'وي')
    .replace(/oy/g, 'وي')
    .replace(/au/g, 'أو')
    .replace(/aw/g, 'أو')
    .replace(/tion/g, 'شن')
    .replace(/sion/g, 'شن')
    .replace(/berg/g, 'بيرغ')
    .replace(/burg/g, 'بورغ')
    .replace(/ford/g, 'فورد')
    .replace(/field/g, 'فيلد')
    .replace(/ham/g, 'هام')
    .replace(/ton/g, 'تون')
    .replace(/ville/g, 'فيل')
    .replace(/land/g, 'لاند')
    .replace(/wood/g, 'وود');

  // Single characters
  const charMap: Record<string, string> = {
    'b': 'ب',
    'c': 'ك',
    'd': 'د',
    'f': 'ف',
    'g': 'غ',
    'h': 'هـ',
    'j': 'ج',
    'k': 'ك',
    'l': 'ل',
    'm': 'م',
    'n': 'ن',
    'p': 'ب',
    'q': 'ق',
    'r': 'ر',
    's': 'س',
    't': 'ت',
    'v': 'ف',
    'w': 'و',
    'x': 'كس',
    'y': 'ي',
    'z': 'ز',
    'a': 'ا',
    'e': 'ي',
    'i': 'ي',
    'o': 'و',
    'u': 'و'
  };

  let out = '';
  for (let i = 0; i < res.length; i++) {
    const char = res[i];
    if (charMap[char]) {
      // Don't duplicate 'ي' or 'و' or 'ا' immediately
      const mapped = charMap[char];
      if (mapped === 'ي' && out.endsWith('ي')) continue;
      if (mapped === 'و' && out.endsWith('و')) continue;
      if (mapped === 'ا' && out.endsWith('ا')) continue;
      out += mapped;
    } else {
      out += char;
    }
  }

  // Remove silent trailing 'ي' if preceded by vowel
  if (out.endsWith('ي') && out.length > 3) {
    // Keep it natural
  }

  return out;
}

/**
 * Intelligent Arabic Team Name Translator:
 * 1. Returns Arabic directly if text contains Arabic characters.
 * 2. Matches exact team in curated dictionary (hundreds of clubs & national teams).
 * 3. Matches normalized & suffix-stripped team names.
 * 4. Detects National Teams (including U23, U20, Women, Olympic).
 * 5. Intelligently translates or transliterates any unlisted team into fluent Arabic.
 */
export function getArabicTeamName(name: string, shortName?: string): string {
  if (!name && !shortName) return 'فريق';

  const raw = (name || shortName || '').trim();

  // If already contains Arabic characters, return as is
  if (/[\u0600-\u06FF]/.test(raw)) {
    return raw;
  }

  // 1. Direct dictionary match
  if (ARABIC_TEAM_NAMES[raw]) return ARABIC_TEAM_NAMES[raw];
  if (shortName && ARABIC_TEAM_NAMES[shortName.trim()]) return ARABIC_TEAM_NAMES[shortName.trim()];

  // 2. Case-insensitive dictionary match
  const lowerRaw = raw.toLowerCase();
  for (const [k, v] of Object.entries(ARABIC_TEAM_NAMES)) {
    if (k.toLowerCase() === lowerRaw) return v;
  }

  // 3. Clean common football prefixes & suffixes:
  // e.g. "FC Barcelona" -> "Barcelona", "Manchester City FC" -> "Manchester City"
  const stripped = raw
    .replace(/\b(FC|CF|SC|AC|FK|SK|CD|UD|SD|SV|VfL|VfB|BSC|TSG|1\.|RCD|RC|CA|AFC|SS|SSC|AS|US|AJ|OGC|CS|CR|MC|JS|ES|RS|FUS|MAS|IR|JK|BK|HNK|NK)\b/gi, '')
    .replace(/\b(Football Club|Club de Fútbol|de Fútbol|Balompié|de Madrid|de Barcelona|Calcio|1909|1901|04|05|SP|CP|RJ|MG|BA|RS)\b/gi, '')
    .trim();

  if (stripped && ARABIC_TEAM_NAMES[stripped]) {
    return ARABIC_TEAM_NAMES[stripped];
  }
  for (const [k, v] of Object.entries(ARABIC_TEAM_NAMES)) {
    if (stripped && k.toLowerCase() === stripped.toLowerCase()) return v;
  }

  // 4. National Team detection (e.g., "Iraq U23", "Saudi Arabia Women", "France Olympic")
  for (const [countryEn, countryAr] of Object.entries(ARABIC_NATIONAL_TEAMS)) {
    const cLower = countryEn.toLowerCase();
    if (lowerRaw.includes(cLower)) {
      if (lowerRaw.includes('u23') || lowerRaw.includes('u-23') || lowerRaw.includes('olympic')) {
        return countryAr.replace('منتخب ', 'منتخب ') + ' الأولمبي';
      }
      if (lowerRaw.includes('u21') || lowerRaw.includes('u-21')) {
        return countryAr.replace('منتخب ', 'منتخب ') + ' تحت 21';
      }
      if (lowerRaw.includes('u20') || lowerRaw.includes('u-20') || lowerRaw.includes('u19')) {
        return countryAr.replace('منتخب ', 'منتخب ') + ' للشباب';
      }
      if (lowerRaw.includes('u17') || lowerRaw.includes('u-17')) {
        return countryAr.replace('منتخب ', 'منتخب ') + ' للناشئين';
      }
      if (lowerRaw.includes('women') || lowerRaw.includes('ladies') || lowerRaw.includes('femenino')) {
        return countryAr.replace('منتخب ', 'منتخب ') + ' للسيدات';
      }
      return countryAr;
    }
  }

  // 5. Partial matches from dictionary (matching significant keys of 4+ characters)
  const sortedKeys = Object.keys(ARABIC_TEAM_NAMES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.length >= 4 && lowerRaw.includes(key.toLowerCase())) {
      return ARABIC_TEAM_NAMES[key];
    }
  }

  // 6. Intelligent word-by-word sports translation & transliteration
  const words = raw.split(/[\s\-_/]+/).filter(Boolean);
  const translatedWords: string[] = [];

  for (const word of words) {
    const wLower = word.toLowerCase();
    // Skip isolated meaningless abbreviations
    if (['fc', 'cf', 'sc', 'ac', 'fk', 'sk', 'cd', 'ud', 'sd', 'sv', 'de', 'el', 'la'].includes(wLower)) {
      continue;
    }
    // Check if word itself matches a team/city in dictionary
    let matched = false;
    for (const [k, v] of Object.entries(ARABIC_TEAM_NAMES)) {
      if (k.toLowerCase() === wLower) {
        translatedWords.push(v);
        matched = true;
        break;
      }
    }
    if (!matched) {
      translatedWords.push(transliterateEnglishWordToPhoneticArabic(word));
    }
  }

  const result = translatedWords.join(' ').trim();
  return result || raw || 'فريق';
}

export function mapLeagueIdToCode(leagueId?: number): string {
  if (!leagueId) return 'OTHER';
  switch (leagueId) {
    case 39:
    case 2021:
      return 'PL';
    case 140:
    case 2014:
      return 'PD';
    case 2:
    case 2001:
      return 'CL';
    case 135:
    case 2019:
      return 'SA';
    case 78:
    case 2002:
      return 'BL1';
    case 61:
    case 2015:
      return 'FL1';
    case 307:
      return 'SAUDI';
    default:
      return 'OTHER';
  }
}

export function mapLeagueArabicName(name: string, leagueId?: number): string {
  if (!name) return 'بطولة رياضية';
  if (/[\u0600-\u06FF]/.test(name)) return name;
  const n = name.toLowerCase();

  if (leagueId === 39 || n.includes('premier league')) return 'الدوري الإنجليزي الممتاز';
  if (leagueId === 140 || n.includes('la liga') || n.includes('primera división') || n.includes('primera division')) return 'الدوري الإسباني (لا ليغا)';
  if (leagueId === 135 || n.includes('serie a')) return 'الدوري الإيطالي (سيريا أ)';
  if (leagueId === 78 || n.includes('bundesliga')) return 'الدوري الألماني (بوندسليغا)';
  if (leagueId === 61 || n.includes('ligue 1')) return 'الدوري الفرنسي (ليغ 1)';
  if (leagueId === 2 || n.includes('uefa champions league') || n.includes('champions league')) return 'دوري أبطال أوروبا';
  if (leagueId === 3 || n.includes('europa league')) return 'الدوري الأوروبي';
  if (leagueId === 848 || n.includes('conference league') || n.includes('conference')) return 'دوري المؤتمر الأوروبي';
  if (leagueId === 307 || n.includes('saudi') || n.includes('roshn') || n.includes('pro league')) return 'دوري روشن السعودي';
  if (n.includes('iraq') || n.includes('stars league')) return 'دوري نجوم العراق';
  if (n.includes('egypt') || n.includes('egyptian')) return 'الدوري المصري الممتاز';
  if (n.includes('world cup qualification') || n.includes('wc qualification') || n.includes('preliminary') || n.includes('qualifiers')) return 'تصفيات كأس العالم';
  if (n.includes('world cup')) return 'كأس العالم FIFA';
  if (n.includes('asian cup') || n.includes('afc asian')) return 'كأس آسيا';
  if (n.includes('afc champions') || n.includes('acl')) return 'دوري أبطال آسيا للنخبة';
  if (n.includes('caf champions')) return 'دوري أبطال أفريقيا';
  if (n.includes('africa cup of nations') || n.includes('afcon')) return 'كأس الأمم الأفريقية';
  if (n.includes('copa america')) return 'كوبا أمريكا';
  if (n.includes('copa libertadores')) return 'كوبا ليبرتادوريس';
  if (n.includes('nations league')) return 'دوري الأمم الأوروبية';
  if (n.includes('euro') && (n.includes('championship') || n.includes('2024') || n.includes('qualification'))) return 'بطولة أمم أوروبا (اليورو)';
  if (n.includes('fa cup')) return 'كأس الاتحاد الإنجليزي';
  if (n.includes('copa del rey')) return 'كأس ملك إسبانيا';
  if (n.includes('coppa italia')) return 'كأس إيطاليا';
  if (n.includes('dfb pokal')) return 'كأس ألمانيا';
  if (n.includes('coupe de france')) return 'كأس فرنسا';
  if (n.includes('eredivisie')) return 'الدوري الهولندي (إيريديفيزي)';
  if (n.includes('primeira liga') || n.includes('liga portugal')) return 'الدوري البرتغالي الممتاز';
  if (n.includes('super lig') || n.includes('süper lig')) return 'الدوري التركي الممتاز';
  if (n.includes('botola')) return 'الدوري المغربي (البطولة الاحترافية)';
  if (n.includes('friendlies') || n.includes('friendly')) return 'مباراة ودية دولية';
  return name || 'بطولة رياضية';
}

export function getAssignedBeINChannel(competitionCode?: string, matchId: number = 0): string {
  const code = (competitionCode || '').toUpperCase();
  switch (code) {
    case 'CL':
      return matchId % 2 === 0 ? 'beIN Sports 1 HD' : 'beIN Sports 2 HD';
    case 'PL':
      return matchId % 3 === 0
        ? 'beIN Sports 1 HD'
        : matchId % 3 === 1
        ? 'beIN Sports 2 HD'
        : 'beIN Sports Premium 1';
    case 'PD':
      return matchId % 2 === 0 ? 'beIN Sports 3 HD' : 'beIN Sports 1 HD';
    case 'SA':
      return 'beIN Sports 4 HD';
    case 'BL1':
      return 'beIN Sports 5 HD';
    case 'FL1':
      return 'beIN Sports 6 HD';
    case 'SAUDI':
      return 'SSC 1 HD / beIN AFC';
    default:
      return matchId % 2 === 0 ? 'beIN Sports 1 HD' : 'beIN Sports 2 HD';
  }
}

function mapApiSportsStatusToMatchStatus(shortStatus: string): FootballMatchStatus {
  const s = (shortStatus || '').toUpperCase();
  if (['1H', '2H', 'LIVE', '10', '15', '20', '30', '45'].includes(s)) return 'IN_PLAY';
  if (s === 'HT') return 'PAUSED';
  if (s === 'ET') return 'EXTRA_TIME';
  if (['P', 'PEN'].includes(s)) return 'PENALTY_SHOOTOUT';
  if (['FT', 'AET', 'PEN_FT'].includes(s)) return 'FINISHED';
  if (['PST', 'INT'].includes(s)) return 'POSTPONED';
  if (['CANC', 'ABD'].includes(s)) return 'CANCELLED';
  if (['SUSP'].includes(s)) return 'SUSPENDED';
  if (['NS', 'TBD'].includes(s)) return 'TIMED';
  return 'TIMED';
}

function mapApiSportsItemToMatch(item: any): FootballMatch {
  const leagueId = item.league?.id;
  const leagueCode = mapLeagueIdToCode(leagueId);
  const status = mapApiSportsStatusToMatchStatus(item.fixture?.status?.short);
  const homeName = item.teams?.home?.name || 'فريق مضيف';
  const awayName = item.teams?.away?.name || 'فريق ضيف';

  return {
    id: item.fixture?.id || Math.floor(Math.random() * 100000),
    utcDate: item.fixture?.date || new Date().toISOString(),
    status,
    minute: item.fixture?.status?.elapsed || undefined,
    channel: getAssignedBeINChannel(leagueCode, item.fixture?.id || 0),
    competition: {
      id: leagueId || 9999,
      name: item.league?.name || 'بطولة',
      code: leagueCode,
      type: 'LEAGUE',
      emblem: item.league?.logo || 'https://media.api-sports.io/football/leagues/39.png',
      arabicName: mapLeagueArabicName(item.league?.name, leagueId)
    },
    homeTeam: {
      id: item.teams?.home?.id || 1,
      name: homeName,
      shortName: homeName,
      tla: homeName.substring(0, 3).toUpperCase(),
      crest: item.teams?.home?.logo || '',
      arabicName: getArabicTeamName(homeName)
    },
    awayTeam: {
      id: item.teams?.away?.id || 2,
      name: awayName,
      shortName: awayName,
      tla: awayName.substring(0, 3).toUpperCase(),
      crest: item.teams?.away?.logo || '',
      arabicName: getArabicTeamName(awayName)
    },
    score: {
      winner: item.teams?.home?.winner
        ? 'HOME_TEAM'
        : item.teams?.away?.winner
        ? 'AWAY_TEAM'
        : (status === 'FINISHED' && item.goals?.home === item.goals?.away ? 'DRAW' : null),
      duration: 'REGULAR',
      fullTime: {
        home: item.goals?.home ?? null,
        away: item.goals?.away ?? null
      },
      halfTime: {
        home: item.score?.halftime?.home ?? null,
        away: item.score?.halftime?.away ?? null
      }
    },
    lastUpdated: new Date().toISOString()
  };
}

class FootballService {
  private callTimestamps: number[] = [];
  private dailyRemaining: number = 100;
  private dailyLimit: number = 100;

  constructor() {
    this.cleanExpiredCalls();
  }

  public getApiKey(): string {
    try {
      const stored = localStorage.getItem(API_STORAGE_KEY);
      if (stored && stored.trim()) return stored.trim();
    } catch {}
    // Check vite env
    const envKey =
      (import.meta.env.VITE_FOOTBALL_API_KEY as string) ||
      (import.meta.env.VITE_FOOTBALL_DATA_API_KEY as string) ||
      '';
    if (envKey && envKey.trim()) return envKey.trim();
    return DEFAULT_API_KEY;
  }

  public setApiKey(token: string): void {
    try {
      if (token && token.trim()) {
        localStorage.setItem(API_STORAGE_KEY, token.trim());
      } else {
        localStorage.removeItem(API_STORAGE_KEY);
      }
    } catch {}
  }

  public getRateLimitStatus(): {
    allowed: boolean;
    remainingCalls: number;
    waitSeconds: number;
    dailyRemaining: number;
    dailyLimit: number;
  } {
    this.cleanExpiredCalls();
    const count = this.callTimestamps.length;
    const remaining = Math.max(0, MAX_CALLS_PER_MINUTE - count);
    if (count < MAX_CALLS_PER_MINUTE) {
      return {
        allowed: true,
        remainingCalls: remaining,
        waitSeconds: 0,
        dailyRemaining: this.dailyRemaining,
        dailyLimit: this.dailyLimit
      };
    }
    const oldest = this.callTimestamps[0];
    const waitSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000));
    return {
      allowed: false,
      remainingCalls: 0,
      waitSeconds,
      dailyRemaining: this.dailyRemaining,
      dailyLimit: this.dailyLimit
    };
  }

  private cleanExpiredCalls(): void {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter((t) => now - t < WINDOW_MS);
  }

  private recordCall(): void {
    this.callTimestamps.push(Date.now());
  }

  /**
   * Primary: fetch from API-Sports (supports live fixtures & standings)
   */
  private async fetchApiSports<T>(endpoint: string, options: { token?: string } = {}): Promise<T> {
    const rateStatus = this.getRateLimitStatus();
    if (!rateStatus.allowed) {
      throw new Error(`RATE_LIMIT: تجاوزت الحد المؤقت للطلبات (10 طلبات/دقيقة). يرجى الانتظار ${rateStatus.waitSeconds} ثانية.`);
    }

    const token = options.token || this.getApiKey();
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (token) {
      headers['x-apisports-key'] = token;
    }

    const proxyUrl = `/api/apisports${endpoint}`;
    const directUrl = `https://v3.football.api-sports.io${endpoint}`;

    this.recordCall();

    let response: Response | null = null;
    let lastError: Error | null = null;

    // First try the dev proxy to avoid browser CORS/Cloudflare restrictions
    try {
      response = await fetch(proxyUrl, { headers });
    } catch (e: any) {
      lastError = e;
    }

    // Direct fallback if proxy 404
    if (!response || (!response.ok && response.status === 404)) {
      try {
        response = await fetch(directUrl, { headers });
      } catch (e: any) {
        lastError = e;
      }
    }

    if (!response) {
      throw new Error(lastError?.message || 'تعذر الاتصال بخادم بيانات المباريات الحية');
    }

    // Capture quota headers from API-Sports
    try {
      const rem = response.headers.get('x-ratelimit-requests-remaining');
      const lim = response.headers.get('x-ratelimit-requests-limit');
      if (rem) this.dailyRemaining = parseInt(rem, 10);
      if (lim) this.dailyLimit = parseInt(lim, 10);
    } catch {}

    if (response.status === 429) {
      throw new Error('RATE_LIMIT: تم استهلاك الحد اليومي لطلبات المباريات (100 طلب/يوم).');
    }

    if (!response.ok) {
      throw new Error(`خطأ في جلب بيانات المباريات: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  }

  /**
   * Fallback: football-data.org fetcher
   */
  private async fetchFootballData<T>(endpoint: string): Promise<T> {
    const token = this.getApiKey();
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (token) {
      headers['X-Auth-Token'] = token;
    }

    const proxyUrl = `/api/football${endpoint}`;
    const directUrl = `https://api.football-data.org/v4${endpoint}`;

    let response: Response | null = null;
    let lastError: Error | null = null;

    try {
      response = await fetch(proxyUrl, { headers });
    } catch (e: any) {
      lastError = e;
    }

    if (!response || (!response.ok && response.status === 404)) {
      try {
        response = await fetch(directUrl, { headers });
      } catch (e: any) {
        lastError = e;
      }
    }

    if (!response || !response.ok) {
      throw new Error(lastError?.message || 'تعذر الاتصال بـ football-data.org');
    }

    return await response.json();
  }

  /**
   * Fetch Today's Matches (مباريات اليوم)
   * Fetches real live matches in progress (via /fixtures?live=all)
   * Merges with today's scheduled/finished fixtures (via /fixtures?date=YYYY-MM-DD)
   */
  public async getTodayMatches(
    forceRefresh = false
  ): Promise<{ matches: FootballMatch[]; isFromCache: boolean; error?: string }> {
    const cacheKey = CACHE_MATCHES_KEY;
    const now = Date.now();

    // Check memory/local cache (TTL: 45s so live updates stay active without exceeding 100/day limit)
    if (!forceRefresh) {
      try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (now - cached.timestamp < 45 * 1000) {
            return { matches: cached.data, isFromCache: true };
          }
        }
      } catch {}
    }

    try {
      // 1. Fetch live matches in progress
      const liveRes = await this.fetchApiSports<{ response: any[] }>('/fixtures?live=all');
      const liveItems = liveRes.response || [];
      const liveMatches: FootballMatch[] = liveItems.map(mapApiSportsItemToMatch);

      // 2. Fetch or load cached scheduled matches for today
      let todayScheduleMatches: FootballMatch[] = [];
      const todayStr = new Date().toISOString().split('T')[0];

      let cachedDateFixtures: { timestamp: number; data: FootballMatch[] } | null = null;
      try {
        const stored = localStorage.getItem(CACHE_DATE_FIXTURES_KEY);
        if (stored) cachedDateFixtures = JSON.parse(stored);
      } catch {}

      // Cache today's full day schedule for 15 minutes to save daily API quota
      if (cachedDateFixtures && now - cachedDateFixtures.timestamp < 15 * 60 * 1000) {
        todayScheduleMatches = cachedDateFixtures.data;
      } else {
        try {
          const dateRes = await this.fetchApiSports<{ response: any[] }>(`/fixtures?date=${todayStr}`);
          const dateItems = dateRes.response || [];
          todayScheduleMatches = dateItems.map(mapApiSportsItemToMatch);
          try {
            localStorage.setItem(
              CACHE_DATE_FIXTURES_KEY,
              JSON.stringify({ timestamp: now, data: todayScheduleMatches })
            );
          } catch {}
        } catch (e) {
          console.warn('Could not fetch date fixtures, relying on live fixtures + mock schedule:', e);
          todayScheduleMatches = cachedDateFixtures?.data || this.getCuratedMockMatches();
        }
      }

      // 3. Merge: Live matches take priority and appear at the very top
      const liveIds = new Set(liveMatches.map((m) => m.id));
      const nonLiveMatches = todayScheduleMatches.filter((m) => !liveIds.has(m.id));

      const merged = [...liveMatches, ...nonLiveMatches];

      // Cache successful response
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: merged }));
      } catch {}

      return { matches: merged, isFromCache: false };
    } catch (err: any) {
      console.warn('API-Sports fetch failed, trying secondary fallback:', err);

      // Try football-data.org as secondary fallback
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const data = await this.fetchFootballData<FootballMatchesResponse>(
          `/matches?dateFrom=${todayStr}&dateTo=${todayStr}`
        );
        const matches = (data.matches || []).map((m) => ({
          ...m,
          channel: m.channel || getAssignedBeINChannel(m.competition?.code, m.id),
          homeTeam: {
            ...m.homeTeam,
            arabicName: getArabicTeamName(m.homeTeam.name, m.homeTeam.shortName)
          },
          awayTeam: {
            ...m.awayTeam,
            arabicName: getArabicTeamName(m.awayTeam.name, m.awayTeam.shortName)
          }
        }));

        try {
          localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: matches }));
        } catch {}

        return { matches, isFromCache: false };
      } catch {}

      // Fallback to cache if available
      try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          return { matches: cached.data, isFromCache: true, error: err.message };
        }
      } catch {}

      // If absolutely no network/cache, return curated mock matches
      return { matches: this.getCuratedMockMatches(), isFromCache: true, error: err.message };
    }
  }

  /**
   * Fetch League Standings (جدول الترتيب)
   * Fetches real 2024 season standings from API-Sports
   */
  public async getLeagueStandings(
    competitionCode: string = 'PL',
    forceRefresh = false
  ): Promise<{
    standings: FootballStandingRow[];
    competition?: CompetitionMeta;
    isFromCache: boolean;
    error?: string;
  }> {
    const cacheKey = `${CACHE_STANDINGS_KEY_PREFIX}${competitionCode}`;
    const now = Date.now();
    const meta = SUPPORTED_LEAGUES.find((l) => l.code === competitionCode) || SUPPORTED_LEAGUES[0];

    // Check cache (2 hours TTL for standings to conserve daily requests)
    if (!forceRefresh) {
      try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (now - cached.timestamp < 2 * 60 * 60 * 1000) {
            return { standings: cached.data, competition: meta, isFromCache: true };
          }
        }
      } catch {}
    }

    try {
      const apiSportsLeagueId = meta.apiSportsId || 39;
      const res = await this.fetchApiSports<{ response: any[] }>(
        `/standings?league=${apiSportsLeagueId}&season=2024`
      );

      const leagueData = res.response?.[0]?.league;
      const rawTable = leagueData?.standings?.[0] || [];

      if (!rawTable || rawTable.length === 0) {
        throw new Error('لم يتم العثور على جدول الترتيب لهذه البطولة');
      }

      const rows: FootballStandingRow[] = rawTable.map((item: any) => ({
        position: item.rank,
        team: {
          id: item.team?.id || 1,
          name: item.team?.name || 'فريق',
          shortName: item.team?.name || 'فريق',
          tla: (item.team?.name || '').substring(0, 3).toUpperCase(),
          crest: item.team?.logo || '',
          arabicName: getArabicTeamName(item.team?.name)
        },
        playedGames: item.all?.played ?? 0,
        form: item.form || null,
        won: item.all?.win ?? 0,
        draw: item.all?.draw ?? 0,
        lost: item.all?.lose ?? 0,
        points: item.points ?? 0,
        goalsFor: item.all?.goals?.for ?? 0,
        goalsAgainst: item.all?.goals?.against ?? 0,
        goalDifference: item.goalsDiff ?? 0
      }));

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: rows }));
      } catch {}

      return { standings: rows, competition: meta, isFromCache: false };
    } catch (err: any) {
      console.warn('API-Sports standings failed, trying secondary fallback:', err);

      // Try football-data.org as secondary fallback
      try {
        const data = await this.fetchFootballData<FootballStandingsResponse>(
          `/competitions/${competitionCode}/standings`
        );
        const totalStanding = data.standings?.find((s) => s.type === 'TOTAL') || data.standings?.[0];
        const table = totalStanding?.table || [];

        const enriched: FootballStandingRow[] = table.map((row) => ({
          ...row,
          team: {
            ...row.team,
            arabicName: getArabicTeamName(row.team.name, row.team.shortName)
          }
        }));

        try {
          localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: enriched }));
        } catch {}

        return { standings: enriched, competition: meta, isFromCache: false };
      } catch {}

      // Return cache if available
      try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          return { standings: cached.data, competition: meta, isFromCache: true, error: err.message };
        }
      } catch {}

      // Fallback curated standings for requested league
      return {
        standings: this.getCuratedMockStandings(competitionCode),
        competition: meta,
        isFromCache: true,
        error: err.message
      };
    }
  }

  /**
   * Curated high-fidelity mock matches for realistic instant render and fallback
   */
  private getCuratedMockMatches(): FootballMatch[] {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return [
      {
        id: 101,
        utcDate: `${today}T18:00:00Z`,
        status: 'IN_PLAY',
        matchday: 24,
        stage: 'REGULAR_SEASON',
        lastUpdated: now.toISOString(),
        minute: 68,
        channel: 'beIN Sports 1 HD',
        competition: {
          id: 2021,
          name: 'Premier League',
          code: 'PL',
          type: 'LEAGUE',
          emblem: 'https://media.api-sports.io/football/leagues/39.png',
          arabicName: 'الدوري الإنجليزي الممتاز'
        },
        homeTeam: {
          id: 64,
          name: 'Liverpool FC',
          shortName: 'Liverpool',
          tla: 'LIV',
          crest: 'https://media.api-sports.io/football/teams/40.png',
          arabicName: 'ليفربول'
        },
        awayTeam: {
          id: 65,
          name: 'Manchester City FC',
          shortName: 'Man City',
          tla: 'MCI',
          crest: 'https://media.api-sports.io/football/teams/50.png',
          arabicName: 'مانشستر سيتي'
        },
        score: {
          winner: null,
          duration: 'REGULAR',
          fullTime: { home: 2, away: 1 },
          halfTime: { home: 1, away: 0 }
        }
      },
      {
        id: 102,
        utcDate: `${today}T20:00:00Z`,
        status: 'TIMED',
        matchday: 24,
        stage: 'REGULAR_SEASON',
        lastUpdated: now.toISOString(),
        channel: 'beIN Sports 3 HD',
        competition: {
          id: 2014,
          name: 'La Liga',
          code: 'PD',
          type: 'LEAGUE',
          emblem: 'https://media.api-sports.io/football/leagues/140.png',
          arabicName: 'الدوري الإسباني (لا ليغا)'
        },
        homeTeam: {
          id: 86,
          name: 'Real Madrid CF',
          shortName: 'Real Madrid',
          tla: 'RMA',
          crest: 'https://media.api-sports.io/football/teams/541.png',
          arabicName: 'ريال مدريد'
        },
        awayTeam: {
          id: 81,
          name: 'FC Barcelona',
          shortName: 'Barcelona',
          tla: 'FCB',
          crest: 'https://media.api-sports.io/football/teams/529.png',
          arabicName: 'برشلونة'
        },
        score: {
          winner: null,
          duration: 'REGULAR',
          fullTime: { home: null, away: null },
          halfTime: { home: null, away: null }
        }
      },
      {
        id: 103,
        utcDate: `${today}T15:30:00Z`,
        status: 'FINISHED',
        matchday: 24,
        stage: 'REGULAR_SEASON',
        lastUpdated: now.toISOString(),
        channel: 'beIN Sports Premium 1',
        competition: {
          id: 2021,
          name: 'Premier League',
          code: 'PL',
          type: 'LEAGUE',
          emblem: 'https://media.api-sports.io/football/leagues/39.png',
          arabicName: 'الدوري الإنجليزي الممتاز'
        },
        homeTeam: {
          id: 57,
          name: 'Arsenal FC',
          shortName: 'Arsenal',
          tla: 'ARS',
          crest: 'https://media.api-sports.io/football/teams/42.png',
          arabicName: 'أرسنال'
        },
        awayTeam: {
          id: 61,
          name: 'Chelsea FC',
          shortName: 'Chelsea',
          tla: 'CHE',
          crest: 'https://media.api-sports.io/football/teams/49.png',
          arabicName: 'تشيلسي'
        },
        score: {
          winner: 'HOME_TEAM',
          duration: 'REGULAR',
          fullTime: { home: 3, away: 1 },
          halfTime: { home: 2, away: 0 }
        }
      },
      {
        id: 104,
        utcDate: `${today}T19:45:00Z`,
        status: 'TIMED',
        matchday: 22,
        stage: 'REGULAR_SEASON',
        lastUpdated: now.toISOString(),
        channel: 'beIN Sports 4 HD',
        competition: {
          id: 2019,
          name: 'Serie A',
          code: 'SA',
          type: 'LEAGUE',
          emblem: 'https://media.api-sports.io/football/leagues/135.png',
          arabicName: 'الدوري الإيطالي (سيريا أ)'
        },
        homeTeam: {
          id: 108,
          name: 'FC Internazionale Milano',
          shortName: 'Inter',
          tla: 'INT',
          crest: 'https://media.api-sports.io/football/teams/505.png',
          arabicName: 'إنتر ميلان'
        },
        awayTeam: {
          id: 109,
          name: 'Juventus FC',
          shortName: 'Juventus',
          tla: 'JUV',
          crest: 'https://media.api-sports.io/football/teams/496.png',
          arabicName: 'يوفنتوس'
        },
        score: {
          winner: null,
          duration: 'REGULAR',
          fullTime: { home: null, away: null },
          halfTime: { home: null, away: null }
        }
      },
      {
        id: 105,
        utcDate: `${today}T17:30:00Z`,
        status: 'IN_PLAY',
        matchday: 21,
        stage: 'REGULAR_SEASON',
        lastUpdated: now.toISOString(),
        minute: 34,
        channel: 'beIN Sports 5 HD',
        competition: {
          id: 2002,
          name: 'Bundesliga',
          code: 'BL1',
          type: 'LEAGUE',
          emblem: 'https://media.api-sports.io/football/leagues/78.png',
          arabicName: 'الدوري الألماني (بوندسليغا)'
        },
        homeTeam: {
          id: 5,
          name: 'FC Bayern München',
          shortName: 'Bayern Munich',
          tla: 'BAY',
          crest: 'https://media.api-sports.io/football/teams/157.png',
          arabicName: 'بايرن ميونخ'
        },
        awayTeam: {
          id: 4,
          name: 'Borussia Dortmund',
          shortName: 'Dortmund',
          tla: 'BVB',
          crest: 'https://media.api-sports.io/football/teams/165.png',
          arabicName: 'بوروسيا دورتموند'
        },
        score: {
          winner: null,
          duration: 'REGULAR',
          fullTime: { home: 1, away: 1 },
          halfTime: { home: 1, away: 1 }
        }
      }
    ];
  }

  /**
   * Curated mock standings for high visual fidelity
   */
  private getCuratedMockStandings(code: string): FootballStandingRow[] {
    if (code === 'PD') {
      return [
        { position: 1, team: { id: 81, name: 'FC Barcelona', shortName: 'Barcelona', tla: 'FCB', crest: 'https://media.api-sports.io/football/teams/529.png', arabicName: 'برشلونة' }, playedGames: 23, won: 18, draw: 2, lost: 3, points: 56, goalsFor: 62, goalsAgainst: 24, goalDifference: 38, form: 'W,W,W,D,W' },
        { position: 2, team: { id: 86, name: 'Real Madrid CF', shortName: 'Real Madrid', tla: 'RMA', crest: 'https://media.api-sports.io/football/teams/541.png', arabicName: 'ريال مدريد' }, playedGames: 23, won: 16, draw: 4, lost: 3, points: 52, goalsFor: 50, goalsAgainst: 21, goalDifference: 29, form: 'W,D,W,W,W' },
        { position: 3, team: { id: 78, name: 'Club Atlético de Madrid', shortName: 'Atlético', tla: 'ATM', crest: 'https://media.api-sports.io/football/teams/530.png', arabicName: 'أتلتيكو مدريد' }, playedGames: 23, won: 14, draw: 6, lost: 3, points: 48, goalsFor: 40, goalsAgainst: 16, goalDifference: 24, form: 'D,W,W,W,D' },
        { position: 4, team: { id: 77, name: 'Athletic Club', shortName: 'Athletic', tla: 'ATH', crest: 'https://media.api-sports.io/football/teams/531.png', arabicName: 'أتلتيك بيلباو' }, playedGames: 23, won: 12, draw: 6, lost: 5, points: 42, goalsFor: 37, goalsAgainst: 22, goalDifference: 15, form: 'W,L,W,D,W' },
        { position: 5, team: { id: 94, name: 'Villarreal CF', shortName: 'Villarreal', tla: 'VIL', crest: 'https://media.api-sports.io/football/teams/533.png', arabicName: 'فياريال' }, playedGames: 23, won: 11, draw: 7, lost: 5, points: 40, goalsFor: 43, goalsAgainst: 33, goalDifference: 10, form: 'L,W,D,W,L' },
        { position: 6, team: { id: 92, name: 'Real Sociedad de Fútbol', shortName: 'Real Sociedad', tla: 'RSO', crest: 'https://media.api-sports.io/football/teams/548.png', arabicName: 'ريال سوسيداد' }, playedGames: 23, won: 10, draw: 5, lost: 8, points: 35, goalsFor: 28, goalsAgainst: 24, goalDifference: 4, form: 'W,L,L,W,W' },
        { position: 7, team: { id: 90, name: 'Real Betis Balompié', shortName: 'Real Betis', tla: 'BET', crest: 'https://media.api-sports.io/football/teams/543.png', arabicName: 'ريال بيتيس' }, playedGames: 23, won: 9, draw: 7, lost: 7, points: 34, goalsFor: 29, goalsAgainst: 27, goalDifference: 2, form: 'D,D,W,L,W' },
        { position: 8, team: { id: 559, name: 'Sevilla FC', shortName: 'Sevilla', tla: 'SEV', crest: 'https://media.api-sports.io/football/teams/536.png', arabicName: 'إشبيلية' }, playedGames: 23, won: 8, draw: 6, lost: 9, points: 30, goalsFor: 27, goalsAgainst: 32, goalDifference: -5, form: 'L,W,D,L,W' }
      ];
    }

    // Default Premier League
    return [
      { position: 1, team: { id: 64, name: 'Liverpool FC', shortName: 'Liverpool', tla: 'LIV', crest: 'https://media.api-sports.io/football/teams/40.png', arabicName: 'ليفربول' }, playedGames: 24, won: 18, draw: 5, lost: 1, points: 59, goalsFor: 57, goalsAgainst: 21, goalDifference: 36, form: 'W,W,W,D,W' },
      { position: 2, team: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: 'https://media.api-sports.io/football/teams/42.png', arabicName: 'أرسنال' }, playedGames: 24, won: 15, draw: 6, lost: 3, points: 51, goalsFor: 49, goalsAgainst: 22, goalDifference: 27, form: 'W,W,D,W,W' },
      { position: 3, team: { id: 65, name: 'Manchester City FC', shortName: 'Man City', tla: 'MCI', crest: 'https://media.api-sports.io/football/teams/50.png', arabicName: 'مانشستر سيتي' }, playedGames: 24, won: 14, draw: 6, lost: 4, points: 48, goalsFor: 51, goalsAgainst: 30, goalDifference: 21, form: 'D,W,W,L,W' },
      { position: 4, team: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE', crest: 'https://media.api-sports.io/football/teams/49.png', arabicName: 'تشيلسي' }, playedGames: 24, won: 12, draw: 7, lost: 5, points: 43, goalsFor: 46, goalsAgainst: 30, goalDifference: 16, form: 'W,D,L,W,W' },
      { position: 5, team: { id: 67, name: 'Newcastle United FC', shortName: 'Newcastle', tla: 'NEW', crest: 'https://media.api-sports.io/football/teams/34.png', arabicName: 'نيوكاسل يونايتد' }, playedGames: 24, won: 12, draw: 5, lost: 7, points: 41, goalsFor: 40, goalsAgainst: 28, goalDifference: 12, form: 'W,W,W,L,W' },
      { position: 6, team: { id: 58, name: 'Aston Villa FC', shortName: 'Aston Villa', tla: 'AVL', crest: 'https://media.api-sports.io/football/teams/66.png', arabicName: 'أستون فيلا' }, playedGames: 24, won: 11, draw: 7, lost: 6, points: 40, goalsFor: 37, goalsAgainst: 35, goalDifference: 2, form: 'D,L,W,D,W' },
      { position: 7, team: { id: 66, name: 'Manchester United FC', shortName: 'Man United', tla: 'MUN', crest: 'https://media.api-sports.io/football/teams/33.png', arabicName: 'مانشستر يونايتد' }, playedGames: 24, won: 10, draw: 5, lost: 9, points: 35, goalsFor: 33, goalsAgainst: 32, goalDifference: 1, form: 'L,W,D,W,L' },
      { position: 8, team: { id: 73, name: 'Tottenham Hotspur FC', shortName: 'Tottenham', tla: 'TOT', crest: 'https://media.api-sports.io/football/teams/47.png', arabicName: 'توتنهام هوتسبير' }, playedGames: 24, won: 9, draw: 4, lost: 11, points: 31, goalsFor: 47, goalsAgainst: 38, goalDifference: 9, form: 'L,L,W,L,L' }
    ];
  }
}

export const footballService = new FootballService();
