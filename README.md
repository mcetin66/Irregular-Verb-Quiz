# Motor Tasarım Atölyesi

Elektrik motorları için tarayıcıda çalışan, etkileşimli tasarım aracı. İki
makine tipini destekler: **sincap kafesli asenkron (SCIM)** ve **yüzey
mıknatıslı senkron (SPM)**. Parametreleri çekerken kesit görünümü, sargı
yerleşimi, doyma haritası ve performans değerleri anında güncellenir.

Veri modeli [Pyleecan](https://github.com/Eomys/pyleecan) (Apache-2.0) sınıf
şemasına göre adlandırılmıştır; üretilen JSON doğrudan
`pyleecan.Functions.load.load()` ile açılır.

> Depo adı henüz değiştirilmedi; içerik motor tasarımı üzerinedir.

## Şu an ne yapıyor

**Geometri ve görselleştirme**
- Parametrik stator kesiti: dış/delik yarıçapı, oluk sayısı, sabit diş
  genişliği, oluk derinliği, ağız genişliği, kama ve dip yarıçapı
- Gömme yüzey mıknatıslı rotor: hava aralığı, mıknatıs kalınlığı, kutup
  kaplama oranı, mil çapı
- Dört görünüm: **Sargı** (faz renkli iletkenler), **Akı** (doyma ısı
  haritası), **Sade** (çıplak laminasyon) ve **3B**
- 3B görünüm harici kütüphane olmadan, doğrudan WebGL ile çizilir:
  parmakla döndürme, yakınlaştırma, **kameraya dönük kesit alma**, parçaları
  eksende **ayırma** ve tek tek gizleme/gösterme

**Sargı analizi**
- Yıldız diyagramı (star of slots) ile faz dağılımı, tek/çift katman, bobin adımı
- Sargı faktörü kw₁ ve ν = 1…13 harmonik spektrumu
- Oluk/kutup matrisi: 10 × 10 kombinasyon için kw₁, dengeli olmayanlar işaretli,
  dokununca o kombinasyona geçilir

**Manyetik devre**
- Carter katsayısı ile etkin hava aralığı
- Sıcaklığa bağlı remanans
- Hava aralığı, diş, stator ve rotor boyunduruğu akı yoğunlukları
- Doyma sınırlarına göre uyarı üretimi

**Asenkron (SCIM)**
- Eşdeğer devre çözümü; Xm geometriden (Carter + doyma) hesaplanır
- Moment / devir eğrisi: kalkış, devrilme ve çalışma noktası işaretli
- Kayma, güç faktörü, hava aralığı gücü, kilitli rotor akımı
- Stator/rotor oluk sayısı uyum kuralları
- **Etiket karşılaştırma paneli**: her büyüklük için hesap / doküman ve sapma

**Kalıcı mıknatıslı (SPM)**
- Ters EMK, moment sabiti, moment, mekanik güç
- Sıcaklığa bağlı remanans, vuruntu momenti göstergeleri

**Ortak**
- Oluk doluluk oranı, akım yoğunluğu, faz direnci
- Bakır ve demir kaybı, verim, kütle dökümü

## Kurulum yok

`dist/index.html` tek başına çalışan bir dosyadır — harici istek yapmaz,
doğrudan tarayıcıda açılır.

## Geliştirme

```bash
npm test      # fizik çekirdeği testleri
npm run build # dist/ üretir
```

- `src/motor.js` — saf hesap çekirdeği (DOM yok, tek doğruluk kaynağı)
- `src/app.js` — SVG çizimi ve arayüz
- `src/view3d.js` — bağımsız WebGL görüntüleyici (harici bağımlılık yok)
- `src/style.css` — tasarım belirteçleri, açık/koyu tema
- `test/motor.test.mjs` — sargı faktörleri literatür değerleriyle doğrulanır

Sargı faktörü hesabı bilinen kombinasyonlarla karşılaştırılarak doğrulanmıştır:

| Kombinasyon | Beklenen kw₁ | Tip |
|---|---|---|
| 36 oluk / 6 kutup, tam adım | 0,966 | dağıtılmış |
| 36 oluk / 6 kutup, 5/6 adım | 0,933 | kısa adım |
| 12 oluk / 10 kutup | 0,933 | kesirli oluk konsantre |
| 12 oluk / 8 kutup | 0,866 | kesirli oluk konsantre |
| 9 oluk / 8 kutup | 0,945 | kesirli oluk konsantre |

## Doğrulanmış örnek: 400 Hz havacılık motoru

Varsayılan tasarım, elimizdeki bir motor dokümanından alınmıştır
(115 V L-N / 200 V L-L, 400 Hz, 1,5 kW, 48/38 oluk, 8 kutup). Dokümanda
bağlantı biçimi yazmıyordu; eşdeğer devre parametreleri ile etiket başarımı
yalnızca **üçgen** bağlantıda (faz gerilimi 200 V) örtüşüyor. Yıldız
varsayıldığında devrilme momenti nominal momentin altına düşüyor — fiziksel
olarak imkânsız. Model dokümandaki dokuz bağımsız değeri %6,4 içinde
yeniden üretiyor:

| Büyüklük | Doküman | Model |
|---|---|---|
| Senkron devir | 6000 d/dk | 6000 |
| Nominal moment | 2,60 N·m | 2,58 |
| Çıkış gücü | 1500 W | 1455 |
| Faz akımı | 4,40 A | 4,12 |
| Güç faktörü | 0,720 | 0,739 |
| Verim | %78,0 | %79,7 |
| Kalkış momenti | 4,00 N·m | 3,76 |
| Kilitli rotor akımı | 15,80 A | 15,77 |
| Net oluk alanı | 17,155 mm² | 17,10 |

## Sınırlar

Bu araç **analitik** bir manyetik devre modeli kullanır. Hızlı ön tasarım ve
kombinasyon taraması içindir; sonlu elemanlar analizinin yerine geçmez.
Hesaba katılmayanlar: yerel doyma dağılımı, vuruntu momenti dalga biçimi,
moment dalgalanması, girdap akımı ve termal davranış.

## Yol haritası

- **Faz 2** — malzeme kütüphanesi (gerçek B–H eğrileri), gömülü mıknatıslı
  (IPM) rotor tipleri, sargı başlarının gerçek geometrisi, PDF rapor
- **Faz 3** — Pyleecan + FEMM arka ucu ile doğrusal olmayan manyetostatik
  analiz, akı çizgisi görselleştirmesi, parametre süpürme
