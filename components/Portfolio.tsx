import React, { useState } from 'react';

const projects = [
  {
    id: 1,
    title: 'E-Commerce Platform',
    category: 'web',
    image: 'https://picsum.photos/600/400?random=1',
    description: 'Modern e-commerce solution with AI-powered recommendations',
    technologies: ['React', 'Node.js', 'MongoDB', 'Stripe'],
    link: '#'
  },
  {
    id: 2,
    title: 'Banking Mobile App',
    category: 'mobile',
    image: 'https://picsum.photos/600/400?random=2',
    description: 'Secure banking application with biometric authentication',
    technologies: ['React Native', 'TypeScript', 'Firebase'],
    link: '#'
  },
  {
    id: 3,
    title: 'Brand Identity Design',
    category: 'design',
    image: 'https://picsum.photos/600/400?random=3',
    description: 'Complete brand identity for a tech startup',
    technologies: ['Figma', 'Illustrator', 'After Effects'],
    link: '#'
  },
  {
    id: 4,
    title: 'Healthcare Dashboard',
    category: 'web',
    image: 'https://picsum.photos/600/400?random=4',
    description: 'Real-time patient monitoring and analytics dashboard',
    technologies: ['Vue.js', 'D3.js', 'Python', 'PostgreSQL'],
    link: '#'
  },
  {
    id: 5,
    title: 'Fitness Tracking App',
    category: 'mobile',
    image: 'https://picsum.photos/600/400?random=5',
    description: 'Cross-platform fitness app with social features',
    technologies: ['Flutter', 'Firebase', 'Google Fit API'],
    link: '#'
  },
  {
    id: 6,
    title: 'Restaurant Website',
    category: 'web',
    image: 'https://picsum.photos/600/400?random=6',
    description: 'Responsive website with online reservation system',
    technologies: ['Next.js', 'Tailwind CSS', 'Contentful'],
    link: '#'
  }
];

const categories = [
  { id: 'all', name: 'All Projects' },
  { id: 'web', name: 'Web Development' },
  { id: 'mobile', name: 'Mobile Apps' },
  { id: 'design', name: 'UI/UX Design' }
];

const Portfolio: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);

  const filteredProjects = selectedCategory === 'all' 
    ? projects 
    : projects.filter(project => project.category === selectedCategory);

  return (
    <section id="portfolio" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-base text-purple-600 font-semibold tracking-wide uppercase">Our Work</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Featured Projects
          </p>
          <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
            Explore our latest work and see how we've helped businesses transform their digital presence.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                  selectedCategory === category.id
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="group relative overflow-hidden rounded-lg shadow-lg cursor-pointer"
              onMouseEnter={() => setHoveredProject(project.id)}
              onMouseLeave={() => setHoveredProject(null)}
            >
              <div className="aspect-w-3 aspect-h-2 relative">
                <img
                  src={project.image}
                  alt={project.title}
                  className="object-cover w-full h-64 transition-transform duration-300 group-hover:scale-110"
                />
                <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
                  hoveredProject === project.id ? 'opacity-100' : 'opacity-0'
                }`} />
              </div>
              
              <div className={`absolute inset-0 p-6 flex flex-col justify-end transition-all duration-300 ${
                hoveredProject === project.id ? 'translate-y-0' : 'translate-y-full'
              }`}>
                <h3 className="text-xl font-semibold text-white mb-2">{project.title}</h3>
                <p className="text-gray-200 text-sm mb-4">{project.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.technologies.map((tech, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-purple-600/20 text-purple-200 text-xs rounded-full"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <a
                  href={project.link}
                  className="inline-flex items-center text-white hover:text-purple-300 transition-colors"
                >
                  View Project
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Portfolio;