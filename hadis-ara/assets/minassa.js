"use strict";
// el-Minassatü'l-hadîsiyye (alminasa.ai): hadis arama, bâb numarası hesabı ve İSNAD 2 atıfları. Bağımlılığı yok.
//
// Site, aramaları kendi sunucusundaki bir Elasticsearch vekiline gönderiyor; eklenti de oraya
// aynı biçimde sorgu yollar. Resmî, belgelenmiş bir API değildir; site değişirse burası güncellenmeli.

const SITE = "https://alminasa.ai";
const ES = `${SITE}/api/reactivesearchproxy/es-prod-euw1-hadith-12-read/_msearch`;

const HL_OPEN = "\u0001";
const HL_CLOSE = "\u0002";

// ─── Kaynaklar ─────────────────────────────────────────────────────────
//
// cite: "bab"   → “Kitâb”, bâb no (no. …)   — bâb sitedeki başlıklardan hesaplanır
//       "kitabNo" → “Kitâb”, no. …          — Concordance bu eserlerde kitap içi hadis sırasını
//                                              kullanır; sitede bazı tarikler eksik olduğundan o sıra
//                                              hesaplanamıyor, baskının hadis numarası verilir
//       "sayfa" → cilt/sayfa (no. …)
// editions: sitenin baskı adı → künye. İlk eşleşen tercih edilir (prefer sırası).

