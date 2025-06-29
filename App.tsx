import React from 'react';
import Header3D from './components/Header3D';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header3D />
      {/* Placeholder content to demonstrate scrolling past the sticky Header */}
      <div className="h-[100vh] bg-white p-10">
        <h2 className="text-3xl font-bold text-neutral-900 mb-4">Content After Header</h2>
        <p className="text-neutral-600 mb-4">
          This section appears after the Header's sticky parallax effect has completed.
          The Header itself will define the scroll length for its animation.
        </p>
        <p className="text-neutral-600">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        </p>
      </div>
    </div>
  );
};

export default App;