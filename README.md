# Hadis Ara — Tinycast eklentisi

el-Minassatü'l-hadîsiyye'de (alminasa.ai) hadis arar. Senet, metin, râvîler, hükümler ve baskı bilgileri yan panelde görünür. İSNAD 2'ye göre dipnot ve kaynakça kopyalanır. Bağımlılığı yoktur (~60 KB).

Kaynaklar: Buhârî, Müslim, Ebû Dâvûd, Tirmizî, Nesâî, İbn Mâce, Dârimî, Muvatta, Ahmed b. Hanbel, İbn Huzeyme, İbn Hibbân ve Hâkim.

## Kurulum

Tinycast → Ayarlar → Extensions → Install New → **Add from folder** → bu klasörü seçin (ya da üst klasörde `zsh kur.sh`).

Elle kurmak için bu klasörü `~/Library/Application Support/com.tinycast.app/extensions/hadis-ara` olarak kopyalayıp Tinycast'i yeniden başlatmanız da yeterlidir.

## Arama

Arapça yazın; hareke gerekmez. Sağ üstteki menüden arama türü seçilir:

- **İfade (varyantlarla):** Varsayılan. Kelimeleri kökleriyle eşler; örneğin "الأعمال بالنية" araması "بالنيات" geçen rivayeti de bulur.
- **Tam ifade:** Harfi harfine arar. Aramayı tırnak içinde yazmak da aynı işi görür: "…"
- **Tüm kelimeler:** Kelimelerin hepsinin, herhangi bir sırada geçtiği hadisleri bulur.

Sonuçlar sitedeki "en sahih" sırasıyla gelir: önce Buhârî, sonra Müslim vb. İlk 40 sonuç görünür; listenin sonundaki satırla devamı yüklenir.

## Kısayollar

| Kısayol | İşlem |
|---|---|
| Tek tıklama | Hadisi seçer, yan panelde gösterir |
| Çift tıklama / ↵ | Tam ekranda okur |
| ⇧⌘A | Dipnot atfı (ilk atıf, tam künye) |
| ⌥⇧⌘A | Kısa dipnot atfı |
| ⇧⌘K | Kaynakça girdisi |
| ⌘R | Bu hadisin diğer rivayetleri |
| ⌘F / ⇧⌘F | Kitapla sınırla / sınırı kaldır |
| ⌥⌘C | Hadisi (senet + metin) kopyala |
| ⇧⌘M | Yalnız metni kopyala |
| ⌘↵ | Aramayı sitede aç |

## Atıf biçimi

| Eser | İlk atıf (sonu) | Kısa atıf |
|---|---|---|
| Buhârî, Ebû Dâvûd, Tirmizî, Nesâî, İbn Mâce, Dârimî | … “Îmân”, 37 (no. 50). | Buhârî, “Îmân”, 37. |
| Müslim, Muvatta | … “İmâre”, no. 1907. | Müslim, “İmâre”, no. 1907. |
| Ahmed b. Hanbel, İbn Huzeyme, İbn Hibbân, Hâkim | … 1/375 (no. 159). | İbn Hibbân, es-Sahîh, 1/375. |

**Bâb numarası hesaplanır, siteden gelmez.** Kitaptaki hadisler sırayla alınır ve bâb başlığı her değiştiğinde sayı bir artar. Bâb başlığı boş kayıtlar ile kitabın kendi adını taşıyan başlık satırı sayılmaz. Concordance'la karşılaştırdığım örneklerin hepsi tuttu:

- Buhârî "Îmân", 37
- Ebû Dâvûd "Sünnet", 16
- Tirmizî "Îmân", 4 ve "Fedâilü’l-cihâd", 16
- İbn Mâce "Mukaddime", 9

Yalnız tercemeden oluşan, hadis içermeyen bâblar sitenin verisinde yok; böyle bir bâbın bulunduğu kitapta sayı eksik çıkar. Bu yüzden yan panelde "Concordance ile karşılaştırın" notu durur.

- **Buhârî "Tefsîr":** Bâblar sûrelere göre ayrı numaralandığı, sûre başlıkları da veride olmadığı için bâb numarası verilmez, hadis numarası verilir.
- **Müslim ve Muvatta:** Concordance bu eserlerde kitap içi hadis sırasını kullanıyor. Sitede bazı tarikler eksik olduğundan bu sıra doğru hesaplanamıyor: "İmâre" 155 olması gerekirken 143 çıkıyor. Bu yüzden kitap adı ve baskının hadis numarası verilir.

**Baskılar:**

- Müslim'de hadis numaraları M. Fuâd Abdülbâkī neşrine ait; atıf da o baskıya yapılır.
- Ahmed b. Hanbel'de sitedeki hadis numarası Mekniz neşrine ait. Türkiye'de yaygın atıf Risâle neşrine yapıldığı için cilt/sayfa Risâle'ye göre verilir, hadis numarası verilmez.
- Diğer eserlerde sitenin kullandığı baskı esas alınır. Künyeler `assets/minassa.js` başındaki `BOOKS` tablosundadır; tez veya makalede kullanmadan önce baskı bilgilerini kontrol edin.

Kitap (bölüm) adları `KITAB` sözlüğüyle Türkçeleştirilir. Sözlükte olmayan ad Arapça kalır; sözlüğe ekleyebilirsiniz.

## Teknik not

Site, aramalarını kendi sunucusundaki bir arama vekili üzerinden yapıyor; eklenti de aynı yolu kullanır. Bu, sitenin belgelenmiş, herkese açık bir API'si değildir. Site altyapısını değiştirirse eklenti çalışmayı bırakabilir; o durumda `assets/minassa.js` başındaki `ES` adresini güncellemek gerekir. Sitede tek tek hadislere kalıcı bağlantı olmadığından "Sitede Aç" eylemi aramayı sitede açar.

## Dosyalar

- `search.js`: arayüz (liste, yan panel, eylemler)
- `assets/minassa.js`: arama, bâb numarası hesabı, İSNAD 2 atıfları, eser ve kitap adı tabloları
- `package.json`: eklenti tanımı