const BOOKS = {
  "صحيح البخاري": {
    order: 1,
    short: "Buhârî",
    author: "Ebû Abdillâh Muhammed b. İsmâîl el-Buhârî",
    bibAuthor: "Buhârî, Ebû Abdillâh Muhammed b. İsmâîl",
    title: "el-Câmiʿu’s-sahîh",
    cite: "bab",
    prefer: ["طوق النجاة", "ابن كثير"],
    editions: {
      "طوق النجاة": { editor: "thk. Muhammed Züheyr b. Nâsır en-Nâsır", imprint: "Beyrut: Dâru Tavki’n-necât, 1422" },
      "ابن كثير": { editor: "thk. Mustafa Dîb el-Buğā", imprint: "Dımaşk: Dâru İbn Kesîr, 1414/1993" },
    },
  },
  "صحيح مسلم": {
    order: 2,
    short: "Müslim",
    author: "Ebü’l-Hüseyn Müslim b. el-Haccâc el-Kuşeyrî",
    bibAuthor: "Müslim b. el-Haccâc, Ebü’l-Hüseyn el-Kuşeyrî",
    title: "el-Câmiʿu’s-sahîh",
    cite: "kitabNo",
    // Hadis numaraları Muhammed Fuâd Abdülbâkī neşrine göre; atıfta da o baskı esas alınır.
    prefer: ["إحياء الكتب العربية", "الجيل"],
    editions: {
      "إحياء الكتب العربية": { editor: "thk. Muhammed Fuâd Abdülbâkī", imprint: "Kahire: Dâru İhyâi’l-kütübi’l-Arabiyye, 1374/1955" },
      "الجيل": { editor: "", imprint: "Beyrut: Dâru’l-Cîl, ts." },
    },
  },
  "سنن أبي داود": {
    order: 3,
    short: "Ebû Dâvûd",
    author: "Ebû Dâvûd Süleymân b. el-Eşʿas es-Sicistânî",
    bibAuthor: "Ebû Dâvûd, Süleymân b. el-Eşʿas es-Sicistânî",
    title: "es-Sünen",
    cite: "bab",
    prefer: ["العصرية"],
    editions: {
      "العصرية": { editor: "thk. Muhammed Muhyiddîn Abdülhamîd", imprint: "Beyrut: el-Mektebetü’l-Asriyye, ts." },
    },
  },
  "جامع الترمذي": {
    order: 4,
    short: "Tirmizî",
    author: "Ebû Îsâ Muhammed b. Îsâ et-Tirmizî",
    bibAuthor: "Tirmizî, Ebû Îsâ Muhammed b. Îsâ",
    title: "el-Câmiʿu’l-kebîr",
    cite: "bab",
    prefer: ["الغرب الإسلامي"],
    editions: {
      "الغرب الإسلامي": { editor: "thk. Beşşâr Avvâd Maʿrûf", imprint: "Beyrut: Dâru’l-Garbi’l-İslâmî, 1996-1998" },
    },
  },
  "سنن النسائى الصغرى": {
    order: 5,
    short: "Nesâî",
    author: "Ebû Abdirrahmân Ahmed b. Şuayb en-Nesâî",
    bibAuthor: "Nesâî, Ebû Abdirrahmân Ahmed b. Şuayb",
    title: "es-Sünen",
    cite: "bab",
    prefer: ["المطبوعات الإسلامية"],
    editions: {
      "المطبوعات الإسلامية": { editor: "nşr. Abdülfettâh Ebû Gudde", imprint: "Halep: Mektebü’l-matbûâti’l-İslâmiyye, 1414/1994" },
    },
  },
  "سنن ابن ماجه": {
    order: 6,
    short: "İbn Mâce",
    author: "Ebû Abdillâh Muhammed b. Yezîd İbn Mâce el-Kazvînî",
    bibAuthor: "İbn Mâce, Ebû Abdillâh Muhammed b. Yezîd el-Kazvînî",
    title: "es-Sünen",
    cite: "bab",
    prefer: ["الرسالة العالمية"],
    editions: {
      "الرسالة العالمية": { editor: "thk. Şuayb el-Arnaût vd.", imprint: "Beyrut: Dâru’r-Risâleti’l-Âlemiyye, 1430/2009" },
    },
  },
  "سنن الدارمي": {
    order: 7,
    short: "Dârimî",
    author: "Ebû Muhammed Abdullah b. Abdirrahmân ed-Dârimî",
    bibAuthor: "Dârimî, Ebû Muhammed Abdullah b. Abdirrahmân",
    title: "es-Sünen",
    cite: "bab",
    prefer: ["المغني"],
    editions: {
      "المغني": { editor: "thk. Hüseyin Selîm Esed ed-Dârânî", imprint: "Riyad: Dâru’l-Muğnî, 1421/2000" },
    },
  },
  "موطأ مالك رواية يحيى الليثي": {
    order: 8,
    short: "Mâlik",
    author: "Mâlik b. Enes",
    bibAuthor: "Mâlik b. Enes",
    title: "el-Muvattaʾ",
    cite: "kitabNo",
    prefer: ["زايد"],
    editions: {
      "زايد": { editor: "thk. Muhammed Mustafa el-Aʿzamî", imprint: "Ebûzabi: Müessesetü Zâyid b. Sultân, 1425/2004" },
    },
  },
  "مسند أحمد بن حنبل": {
    order: 9,
    short: "Ahmed b. Hanbel",
    author: "Ebû Abdillâh Ahmed b. Muhammed b. Hanbel",
    bibAuthor: "Ahmed b. Hanbel, Ebû Abdillâh Ahmed b. Muhammed",
    title: "el-Müsned",
    cite: "sayfa",
    // Türkiye'de yaygın atıf Risâle neşrine; sitedeki hadis numarası ise Mekniz neşrine ait.
    prefer: ["الرسالة", "المكنز"],
    editions: {
      "الرسالة": { editor: "thk. Şuayb el-Arnaût vd.", imprint: "Beyrut: Müessesetü’r-Risâle, 1421/2001", numbered: false },
      "المكنز": { editor: "nşr. Cemʿiyyetü’l-Meknezi’l-İslâmî", imprint: "Cidde: Dâru’l-Minhâc, 1431/2010" },
    },
  },
  "صحيح ابن خزيمة": {
    order: 10,
    short: "İbn Huzeyme",
    author: "Ebû Bekr Muhammed b. İshâk b. Huzeyme",
    bibAuthor: "İbn Huzeyme, Ebû Bekr Muhammed b. İshâk",
    title: "es-Sahîh",
    cite: "sayfa",
    prefer: ["الميمان"],
    editions: {
      "الميمان": { editor: "thk. Mâhir Yâsîn el-Fahl", imprint: "Riyad: Dâru’l-Meymân, 1430/2009" },
    },
  },
  "صحيح ابن حبان": {
    order: 11,
    short: "İbn Hibbân",
    author: "Ebû Hâtim Muhammed b. Hibbân el-Büstî",
    bibAuthor: "İbn Hibbân, Ebû Hâtim Muhammed el-Büstî",
    title: "es-Sahîh",
    fullTitle: "es-Sahîh (el-İhsân fî takrîbi Sahîhi İbn Hibbân)",
    cite: "sayfa",
    prefer: ["الرسالة"],
    editions: {
      "الرسالة": { editor: "thk. Şuayb el-Arnaût", imprint: "Beyrut: Müessesetü’r-Risâle, 1414/1993" },
    },
  },
  "المستدرك على الصحيحين": {
    order: 12,
    short: "Hâkim",
    author: "Ebû Abdillâh Muhammed b. Abdillâh el-Hâkim en-Nîsâbûrî",
    bibAuthor: "Hâkim en-Nîsâbûrî, Ebû Abdillâh Muhammed b. Abdillâh",
    title: "el-Müstedrek ʿale’s-Sahîhayn",
    cite: "sayfa",
    prefer: ["المعرفة"],
    editions: {
      "المعرفة": { editor: "", imprint: "Beyrut: Dâru’l-Maʿrife, ts." },
    },
  },
};

