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
    description: "We brought House of Holland together with London's energy through its rebellious spirit, maximalist design and bold color palette. We transformed the boundary-breaking style of unisex collections into a powerful visual story.",
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
    description: "A visual story inviting viewers to freedom with House of Holland's rebellious spirit, vibrant colors and unique details.",
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
    description: "For Rakle, who transforms glassmaking into art, we turned their refined designs into a timeless story with 3D visualization. Rakle's creativity on glass shined in every corner of the screen.",
    tags: "3D Visuals, Modern Design, Glassware, Creative Storytelling",
    year: 2022,
    duration: "30s",
    services: "3D Animation, Motion Graphics, Color Grading, Visual Storytelling"
  },
  4: {
    id: 4,
    title: "Cliff",
    location: "Bodrum",
    category: "Gastronomy",
    category2: "Commercial",
    description: "The fresh aromas and colorful mezes of the Aegean came to life in Cliff Bodrum's kitchen. With Kitchen Series, we invited viewers to the magic of the kitchen before the plate.",
    tags: "Aegean Cuisine, Close-Up Filming, Fine Dining",
    year: 2024,
    duration: "20s",
    services: "Food Videography, Close-Up Shots, Color Grading, Brand Storytelling"
  },
  5: {
    id: 5,
    title: "Cliff",
    location: "Bodrum",
    category: "Gastronomy",
    category2: "Commercial",
    description: "The intimate narrative of the care, curiosity and passionate details touched by chefs behind every dessert prepared in Cliff's kitchen... All angles made visible the effort behind every touch.",
    tags: "Kitchen Series, Pastry Experience, Culinary Art",
    year: 2024,
    duration: "23s",
    services: "Video Production, Close-up Cinematography, Post Production, Sound Design"
  },
  6: {
    id: 6,
    title: "Papillon",
    location: "Bodrum",
    category: "Gastronomy",
    category2: "Commercial",
    description: "While Papillon presents the rich herb varieties of Bodrum cuisine with modern interpretations, we told this passion through an intimate story narrative. The Aegean's culture, flavor and hospitality came together in a single video.",
    tags: "Aegean Culture, Herbal Cuisine, Storytelling, Bodrum Gastronomy",
    year: 2024,
    duration: "23s",
    services: "Video Production, Interview Setup, Color Grading, Brand Storytelling"
  },
  7: {
    id: 7,
    title: "Cliff Beach",
    location: "Bodrum",
    category: "Gastronomy",
    category2: "Commercial",
    description: "Inspired by the motto 'Feel the Aegean Soul', we captured from the sky the energy of Cliff Beach Club intertwined with the sea and its distinctive Aegean spirit. Sea breeze, sunset and entertainment came to life in these frames.",
    tags: "Drone Shots, Aegean Spirit, Beach Club Life, Bodrum Coast",
    year: 2024,
    duration: "20s",
    services: "Drone Footage, Aerial Videography, Color Grading"
  },
  8: {
    id: 8,
    title: "Dieci",
    location: "Bodrum",
    category: "Gastronomy",
    category2: "Commercial",
    description: "In the heart of Dieci's kitchen, the care and Italian passion behind every touch... Passion, flavor and story came together through dishes crafted by chefs' hands.",
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
    description: "We transformed Liquorish's eye-catching collection suitable for every body type into a cinematic story. Every frame reflects the story of style and energy.",
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
    description: "Reflections of art on human faces... A presentation prepared with details reflecting the spirit of the exhibition.",
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
    description: "A vacation story in harmony with Bodrum's vibrant rhythm, from beach to pool, from daylight to night lights.",
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
    description: "This look from the 2023 collection came to life in London's street atmosphere. By capturing the city's dynamism with our camera, we further strengthened the connection between fashion and lifestyle.",
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
    description: "We brought together bright colors and unique silhouettes with modern editing and dynamic angles. Every frame conveys the brand's free and boundary-breaking stance.",
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
    description: "The energy of Bodrum streets with Liquorish's vibrant summer collection... We brought together visual storytelling with dynamic transitions, vivid color arrangements and shots from different perspectives.",
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
    description: "We transformed House of Holland's SS24 collection studio shoot into an energetic story. With quick cuts, strong angles and vibrant tones, we reflected House of Holland's authentic spirit.",
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
    description: "We crafted the AW23 collection shot in the sophisticated atmosphere of one of London's finest hotels with detailed transitions and elegant rhythm in editing. In every scene, we highlighted both the venue's elegance and the collection's strong silhouettes.",
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
    description: "We completed the hotel shoots for Liquorish's AW23 collection with refined editing that pays attention to details. We created a flow that reflects the collection's sophisticated spirit to the audience.",
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
    description: "We brought the magic of New Year gifts to video with Rakle's New Year Collection; in every scene, we highlighted details to reflect the intimate and joyful side of gifts to viewers.",
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
    description: "Centering Rakle's New Year gifts, we added warm and inviting story texture to the scenes. We aimed to make viewers feel that gifts are not just objects, but carry memories and emotions.",
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
    description: "In the New Year Stories series, we told small, intimate stories with Rakle's New Year Collection. We aimed to make viewers feel that gifts are not just objects, but carry memories and emotions.",
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
    description: "In the Book Store series prepared for Inspera Bodrum, leading Bodrum's cultural and artistic life, we shaped each interview with a warm and intimate narrative. We established a cultural connection by inviting viewers to a world full of books.",
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
    description: "With interviews for the Book Store series, we turned every page and recommendation into a small story, making viewers feel the soul of books.",
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
    description: "We brought healthy drink recipes and preparation processes to video with a dietitian. In every scene, we aimed to create an intimate and instructive narrative while offering viewers delicious and practical ideas.",
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
    description: "In Rakle's Healthy Drinks Series, we highlighted healthy drinks prepared with a dietitian. From ingredients to recipes, we conveyed every step intimately and took viewers on a journey that both informs and offers an enjoyable experience.",
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
    description: "In Rakle's Healthy Drinks Series, we brought healthy drinks prepared with a dietitian to video, both inspiring viewers and offering easy-to-apply recipes. We turned every scene into a story with an intimate narrative.",
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
    description: "In Rakle's Healthy Drinks Series, we brought healthy drinks prepared with a dietitian to video, both inspiring viewers and offering easy-to-apply recipes. We turned every scene into a story with an intimate narrative.",
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
    description: "Cooling off in the clear waters of the Aegean Sea, comfort in luxury rooms and fun experiences... In every detail, we aimed to make viewers feel the joy of vacation at Hapimag Sea Garden Resort.",
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
    description: "Video production for us is not just a filming process; it's a journey we establish to convey brands' stories with the right emotion. We enter the world of brands from different sectors, adding a unique perspective suitable to their spirit to each project.",
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
    description: "We conveyed how knowledge and experience passed down for three generations come to life at every stage, through intimate frames from inside the Rapsodi Dekor factory and production process. We brought together the details of craftsmanship and masters' touches with a natural narrative.",
    tags: "Glassmaking, Promotional Video",
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
    description: "We highlighted how art is experienced at Inspera Bodrum as a point of experience and meeting. We reflected that inspiration is just a beginning, creativity is felt in every corner, and moments that touch the viewer.",
    tags: "Inspera Bodrum, Culture, Art, Promotional Video",
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
    description: "G2o Turkey Travel & Events' special event in Bodrum stands out with its unique venue selection and carefully planned experiences. In our shoots, we captured the event's energy, participants' enjoyment, and Bodrum's enchanting atmosphere. In video editing, we brought together every moment in a rhythmic, fluid way that reflects the brand's professional texture.",
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
    description: "For the video announcing İnanç Ayar's Entrepreneurship School, we focused on delivering the message clearly and effectively. Our goal was to ensure viewers could feel İnanç Ayar's excitement and what the Entrepreneurship School offers.",
    tags: "Video Production, Corporate Video, Education",
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
    description: "In the Merak series featuring Emre Onar's inspiring interviews with experts in fields he's passionate about, guests' energy, intimate moments and detailed stories were brought to the forefront. Viewers experience knowledge and inspiration together in each episode.",
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
    description: "In the video editing of the Running Room exhibition, Feza Güvenal's canvases and Vincenzo Savastano's sculptures were highlighted with detailed close-ups. The video was prepared with fluid editing that emphasizes the exhibition's spatial atmosphere and the texture of the artworks.",
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
    description: "To understand your own life experiences, increase your emotional awareness and strengthen your mental health, Clinical Psychologist Pınar Deniz shares all curious topics about psychology in her own narrative.",
    tags: "Psychology, Mental Health, Clinical Psychologist, Self Awareness",
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
    description: "To understand your own life experiences, increase your emotional awareness and strengthen your mental health, Clinical Psychologist Pınar Deniz shares all curious topics about psychology in her own narrative.",
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
    category: "Gastronomy",
    category2: "Commercial",
    description: "In the heart of Dieci's kitchen, the care and Italian passion behind every touch... Passion, flavor and story came together through dishes crafted by chefs' hands.",
    tags: "Italian Restaurant, Culinary Storytelling, Chef Life, Fine Dining, Gourmet Experience",
    year: 2025,
    duration: "",
    services: ""
  },
  40: {
    id: 40,
    title: "Dieci",
    location: "Bodrum",
    category: "Gastronomy",
    category2: "Commercial",
    description: "In the heart of Dieci's kitchen, the care and Italian passion behind every touch... Passion, flavor and story came together through dishes crafted by chefs' hands.",
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
    description: "A visual story inviting viewers to freedom with House of Holland's rebellious spirit, vibrant colors and unique details.",
    tags: "",
    year: 2024,
    duration: "",
    services: ""
  },
  42: {
    id: 42,
    title: "Cliff",
    location: "Bodrum",
    category: "Gastronomy",
    category2: "Commercial",
    description: "Inspired by the motto 'Feel the Aegean Soul', we captured from the sky the energy of Cliff Beach Club intertwined with the sea and its distinctive Aegean spirit. Sea breeze, sunset and entertainment came to life in these frames.",
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