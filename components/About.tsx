import React from 'react';

const stats = [
  { value: '100+', label: 'Happy Clients' },
  { value: '250+', label: 'Projects Completed' },
  { value: '15+', label: 'Years Experience' },
  { value: '50+', label: 'Team Members' }
];


const About: React.FC = () => {
  return (
    <section id="about" className="py-20" style={{ backgroundColor: '#fffceb' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-ramillas text-4xl sm:text-5xl font-bold text-neutral-900 mb-4 leading-tight">
            About Our Agency
          </h2>
          <p className="font-grotesk text-lg text-neutral-700 max-w-2xl lg:mx-auto">
            We're a passionate team of digital experts dedicated to transforming businesses through innovative technology solutions.
          </p>
        </div>

        {/* Company Story */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <h3 className="font-ramillas text-3xl font-bold text-neutral-900 mb-6">Our Story</h3>
            <p className="font-grotesk text-neutral-700 mb-4 leading-relaxed">
              Founded in 2008, we started as a small team with big dreams. Today, we're proud to be one of the leading digital agencies, 
              helping businesses worldwide achieve their digital transformation goals.
            </p>
            <p className="font-grotesk text-neutral-700 mb-4 leading-relaxed">
              Our journey has been driven by innovation, creativity, and an unwavering commitment to our clients' success. 
              We believe in building long-term partnerships and delivering solutions that make a real difference.
            </p>
            <p className="font-grotesk text-neutral-700 leading-relaxed">
              With expertise spanning web development, mobile apps, UI/UX design, and digital marketing, 
              we offer comprehensive solutions tailored to each client's unique needs.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="font-ramillas text-4xl font-bold text-neutral-900 mb-2">{stat.value}</div>
              <div className="font-grotesk text-neutral-700">{stat.label}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default About;