const BOOK_LIST = Object.entries(BOOKS)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([arabic, b]) => ({ arabic, ...b }));

// ─── Kitap (bölüm) adları ──────────────────────────────────────────────
//
// "كتاب"/"من كتاب"/"أبواب" ön ekleri atıldıktan sonraki ada göre. Bulunamayan ad Arapça kalır.

const KITAB = {
  "آداب القضاة": "Âdâbü’l-kudât",
  "أحاديث الأنبياء": "Ehâdîsü’l-enbiyâʾ",
  "أخبار الآحاد": "Ahbâru’l-âhâd",
  "أسماء النبي صلى الله عليه وسلم": "Esmâʾü’n-nebî",
  "إحياء الموات": "İhyâʾü’l-mevât",
  "إخباره صلى الله عليه وسلم عن مناقب الصحابة": "Menâkıbü’s-sahâbe",
  "إقامة الصلاة والسنة فيها": "İkāmetü’s-salât",
  "ابن ماجه": "Mukaddime",
  "استتابة المرتدين والمعاندين وقتالهم": "İstitâbetü’l-mürteddîn",
  "الآداب": "Âdâb",
  "الأحباس": "Ahbâs",
  "الأحكام": "Ahkâm",
  "الأدب": "Edeb",
  "الأذان": "Ezân",
  "الأذان والسنة فيه": "Ezân",
  "الأشربة": "Eşribe",
  "الأضاحي": "Edâhî",
  "الأضحية": "Udhiyye",
  "الأطعمة": "Etʿime",
  "الأقضية": "Akdıye",
  "الألفاظ من الأدب وغيرها": "Elfâz",
  "الأيمان": "Eymân",
  "الأيمان والنذور": "Eymân ve’n-nüzûr",
  "الإجارة": "İcâre",
  "الإسراء": "İsrâʾ",
  "الإكراه": "İkrâh",
  "الإمارة": "İmâre",
  "الإمامة": "İmâme",
  "الإمامة في الصلاة": "İmâme",
  "الإمامة وصلاة الجماعة": "İmâme",
  "الإيمان": "Îmân",
  "الإيمان وشرائعه": "Îmân",
  "الاستئذان": "İstiʾzân",
  "الاستئذان والآداب": "İstiʾzân",
  "الاستسقاء": "İstiskāʾ",
  "الاستعاذة": "İstiâze",
  "الاعتصام بالكتاب والسنة": "İʿtisâm",
  "الاعتكاف": "İʿtikâf",
  "الافتتاح": "İftitâh",
  "البر ، والصلة ، والآداب": "Birr",
  "البر والإحسان": "Birr ve’l-ihsân",
  "البر والصلة": "Birr",
  "البيعة": "Beyʿa",
  "البيوع": "Büyûʿ",
  "التاريخ": "Târîh",
  "التجارات": "Ticârât",
  "الترجل": "Tereccül",
  "التطبيق": "Tatbîk",
  "التطوع": "Tatavvuʿ",
  "التعبير": "Taʿbîr",
  "التفسير": "Tefsîr",
  "التمني": "Temennî",
  "التوبة": "Tevbe",
  "التوحيد": "Tevhîd",
  "التيمم": "Teyemmüm",
  "الجامع": "Câmiʿ",
  "الجزية": "Cizye",
  "الجمعة": "Cumʿa",
  "الجنائز": "Cenâiz",
  "الجنائز وما يتعلق بها مقدما أو مؤخرا": "Cenâiz",
  "الجنايات": "Cinâyât",
  "الجنة وصفة نعيمها وأهلها": "Cennet",
  "الجهاد": "Cihâd",
  "الجهاد والسير": "Cihâd",
  "الحج": "Hac",
  "الحجر": "Hacr",
  "الحدود": "Hudûd",
  "الحروف والقراءات": "Hurûf",
  "الحظر والإباحة": "Hazr ve’l-ibâha",
  "الحمام": "Hammâm",
  "الحوالات": "Havâlât",
  "الحوالة": "Havâle",
  "الحيض": "Hayz",
  "الحيض والاستحاضة": "Hayz",
  "الحيل": "Hiyel",
  "الخاتم": "Hâtem",
  "الخراج والإمارة والفيء": "Harâc",
  "الخصومات": "Husûmât",
  "الخيل": "Hayl",
  "الدعاء": "Duʿâ",
  "الدعوات": "Daʿavât",
  "الدعوى": "Daʿvâ",
  "الديات": "Diyât",
  "الذبائح": "Zebâih",
  "الذبائح والصيد": "Zebâih ve’s-sayd",
  "الذكر والدعاء والتوبة والاستغفار": "Zikir",
  "الرؤيا": "Rüʾyâ",
  "الرضاع": "Radâʿ",
  "الرقائق": "Rekāik",
  "الرقاق": "Rikāk",
  "الرقبى": "Rukbâ",
  "الرقبى والعمرى": "Rukbâ ve’l-umrâ",
  "الرقى والتمائم": "Rukā ve’t-temâim",
  "الرهن": "Rehn",
  "الرهون": "Ruhûn",
  "الزكاة": "Zekât",
  "الزهد": "Zühd",
  "الزهد والرقائق": "Zühd",
  "الزينة من السنن": "Zîne",
  "الزينة والتطييب": "Zîne",
  "السلام": "Selâm",
  "السلم": "Selem",
  "السنة": "Sünnet",
  "السهو": "Sehv",
  "السير": "Siyer",
  "الشركة": "Şirket",
  "الشروط": "Şurût",
  "الشعر": "Şiʿr",
  "الشفعة": "Şüfʿa",
  "الشهادات": "Şehâdât",
  "الصدقات": "Sadakāt",
  "الصدقة": "Sadaka",
  "الصلاة": "Salât",
  "الصلاة في رمضان": "Salât fî Ramazân",
  "الصلح": "Sulh",
  "الصوم": "Savm",
  "الصيام": "Sıyâm",
  "الصيد": "Sayd",
  "الصيد والذبائح": "Sayd",
  "الصيد والذبائح وما يؤكل من الحيوان": "Sayd",
  "الضحايا": "Dahâyâ",
  "الطب": "Tıb",
  "الطلاق": "Talâk",
  "الطلاق واللعان": "Talâk",
  "الطهارة": "Tahâret",
  "الطهارة وسننها": "Tahâret",
  "العارية": "Âriyye",
  "العتق": "Itk",
  "العتق والولاء": "Itk",
  "العدوى والطيرة والفأل": "Advâ",
  "العقول": "Ukūl",
  "العقيقة": "Akīka",
  "العلم": "İlim",
  "العمرى": "Umrâ",
  "العيدين": "Îdeyn",
  "العين": "Ayn",
  "الغسل": "Gusl",
  "الغسل والتيمم": "Gusl",
  "الغصب": "Gasb",
  "الفتن": "Fiten",
  "الفتن وأشراط الساعة": "Fiten",
  "الفتن والملاحم": "Fiten",
  "الفرائض": "Ferâiz",
  "الفرع والعتيرة": "Ferʿ ve’l-atîre",
  "الفضائل": "Fedâil",
  "القبلة": "Kıble",
  "القدر": "Kader",
  "القرآن": "Kurʾân",
  "القراءات": "Kırâʾât",
  "القراض": "Kırâz",
  "القسامة": "Kasâme",
  "القسامة والمحاربين والقصاص والديات": "Kasâme",
  "القضاء": "Kazâʾ",
  "الكسوف": "Küsûf",
  "الكفارات": "Keffârât",
  "الكفالة": "Kefâle",
  "الكلام": "Kelâm",
  "الكهانة والسحر": "Kehâne",
  "اللباس": "Libâs",
  "اللباس وآدابه": "Libâs",
  "اللباس والزينة": "Libâs",
  "اللقطة": "Lukata",
  "المحاربين من أهل الكفر والردة": "Muhâribîn",
  "المدبر": "Müdebber",
  "المرضى": "Merdâ",
  "المزارعة": "Müzâraa",
  "المساجد": "Mesâcid",
  "المساجد والجماعات": "Mesâcid",
  "المساجد ومواضع الصلاة": "Mesâcid",
  "المساقاة": "Müsâkāt",
  "المظالم والغصب": "Mezâlim",
  "المغازي": "Meğāzî",
  "المكاتب": "Mükâteb",
  "الملاحم": "Melâhim",
  "المناسك": "Menâsik",
  "المناقب": "Menâkıb",
  "المهدي": "Mehdî",
  "المواقيت": "Mevâkît",
  "المياه": "Miyâh",
  "النجوم والأنواء": "Nücûm",
  "النحل": "Nuhl",
  "النذر": "Nezr",
  "النذور": "Nüzûr",
  "النذور والأيمان": "Nüzûr ve’l-eymân",
  "النفقات": "Nafakāt",
  "النكاح": "Nikâh",
  "الهبات": "Hibât",
  "الهبة": "Hibe",
  "الهبة وفضلها والتحريض عليها": "Hibe",
  "الوتر": "Vitr",
  "الوحي": "Vahy",
  "الوصايا": "Vesâyâ",
  "الوصية": "Vasiyye",
  "الوضوء": "Vudûʾ",
  "الوقف": "Vakf",
  "الوكالة": "Vekâle",
  "الولاء والهبة": "Velâ",
  "باب الاعتصام بالسنة وما يتعلق بها نقلا وأمرا وزجرا": "İʿtisâm bi’s-sünne",
  "باب بدء الوحي": "Bedʾü’l-vahy",
  "باب ما جاء في الابتداء بحمد الله تعالى": "Mukaddime",
  "بدء الخلق": "Bedʾü’l-halk",
  "تتمة كتاب الصلاة": "Salât",
  "تحريم الدم": "Tahrîmü’d-dem",
  "تعبير الرؤيا": "Taʿbîrü’r-rüʾyâ",
  "تفسير القرآن": "Tefsîr",
  "تقصير الصلاة في السفر": "Taksîrü’s-salât",
  "جهنم": "Cehennem",
  "حسن الخلق": "Hüsnü’l-hulk",
  "دعوة المظلوم": "Daʿvetü’l-mazlûm",
  "سجود القرآن": "Sücûdü’l-Kurʾân",
  "شهر رمضان": "Şehru Ramazân",
  "صفة الجنة": "Sıfatü’l-cenne",
  "صفة القيامة والجنة والنار": "Sıfatü’l-kıyâme",
  "صفة القيامة والرقائق والورع": "Sıfatü’l-kıyâme",
  "صفة النبي صلى الله عليه وسلم": "Sıfatü’n-nebî",
  "صفة جهنم": "Sıfatü cehennem",
  "صلاة الاستسقاء": "İstiskāʾ",
  "صلاة التراويح": "Salâtü’t-terâvîh",
  "صلاة الجماعة": "Salâtü’l-cemâa",
  "صلاة الخوف": "Salâtü’l-havf",
  "صلاة السفر": "Salâtü’s-sefer",
  "صلاة العيدين": "Îdeyn",
  "صلاة الكسوف": "Küsûf",
  "صلاة الليل": "Salâtü’l-leyl",
  "صلاة المسافرين وقصرها": "Salâtü’l-müsâfirîn",
  "عشرة النساء": "İşretü’n-nisâʾ",
  "فرض الخمس": "Farzu’l-humus",
  "فضائل الجهاد": "Fedâilü’l-cihâd",
  "فضائل الصحابة": "Fedâilü’s-sahâbe",
  "فضائل القرآن": "Fedâilü’l-Kurʾân",
  "فضائل المدينة": "Fedâilü’l-Medîne",
  "في الاستقراض وأداء الديون والحجر والتفليس": "İstikrâz",
  "في اللقطة": "Lukata",
  "قصر الصلاة في السفر": "Kasru’s-salât",
  "قطع السارق": "Katʿu’s-sârik",
  "قيام الليل وتطوع النهار": "Kıyâmü’l-leyl",
  "كراء الأرض": "Kirâʾü’l-arz",
  "كفارات الأيمان": "Keffârâtü’l-eymân",
  "ما جاء في الجنائز": "Cenâiz",
  "معرفة الصحابة رضي الله عنهم": "Maʿrifetü’s-sahâbe",
  "مقدمة": "Mukaddime",
  "مناسك الحج": "Menâsik",
  "مواقيت الصلاة": "Mevâkītü’s-salât",
  "وقوت الصلاة": "Vukūtü’s-salât",
};

