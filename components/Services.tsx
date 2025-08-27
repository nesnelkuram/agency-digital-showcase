import React from 'react';

const services = [
  {
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Film Production',
    description: 'Professional cinematic storytelling for brands and businesses. High-end commercial films and corporate videos.',
    features: ['Brand Films', 'Commercial Videos', 'Corporate Documentaries', 'Product Launch Films']
  },
  {
    image: 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Photography',
    description: 'Professional photography services that capture stunning visuals and tell your brand story effectively.',
    features: ['Product Photography', 'Architectural Shoots', 'Corporate Portraits', 'Event Photography']
  },
  {
    image: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Videography',
    description: 'Dynamic video content creation for digital platforms and social media that drives engagement.',
    features: ['Social Media Reels', 'Behind-the-Scenes', 'Event Coverage', 'Product Demos']
  },
  {
    image: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Social Media Management',
    description: 'Complete social media strategy across all platforms with content creation and analytics.',
    features: ['Content Strategy', 'Platform Management', 'Community Engagement', 'Performance Analytics']
  },
  {
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Digital Marketing',
    description: 'Data-driven marketing strategies that drive growth and ROI across multiple digital channels.',
    features: ['Google Ads & PPC', 'SEO Optimization', 'Email Marketing', 'Conversion Optimization']
  },
  {
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Brand Strategy',
    description: 'Strategic brand development and positioning that sets you apart from your competitors.',
    features: ['Brand Positioning', 'Competitive Analysis', 'Target Research', 'Go-to-Market Strategy']
  },
  {
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Branding',
    description: 'Visual identity design that brings your brand strategy to life through compelling design systems.',
    features: ['Logo & Brand Design', 'Visual Identity', 'Brand Guidelines', 'Packaging Design']
  },
  {
    image: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Web Design',
    description: 'Modern, responsive websites that convert visitors into customers with optimized user experience.',
    features: ['Responsive Design', 'E-commerce Websites', 'Landing Pages', 'CMS Integration']
  },
  {
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'App Building',
    description: 'Custom mobile and web applications that solve business problems and enhance customer experience.',
    features: ['iOS & Android Apps', 'Web Applications', 'E-commerce Platforms', 'API Integration']
  }
];

interface ServicesProps {
  onOpenQuote?: () => void;
}

const serviceIcons = {
  'Production': '🎬',
  'Social Media Management': '📱',
  'Brand Strategy': '🎯',
  'Branding': '🎨',
  'Digital Marketing': '💻',
  'Content Creation': '📹',
  'Photography': '📸',
  'Web Design': '🌐',
  'App Building': '📱'
};

const Services: React.FC<ServicesProps> = ({ onOpenQuote }) => {
  const serviceNames = [
    'Production', 'Social Media Management', 'Brand Strategy',
    'Branding', 'Digital Marketing', 'Content Creation', 'Photography',
    'Web Design', 'App Building'
  ];

  return (
    <section id="services" className="py-24" style={{ backgroundColor: '#ebeef8' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-ramillas text-4xl sm:text-5xl font-bold text-neutral-900 mb-12 leading-tight">
          We know what we do best.
        </h2>
        
        {/* Service Tags */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {serviceNames.map((service, index) => (
            <span
              key={index}
              className="px-4 py-2 rounded-full font-grotesk font-medium text-sm transition-all duration-300 hover:scale-105 cursor-pointer flex items-center gap-2"
              style={{ 
                backgroundColor: '#fffceb',
                color: '#262626'
              }}
            >
              <span className="text-base">{serviceIcons[service as keyof typeof serviceIcons]}</span>
              {service}
            </span>
          ))}
        </div>

        {/* Call to Action */}
        <div className="space-y-6">
          <h3 className="font-ramillas text-3xl sm:text-4xl font-bold text-neutral-900 leading-tight">
            Do you really know<br />what you need?
          </h3>
          
          <button
            onClick={onOpenQuote}
            className="px-8 py-3 rounded-full font-grotesk font-bold text-neutral-800 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ 
              backgroundColor: '#fffceb'
            }}
          >
            Take a Quiz
          </button>
        </div>
      </div>
    </section>
  );
};

export default Services;