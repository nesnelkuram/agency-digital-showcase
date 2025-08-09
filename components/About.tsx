import React from 'react';

const stats = [
  { value: '100+', label: 'Happy Clients' },
  { value: '250+', label: 'Projects Completed' },
  { value: '15+', label: 'Years Experience' },
  { value: '50+', label: 'Team Members' }
];

const team = [
  {
    name: 'Sarah Johnson',
    role: 'CEO & Founder',
    image: 'https://picsum.photos/300/300?random=10',
    social: {
      linkedin: '#',
      twitter: '#'
    }
  },
  {
    name: 'Michael Chen',
    role: 'CTO',
    image: 'https://picsum.photos/300/300?random=11',
    social: {
      linkedin: '#',
      twitter: '#'
    }
  },
  {
    name: 'Emily Rodriguez',
    role: 'Creative Director',
    image: 'https://picsum.photos/300/300?random=12',
    social: {
      linkedin: '#',
      twitter: '#'
    }
  },
  {
    name: 'David Kim',
    role: 'Lead Developer',
    image: 'https://picsum.photos/300/300?random=13',
    social: {
      linkedin: '#',
      twitter: '#'
    }
  }
];

const About: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-base text-purple-600 font-semibold tracking-wide uppercase">Who We Are</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            About Our Agency
          </p>
          <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
            We're a passionate team of digital experts dedicated to transforming businesses through innovative technology solutions.
          </p>
        </div>

        {/* Company Story */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h3>
            <p className="text-gray-600 mb-4">
              Founded in 2008, we started as a small team with big dreams. Today, we're proud to be one of the leading digital agencies, 
              helping businesses worldwide achieve their digital transformation goals.
            </p>
            <p className="text-gray-600 mb-4">
              Our journey has been driven by innovation, creativity, and an unwavering commitment to our clients' success. 
              We believe in building long-term partnerships and delivering solutions that make a real difference.
            </p>
            <p className="text-gray-600">
              With expertise spanning web development, mobile apps, UI/UX design, and digital marketing, 
              we offer comprehensive solutions tailored to each client's unique needs.
            </p>
          </div>
          <div className="relative">
            <img
              src="https://picsum.photos/600/400?random=20"
              alt="Our office"
              className="rounded-lg shadow-xl"
            />
            <div className="absolute -bottom-6 -right-6 w-72 h-72 bg-purple-600 rounded-lg -z-10 opacity-20" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">{stat.value}</div>
              <div className="text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Team */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-12">Meet Our Team</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="text-center group">
                <div className="relative mb-4 overflow-hidden rounded-lg">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                    <div className="flex space-x-4">
                      <a
                        href={member.social.linkedin}
                        className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                      </a>
                      <a
                        href={member.social.twitter}
                        className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-gray-900">{member.name}</h4>
                <p className="text-gray-600">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;