function normKitab(ch) {
  return String(ch || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:و?من )?(?:كتاب|كتب|أبواب) /, "")
    .trim();
}

function kitabName(chapter) {
  const raw = String(chapter || "").replace(/\s+/g, " ").trim();
  const n = normKitab(raw);
  if (KITAB[n]) return KITAB[n];
  if (KITAB[raw]) return KITAB[raw];
  // "… ، رجالهم ونسائهم …" gibi uzun başlıklar: ilk virgüle kadar dene
  const head = n.split(" ،")[0].trim();
  return KITAB[head] || n;
}

// ─── Ağ ───────────────────────────────────────────────────────────────

async function es(body) {
  const res = await fetch(ES, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson", Accept: "application/json" },
    body: "{}\n" + JSON.stringify(body) + "\n",
  });
  if (!res.ok) throw new Error(`Sunucu ${res.status} döndürdü`);
  const json = await res.json();
  const r = json && json.responses && json.responses[0];
  if (!r) throw new Error("Beklenmeyen yanıt");
  if (r.error) throw new Error((r.error.root_cause && r.error.root_cause[0] && r.error.root_cause[0].reason) || r.error.type || "Arama hatası");
  return r;
}

const SOURCE = [
  "hadith_id",
  "hadith_serial_id",
  "book_name",
  "type",
  "chapter",
  "sub_chapter",
  "hadith",
  "number",
  "volume",
  "page",
  "editions",
  "narrators",
  "rulings",
  "raw_narrations",
];

