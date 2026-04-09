/**
 * Kiralık Kamera 7/24 — Teknik Ekip Kataloğu
 * Kaynak: https://kiralikkamera724.com/kiralik/teknik-ekip
 */

export interface ExternalCrewItem {
  id: string;
  name: string;
  role: string;
  dailyPrice: number;
  imageUrl: string;
  sourceUrl: string;
}

export const EXTERNAL_CREW_CATALOG: ExternalCrewItem[] = [
  { id: 'ext-kamera-asistani', name: 'Kamera Asistanı', role: 'Kamera', dailyPrice: 5500, imageUrl: 'https://kiralikkamera724.com/dimg/urun/26846231653146527008Kamera Asistanı.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/kamera-asistani' },
  { id: 'ext-goruntu-yonetmeni', name: 'Görüntü Yönetmeni', role: 'Kamera', dailyPrice: 25000, imageUrl: 'https://kiralikkamera724.com/dimg/urun/28371245252687323278Goruntu Yonetmeni.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/goruntu-yonetmeni' },
  { id: 'ext-focus-puller', name: 'Focus Puller', role: 'Kamera', dailyPrice: 8000, imageUrl: 'https://kiralikkamera724.com/dimg/urun/29198279112130523749Focus Puller.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/focus-puller' },
  { id: 'ext-kamera-operatoru', name: 'Kamera Operatörü', role: 'Kamera', dailyPrice: 6000, imageUrl: 'https://kiralikkamera724.com/dimg/urun/21909238012662427642Camera Operatoru.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/kamera-operatoru' },
  { id: 'ext-cine-operator', name: 'Cine Operatör', role: 'Kamera', dailyPrice: 7000, imageUrl: 'https://kiralikkamera724.com/dimg/urun/28281264232479823930Cine Operator.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/cine-operator' },
  { id: 'ext-best-boy', name: 'Best Boy', role: 'Işık', dailyPrice: 5500, imageUrl: 'https://kiralikkamera724.com/dimg/urun/28217283002433725186BestBoy.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/best-boy' },
  { id: 'ext-isik-sefi', name: 'Işık Şefi', role: 'Işık', dailyPrice: 11000, imageUrl: 'https://kiralikkamera724.com/dimg/urun/24677288452605130828Isik Sefi.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/isik-sefi' },
  { id: 'ext-isik-asistani', name: 'Işık Asistanı', role: 'Işık', dailyPrice: 5500, imageUrl: 'https://kiralikkamera724.com/dimg/urun/23876273412778822165Isik Asistani.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/isik-asistani' },
  { id: 'ext-ses-teknisyeni', name: 'Ses Teknisyeni', role: 'Ses', dailyPrice: 7500, imageUrl: 'https://kiralikkamera724.com/dimg/urun/26506208032165626442Ses Teknisiyeni.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/ses-teknisyeni' },
  { id: 'ext-boom-operatoru', name: 'Boom Operatörü', role: 'Ses', dailyPrice: 5500, imageUrl: 'https://kiralikkamera724.com/dimg/urun/29299215883193421291Boom Operator.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/boom-operatoru' },
  { id: 'ext-sesci', name: 'Sesçi', role: 'Ses', dailyPrice: 6500, imageUrl: 'https://kiralikkamera724.com/dimg/urun/25210299552620829845Sesci.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/sesci' },
  { id: 'ext-dit', name: 'D.I.T.', role: 'Teknik', dailyPrice: 7000, imageUrl: 'https://kiralikkamera724.com/dimg/urun/21548261532645225198DIT.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/d-i-t' },
  { id: 'ext-ronin2-operatoru', name: 'DJI Ronin 2 Operatörü', role: 'Teknik', dailyPrice: 7000, imageUrl: 'https://kiralikkamera724.com/dimg/urun/28626246942732828777Ronin 2 Operatoru.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/dji-ronin-2-operatoru' },
  { id: 'ext-ronin2-asistani', name: 'DJI Ronin 2 Asistanı', role: 'Teknik', dailyPrice: 6000, imageUrl: 'https://kiralikkamera724.com/dimg/urun/28652298752837225607DJI Ronin 2 Asistanı.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/dji-ronin-2-asistani' },
  { id: 'ext-runner', name: 'Runner', role: 'Prodüksiyon', dailyPrice: 5000, imageUrl: 'https://kiralikkamera724.com/dimg/urun/20834316372363231539Runner.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/runner' },
  { id: 'ext-wireless-video-asistani', name: 'Wireless Video Asistanı', role: 'Teknik', dailyPrice: 5500, imageUrl: 'https://kiralikkamera724.com/dimg/urun/30931234313014224076Wireless Video Asistanı.png', sourceUrl: 'https://kiralikkamera724.com/teknik-ekip/wireless-video-asistani' },
];

export const EXTERNAL_CREW_ROLES = ['Tümü', 'Kamera', 'Işık', 'Ses', 'Teknik', 'Prodüksiyon'];
