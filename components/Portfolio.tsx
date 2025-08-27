import React, { useState } from 'react';
import VideoGallery from './VideoGallery';

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
  { id: 'fashion', name: 'Fashion' },
  { id: 'commercial', name: 'Commercial' },
  { id: 'gastronomi', name: 'Gastronomi' },
  { id: 'interview', name: 'Interview' }
];

const Portfolio: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);
  const [showVideos, setShowVideos] = useState(true);

  const filteredProjects = selectedCategory === 'all' 
    ? projects 
    : projects.filter(project => project.category === selectedCategory);

  return (
    <section id="portfolio" className="py-20" style={{ backgroundColor: '#ebeef8' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-ramillas text-4xl sm:text-5xl font-bold text-neutral-900 mb-4 leading-tight">
            Our Work
          </h2>
          <p className="font-grotesk text-lg text-neutral-700 max-w-2xl lg:mx-auto">
            Explore our video productions and creative projects that showcase our expertise across various industries.
          </p>
        </div>

        {/* Toggle between Videos and Projects */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-full p-1 bg-white shadow-sm">
            <button
              onClick={() => setShowVideos(true)}
              className={`px-6 py-2 rounded-full text-sm font-grotesk font-medium transition-all duration-300 ${
                showVideos
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Video Productions
            </button>
            <button
              onClick={() => setShowVideos(false)}
              className={`px-6 py-2 rounded-full text-sm font-grotesk font-medium transition-all duration-300 ${
                !showVideos
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Digital Projects
            </button>
          </div>
        </div>

        {/* Video Gallery or Projects Grid */}
        {showVideos ? (
          <VideoGallery 
            showFilters={true}
            columns={4}
            autoLoad={false}
          />
        ) : (
          <>
        {/* Category Filter */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-full p-1" style={{ backgroundColor: '#fffceb' }}>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-grotesk font-medium transition-all duration-300 ${
                  selectedCategory === category.id
                    ? 'text-neutral-900 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                style={{ 
                  backgroundColor: selectedCategory === category.id ? '#ebeef8' : 'transparent'
                }}
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
                      className="px-3 py-1 text-neutral-800 text-xs rounded-full font-grotesk"
                      style={{ backgroundColor: '#fffceb' }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <a
                  href={project.link}
                  className="inline-flex items-center text-white hover:opacity-80 transition-opacity font-grotesk"
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
        </>
        )}
      </div>
    </section>
  );
};

export default Portfolio;