// Arama türleri: "ifade" kelime köklerine göre ifade (siteyle aynı varyantları bulur),
// "tam" harfi harfine ifade, "kelime" tüm kelimeler herhangi bir sırada.
function buildQuery(text, mode) {
  const t = text.trim();
  if (mode === "tam") return { match_phrase: { hadith: t } };
  if (mode === "kelime") return { match: { "hadith.tokenized": { query: t, operator: "and" } } };
  return { match_phrase: { "hadith.tokenized": t } };
}

const PAGE = 40;

async function search(text, { mode = "ifade", book = "", from = 0, ids = null } = {}) {
  let quoted = false;
  let t = String(text || "").trim();
  const m = t.match(/^["“”«](.+)["“”»]$/);
  if (m) {
    t = m[1].trim();
    quoted = true;
  }
  const filter = [];
  if (book) filter.push({ term: { book_name: book } });
  if (ids) filter.push({ ids: { values: ids } });
  const must = t ? [buildQuery(t, quoted ? "tam" : mode)] : [];
  const field = !t ? null : quoted || mode === "tam" ? "hadith" : "hadith.tokenized";
  const body = {
    from,
    size: PAGE,
    _source: SOURCE,
    track_total_hits: true,
    sort: [{ authenticity_order: "asc" }, { hadith_serial_id: "asc" }],
    query: { bool: { must, filter } },
  };
  if (field) body.highlight = { pre_tags: [HL_OPEN], post_tags: [HL_CLOSE], fields: { [field]: { number_of_fragments: 0 } } };
  const r = await es(body);
  const hits = r.hits.hits.map((h) => {
    const s = h._source;
    const hl = h.highlight && h.highlight[field] && h.highlight[field][0];
    return { ...s, id: h._id, html: hl || s.hadith || "" };
  });
  return { total: r.hits.total.value, hits };
}

