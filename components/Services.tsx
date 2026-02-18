import React from 'react';

const services = [
  {
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Brand Story Videos',
    description: 'Increase brand trust and emotional connection with authentic documentary-style brand stories that convert viewers into customers.',
    features: ['300% higher engagement rates', 'Builds brand credibility', 'Drives purchase decisions', 'Boosts social media reach'],
    pricing: 'Starting at $15K'
  },
  {
    image: 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Executive Thought Leadership',
    description: 'Position your leadership as industry experts with professional video content that builds authority and drives business opportunities.',
    features: ['Establishes thought leadership', 'Generates qualified leads', 'Increases speaking opportunities', 'Builds personal brand value'],
    pricing: 'Starting at $8K'
  },
  {
    image: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Product Launch Campaigns',
    description: 'Drive 500%+ more pre-orders and launch buzz with cinematic product videos that showcase value and create demand.',
    features: ['500% higher conversion rates', 'Viral potential content', 'Multi-platform optimization', 'Launch day amplification'],
    pricing: 'Starting at $25K'
  },
  {
    image: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Customer Success Stories',
    description: 'Turn satisfied customers into your best salespeople with compelling video testimonials that drive new business.',
    features: ['92% trust video testimonials', 'Shortens sales cycles', 'Increases close rates', 'Builds social proof'],
    pricing: 'Starting at $5K'
  },
  {
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Event Marketing Videos',
    description: 'Maximize event ROI with professional documentation that extends your reach and generates leads year-round.',
    features: ['Extends event lifespan', 'Generates ongoing leads', 'Builds FOMO for next event', 'Content for entire year'],
    pricing: 'Starting at $12K'
  },
  {
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    title: 'Social Media Content',
    description: 'Dominate social media with scroll-stopping video content designed to increase followers, engagement, and sales.',
    features: ['10x higher engagement', 'Increases follower growth', 'Drives website traffic', 'Generates direct sales'],
    pricing: 'Starting at $3K/month'
  }
];

interface ServicesProps {
  onOpenQuote?: () => void;
}

const serviceIcons = {
  'Brand Story Videos': '🎬',
  'Executive Thought Leadership': '🎯',
  'Product Launch Campaigns': '🚀',
  'Customer Success Stories': '⭐',
  'Event Marketing Videos': '🎪',
  'Social Media Content': '📱'
};

const Services: React.FC<ServicesProps> = ({ onOpenQuote }) => {
  const serviceNames = [
    'Brand Story Videos', 'Executive Thought Leadership', 'Product Launch Campaigns',
    'Customer Success Stories', 'Event Marketing Videos', 'Social Media Content'
  ];

  return (
    <section id="services" className="py-24" style={{ backgroundColor: 'rgba(235, 238, 248, 0.85)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-ramillas text-4xl sm:text-5xl font-bold text-neutral-900 mb-12 leading-tight">
          Video Marketing That Delivers ROI
        </h2>
        
        {/* Service Tags */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-16 px-2 md:px-0">
          {serviceNames.map((service, index) => (
            <span
              key={index}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-grotesk font-medium text-xs sm:text-sm transition-all duration-300 hover:scale-105 cursor-pointer flex items-center gap-1.5 sm:gap-2"
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
          <h3 className="font-ramillas text-2xl sm:text-3xl md:text-4xl font-bold text-neutral-900 leading-tight">
            Ready to increase your<br className="hidden sm:block" />brand visibility by 300%?
          </h3>
          <p className="font-grotesk text-base sm:text-lg text-neutral-600 mb-4 sm:mb-6">
            Get a free video marketing strategy session with our team
          </p>
          
          <button
            onClick={onOpenQuote}
            className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-full font-grotesk font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg text-sm sm:text-base"
            style={{
              backgroundColor: '#333333'
            }}
          >
            Book Free Strategy Call
          </button>
        </div>
      </div>
    </section>
  );
};

export default Services;