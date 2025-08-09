import React from 'react';
import Header3D from './components/Header3D';
import Services from './components/Services';
import Portfolio from './components/Portfolio';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';

const App: React.FC = () => {
  return (
    <div className="min-h-screen">
      <Header3D />
      
      {/* Services Section */}
      <Services />
      
      {/* Portfolio Section */}
      <Portfolio />
      
      {/* About Section */}
      <About />
      
      {/* Contact Section */}
      <Contact />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;