// Bir hadisin diğer rivayetleri (sitenin "طرق الحديث" listesi).
async function narrations(h) {
  const ids = (h.raw_narrations || []).filter((x) => x && x !== h.hadith_id);
  if (!ids.length) return { total: 0, hits: [] };
  return search("", { ids: [...new Set(ids)] });
}

// ─── Bâb numarası ─────────────────────────────────────────────────────
//
// Site bâb numarası vermiyor; aynı kitaptaki hadisleri sırayla alıp bâb başlığı her değiştiğinde
// sayacı artırıyoruz. Bâb başlığı boş olan kayıtlar ve kitabın kendi adını taşıyan başlık satırı
// sayılmaz. Hadis içermeyen (yalnız tercemeli) bâblar veride olmadığından sayı bazen eksik çıkar.

const chapterCache = new Map(); // book|chapter -> Promise<[{serial, sub}]>

function chapterRows(book, chapter) {
  const key = `${book}|${chapter}`;
  if (!chapterCache.has(key)) {
    const p = es({
      size: 10000,
      _source: ["sub_chapter", "hadith_serial_id"],
      sort: [{ hadith_serial_id: "asc" }],
      query: { bool: { filter: [{ term: { book_name: book } }, { term: { chapter } }] } },
    }).then((r) => r.hits.hits.map((h) => ({ serial: h._source.hadith_serial_id, sub: h._source.sub_chapter })));
    p.catch(() => chapterCache.delete(key));
    chapterCache.set(key, p);
  }
  return chapterCache.get(key);
}

