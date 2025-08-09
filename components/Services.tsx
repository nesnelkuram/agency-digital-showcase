import React from 'react';

const services = [
  {
    icon: '🎨',
    title: 'UI/UX Design',
    description: 'Create stunning user interfaces and experiences that captivate your audience and drive engagement.',
    features: ['User Research', 'Wireframing', 'Prototyping', 'Visual Design']
  },
  {
    icon: '💻',
    title: 'Web Development',
    description: 'Build powerful, scalable web applications using cutting-edge technologies and best practices.',
    features: ['React/Next.js', 'Node.js', 'Database Design', 'API Development']
  },
  {
    icon: '📱',
    title: 'Mobile Development',
    description: 'Develop native and cross-platform mobile apps that deliver exceptional user experiences.',
    features: ['iOS Development', 'Android Development', 'React Native', 'Flutter']
  },
  {
    icon: '🚀',
    title: 'Digital Marketing',
    description: 'Boost your online presence with data-driven marketing strategies that deliver results.',
    features: ['SEO Optimization', 'Social Media', 'Content Marketing', 'Analytics']
  }
];

const Services: React.FC = () => {
  return (
    <section id="services" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-base text-purple-600 font-semibold tracking-wide uppercase">What We Do</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Our Services
          </p>
          <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
            We offer comprehensive digital solutions to help your business thrive in the modern world.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="relative group bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {service.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-white transition-colors duration-300">
                  {service.title}
                </h3>
                <p className="text-gray-600 mb-4 group-hover:text-gray-100 transition-colors duration-300">
                  {service.description}
                </p>
                <ul className="space-y-1">
                  {service.features.map((feature, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-gray-500 group-hover:text-gray-200 transition-colors duration-300 flex items-center"
                    >
                      <span className="w-1 h-1 bg-purple-600 group-hover:bg-white rounded-full mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;