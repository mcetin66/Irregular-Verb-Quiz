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
- Montaj grupları: **Tümü / Rotor / Stator** — çıplak rotoru fotoğrafla
  karşılaştırmak için tek dokunuşla yalıtılabilir
- Rotor eğimi (skew) 3B'de helisel oluk olarak çizilir
- **Gerçek bobin başları**: her bobin oluktan çıkıp adım kadar ötedeki oluğa
  dönen bir yol boyunca süpürülür, faz rengiyle çizilir — tek parça bakır
  halka değil
- Sac paketi dokusu ve metalik yansıma; doku görseldir, katman sayısını
  birebir göstermez (aliasing'e karşı aralık alt sınırlıdır)

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

**Silisli sac kütüphanesi — ölçülmüş veri**
- `src/laminations.js`: Pyleecan malzeme kütüphanesinden (Apache-2.0) alınan
  gerçek veri — grade başına **B–H eğrisi** ve **çok frekanslı ölçülmüş kayıp
  yüzeyi**. Dört gradede 400 Hz ölçümü var; HF-10X 10 kHz'e kadar gidiyor.
- **Demir kaybı ölçülen yüzeyden** ara değerlendirilir (B'de doğrusal,
  frekansta log-log) — 50 Hz'den Steinmetz çıkarımı yapılmaz. Fark küçük
  değildir: M400-50A'da 400 Hz / 1,0 T ölçülen 35,9 W/kg, çıkarım 40,2.
- **Doyman faktörü B–H eğrisinden hesaplanır**, varsayılmaz: bir kutup çifti
  boyunca 2 hava aralığı + 2 stator dişi + 2 rotor dişi + boyunduruklar için
  manyeto-motor kuvvet dengesi kurulur ve Xm ile yinelemeli çözülür.
- Arayüzde ayrı **Silisli sac** bölümü: B–H ve kayıp eğrileri, üzerinde diş
  ve boyunduruk çalışma noktaları işaretli; MMK dökümü.

**Üretim seçimleri (asenkron)**
- Kafes malzemesi ve üretim biçimi: alüminyum/bakır × döküm/çubuk. Rotor
  direnci çubuk + kısa devre halkası geometrisinden hesaplanabilir
- Derin çubuk (deri) etkisi: kalkışta direnç artışı, nominalde etkisiz
- Kapalı rotor oluğu seçeneği: Carter düşer, kaçak reaktans artar
- Stator/rotor oluk kombinasyonu kural denetimi (Alger) ve uygun Zr listesi

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

Varsayılan tasarım, elimizdeki bir motor dokümanından alınmış ve **sökülmüş
motor üzerinde kumpasla ölçülerek** düzeltilmiştir
(115 V L-N / 200 V L-L, 400 Hz, 1,5 kW, 48/38 oluk, 8 kutup).

Ölçülen değerler:

| | Doküman | Ölçülen |
|---|---|---|
| Stator sac paketi dış çapı | 91 mm | **92,23 mm** |
| Rotor dış çapı | (türetilen) 65,4 | **65,42 mm** |
| Hava aralığı | 0,30 mm | 0,29 (66 − 65,42)/2 |
| Rotor paketi boyu | (aktif) 58 mm | 64,08 mm |
| Rotor + mil toplam boy | — | 117,14 mm |

**Oluk profili çıkarımdır.** Dokümanda diş genişliği ve oluk derinliği yoktu.
İki kısıtla çözüldü: net oluk alanı 17,155 mm² ve etiketteki güç faktörü
0,720. Çözüm **açık oluk** veriyor — ağız genişliği oluk üst genişliğine eşit
(diş 1,57 mm, derinlik 5,32 mm, ağız 2,93 mm). Doğrulanması gereken tek
geometri budur.

Bu çıkarım, doyma faktörü B–H eğrisinden hesaplanmaya başladıktan sonra
zorunlu hâle geldi: gerçek ksat 1,04 çıkıyor (demir MMK'sı hava aralığının
yalnızca %3,4'ü), oysa model daha önce 1,3 varsayıyordu. Aradaki fark
Carter katsayısından, yani oluk ağzından geliyordu.

**Önemli düzeltme:** dokümandaki "rotor iç çapı 44 mm" ifadesi ilk başta mil
çapı sanılmıştı. Fotoğrafta mil, paket yüzünde bile rotor çapının dörtte biri
kadar — 44 mm mil olamaz. 44 mm **çubuk dibi çemberidir**: çubuk derinliği
(65,42 − 44)/2 = 10,71 mm. Bu okumayla çubuk geometrisinden hesaplanan kafes
direnci dokümandaki 3,65 Ω değerine **%0,3** içinde oturuyor — ilk okumada
bu mümkün değildi. Dokümanda
bağlantı biçimi yazmıyordu; eşdeğer devre parametreleri ile etiket başarımı
yalnızca **üçgen** bağlantıda (faz gerilimi 200 V) örtüşüyor. Yıldız
varsayıldığında devrilme momenti nominal momentin altına düşüyor — fiziksel
olarak imkânsız. Model dokümandaki dokuz bağımsız değeri %6,4 içinde
yeniden üretiyor. Kalkış momenti etikette **garanti alt sınır** olarak verilir;
model derin çubuk etkisiyle 5,26 N·m buluyor:

| Büyüklük | Doküman | Model |
|---|---|---|
| Senkron devir | 6000 d/dk | 6000 |
| Nominal moment | 2,60 N·m | 2,59 |
| Çıkış gücü | 1500 W | 1460 |
| Faz akımı | 4,40 A | 4,05 |
| Güç faktörü | 0,720 | 0,751 |
| Verim | %78,0 | %78,9 |
| Kalkış momenti | ≥ 4,00 N·m | 5,26 |
| Kilitli rotor akımı | 15,80 A | 15,06 |
| Net oluk alanı | 17,155 mm² | 17,10 |

## 115 V mi, 200 V mü?

Dokümandaki "115 V L-N / 200 V L-L" **iki seçenek değil, tek bir üç fazlı
şebekedir** (115 × √3 = 199,2). Bu, standart havacılık 400 Hz beslemesidir.
Belirsizlik gerilimde değil, **sargının o şebekeye nasıl bağlandığındadır**:

| Bağlantı | Sargının gördüğü gerilim |
|---|---|
| Üçgen | hat gerilimi — **200 V** |
| Yıldız | faz gerilimi — **115 V** |

Mevcut sargı (oluk başına 30 iletken = 240 sarım/faz) **yalnızca üçgende
çalışır**. Yıldıza alınırsa akı √3 kadar düşer ve devrilme momenti nominal
momentin altına iner — motor yükü kaldıramaz.

115 V faz gerilimiyle aynı motoru elde etmek için sargı yeniden sarılmalıdır:
sarım sayısı √3 kadar azalır (240 → 138,6; gerçeklenebilir en yakın 136).
Sonuç **aynı makinedir** — aynı akı, aynı moment, aynı güç, aynı HAT akımı:

| Aynı yükte (2,6 N·m) | Üçgen 200 V | Yıldız 115 V |
|---|---|---|
| Faz gerilimi | 200,0 V | 115,5 V |
| Faz başına sarım | 240 | 136 |
| Oluk başına iletken | 30 | 34 (2 paralel kol) |
| Hava aralığı akısı | 0,443 T | 0,453 T |
| **Hat akımı** | **7,69 A** | **7,79 A** |
| Verim | %77,3 | %77,5 |
| Çıkış gücü | 1463 W | 1505 W |

Dokümandaki 4,4 A ve 15,8 A üçgende **faz** akımlarıdır; hat akımları
bunların √3 katıdır (7,62 A ve 27,4 A).

## Üç hazır tasarım

Arayüzün üstündeki düğmeler aynı gövdede üç tasarımı karşılaştırır.

**Doküman** — elimizdeki motorun ölçüleri ve etiket değerleri (yukarıdaki tablo),
üçgen bağlı, faz gerilimi 200 V.

**115 V yıldız** — aynı motor, 115 V faz gerilimi için yeniden sarılmış.

**Claude Op.** — aynı gövde (Ø91 × 58 mm), aynı besleme (200 V üçgen, 400 Hz,
8 kutup) ve aynı görev (1,5 kW / 2,6 N·m) altında kısıtlı arama ile bulunan
tasarım. 30 000 rastgele aday + tepe tırmanma; kısıtlar `test/motor.test.mjs`
içinde doğrulanır.

| | Doküman | Claude Op. |
|---|---|---|
| Verim | %78,5 | **%89,4** |
| Toplam kayıp | 398 W | **180 W** |
| — stator bakır | 203 | 68 |
| — rotor kafes | 108 | 29 |
| — demir | 27 | 23 |
| Gövde ısı yükü | 13 437 W/m² | **6 075 W/m²** |
| Akım yoğunluğu | 17,3 A/mm² | 6,6 |
| Kayma | %6,67 | %1,78 |
| Kalkış momenti | 4,26 N·m | 4,05 |
| Devrilme momenti | 5,71 N·m | 6,71 |

Değişenler: delik çapı 66 → 64,4 mm, oluk derinliği 6,0 → 9,0 mm, oluk ağzı
1,8 → 1,26 mm, bobin başına sarım 15 → 14, rotor çubuğu 38 × (7,0 × 2,8) →
37 × (9,0 × 2,75) mm, hava aralığı 0,30 → 0,25 mm, mil oturma çapı 44 → 27 mm,
sac M400-50A → NO20 (0,20 mm), kafes alüminyum döküm → bakır çubuk, sargı
yuvarlak tel (%42 doluluk) → dikdörtgen tel (%62).

Arama kısıtları: B diş ≤ 1,70 T · B boyunduruk ≤ 1,50 T · B rotor dişi ≤ 1,60 T ·
kalkış momenti ≥ 4,0 N·m · devrilme payı ≥ 2,2× · J ≤ 12 A/mm² · güç faktörü
≥ 0,70 · hava aralığı ≥ 0,25 mm · diş ≥ 1,5 mm · oluk ağzı ≥ 1,2 mm ·
oluk kombinasyonu kurallarından geçmeli.

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
