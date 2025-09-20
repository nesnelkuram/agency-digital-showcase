import React, { useState, useEffect } from 'react';

interface SimpleQuoteLightboxProps {
  isOpen: boolean;
  onClose: () => void;
}

const SERVICES = [
  { name: 'Brand Story Videos', price: '$15K+', icon: '🎬' },
  { name: 'Executive Thought Leadership', price: '$8K+', icon: '🎯' },
  { name: 'Product Launch Campaigns', price: '$25K+', icon: '🚀' },
  { name: 'Customer Success Stories', price: '$5K+', icon: '⭐' },
  { name: 'Event Marketing Videos', price: '$12K+', icon: '🎪' },
  { name: 'Social Media Content', price: '$3K/mo', icon: '📱' }
];

const BUDGETS = [
  { range: '$5K - $15K', value: '5-15k' },
  { range: '$15K - $30K', value: '15-30k' },
  { range: '$30K - $50K', value: '30-50k' },
  { range: '$50K+', value: '50k+' }
];

const TIMELINES = [
  { period: 'ASAP (Rush fee applies)', value: 'asap' },
  { period: '2-4 weeks', value: '2-4weeks' },
  { period: '1-2 months', value: '1-2months' },
  { period: '3+ months', value: '3months+' }
];

const SimpleQuoteLightbox: React.FC<SimpleQuoteLightboxProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    services: [] as string[],
    budget: '',
    timeline: '',
    name: '',
    email: '',
    company: '',
    phone: '',
    projectDetails: ''
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setStep(1);
      setFormData({
        services: [],
        budget: '',
        timeline: '',
        name: '',
        email: '',
        company: '',
        phone: '',
        projectDetails: ''
      });
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    // In a real app, you'd send this to your backend
    console.log('Form submitted:', formData);
    
    // Show success message and close
    alert('Thank you! We will contact you within 24 hours with a custom proposal.');
    onClose();
  };

  const canProceedStep1 = formData.services.length > 0;
  const canProceedStep2 = formData.budget && formData.timeline;
  const canSubmit = formData.name && formData.email && formData.company;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-ramillas text-2xl font-bold text-gray-900">
                Get Your Free Strategy Session
              </h2>
              <p className="font-grotesk text-gray-600 mt-1">
                Step {step} of 3 - Takes less than 2 minutes
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* Step 1: Service Selection */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-ramillas text-xl font-bold text-gray-900 mb-2">
                  What type of video content do you need?
                </h3>
                <p className="font-grotesk text-gray-600">
                  Select all that apply. We'll create a custom proposal for your needs.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SERVICES.map((service) => (
                  <button
                    key={service.name}
                    onClick={() => handleServiceToggle(service.name)}
                    className={`p-4 rounded-lg border-2 text-left transition-all duration-200 hover:scale-105 ${
                      formData.services.includes(service.name)
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{service.icon}</span>
                          <span className="font-grotesk font-semibold text-gray-900">
                            {service.name}
                          </span>
                        </div>
                        <span className="font-grotesk text-sm text-blue-600 font-medium">
                          {service.price}
                        </span>
                      </div>
                      {formData.services.includes(service.name) && (
                        <div className="text-blue-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Budget & Timeline */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-ramillas text-xl font-bold text-gray-900 mb-2">
                  Budget & Timeline
                </h3>
                <p className="font-grotesk text-gray-600">
                  Help us create the perfect proposal for your project scope.
                </p>
              </div>
              
              {/* Budget */}
              <div>
                <label className="block font-grotesk font-semibold text-gray-900 mb-3">
                  What's your budget range?
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {BUDGETS.map((budget) => (
                    <button
                      key={budget.value}
                      onClick={() => setFormData(prev => ({ ...prev, budget: budget.value }))}
                      className={`p-3 rounded-lg border-2 text-center transition-all duration-200 ${
                        formData.budget === budget.value
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="font-grotesk font-medium text-gray-900">
                        {budget.range}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <label className="block font-grotesk font-semibold text-gray-900 mb-3">
                  When do you need this completed?
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {TIMELINES.map((timeline) => (
                    <button
                      key={timeline.value}
                      onClick={() => setFormData(prev => ({ ...prev, timeline: timeline.value }))}
                      className={`p-3 rounded-lg border-2 text-center transition-all duration-200 ${
                        formData.timeline === timeline.value
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="font-grotesk font-medium text-gray-900">
                        {timeline.period}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Contact Information */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-ramillas text-xl font-bold text-gray-900 mb-2">
                  Contact Information
                </h3>
                <p className="font-grotesk text-gray-600">
                  We'll send you a custom proposal within 24 hours.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-grotesk font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="Your full name"
                  />
                </div>
                
                <div>
                  <label className="block font-grotesk font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="your@email.com"
                  />
                </div>
                
                <div>
                  <label className="block font-grotesk font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="Your company"
                  />
                </div>
                
                <div>
                  <label className="block font-grotesk font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
              
              <div>
                <label className="block font-grotesk font-medium text-gray-700 mb-2">
                  Project Details (Optional)
                </label>
                <textarea
                  value={formData.projectDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectDetails: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Tell us more about your project goals..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-8 py-6 rounded-b-2xl border-t border-gray-200">
          <div className="flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="px-4 py-2 font-grotesk font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}
            
            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                className={`px-6 py-2 rounded-lg font-grotesk font-bold transition-all duration-200 ${
                  (step === 1 ? canProceedStep1 : canProceedStep2)
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`px-6 py-2 rounded-lg font-grotesk font-bold transition-all duration-200 ${
                  canSubmit
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Get My Free Proposal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleQuoteLightbox;