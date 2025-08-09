import { VideoInfo, MediaContent } from './types';

export const HEADER_VIDEOS: VideoInfo[] = [
  // Yerel optimize edilmiş dikey video
  { 
    id: 'vid1_dikey_2_1', 
    src: '/videos/Dikey_2_1.mp4',  // 4.1MB - optimize boyut
    alt: 'Dikey video 2.1' 
  },
  // Exit109 kısa video klipleri
  { 
    id: 'vid2_rw20', 
    src: 'https://www.exit109.com/~dnn/clips/RW20seconds_1.mp4', 
    alt: 'RW 20 seconds clip 1' 
  },
  { 
    id: 'vid3_rw20_2', 
    src: 'https://www.exit109.com/~dnn/clips/RW20seconds_2.mp4', 
    alt: 'RW 20 seconds clip 2' 
  },
  { 
    id: 'vid4_clips', 
    src: 'https://www.exit109.com/~dnn/clips/RW20seconds.mp4',
    alt: 'RW 20 seconds original' 
  },
  // Mobile format videolar
  { 
    id: 'vid5_bunny', 
    src: 'https://www.exit109.com/~dnn/clips/bbb_480_688.mp4',
    alt: 'Big Buck Bunny mobile' 
  },
  { 
    id: 'vid6_sintel', 
    src: 'https://www.exit109.com/~dnn/clips/sintel_480_688.mp4',
    alt: 'Sintel mobile format' 
  },
];

// This constant is used in PhoneMockup.tsx for styling its aspect ratio.
// export const PHONE_ASPECT_RATIO_NUMBER = 9 / 19.5; // Example: 0.4615
// The Tailwind class `aspect-[9/19.5]` is used directly for simplicity.

// Geçici olarak eski yapıyı koruyoruz, yavaş yavaş MediaContent'e geçeceğiz
export const PHONE_IMAGES = [
  // Picsum ile rastgele fotoğraflar - 9:16 oranında (iPhone ekran oranı)
  { id: 'img1', src: 'https://picsum.photos/1080/1920?random=1', alt: 'Mobile app showcase 1' },
  { id: 'img2', src: 'https://picsum.photos/1080/1920?random=2', alt: 'Mobile app showcase 2' },
  { id: 'img3', src: 'https://picsum.photos/1080/1920?random=3', alt: 'Mobile app showcase 3' },
  { id: 'img4', src: 'https://picsum.photos/1080/1920?random=4', alt: 'Mobile app showcase 4' },
  { id: 'img5', src: 'https://picsum.photos/1080/1920?random=5', alt: 'Mobile app showcase 5' },
  { id: 'img6', src: 'https://picsum.photos/1080/1920?random=6', alt: 'Mobile app showcase 6' },
  { id: 'img7', src: 'https://picsum.photos/1080/1920?random=7', alt: 'Mobile app showcase 7' },
  { id: 'img8', src: 'https://picsum.photos/1080/1920?random=8', alt: 'Mobile app showcase 8' },
  { id: 'img9', src: 'https://picsum.photos/1080/1920?random=9', alt: 'Mobile app showcase 9' },
  { id: 'img10', src: 'https://picsum.photos/1080/1920?random=10', alt: 'Mobile app showcase 10' },
  { id: 'img11', src: 'https://picsum.photos/1080/1920?random=11', alt: 'Mobile app showcase 11' },
  { id: 'img12', src: 'https://picsum.photos/1080/1920?random=12', alt: 'Mobile app showcase 12' },
];

// Yeni medya içeriği yapısı - animasyonlu önizlemeler için
export const PHONE_MEDIA_CONTENT: MediaContent[] = [
  {
    id: 'media1',
    thumbnail: 'https://picsum.photos/1080/1920?random=1',
    preview: 'https://www.exit109.com/~dnn/clips/RW20seconds_1.mp4', // 20 sn kısa klip
    fullVideo: 'https://www.exit109.com/~dnn/clips/RW20seconds_1.mp4',
    alt: 'Showcase video 1',
    duration: 20,
    type: 'video'
  },
  {
    id: 'media2',
    thumbnail: 'https://picsum.photos/1080/1920?random=2',
    preview: 'https://www.exit109.com/~dnn/clips/RW20seconds_2.mp4',
    fullVideo: 'https://www.exit109.com/~dnn/clips/RW20seconds_2.mp4',
    alt: 'Showcase video 2',
    duration: 20,
    type: 'video'
  },
  {
    id: 'media3',
    thumbnail: 'https://picsum.photos/1080/1920?random=3',
    preview: 'https://www.exit109.com/~dnn/clips/bbb_480_688.mp4',
    fullVideo: 'https://www.exit109.com/~dnn/clips/bbb_480_688.mp4',
    alt: 'Big Buck Bunny mobile',
    duration: 30,
    type: 'video'
  },
  {
    id: 'media4',
    thumbnail: 'https://picsum.photos/1080/1920?random=4',
    alt: 'Static image showcase',
    type: 'image'
  },
  {
    id: 'media5',
    thumbnail: 'https://picsum.photos/1080/1920?random=5',
    preview: 'https://www.exit109.com/~dnn/clips/sintel_480_688.mp4',
    fullVideo: 'https://www.exit109.com/~dnn/clips/sintel_480_688.mp4',
    alt: 'Sintel mobile',
    duration: 25,
    type: 'video'
  },
  {
    id: 'media6',
    thumbnail: 'https://picsum.photos/1080/1920?random=6',
    alt: 'Static showcase 6',
    type: 'image'
  },
  // Geri kalanlar için statik görseller
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `media${i + 7}`,
    thumbnail: `https://picsum.photos/1080/1920?random=${i + 7}`,
    alt: `Showcase ${i + 7}`,
    type: 'image' as const
  }))
];
