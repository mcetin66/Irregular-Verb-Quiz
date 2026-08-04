# Motor Tasarım Atölyesi

Kalıcı mıknatıslı senkron motorlar (SPM) için tarayıcıda çalışan, etkileşimli
stator/rotor tasarım aracı. Parametreleri çekerken kesit görünümü, sargı
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
- Üç görünüm: **Sargı** (faz renkli iletkenler), **Akı** (doyma ısı haritası),
  **Sade** (çıplak laminasyon)

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

**Performans**
- Ters EMK, moment sabiti, moment, mekanik güç
- Oluk doluluk oranı, akım yoğunluğu, faz direnci
- Bakır ve demir kaybı, verim, kütle dökümü, moment yoğunluğu

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

## Sınırlar

Bu araç **analitik** bir manyetik devre modeli kullanır. Hızlı ön tasarım ve
kombinasyon taraması içindir; sonlu elemanlar analizinin yerine geçmez.
Hesaba katılmayanlar: yerel doyma dağılımı, vuruntu momenti dalga biçimi,
moment dalgalanması, girdap akımı ve termal davranış.

## Yol haritası

- **Faz 2** — malzeme kütüphanesi (gerçek B–H eğrileri), hız–moment zarfı,
  gömülü mıknatıslı (IPM) rotor tipleri, PDF rapor
- **Faz 3** — Pyleecan + FEMM arka ucu ile doğrusal olmayan manyetostatik
  analiz, akı çizgisi görselleştirmesi, parametre süpürme
