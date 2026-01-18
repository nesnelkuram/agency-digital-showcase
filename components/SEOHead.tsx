import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  ogUrl?: string;
  lang?: 'en' | 'tr';
}

/**
 * SEO Head Component
 * Dynamically updates document title and meta tags for landing pages
 */
const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  keywords = [],
  ogImage = 'https://intiba.com/og-image.jpg',
  ogUrl,
  lang = 'en',
}) => {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;

      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Basic meta tags
    updateMetaTag('description', description);
    if (keywords.length > 0) {
      updateMetaTag('keywords', keywords.join(', '));
    }

    // Open Graph tags
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', ogImage, true);
    if (ogUrl) {
      updateMetaTag('og:url', ogUrl, true);
    }
    updateMetaTag('og:locale', lang === 'tr' ? 'tr_TR' : 'en_US', true);

    // Twitter tags
    updateMetaTag('twitter:title', title, true);
    updateMetaTag('twitter:description', description, true);
    updateMetaTag('twitter:image', ogImage, true);

    // Update html lang attribute
    document.documentElement.lang = lang;

    // Cleanup: restore defaults when component unmounts
    return () => {
      document.title = 'Intiba - We Define Brands Through Visual Storytelling';
      document.documentElement.lang = 'en';
    };
  }, [title, description, keywords, ogImage, ogUrl, lang]);

  return null;
};

export default SEOHead;
