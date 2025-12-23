import React, { useState, useEffect } from 'react';

interface UrgencyBarProps {
  onOpenQuote?: () => void;
}

const UrgencyBar: React.FC<UrgencyBarProps> = ({ onOpenQuote }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    // Show after 5 seconds of being on the page
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 5000);

    // Calculate time until end of month for urgency
    const calculateTimeLeft = () => {
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const difference = endOfMonth.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setTimeLeft(`${days}d ${hours}h`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000 * 60 * 60); // Update every hour

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-red-600 text-white shadow-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="font-grotesk font-bold text-xs sm:text-sm">
                LIMITED TIME:
              </span>
            </div>
            
            <div className="hidden sm:block">
              <span className="font-grotesk text-sm">
                Free strategy sessions ending in <span className="font-bold">{timeLeft}</span> 
                - Only <span className="font-bold">3 spots</span> left this month
              </span>
            </div>
            
            <div className="sm:hidden truncate">
              <span className="font-grotesk text-xs">
                <span className="font-bold">3 spots</span> - {timeLeft}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onOpenQuote}
              className="bg-white text-red-600 px-2 sm:px-4 py-1 sm:py-1.5 rounded font-grotesk font-bold text-xs sm:text-sm hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              Claim Yours
            </button>
            
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UrgencyBar;