import React from 'react';
import VideoGallery from './VideoGallery';

const Portfolio: React.FC = () => {
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

        {/* Video Gallery */}
        <VideoGallery 
          showFilters={true}
          columns={4}
          autoLoad={false}
        />
      </div>
    </section>
  );
};

export default Portfolio;