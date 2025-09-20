import React from 'react';

const stats = [
  { value: '500+', label: 'Videos Produced' },
  { value: '300%', label: 'Avg. Brand Awareness Increase' },
  { value: '50M+', label: 'Video Views Generated' },
  { value: '98%', label: 'Client Satisfaction Rate' }
];

const testimonials = [
  {
    quote: "Intiba's video campaigns increased our hotel bookings by 400% in just 3 months. Their cinematic approach to storytelling is unmatched.",
    author: "Sarah Johnson",
    title: "Marketing Director",
    company: "Luxury Resorts Group",
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"
  },
  {
    quote: "The brand documentary they created for us generated 2.5 million views and led to our biggest funding round ever. Absolutely incredible work.",
    author: "Michael Chen",
    title: "CEO & Founder",
    company: "TechStart Inc",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"
  },
  {
    quote: "Our product launch video went viral with 8M+ views. The ROI was over 1000%. These guys understand how to create content that converts.",
    author: "Emily Rodriguez",
    title: "Head of Marketing",
    company: "Fashion Forward",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"
  }
];

const brands = [
  { name: "Netflix", logo: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&q=80" },
  { name: "Marriott", logo: "https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&q=80" },
  { name: "BMW", logo: "https://images.unsplash.com/photo-1555215695-3004980ad54e?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&q=80" },
  { name: "Nike", logo: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&q=80" },
  { name: "Apple", logo: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&q=80" },
  { name: "Microsoft", logo: "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&q=80" }
];


const About: React.FC = () => {
  return (
    <section id="about" className="py-20" style={{ backgroundColor: '#fffceb' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Trusted by Section */}
        <div className="text-center mb-16">
          <h2 className="font-grotesk text-lg text-neutral-600 mb-8 uppercase tracking-wide">
            Trusted by Global Brands
          </h2>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            {brands.map((brand, index) => (
              <div key={index} className="h-12 flex items-center">
                <img 
                  src={brand.logo} 
                  alt={brand.name}
                  className="h-8 w-auto grayscale hover:grayscale-0 transition-all duration-300"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Main Section */}
        <div className="text-center mb-16">
          <h2 className="font-ramillas text-4xl sm:text-5xl font-bold text-neutral-900 mb-4 leading-tight">
            Proven Results That Speak Volumes
          </h2>
          <p className="font-grotesk text-lg text-neutral-700 max-w-3xl mx-auto">
            We've helped hundreds of brands increase their visibility and drive real business results through strategic video marketing.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="font-ramillas text-4xl font-bold text-blue-600 mb-2">{stat.value}</div>
              <div className="font-grotesk text-neutral-700">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mb-20">
          <h3 className="font-ramillas text-3xl font-bold text-neutral-900 text-center mb-12">
            What Our Clients Say
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-lg">
                <div className="mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400 text-lg">★</span>
                  ))}
                </div>
                <p className="font-grotesk text-neutral-700 mb-6 italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.author}
                    className="w-12 h-12 rounded-full mr-4"
                  />
                  <div>
                    <div className="font-grotesk font-semibold text-neutral-900">
                      {testimonial.author}
                    </div>
                    <div className="font-grotesk text-sm text-neutral-600">
                      {testimonial.title}, {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Awards & Recognition */}
        <div className="text-center bg-white rounded-lg p-8">
          <h3 className="font-ramillas text-2xl font-bold text-neutral-900 mb-6">
            Awards & Recognition
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-8">
            <div className="text-center">
              <div className="font-grotesk text-lg font-semibold text-neutral-900">🏆 Cannes Lions</div>
              <div className="font-grotesk text-sm text-neutral-600">Bronze Winner 2023</div>
            </div>
            <div className="text-center">
              <div className="font-grotesk text-lg font-semibold text-neutral-900">🎬 Webby Awards</div>
              <div className="font-grotesk text-sm text-neutral-600">Best Brand Film 2023</div>
            </div>
            <div className="text-center">
              <div className="font-grotesk text-lg font-semibold text-neutral-900">⭐ Clutch.co</div>
              <div className="font-grotesk text-sm text-neutral-600">Top 1% Agency 2024</div>
            </div>
            <div className="text-center">
              <div className="font-grotesk text-lg font-semibold text-neutral-900">📈 Google Premier</div>
              <div className="font-grotesk text-sm text-neutral-600">Partner Since 2020</div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default About;