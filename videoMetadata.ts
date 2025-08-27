export interface VideoMetadata {
  id: number;
  title: string;
  location: string;
  category: string;
  category2?: string;
  description: string;
  tags?: string;
  year?: number;
  duration?: string;
  services?: string;
}

export const videoMetadata: Record<number, VideoMetadata> = {
  1: {
    id: 1,
    title: "House of Holland",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "Asi ruhu, maksimalist tasarımı ve cesur renk paletiyle House of Holland'ı Londra'nın enerjisiyle buluşturduk. Unisex koleksiyonların sınır tanımayan stilini güçlü bir görsel hikâyeye dönüştürdük.",
    tags: "Maximalist Fashion, Bold Colors, London Style, Unisex Collection, Designer Brand",
    year: 2024,
    duration: "27s",
    services: "Fashion Film, Color Grading"
  },
  2: {
    id: 2,
    title: "House of Holland",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "House of Holland'ın asi ruhu, canlı renkleri ve özgün detaylarıyla izleyiciyi özgürlüğe davet eden bir görsel hikâye.",
    tags: "Maximalist Fashion, Bold Colors, London Style, Unisex Collection, Designer Brand",
    year: 2024,
    duration: "12s",
    services: "Fashion Film, Color Grading, Visual Storytelling"
  },
  3: {
    id: 3,
    title: "Rakle",
    location: "İstanbul",
    category: "Commercial",
    category2: "Commercial",
    description: "Cam işçiliğini sanata dönüştüren Rakle için, rafine tasarımlarını 3D görselleştirme ile zamansız bir hikâyeye dönüştürdük. Rakle'nin cam üzerindeki yaratıcılığı, ekranın her köşesinde parladı.",
    tags: "3D Visuals, Modern Design, Glassware, Creative Storytelling",
    year: 2022,
    duration: "30s",
    services: "3D Animation, Motion Graphics, Color Grading, Visual Storytelling"
  },
  4: {
    id: 4,
    title: "Cliff",
    location: "Bodrum",
    category: "Gastronomi",
    category2: "Commercial",
    description: "Ege'nin taze aromaları ve renkli mezeleri, Cliff Bodrum mutfağında hayat buldu. Kitchen Series ile izleyiciyi, tabaktan önce mutfağın büyüsüne davet ettik.",
    tags: "Aegean Cuisine, Close-Up Filming, Fine Dining",
    year: 2024,
    duration: "20s",
    services: "Food Videography, Close-Up Shots, Color Grading, Brand Storytelling"
  },
  5: {
    id: 5,
    title: "Cliff",
    location: "Bodrum",
    category: "Gastronomi",
    category2: "Commercial",
    description: "Cliff mutfağında pişen her tatlının ardındaki özenin, merakın ve şeflerin tutkuyla dokunduğu detayların samimi kurgusu… Tüm açılar, her bir dokunuşun ardındaki emeği görünür kıldı.",
    tags: "Kitchen Series, Pastry Experience, Culinary Art",
    year: 2024,
    duration: "23s",
    services: "Video Production, Close-up Cinematography, Post Production, Sound Design"
  },
  6: {
    id: 6,
    title: "Papillon",
    location: "Bodrum",
    category: "Gastronomi",
    category2: "Commercial",
    description: "Papillon, Bodrum mutfağının zengin ot çeşitlerini modern yorumlarla sunarken, biz de bu tutkuyu samimi bir hikâye kurgusuyla anlattık. Ege'nin kültürü, lezzeti ve misafirperverliği tek bir videoda buluştu.",
    tags: "Aegean Culture, Herbal Cuisine, Storytelling, Bodrum Gastronomy",
    year: 2024,
    duration: "23s",
    services: "Video Production, Interview Setup, Color Grading, Brand Storytelling"
  },
  7: {
    id: 7,
    title: "Cliff Beach",
    location: "Bodrum",
    category: "Gastronomi",
    category2: "Commercial",
    description: "Feel the Aegean Soul mottosundan ilham alarak, Cliff Beach Club'ın denizle iç içe geçen enerjisini ve Ege'ye özgü ruhunu gökyüzünden yakaladık. Deniz kokusu, gün batımı ve eğlence bu karelerde hayat buldu.",
    tags: "Drone Shots, Aegean Spirit, Beach Club Life, Bodrum Coast",
    year: 2024,
    duration: "20s",
    services: "Drone Footage, Aerial Videography, Color Grading"
  },
  8: {
    id: 8,
    title: "Dieci",
    location: "Bodrum",
    category: "Gastronomi",
    category2: "Commercial",
    description: "Dieci mutfağının kalbinde, her dokunuşun ardındaki özen ve İtalyan tutkusu... Şeflerin elinden çıkan tabaklarla tutku, lezzet ve hikâye bir araya geldi.",
    tags: "Italian Restaurant, Culinary Storytelling, Chef Life, Fine Dining, Gourmet Experience",
    year: 2025,
    duration: "44s",
    services: "Video Production, Interview Setup, Close-Up Shots, Color Grading"
  },
  9: {
    id: 9,
    title: "Liquorish",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "Liquorish'in her bedene uygun, göz alıcı koleksiyonunu sinematik bir hikâyeye dönüştürdük. Her kare stilin ve enerjinin hikâyesini yansıtıyor.",
    tags: "Fashion Storytelling, Vibrant Fashion, Women's Style",
    year: 2023,
    duration: "33s",
    services: "Video Production, Color Grading"
  },
  10: {
    id: 10,
    title: "Inspera Bodrum",
    location: "Bodrum",
    category: "Interview",
    category2: "Commercial",
    description: "Sanatın insan yüzündeki yansımaları… Serginin ruhunu yansıtan detaylarla hazırlanan bir tanıtım.",
    tags: "Inspera Art, Portrait Exhibition, Contemporary Art, Art Film",
    year: 2024,
    duration: "8s",
    services: "Video Production, Cinematic Storytelling, Post Production, Color Grading"
  },
  11: {
    id: 11,
    title: "Very Chic",
    location: "Bodrum",
    category: "Commercial",
    category2: "Commercial",
    description: "Bodrum'un hareketli ritmiyle uyumlu, plajdan havuza, gün ışığından gece ışıklarına kadar süren bir tatil hikayesi.",
    tags: "Luxury Hotel, All Inclusive, Pool Party, DJ Performance",
    year: 2024,
    duration: "59s",
    services: "Video Production, Drone Footage, Sound Design"
  },
  12: {
    id: 12,
    title: "House of Holland",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "2023 koleksiyonundan seçilen bu look, Londra'nın sokak atmosferinde hayat buldu. Kameramızla şehrin dinamizmini yakalayarak, moda ve yaşam tarzı arasındaki bağı daha da güçlendirdik.",
    tags: "Maximalist Fashion, Bold Colors, London Style, Unisex Collection, Designer Brand",
    year: 2023,
    duration: "29s",
    services: "Fashion Film, Color Grading, Visual Storytelling"
  },
  13: {
    id: 13,
    title: "House of Holland",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "Parlak renkler ve özgün silüetleri, modern kurgu ve dinamik açılarla bir araya getirdik. Her kare markanın özgür ve sınır tanımayan duruşunu hissettiriyor.",
    tags: "Maximalist Fashion, Bold Colors, London Style, Unisex Collection, Designer Brand",
    year: 2023,
    duration: "11s",
    services: "Fashion Film, Color Grading, Visual Storytelling, Cinematic Editing"
  },
  14: {
    id: 14,
    title: "Liquorish",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "Liquorish'in canlı yaz koleksiyonu ile Bodrum sokaklarının enerjisi... Hareketli geçişler, canlı renk düzenlemeleri ve farklı perspektiflerden çekimler ile görsel anlatımı bir araya getirdik.",
    tags: "Fashion Video Production, Street Cinematography, Video Editing",
    year: 2023,
    duration: "16s",
    services: "Location Filming, Creative Editing, Color Grading"
  },
  15: {
    id: 15,
    title: "House of Holland",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "Stüdyo çekimini kurguladığımız House of Holland'ın SS24 koleksiyonunu enerjik bir hikâyeye dönüştürdük. Hızlı kesimler, güçlü açılar ve canlı tonlarla House of Holland'ın özgün ruhunu yansıttık.",
    tags: "Maximalist Fashion, Bold Colors, London Style, Unisex Collection, Designer Brand",
    year: 2024,
    duration: "20s",
    services: "Video Production, Dynamic Editing, Sound Design, Post Production"
  },
  16: {
    id: 16,
    title: "Liquorish",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "Londra'nın en güzel otellerinden birinin sofistike atmosferinde çekilen AW23 koleksiyonunu, kurguda detaylı geçişler ve zarif bir ritimle işledik. Her sahnede hem mekanın şıklığını hem de koleksiyonun güçlü silüetlerini öne çıkardık.",
    tags: "Fashion Storytelling, Vibrant Fashion, Women's Style",
    year: 2023,
    duration: "22s",
    services: "Video Production, Color Grading, Creative Editing"
  },
  17: {
    id: 17,
    title: "Liquorish",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "Liquorish'in AW23 koleksiyonu için yapılan otel çekimlerini, detaylara özen gösteren rafine bir kurgu ile tamamladık. Koleksiyonun sofistike ruhunu izleyiciye yansıtan bir akış yarattık.",
    tags: "Fashion Storytelling, Vibrant Fashion, Women's Style",
    year: 2023,
    duration: "17s",
    services: "Video Production, Color Grading, Creative Editing"
  },
  18: {
    id: 18,
    title: "Rakle",
    location: "İstanbul",
    category: "Commercial",
    category2: "Personal Branding",
    description: "Rakle'nin Yeni Yıl Koleksiyonu ile yılbaşı hediyelerinin büyüsünü videoya taşıdık; her sahnede detayları öne çıkararak hediyelerin samimi ve neşeli yanını izleyiciye yansıttık.",
    tags: "Holiday Gifts, Creative Video, Storytelling",
    year: 2024,
    duration: "25s",
    services: "Storytelling, Filming, Editing, Creative Direction"
  },
  19: {
    id: 19,
    title: "Rakle",
    location: "İstanbul",
    category: "Commercial",
    category2: "Personal Branding",
    description: "Rakle'nin yılbaşı hediyelerini merkeze alarak, sahnelere sıcak ve davetkar bir hikaye dokusu ekledik. İzleyiciye, hediyelerin sadece objeler değil, anılar ve duygular taşıdığını hissettirmeyi amaçladık.",
    tags: "Holiday Gifts, Creative Video, Storytelling",
    year: 2024,
    duration: "36s",
    services: "Storytelling, Filming, Editing, Creative Direction"
  },
  20: {
    id: 20,
    title: "Rakle",
    location: "İstanbul",
    category: "Commercial",
    category2: "Personal Branding",
    description: "Yılbaşı Hikayeleri serisinde Rakle'nin Yeni Yıl Koleksiyonuyla küçük, samimi hikayeler anlattık. İzleyiciye, hediyelerin sadece objeler değil, anılar ve duygular taşıdığını hissettirmeyi amaçladık.",
    tags: "Holiday Gifts, Creative Video, Storytelling",
    year: 2024,
    duration: "28s",
    services: "Storytelling, Filming, Editing, Creative Direction"
  },
  21: {
    id: 21,
    title: "Inspera Bodrum",
    location: "Bodrum",
    category: "Interview",
    category2: "Events",
    description: "Bodrum'un kültürel ve sanatsal yaşamına öncülük eden Inspera Bodrum için hazırlanan Book Store serisinde, her röportajı sıcak ve samimi bir anlatımla şekillendirdik. İzleyiciyi kitaplarla dolu bir dünyaya davet ederek kültürel bir bağ kurduk.",
    tags: "Inspera Bodrum, Book Recommendations, Storytelling, Cultural Video",
    year: 2024,
    duration: "75s",
    services: "Creative Direction, Filming, Editing, Interview Storytelling"
  },
  22: {
    id: 22,
    title: "Inspera Bodrum",
    location: "Bodrum",
    category: "Interview",
    category2: "Personal Branding",
    description: "Book Store serisi için yapılan röportajlarla her sayfa ve öneriyi küçük bir hikayeye dönüştürdük, kitapların ruhunu izleyiciye hissettirdik.",
    tags: "Inspera Bodrum, Book Recommendations, Storytelling, Cultural Video",
    year: 2024,
    duration: "108s",
    services: "Creative Direction, Filming, Editing, Interview Storytelling"
  },
  23: {
    id: 23,
    title: "Rakle",
    location: "İstanbul",
    category: "Commercial",
    category2: "Personal Branding",
    description: "Sağlıklı içeceklerin tariflerini ve yapım süreçlerini diyetisyenle birlikte videoya taşıdık. Her sahnede izleyiciye lezzetli ve pratik fikirler sunarken, samimi ve öğretici bir anlatım yaratmayı hedefledik.",
    tags: "Healthy Drinks, Social Media Video, Creative Content",
    year: 2024,
    duration: "58s",
    services: "Creative Direction, Filming, Editing, Storytelling"
  },
  24: {
    id: 24,
    title: "Rakle",
    location: "İstanbul",
    category: "Commercial",
    category2: "Personal Branding",
    description: "Rakle'nin Sağlıklı İçecekler Serisi'nde, bir diyetisyen eşliğinde hazırlanan sağlıklı içecekleri öne çıkardık. Malzemelerden tariflere, her adımı samimi bir şekilde aktardık ve izleyiciyi hem bilgilendiren hem de keyifli bir deneyim sunan bir yolculuğa çıkardık.",
    tags: "Healthy Drinks, Social Media Video, Creative Content",
    year: 2024,
    duration: "43s",
    services: "Creative Direction, Filming, Editing, Storytelling"
  },
  25: {
    id: 25,
    title: "Rakle",
    location: "İstanbul",
    category: "Commercial",
    category2: "Personal Branding",
    description: "Rakle'nin Sağlıklı İçecekler Serisi'nde, diyetisyen eşliğinde hazırlanan sağlıklı içecekleri videoya taşıyarak izleyiciye hem ilham verdik hem de uygulaması kolay tarifler sunduk. Her sahneyi samimi bir anlatımla hikayeleştirdik.",
    tags: "Healthy Drinks, Social Media Video, Creative Content",
    year: 2024,
    duration: "74s",
    services: "Creative Direction, Filming, Editing, Storytelling"
  },
  26: {
    id: 26,
    title: "Rakle",
    location: "İstanbul",
    category: "Commercial",
    category2: "Personal Branding",
    description: "Rakle'nin Sağlıklı İçecekler Serisi'nde, diyetisyen eşliğinde hazırlanan sağlıklı içecekleri videoya taşıyarak izleyiciye hem ilham verdik hem de uygulaması kolay tarifler sunduk. Her sahneyi samimi bir anlatımla hikayeleştirdik.",
    tags: "Healthy Drinks, Social Media Video, Creative Content",
    year: 2024,
    duration: "50s",
    services: "Creative Direction, Filming, Editing, Storytelling"
  },
  27: {
    id: 27,
    title: "Hapimag Sea Garden Resort",
    location: "Bodrum",
    category: "Commercial",
    category2: "Commercial",
    description: "Ege Denizi'nin berrak sularında serinleme, lüks odalarda konfor ve eğlenceli deneyimler... Her detayda izleyiciye Hapimag Sea Garden Resort'ta tatilin keyfini hissettirmeyi hedefledik.",
    tags: "Luxury Resort, Storytelling Video, Resort Life, Promotional Video",
    year: 2024,
    duration: "81s",
    services: "Filming, Creative Direction, Editing, Visual Storytelling"
  },
  28: {
    id: 28,
    title: "Intiba",
    location: "Bodrum",
    category: "Commercial",
    category2: "Commercial",
    description: "Video prodüksiyon bizim için yalnızca bir çekim süreci değil; markaların hikâyesini en doğru duyguyla aktarabilmek için kurduğumuz bir yolculuk. Farklı sektörlerden markaların dünyasına giriyor, her projeye onların ruhuna uygun özgün bir bakış açısı katıyoruz.",
    tags: "Video Production, Storytelling, Brand Identity, Creative Filmmaking",
    year: 2025,
    duration: "43s",
    services: "Video Production, Drone Footage, Color Grading, Post Production, Sound Design"
  },
  29: {
    id: 29,
    title: "Rapsodi Dekor",
    location: "İstanbul",
    category: "Commercial",
    category2: "Commercial",
    description: "Üç nesildir aktarılan bilgi ve deneyimin her aşamada nasıl hayat bulduğunu, Rapsodi Dekor fabrikasının içinden ve üretim sürecinden samimi karelerle aktardık. İşçiliğin detaylarını ve ustaların dokunuşlarını doğal bir anlatımla bir araya getirdik.",
    tags: "Cam İşçiliği, Promotional Video",
    year: 2025,
    duration: "46s",
    services: "Filming, Editing, Storytelling, Creative Direction"
  },
  30: {
    id: 30,
    title: "Inspera Bodrum",
    location: "Bodrum",
    category: "Interview",
    category2: "Events",
    description: "Sanatın deneyim ve buluşma noktası olarak Inspera Bodrum'da nasıl yaşandığını öne çıkardık. İlhamın sadece bir başlangıç olduğunu, yaratıcılığın her köşede hissedildiğini ve izleyiciye dokunan anları yansıttık.",
    tags: "Inspera Bodrum, Kültür, Sanat, Promotional Video",
    year: 2024,
    duration: "62s",
    services: "Filming, Editing, Storytelling, Creative Direction"
  },
  31: {
    id: 31,
    title: "G2O",
    location: "Bodrum",
    category: "Commercial",
    category2: "Commercial",
    description: "G2o Turkey Travel & Events'in Bodrum'daki özel etkinliği, eşsiz mekan seçimi ve özenle planlanmış deneyimleriyle öne çıkıyor. Çekimlerimizde etkinliğin enerjisini, katılımcıların keyfini ve Bodrum'un büyüleyici atmosferini yakaladık. Video kurgusunda ise her anı ritmik, akıcı ve markanın profesyonel dokusunu yansıtacak şekilde bir araya getirdik.",
    tags: "Event Video, Corporate Event, Event Coverage",
    year: 2024,
    duration: "144s",
    services: "Video Production, Post Production, Drone Footage, Event Coverage, Color Grading"
  },
  32: {
    id: 32,
    title: "İnanç Ayar",
    location: "İstanbul",
    category: "Interview",
    category2: "Events",
    description: "İnanç Ayar'ın Girişimcilik Okulu'nun duyurusunu yaptığı video için mesajın net ve etkileyici şekilde aktarılmasına odaklandık. Amacımız, izleyicilerin İnanç Ayar'ın heyecanını ve Girişimcilik Okulu'nun sunduklarını hissedebilmesini sağlamaktı.",
    tags: "Video Prodüksiyon, Kurumsal Video, Eğitim",
    year: 2025,
    duration: "74s",
    services: "Screenplay Editing, Shooting Management, Filming, Editing"
  },
  33: {
    id: 33,
    title: "Emre Onar",
    location: "İstanbul",
    category: "Interview",
    category2: "Personal Branding",
    description: "Emre Onar'ın tutkuyla bağlı olduğu alanlarda uzman isimlerle yaptığı ilham verici röportajlarını konu alan Merak serisinde konukların enerjisi, samimi anları ve detaylı hikayeleri ön plana çıkarıldı. İzleyici, her bölümde bilgi ve ilhamı bir arada deneyimliyor.",
    tags: "Interview Series, Passion Stories, Creative Experts",
    year: 2024,
    duration: "42s",
    services: "Video Editing, Post Production, Sound Design, Color Grading"
  },
  34: {
    id: 34,
    title: "Inspera Bodrum",
    location: "Bodrum",
    category: "Interview",
    category2: "Commercial",
    description: "Running Room sergisinin video kurgusunda, Feza Güvenal'in tuvalleri ve Vincenzo Savastano'nun heykelleri detaylı yakın çekimlerle öne çıkarıldı. Video, serginin mekân atmosferini ve sanat eserlerinin dokusunu vurgulayan akıcı bir kurgu ile hazırlandı.",
    tags: "Running Room, Inspera Art Space, Contemporary Art",
    year: 2024,
    duration: "34s",
    services: "Video Editing, Post Production, Sound Design, Color Grading"
  },
  35: {
    id: 35,
    title: "Pınar Deniz",
    location: "Bodrum",
    category: "Interview",
    category2: "Personal Branding",
    description: "Kendi yaşam deneyimlerinizi anlamak, duygusal farkındalığınızı artırmak ve zihinsel sağlığınızı güçlendirmek için Klinik Psikolog Pınar Deniz, psikolojiye dair merak edilen tüm konuları kendi anlatımıyla paylaşıyor.",
    tags: "Psikoloji, Mental Health, Klinik Psikolog, Self Awareness",
    year: 2025,
    duration: "58s",
    services: "Filming, Editing, Storytelling, Creative Direction"
  },
  36: {
    id: 36,
    title: "Pınar Deniz",
    location: "Bodrum",
    category: "Interview",
    category2: "Personal Branding",
    description: "Kendi yaşam deneyimlerinizi anlamak, duygusal farkındalığınızı artırmak ve zihinsel sağlığınızı güçlendirmek için Klinik Psikolog Pınar Deniz, psikolojiye dair merak edilen tüm konuları kendi anlatımıyla paylaşıyor.",
    tags: "",
    year: 2025,
    duration: "",
    services: ""
  },
  37: {
    id: 37,
    title: "Inspera",
    location: "Bodrum",
    category: "Interview",
    category2: "Personal Branding",
    description: "",
    tags: "",
    year: 2024,
    duration: "",
    services: ""
  },
  39: {
    id: 39,
    title: "Dieci",
    location: "Bodrum",
    category: "Gastronomi",
    category2: "Commercial",
    description: "Dieci mutfağının kalbinde, her dokunuşun ardındaki özen ve İtalyan tutkusu... Şeflerin elinden çıkan tabaklarla tutku, lezzet ve hikâye bir araya geldi.",
    tags: "Italian Restaurant, Culinary Storytelling, Chef Life, Fine Dining, Gourmet Experience",
    year: 2025,
    duration: "",
    services: ""
  },
  40: {
    id: 40,
    title: "Dieci",
    location: "Bodrum",
    category: "Gastronomi",
    category2: "Commercial",
    description: "Dieci mutfağının kalbinde, her dokunuşun ardındaki özen ve İtalyan tutkusu... Şeflerin elinden çıkan tabaklarla tutku, lezzet ve hikâye bir araya geldi.",
    tags: "Italian Restaurant, Culinary Storytelling, Chef Life, Fine Dining, Gourmet Experience",
    year: 2025,
    duration: "",
    services: ""
  },
  41: {
    id: 41,
    title: "House Of Holland",
    location: "London",
    category: "Fashion",
    category2: "Commercial",
    description: "House of Holland'ın asi ruhu, canlı renkleri ve özgün detaylarıyla izleyiciyi özgürlüğe davet eden bir görsel hikâye.",
    tags: "",
    year: 2024,
    duration: "",
    services: ""
  },
  42: {
    id: 42,
    title: "Cliff",
    location: "Bodrum",
    category: "Gastronomi",
    category2: "Commercial",
    description: "Feel the Aegean Soul mottosundan ilham alarak, Cliff Beach Club'ın denizle iç içe geçen enerjisini ve Ege'ye özgü ruhunu gökyüzünden yakaladık. Deniz kokusu, gün batımı ve eğlence bu karelerde hayat buldu.",
    tags: "",
    year: 2024,
    duration: "",
    services: ""
  }
};

export const getVideoMetadata = (id: number): VideoMetadata | undefined => {
  return videoMetadata[id];
};

export const getAllVideoIds = (): number[] => {
  return Object.keys(videoMetadata).map(id => parseInt(id)).filter(id => !isNaN(id));
};

export const getVideosByCategory = (category: string): VideoMetadata[] => {
  return Object.values(videoMetadata).filter(video => 
    video.category.toLowerCase() === category.toLowerCase()
  );
};

export const getVideosByLocation = (location: string): VideoMetadata[] => {
  return Object.values(videoMetadata).filter(video => 
    video.location.toLowerCase() === location.toLowerCase()
  );
};

export const getAllCategories = (): string[] => {
  const categories = new Set<string>();
  Object.values(videoMetadata).forEach(video => {
    if (video.category) categories.add(video.category);
  });
  return Array.from(categories).sort();
};