function cleanBab(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

// { n, kind: "bab", reason? } ya da null (bâb kullanılmayan eserler)
async function position(h) {
  const b = BOOKS[h.book_name];
  if (!b || b.cite !== "bab") return null;
  const rows = await chapterRows(h.book_name, h.chapter);
  const upto = rows.filter((r) => r.serial <= h.hadith_serial_id);
  const chapterTitle = cleanBab(h.chapter);
  let n = 0;
  let prev = null;
  for (const r of upto) {
    const s = cleanBab(r.sub);
    if (!s || s === chapterTitle) continue;
    if (s !== prev) {
      n++;
      prev = s;
    }
  }
  // Buhârî'nin "Tefsîr" kitabında bâblar sûrelere göre ayrı numaralanır; sûre başlıkları veride yok.
  if (h.book_name === "صحيح البخاري" && normKitab(h.chapter) === "تفسير القرآن") return { n: null, kind: "bab", reason: "Buhârî “Tefsîr”inde sûre başlıkları veride yok" };
  return { n: Math.max(n, 1), kind: "bab" };
}

// ─── Atıf ─────────────────────────────────────────────────────────────

function pickEdition(h) {
  const b = BOOKS[h.book_name];
  const list = [{ edition: "", volume: h.volume, page: h.page }, ...(h.editions || [])];
  for (const key of b.prefer) {
    const e = (h.editions || []).find((x) => x.edition && x.edition.includes(key));
    if (e) return { ...b.editions[key], volume: e.volume, page: e.page, key };
  }
  // Baskı listesinde yoksa ana baskı (sitenin varsayılanı) = ilk tercih
  const key = b.prefer[0];
  return { ...b.editions[key], volume: list[0].volume, page: list[0].page, key };
}

function numbers(h) {
  const n = (h.number || []).filter((x) => x != null);
  if (!n.length) return "";
  if (n.length === 2 && Number(n[1]) === Number(n[0]) + 1) return `${n[0]}-${n[1]}`;
  return n.join(", ");
}

function volPage(e) {
  if (e.page == null) return "";
  return e.volume != null ? `${e.volume}/${e.page}` : String(e.page);
}

// pos: position() sonucu (bâb kitapları için gerekli).
function citations(h, pos) {
  const b = BOOKS[h.book_name];
  if (!b) return null;
  const e = pickEdition(h);
  const no = numbers(h);
  const kitab = kitabName(h.chapter);
  let locFull;
  let locShort;
  if (b.cite === "sayfa") {
    const vp = volPage(e);
    const withNo = no && e.numbered !== false ? ` (no. ${no})` : "";
    locFull = `${vp}${withNo}`;
    locShort = `${b.title}, ${vp}`;
  } else {
    const n = b.cite === "bab" && pos && pos.n;
    if (n) {
      locFull = `“${kitab}”, ${n}${no ? ` (no. ${no})` : ""}`;
      locShort = `“${kitab}”, ${n}`;
    } else {
      locFull = `“${kitab}”${no ? `, no. ${no}` : ""}`;
      locShort = locFull;
    }
  }
  const footnote = `${b.author}, ${b.fullTitle || b.title}${e.editor ? ", " + e.editor : ""} (${e.imprint}), ${locFull}.`;
  const shortFootnote = `${b.short}, ${locShort}.`;
  const bibliography = `${b.bibAuthor}. ${b.fullTitle || b.title}. ${e.editor ? capitalize(e.editor) + ". " : ""}${e.imprint}.`;
  return { footnote, shortFootnote, bibliography, edition: e, kitab, locShort };
}

function capitalize(s) {
  return s ? s[0].toLocaleUpperCase("tr") + s.slice(1) : s;
}

// ─── Metin ────────────────────────────────────────────────────────────

function decode(s) {
  return String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Sitenin HTML'i: <a class=rawy id=…>râvî</a>, <a class=matn>metin</a>, <highlight>…</highlight>.
function parts(html) {
  let s = String(html || "")
    .replace(/<highlight>/g, HL_OPEN)
    .replace(/<\/highlight>/g, HL_CLOSE);
  const i = s.search(/<a class=["']?matn/);
  let isnad = i >= 0 ? s.slice(0, i) : "";
  let matn = i >= 0 ? s.slice(i) : s;
  const strip = (x) => decode(x.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  return { isnad: strip(isnad), matn: strip(matn) };
}

function plain(html) {
  const p = parts(html);
  return [p.isnad, p.matn].filter(Boolean).join(" ").replace(new RegExp(`[${HL_OPEN}${HL_CLOSE}]`, "g"), "");
}

// Markdown içinde vurgu: ** … ** (işaretler kelime içinde kalabilir, o yüzden boşluklarla sınırlanır)
function mdHighlight(s) {
  return s
    .replace(new RegExp(`${HL_OPEN}([^${HL_CLOSE}]*)${HL_CLOSE}`, "g"), (_, x) => (x.trim() ? `**${x.trim()}**` : x))
    .replace(new RegExp(`[${HL_OPEN}${HL_CLOSE}]`, "g"), "");
}

function mdEscape(s) {
  return String(s).replace(/([\\`*_{}\[\]<>#|])/g, "\\$1");
}

function snippet(html, max = 140) {
  const p = parts(html);
  const text = p.matn || p.isnad;
  const at = text.indexOf(HL_OPEN);
  let s = text;
  if (at > 40) s = "… " + text.slice(at - 40);
  s = s.replace(new RegExp(`[${HL_OPEN}${HL_CLOSE}]`, "g"), "");
  return s.length > max ? s.slice(0, max) + " …" : s;
}

const TYPES = { "مرفوع": "Merfû", "موقوف": "Mevkûf", "مقطوع": "Maktûʿ", "قدسي": "Kudsî" };

function hadithMarkdown(h, pos, cite) {
  const b = BOOKS[h.book_name];
  const p = parts(h.html || h.hadith);
  const no = numbers(h);
  const lines = [];
  const kitab = kitabName(h.chapter);
  lines.push(`## ${b ? b.short : h.book_name}${no ? ` — no. ${no}` : ""}`);
  const where = [`“${kitab}”`];
  if (pos && pos.n) where.push(`bâb ${pos.n}`);
  if (h.volume != null || h.page != null) where.push(volPage(h));
  if (TYPES[h.type]) where.push(TYPES[h.type]);
  lines.push(where.join(" · "));
  lines.push("");
  lines.push(`${mdEscape(h.chapter || "")}${h.sub_chapter ? " — " + mdEscape(h.sub_chapter) : ""}`);
  lines.push("");
  if (p.isnad) lines.push(mdHighlight(mdEscape(p.isnad)), "");
  if (p.matn) lines.push("> " + mdHighlight(mdEscape(p.matn)), "");
  if (cite) {
    lines.push("---", "", `**Atıf (İSNAD 2):** ${mdEscape(cite.shortFootnote)}`);
    if (pos && pos.n) lines.push("", "*Bâb numarası sitedeki bâb başlıklarından hesaplandı; Concordance ile karşılaştırın.*");
    if (b && b.cite === "kitabNo") lines.push("", "*Bu eserde Concordance kitap içi hadis sırasını kullanır; o sıra sitedeki veriden hesaplanamadığı için baskının hadis numarası verildi.*");
    if (pos && pos.reason) lines.push("", `*Bâb numarası hesaplanamadı: ${pos.reason}.*`);
    lines.push("");
  }
  const rulings = (h.rulings || []).filter((r) => r && r.ruling);
  if (rulings.length) {
    lines.push("### Hükümler", "");
    for (const r of rulings) lines.push(`- **${mdEscape(r.ruler)}**: ${mdEscape(r.ruling)}${r.book_name ? ` (${mdEscape(r.book_name)}${r.page ? `, ${r.volume ? r.volume + "/" : ""}${r.page}` : ""})` : ""}`);
    lines.push("");
  }
  const narr = (h.narrators || []).filter((n) => n && n.full_name);
  if (narr.length) {
    lines.push("### Râvîler", "");
    for (const n of narr) lines.push(`- ${mdEscape(n.full_name)}${n.grade ? ` — ${mdEscape(n.grade.replace(/\s+/g, " ").trim())}` : ""}`);
    lines.push("");
  }
  const eds = h.editions || [];
  if (eds.length) {
    lines.push("### Baskılar", "");
    for (const e of eds) lines.push(`- ${mdEscape(e.edition)}: ${volPage(e)}`);
    lines.push("");
  }
  return lines.join("\n");
}

function searchUrl(text) {
  return `${SITE}/?search=${encodeURIComponent(text)}`;
}

module.exports = {
  SITE,
  BOOKS,
  BOOK_LIST,
  search,
  narrations,
  position,
  citations,
  kitabName,
  hadithMarkdown,
  snippet,
  plain,
  parts,
  numbers,
  searchUrl,
  TYPES,
};
