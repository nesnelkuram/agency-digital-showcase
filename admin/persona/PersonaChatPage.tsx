import React from 'react';
import PersonaChatWidget from './PersonaChatWidget';

const PersonaChatPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
          Danisman AI
        </h1>
        <p className="font-grotesk text-neutral-600 mt-1">
          432 blog yazisinin perspektifiyle is ve marka stratejisi danismanligi
        </p>
      </div>

      {/* Chat container */}
      <div className="h-[calc(100vh-220px)] min-h-[500px]">
        <PersonaChatWidget />
      </div>
    </div>
  );
};

export default PersonaChatPage;
