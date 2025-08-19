import React, { useEffect, useMemo, useState } from "react";

const ALL_SERVICES = [
  "Film Production",
  "Photography", 
  "Videography",
  "Social Media Management",
  "Digital Marketing",
  "Brand Strategy",
  "Branding",
  "Web Design",
  "App Building",
];

const STEP_IMAGES = {
  0: "https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2274&q=80", // Dark office workspace
  1: "https://images.unsplash.com/photo-1485846234645-a62644f84728?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2059&q=80", // Services/film production
  2: "https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80", // Business goals
  3: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80", // Location/map
  4: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2076&q=80", // Project summary/writing
  5: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80", // Priority/targets
  6: "https://images.unsplash.com/photo-1605092676920-8ac4b0ec7e0a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2274&q=80", // Challenge/problem
  7: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2015&q=80", // Current assets/analytics
  8: "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2274&q=80", // Brand stage/building
  9: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2274&q=80", // Decision factors/team
  10: "https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2274&q=80", // Previous experience/handshake
  11: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80", // Concerns/thinking
  12: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?ixlib=rb-4.0.3&ixid=M3wxMajA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2026&q=80", // Timeline/clock
  13: "https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2274&q=80", // Contact/communication
  14: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80", // Summary/documents
  15: "https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80", // Direct: Goals/Platform
  16: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2026&q=80", // Direct: Timeline
  17: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80", // Direct: Budget
  18: "https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2274&q=80", // Direct: Contact
  100: "https://images.unsplash.com/photo-1485846234645-a62644f84728?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2059&q=80", // Direct: Services
  101: "https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80", // Direct: Goals
  102: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2339&q=80", // Direct: Platform
  103: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2026&q=80", // Direct: Timeline
  104: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80", // Direct: Budget
  105: "https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2274&q=80" // Direct: Contact
};

const SERVICE_DESCRIPTIONS = {
  "Film Production": {
    title: "Film Production",
    description: "Professional cinematic storytelling for brands and businesses. We create high-end commercial films, brand documentaries, and corporate videos that captivate audiences.",
    examples: "• Brand films for luxury hotels\n• Corporate documentaries\n• Product launch films\n• CEO interviews and testimonials\n• Company culture videos"
  },
  "Photography": {
    title: "Photography",
    description: "Professional photography services for commercial and creative projects. We capture stunning visuals that tell your brand's story through carefully crafted images.",
    examples: "• Product photography for e-commerce\n• Architectural and real estate shoots\n• Corporate headshots and team photos\n• Event photography\n• Food and lifestyle photography"
  },
  "Videography": {
    title: "Videography",
    description: "Dynamic video content creation for digital platforms and social media. We produce engaging short-form content that drives engagement and conversions.",
    examples: "• Social media reels and shorts\n• Behind-the-scenes content\n• Event highlights and coverage\n• Product demonstrations\n• Tutorial and how-to videos"
  },
  "Social Media Management": {
    title: "Social Media Management",
    description: "Complete social media strategy and management across all platforms. We handle content creation, scheduling, community management, and performance analytics.",
    examples: "• Instagram and TikTok management\n• Content calendar planning\n• Community engagement\n• Influencer collaborations\n• Social media advertising campaigns"
  },
  "Digital Marketing": {
    title: "Digital Marketing",
    description: "Comprehensive digital marketing strategies that drive growth and ROI. We create data-driven campaigns across multiple channels to reach your target audience.",
    examples: "• Google Ads and PPC campaigns\n• SEO optimization\n• Email marketing automation\n• Conversion rate optimization\n• Analytics and performance tracking"
  },
  "Brand Strategy": {
    title: "Brand Strategy",
    description: "Strategic brand development and positioning that sets you apart from competitors. We define your brand's core identity, values, and messaging framework.",
    examples: "• Brand positioning and messaging\n• Competitive analysis\n• Target audience research\n• Brand guidelines development\n• Go-to-market strategies"
  },
  "Branding": {
    title: "Branding",
    description: "Visual identity design and brand asset creation. We bring your brand strategy to life through compelling visual elements and consistent design systems.",
    examples: "• Logo design and brand marks\n• Brand color palettes and typography\n• Business card and stationery design\n• Brand guidelines and style guides\n• Packaging and product design"
  },
  "Web Design": {
    title: "Web Design",
    description: "Modern, responsive website design that converts visitors into customers. We create user-friendly websites optimized for performance and search engines.",
    examples: "• E-commerce website development\n• Corporate website design\n• Landing page optimization\n• Mobile-responsive design\n• CMS integration and training"
  },
  "App Building": {
    title: "App Building",
    description: "Custom mobile and web application development. We build scalable, user-friendly apps that solve real business problems and enhance customer experience.",
    examples: "• iOS and Android mobile apps\n• Web applications and dashboards\n• E-commerce and booking platforms\n• Customer portal development\n• API integration and databases"
  }
};

const PROJECT_TYPES = [
  "New Launch Campaign",
  "Brand Refresh", 
  "Seasonal Campaign",
  "Product Showcase",
  "Event Coverage",
  "Social Content Series",
  "Website Redesign",
  "App Launch",
  "Corporate Film",
  "Marketing Campaign",
];

const LOCATIONS = [
  "Bodrum",
  "Istanbul", 
  "Ankara",
  "London",
  "Dubai",
  "New York",
  "Paris",
  "Other",
];

const GOALS = [
  "Brand Awareness",
  "Lead Generation",
  "Sales / Bookings",
  "Social Growth", 
  "Conversion Rate Increase",
  "App Downloads",
  "Investor Deck / PR",
];

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "LinkedIn", "Facebook", "X/Twitter", "Pinterest"];
const VIDEO_TYPES = [
  "Brand Film",
  "Product Video",
  "Event Highlights", 
  "Real Estate Tour",
  "Interview / Testimonial",
  "Social Reels/Shorts",
  "Aerial/Drone",
];

const PHOTO_TYPES = [
  "Product / Food",
  "Architecture / Real Estate",
  "Event",
  "Lifestyle / Fashion",
  "Corporate Portraits",
];

const BUDGETS = [
  "Under $1,500",
  "$1,500–$3,000", 
  "$3,000–$7,500",
  "$7,500–$15,000",
  "$15,000–$30,000",
  "$30,000+",
];

const BUSINESS_GOALS = [
  "Increase brand awareness",
  "Generate new leads",
  "Increase direct sales and revenue",
  "Increase website traffic",
  "Strengthen online reputation and credibility",
  "Launch a new product/service to market",
  "Other (Please specify)"
];

const CURRENT_ASSETS = [
  "Existing website",
  "Social media accounts",
  "Logo and brand guidelines",
  "Existing marketing materials",
  "Previous marketing campaigns",
  "None"
];

const SUCCESS_METRICS = [
  "Increase in website traffic",
  "Increase in conversion rate",
  "Increase in leads",
  "Increase in social media engagement",
  "Increase in sales and revenue",
  "Decrease in customer acquisition cost (CAC)",
  "Other metric (Please specify)"
];

const PROJECT_PRIORITIES = [
  "Immediate revenue generation",
  "Long-term brand building",
  "Market expansion",
  "Customer retention",
  "Competitive advantage",
  "Crisis management/reputation",
  "Product/service launch",
  "Other priority"
];

const BRAND_STAGES = [
  "Startup (Just getting started)",
  "Growth (Scaling rapidly)",
  "Established (Stable market position)",
  "Rebranding (Major changes needed)",
  "Mature (Market leader)"
];

const DECISION_FACTORS = [
  "Quality of work portfolio",
  "Pricing and budget fit",
  "Team expertise and experience",
  "Communication style",
  "Timeline and availability",
  "Local presence/understanding",
  "Proven results and case studies",
  "Cultural fit with our company"
];

const PREVIOUS_EXPERIENCES = [
  "Very positive - exceeded expectations",
  "Mostly positive - minor issues",
  "Mixed results - some good, some bad",
  "Disappointing - below expectations",
  "Terrible - major problems",
  "No previous agency experience"
];

const MAIN_CONCERNS = [
  "Budget constraints",
  "Timeline pressure",
  "Quality standards",
  "Communication issues",
  "Scope creep",
  "Lack of clear strategy",
  "Poor ROI from previous efforts",
  "Internal team coordination"
];

const DIRECT_GOALS = [
  "Brand Awareness",
  "Lead Generation", 
  "Sales / Bookings",
  "Social Growth",
  "App Downloads",
  "Website Traffic",
  "Event Promotion"
];

const DIRECT_PLATFORMS = [
  "Instagram", 
  "TikTok", 
  "YouTube", 
  "LinkedIn", 
  "Facebook", 
  "Website", 
  "Print Media",
  "Other"
];

const DIRECT_TIMELINES = [
  "ASAP (Rush)",
  "Within 1 week",
  "Within 2 weeks", 
  "Within 1 month",
  "Within 2 months",
  "I'm flexible"
];

const DIRECT_BUDGETS = [
  "Under $1,500",
  "$1,500 - $3,000",
  "$3,000 - $7,500", 
  "$7,500 - $15,000",
  "$15,000 - $30,000",
  "$30,000+"
];

const initialData = {
  knowsNeeds: "",
  services: [] as string[],
  projectTypes: [] as string[],
  projectSummary: "",
  
  // Business Goals & Challenges
  businessGoals: [] as string[],
  otherBusinessGoal: "",
  mainChallenge: "",
  
  // Current Assets
  currentAssets: [] as string[],
  websiteUrl: "",
  socialPlatforms: "",
  
  // Competition & Value
  competitors: "",
  uniqueValue: "",
  
  // Target Audience Details
  targetAge: "",
  targetGender: "",
  targetLocation: "",
  targetIncome: "",
  targetHobbies: "",
  targetValues: "",
  targetChallenges: "",
  
  // Success Metrics
  successMetrics: [] as string[],
  otherMetric: "",
  
  // New guidance fields
  projectPriorities: [] as string[],
  otherPriority: "",
  brandStageLevel: "",
  decisionFactors: [] as string[],
  previousExperience: "",
  mainConcerns: [] as string[],
  otherConcern: "",
  
  // Direct flow fields
  directGoals: [] as string[],
  directPlatforms: [] as string[],
  directTimeline: "",
  directBudget: "",
  
  // Original fields
  goals: [] as string[],
  kpis: "",
  audience: "",
  languages: "",
  locations: [] as string[],
  isBodrum: false,
  videoTypes: [] as string[],
  videoLengths: "",
  shootDays: "",
  locationsOnShoot: "",
  needScript: false,
  needStoryboard: false,
  needVoiceOver: false,
  needSubtitles: false,
  needDrone: false,
  talentNeeded: false,
  photoTypes: [] as string[],
  photoDeliverables: "",
  platforms: [] as string[],
  postingFrequency: "",
  contentPillars: "",
  adBudget: "",
  brandStage: "",
  brandAssetsNeeded: [] as string[],
  toneOfVoice: "",
  siteType: "",
  pagesCount: "",
  cms: "",
  ecommerce: false,
  integrations: "",
  appPlatforms: [] as string[],
  coreFeatures: "",
  backend: "Supabase",
  auth: true,
  notifications: true,
  startDate: "",
  deadline: "",
  budget: "",
  flexibleOnTimeline: true,
  hasBrandGuide: false,
  referenceLinks: "",
  decisionMakers: "",
  name: "",
  company: "",
  email: "",
  phone: "",
  preferredContact: "Email",
  notes: "",
  consent: false,
};

const STEPS = [
  { id: 0, title: "Let's Start" },
  { id: 1, title: "Services" },
  { id: 2, title: "Business Goals" },
  { id: 3, title: "Project Location" },
  { id: 4, title: "Project Summary" },
  { id: 5, title: "Priority Level" },
  { id: 6, title: "Main Challenge" },
  { id: 7, title: "Current Assets" },
  { id: 8, title: "Brand Stage" },
  { id: 9, title: "Decision Factors" },
  { id: 10, title: "Previous Experience" },
  { id: 11, title: "Main Concerns" },
  { id: 12, title: "Timeline" },
  { id: 13, title: "Contact" },
  { id: 14, title: "Summary" },
];

interface QuoteLightboxProps {
  isOpen: boolean;
  onClose: () => void;
}

function Progress({ step, knowsNeeds }: { step: number; knowsNeeds: string }) {
  // Direkt flow için farklı hesaplama
  let currentStep, totalSteps, stepTitle;
  
  if (knowsNeeds === "clear-idea") {
    if (step === 0) { currentStep = 1; stepTitle = "Let's Start"; }
    else if (step === 100) { currentStep = 2; stepTitle = "Services"; }
    else if (step === 101) { currentStep = 3; stepTitle = "Goals"; }
    else if (step === 102) { currentStep = 4; stepTitle = "Platform"; }
    else if (step === 103) { currentStep = 5; stepTitle = "Timeline"; }
    else if (step === 104) { currentStep = 6; stepTitle = "Budget"; }
    else if (step === 105) { currentStep = 7; stepTitle = "Contact"; }
    else { currentStep = 1; stepTitle = "Let's Start"; }
    totalSteps = 7;
  } else {
    currentStep = step + 1;
    totalSteps = STEPS.length;
    stepTitle = STEPS[step]?.title || "Let's Start";
  }
  
  const pct = (currentStep / totalSteps) * 100;
  
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between text-sm text-neutral-600 mb-3">
        <span className="font-grotesk font-semibold">{stepTitle}</span>
        <span className="font-grotesk">
          Step {currentStep} / {totalSteps}
        </span>
      </div>
      <div className="w-full h-1 bg-neutral-200 rounded-full overflow-hidden">
        <div 
          className="h-1 bg-neutral-900 rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${pct}%` }} 
        />
      </div>
    </div>
  );
}

function Section({ title, children, subtitle, compact, extraCompact }: { title: string; children: React.ReactNode; subtitle?: string; compact?: boolean; extraCompact?: boolean }) {
  if (extraCompact) {
    return (
      <div className="mb-2">
        <div className="min-h-[40px] flex flex-col justify-center text-center mb-3">
          <h3 className="font-ramillas font-bold text-neutral-900 mb-1 text-lg">{title}</h3>
          {subtitle && <p className="font-grotesk text-neutral-600 text-sm">{subtitle}</p>}
        </div>
        <div className="grid gap-4">{children}</div>
      </div>
    );
  }
  
  return (
    <div className={compact ? "mb-4" : "mb-8"}>
      <div className={`${compact ? 'min-h-[60px]' : 'min-h-[80px]'} flex flex-col justify-center text-center ${compact ? 'mb-4' : 'mb-6'}`}>
        <h3 className={`font-ramillas font-bold text-neutral-900 mb-2 ${compact ? 'text-xl' : 'text-2xl'}`}>{title}</h3>
        {subtitle && <p className="font-grotesk text-neutral-600">{subtitle}</p>}
      </div>
      <div className="grid gap-6">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full border-2 transition-all duration-200 font-grotesk font-semibold text-sm ${
        active 
          ? "bg-neutral-900 text-white border-neutral-900" 
          : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

function ColorfulServiceChip({ active, onClick, children, compact = false }: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      } ${
        active 
          ? 'bg-neutral-900 text-white' 
          : 'text-neutral-900 hover:opacity-80'
      }`}
      style={{
        backgroundColor: active ? undefined : '#fffceb'
      }}
    >
      {children}
    </button>
  );
}

function ColorfulLocationChip({ active, onClick, children }: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm ${
        active 
          ? 'bg-neutral-900 text-white' 
          : 'text-neutral-900 hover:opacity-80'
      }`}
      style={{
        backgroundColor: active ? undefined : '#fffceb'
      }}
    >
      {children}
    </button>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input 
          type="checkbox" 
          className="sr-only" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)} 
        />
        <div className={`w-5 h-5 rounded border-2 transition-all duration-200 ${
          checked 
            ? "bg-neutral-900 border-neutral-900" 
            : "bg-white border-neutral-300 group-hover:border-neutral-400"
        }`}>
          {checked && (
            <svg className="w-3 h-3 text-white absolute top-0.5 left-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
      <span className="font-grotesk text-neutral-700">{label}</span>
    </label>
  );
}

function Input({ label, className, compact, ...props }: { label: string; className?: string; compact?: boolean; [key: string]: any }) {
  return (
    <label className={`grid ${compact ? 'gap-1' : 'gap-2'}`}>
      <span className={`font-grotesk font-semibold text-neutral-700 ${compact ? 'text-xs' : ''}`}>{label}</span>
      <input 
        {...props} 
        className={`border-2 border-neutral-300 rounded-xl font-grotesk focus:outline-none focus:border-neutral-900 transition-colors ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'} ${className || ""}`} 
      />
    </label>
  );
}

function Textarea({ label, className, compact, ...props }: { label: string; className?: string; compact?: boolean; [key: string]: any }) {
  return (
    <label className={`grid ${compact ? 'gap-1' : 'gap-2'}`}>
      <span className={`font-grotesk font-semibold text-neutral-700 ${compact ? 'text-xs' : ''}`}>{label}</span>
      <textarea 
        {...props} 
        className={`border-2 border-neutral-300 rounded-xl font-grotesk focus:outline-none focus:border-neutral-900 transition-colors resize-none ${compact ? 'px-3 py-2 text-sm min-h-[60px]' : 'px-4 py-3 min-h-[120px]'} ${className || ""}`} 
      />
    </label>
  );
}

function Select({ label, children, className, ...props }: { label: string; children: React.ReactNode; className?: string; [key: string]: any }) {
  return (
    <label className="grid gap-2">
      <span className="font-grotesk font-semibold text-neutral-700">{label}</span>
      <select 
        {...props} 
        className={`border-2 border-neutral-300 rounded-xl px-4 py-3 font-grotesk focus:outline-none focus:border-neutral-900 transition-colors bg-white ${className || ""}`}
      >
        {children}
      </select>
    </label>
  );
}

function ToggleGroup({ items, value, onChange }: { items: string[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <Chip 
          key={it} 
          active={value.includes(it)} 
          onClick={() => onChange(toggleArray(value, it))}
        >
          {it}
        </Chip>
      ))}
    </div>
  );
}

function toggleArray(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function QuoteLightbox({ isOpen, onClose }: QuoteLightboxProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initialData);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Her açılışta fresh start için localStorage'ı temizle
      if (typeof window !== "undefined") {
        localStorage.removeItem("clientNeedsDraft");
      }
      // Her zaman initialData ile başla
      setData(initialData);
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof window !== "undefined" && isOpen) {
      localStorage.setItem("clientNeedsDraft", JSON.stringify(data));
    }
  }, [data, isOpen]);

  const hasService = (name: string) => data.services.includes(name);

  const brief = useMemo(() => ({
    project: {
      types: data.projectTypes,
      summary: data.projectSummary,
      goals: data.businessGoals,
      otherGoal: data.otherBusinessGoal,
      priorities: data.projectPriorities,
      otherPriority: data.otherPriority,
      mainChallenge: data.mainChallenge,
      locations: data.locations,
      bodrumFocus: data.isBodrum,
    },
    brandInfo: {
      stage: data.brandStageLevel,
      currentAssets: data.currentAssets,
      websiteUrl: data.websiteUrl,
      socialPlatforms: data.socialPlatforms,
    },
    decisionProcess: {
      importantFactors: data.decisionFactors,
      previousExperience: data.previousExperience,
      mainConcerns: data.mainConcerns,
      otherConcern: data.otherConcern,
    },
    services: data.services,
    production: hasService("Film Production") ? {
      videoTypes: data.videoTypes,
      videoLengths: data.videoLengths,
      shootDays: data.shootDays,
      locationsOnShoot: data.locationsOnShoot,
      needScript: data.needScript,
      needStoryboard: data.needStoryboard,
      needVoiceOver: data.needVoiceOver,
      needSubtitles: data.needSubtitles,
      needDrone: data.needDrone,
      talentNeeded: data.talentNeeded,
    } : undefined,
    photography: hasService("Photography") ? {
      photoTypes: data.photoTypes,
      deliverables: data.photoDeliverables,
    } : undefined,
    socialDigital: (hasService("Social Media Management") || hasService("Digital Marketing") || hasService("Videography")) ? {
      platforms: data.platforms,
      postingFrequency: data.postingFrequency,
      contentPillars: data.contentPillars,
      adBudget: data.adBudget,
    } : undefined,
    brand: (hasService("Brand Strategy") || hasService("Branding")) ? {
      brandStage: data.brandStage,
      brandAssetsNeeded: data.brandAssetsNeeded,
      toneOfVoice: data.toneOfVoice,
    } : undefined,
    web: hasService("Web Design") ? {
      siteType: data.siteType,
      pagesCount: data.pagesCount,
      cms: data.cms,
      ecommerce: data.ecommerce,
      integrations: data.integrations,
    } : undefined,
    app: hasService("App Building") ? {
      platforms: data.appPlatforms,
      coreFeatures: data.coreFeatures,
      backend: data.backend,
      auth: data.auth,
      notifications: data.notifications,
    } : undefined,
    budgetTimeline: {
      budget: data.budget,
      startDate: data.startDate,
      deadline: data.deadline,
      flexibleOnTimeline: data.flexibleOnTimeline,
    },
    assets: {
      hasBrandGuide: data.hasBrandGuide,
      referenceLinks: data.referenceLinks,
      competitors: data.competitors,
      decisionMakers: data.decisionMakers,
    },
    contact: {
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      preferredContact: data.preferredContact,
      notes: data.notes,
      consent: data.consent,
    },
  }), [data]);

  function next() {
    // "I know exactly what I need" seçeneği için direkt flow
    if (data.knowsNeeds === "clear-idea") {
      // Direkt flow step sequence: 0 -> 100 -> 101 -> 102 -> 103 -> 104 -> 105
      if (step === 0) setStep(100); // Services
      else if (step === 100) setStep(101); // Goals
      else if (step === 101) setStep(102); // Platform 
      else if (step === 102) setStep(103); // Timeline
      else if (step === 103) setStep(104); // Budget
      else if (step === 104) setStep(105); // Contact
      else setStep((s) => Math.min(s + 1, 105));
    } else {
      // Guidance flow: normal progression
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
    setSelectedService(null);
  }

  function back() {
    // "I know exactly what I need" seçeneği için direkt flow
    if (data.knowsNeeds === "clear-idea") {
      if (step === 105) setStep(104); // Contact -> Budget
      else if (step === 104) setStep(103); // Budget -> Timeline
      else if (step === 103) setStep(102); // Timeline -> Platform
      else if (step === 102) setStep(101); // Platform -> Goals
      else if (step === 101) setStep(100); // Goals -> Services
      else if (step === 100) setStep(0); // Services -> Start
      else setStep((s) => Math.max(s - 1, 0));
    } else {
      // Guidance flow: normal progression
      setStep((s) => Math.max(s - 1, 0));
    }
    setSelectedService(null);
  }

  function downloadBrief() {
    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const projectName = data.services.length > 0 ? data.services[0].toLowerCase().replace(/\s+/g, '-') : "project";
    const companyName = data.company ? data.company.toLowerCase().replace(/\s+/g, '-') : "";
    const filename = companyName ? `${companyName}-${projectName}-brief.json` : `${projectName}-brief.json`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyBrief() {
    navigator.clipboard.writeText(JSON.stringify(brief, null, 2));
  }

  function resetAll() {
    setData(initialData);
    if (typeof window !== "undefined") localStorage.removeItem("clientNeedsDraft");
    setStep(0);
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep(0);
    }, 300);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl h-[60vh] rounded-2xl shadow-2xl mx-4 overflow-hidden">
        {/* Full background image */}
        <img 
          src={STEP_IMAGES[step as keyof typeof STEP_IMAGES]}
          alt="Background"
          className="w-full h-full object-cover absolute inset-0 rounded-2xl"
        />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 transition-colors flex items-center justify-center z-50"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content overlay */}
        <div className="absolute inset-0 flex h-full">
          <div className="w-2/5 p-8 flex flex-col justify-center">
            {step === 1 && selectedService && (
              <div className="text-white">
                <h3 className="font-ramillas text-2xl font-bold mb-4">
                  {SERVICE_DESCRIPTIONS[selectedService as keyof typeof SERVICE_DESCRIPTIONS].title}
                </h3>
                <p className="font-grotesk text-base mb-6 leading-relaxed">
                  {SERVICE_DESCRIPTIONS[selectedService as keyof typeof SERVICE_DESCRIPTIONS].description}
                </p>
                <div className="font-grotesk text-sm leading-relaxed whitespace-pre-line">
                  {SERVICE_DESCRIPTIONS[selectedService as keyof typeof SERVICE_DESCRIPTIONS].examples}
                </div>
              </div>
            )}
          </div>
          <div 
            className="w-3/5 flex flex-col relative rounded-r-2xl"
            style={{
              backgroundColor: '#ebeef8'
            }}
          >
            <div className="flex-1 p-8 pb-24 flex flex-col justify-center overflow-y-auto">
            {step === 0 && (
              <>
                <div className="mb-8 mt-16 text-center">
                  <p className="font-ramillas text-base italic text-neutral-700 mb-4 leading-relaxed">
                    Before we begin, Let's make sure we're<br/>
                    the right fit for your project.
                  </p>
                  <h2 className="font-grotesk text-xl font-bold text-neutral-900 leading-tight tracking-tight">
                    Do you have a clear idea of what you
                    need, or would you like us to guide you?
                  </h2>
                </div>
                
                <div className="space-y-2 mb-10 max-w-sm mx-auto">
                  <button
                    onClick={() => setData({ ...data, knowsNeeds: "clear-idea" })}
                    className={`w-full px-4 py-2.5 font-grotesk font-medium rounded-xl transition-all duration-300 text-center relative hover:opacity-90`}
                    style={{
                      backgroundColor: data.knowsNeeds === "clear-idea" ? '#000000' : '#fffceb',
                      color: data.knowsNeeds === "clear-idea" ? '#fffceb' : '#262626'
                    }}
                  >
                    <div className="font-semibold text-base">I know exactly what I need</div>
                    <div 
                      className="text-xs mt-0.5"
                      style={{
                        color: data.knowsNeeds === "clear-idea" ? '#fffceb' : '#737373'
                      }}
                    >
                      I have specific requirements in mind
                    </div>
                  </button>
                  <button
                    onClick={() => setData({ ...data, knowsNeeds: "need-guidance" })}
                    className={`w-full px-4 py-2.5 font-grotesk font-medium rounded-xl transition-all duration-300 text-center relative hover:opacity-90`}
                    style={{
                      backgroundColor: data.knowsNeeds === "need-guidance" ? '#000000' : '#fffceb',
                      color: data.knowsNeeds === "need-guidance" ? '#fffceb' : '#262626'
                    }}
                  >
                    <div className="font-semibold text-base">I'd like guidance</div>
                    <div 
                      className="text-xs mt-0.5"
                      style={{
                        color: data.knowsNeeds === "need-guidance" ? '#fffceb' : '#737373'
                      }}
                    >
                      Help me figure out what's best
                    </div>
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={next}
                    disabled={!data.knowsNeeds}
                    className={`font-grotesk font-semibold transition-colors flex items-center gap-1 text-sm ${
                      data.knowsNeeds 
                        ? 'text-neutral-800 hover:text-neutral-900' 
                        : 'text-neutral-400 cursor-not-allowed'
                    }`}
                  >
                    Next &gt;
                  </button>
                </div>
              </>
            )}

            {step === 1 && (
              <Section title="What services do you need?" subtitle="Select all that apply">
                <div className="flex flex-wrap gap-3 justify-center">
                  {ALL_SERVICES.map((service) => (
                    <ColorfulServiceChip
                      key={service}
                      active={data.services.includes(service)}
                      onClick={() => {
                        setData({ ...data, services: toggleArray(data.services, service) });
                        setSelectedService(service);
                      }}
                    >
                      {service}
                    </ColorfulServiceChip>
                  ))}
                </div>
              </Section>
            )}

            {step === 2 && (
              <Section title="What are your main business goals?" subtitle="What do you hope to achieve in the next 6-12 months? (Select all that apply)">
                <div className="flex flex-wrap gap-2 justify-center">
                  {BUSINESS_GOALS.map((goal) => (
                    <ColorfulServiceChip
                      key={goal}
                      active={data.businessGoals.includes(goal)}
                      onClick={() => setData({ ...data, businessGoals: toggleArray(data.businessGoals, goal) })}
                      compact={true}
                    >
                      {goal}
                    </ColorfulServiceChip>
                  ))}
                </div>
                {data.businessGoals.includes("Other (Please specify)") && (
                  <div className="mt-3 max-w-xs mx-auto">
                    <Input
                      label=""
                      value={data.otherBusinessGoal}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, otherBusinessGoal: e.target.value })}
                      placeholder="Specify your goal..."
                      className="text-sm py-2"
                    />
                  </div>
                )}
              </Section>
            )}

            {step === 3 && (
              <Section title="Where will this project take place?" subtitle="Select all relevant locations">
                <div className="flex flex-wrap gap-3 justify-center">
                  {LOCATIONS.map((location) => (
                    <ColorfulLocationChip
                      key={location}
                      active={data.locations.includes(location)}
                      onClick={() => setData({ 
                        ...data, 
                        locations: toggleArray(data.locations, location),
                        isBodrum: toggleArray(data.locations, location).includes("Bodrum")
                      })}
                    >
                      {location}
                    </ColorfulLocationChip>
                  ))}
                </div>
                {data.locations.length > 0 && (
                  <div className="mt-6 p-4 bg-white rounded-xl text-center">
                    <p className="font-grotesk text-sm text-neutral-600">
                      <strong>Selected:</strong> {data.locations.join(", ")}
                    </p>
                    {data.isBodrum && (
                      <div className="mt-3">
                        <span className="font-grotesk text-sm text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                          🌊 Bodrum local crew & logistics priority
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </Section>
            )}

            {step === 4 && (
              <Section title="Tell us about your project" subtitle="A brief description helps us understand your vision">
                <div className="max-w-2xl mx-auto">
                  <Textarea 
                    label="Project Summary" 
                    value={data.projectSummary} 
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, projectSummary: e.target.value })} 
                    placeholder="Example: We're launching a new restaurant in Bodrum and need a brand film to showcase our unique atmosphere, plus social media content for the opening campaign..."
                    className="text-center"
                  />
                </div>
              </Section>
            )}

            {step === 5 && (
              <Section title="What's your main priority for this project?" subtitle="Help us understand what matters most to you">
                <div className="flex flex-wrap gap-2 justify-center">
                  {PROJECT_PRIORITIES.map((priority) => (
                    <ColorfulServiceChip
                      key={priority}
                      active={data.projectPriorities.includes(priority)}
                      onClick={() => setData({ ...data, projectPriorities: toggleArray(data.projectPriorities, priority) })}
                      compact={true}
                    >
                      {priority}
                    </ColorfulServiceChip>
                  ))}
                </div>
                {data.projectPriorities.includes("Other priority") && (
                  <div className="mt-3 max-w-xs mx-auto">
                    <Input
                      label=""
                      value={data.otherPriority}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, otherPriority: e.target.value })}
                      placeholder="Specify priority..."
                      className="text-sm py-2"
                    />
                  </div>
                )}
              </Section>
            )}

            {step === 6 && (
              <Section title="What's your biggest challenge?" subtitle="What keeps you up at night or challenges you the most about your business?">
                <div className="max-w-2xl mx-auto">
                  <Textarea 
                    label="Main Business Challenge" 
                    value={data.mainChallenge} 
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, mainChallenge: e.target.value })} 
                    placeholder="Example: We're struggling to reach our target audience online and our current marketing efforts aren't generating enough leads..."
                  />
                </div>
              </Section>
            )}

            {step === 7 && (
              <Section title="What digital assets do you currently have?" subtitle="Select all that apply to understand your starting point">
                <div className="flex flex-wrap gap-2 justify-center">
                  {CURRENT_ASSETS.map((asset) => (
                    <ColorfulServiceChip
                      key={asset}
                      active={data.currentAssets.includes(asset)}
                      onClick={() => setData({ ...data, currentAssets: toggleArray(data.currentAssets, asset) })}
                      compact={true}
                    >
                      {asset}
                    </ColorfulServiceChip>
                  ))}
                </div>
                
                {data.currentAssets.includes("Existing website") && (
                  <div className="mt-3 max-w-xs mx-auto">
                    <Input
                      label=""
                      value={data.websiteUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, websiteUrl: e.target.value })}
                      placeholder="Website URL"
                      className="text-sm py-2"
                    />
                  </div>
                )}
                
                {data.currentAssets.includes("Social media accounts") && (
                  <div className="mt-3 max-w-xs mx-auto">
                    <Input
                      label=""
                      value={data.socialPlatforms}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, socialPlatforms: e.target.value })}
                      placeholder="Social platforms"
                      className="text-sm py-2"
                    />
                  </div>
                )}
              </Section>
            )}

            {step === 8 && (
              <Section title="What stage is your brand at?" subtitle="Help us understand your brand maturity level">
                <div className="flex flex-wrap gap-3 justify-center">
                  {BRAND_STAGES.map((stage) => (
                    <ColorfulServiceChip
                      key={stage}
                      active={data.brandStageLevel === stage}
                      onClick={() => setData({ ...data, brandStageLevel: stage })}
                    >
                      {stage}
                    </ColorfulServiceChip>
                  ))}
                </div>
              </Section>
            )}

            {step === 9 && (
              <Section title="What factors are most important in choosing an agency?" subtitle="Select all that apply">
                <div className="flex flex-wrap gap-2 justify-center">
                  {DECISION_FACTORS.map((factor) => (
                    <ColorfulServiceChip
                      key={factor}
                      active={data.decisionFactors.includes(factor)}
                      onClick={() => setData({ ...data, decisionFactors: toggleArray(data.decisionFactors, factor) })}
                      compact={true}
                    >
                      {factor}
                    </ColorfulServiceChip>
                  ))}
                </div>
              </Section>
            )}

            {step === 10 && (
              <Section title="What's your experience with agencies?" subtitle="This helps us understand how to work best with you">
                <div className="flex flex-wrap gap-2 justify-center">
                  {PREVIOUS_EXPERIENCES.map((experience) => (
                    <ColorfulServiceChip
                      key={experience}
                      active={data.previousExperience === experience}
                      onClick={() => setData({ ...data, previousExperience: experience })}
                      compact={true}
                    >
                      {experience}
                    </ColorfulServiceChip>
                  ))}
                </div>
              </Section>
            )}

            {step === 11 && (
              <Section title="What are your main concerns?" subtitle="What worries you most about this project? (Select all that apply)">
                <div className="flex flex-wrap gap-2 justify-center">
                  {MAIN_CONCERNS.map((concern) => (
                    <ColorfulServiceChip
                      key={concern}
                      active={data.mainConcerns.includes(concern)}
                      onClick={() => setData({ ...data, mainConcerns: toggleArray(data.mainConcerns, concern) })}
                      compact={true}
                    >
                      {concern}
                    </ColorfulServiceChip>
                  ))}
                </div>
                {data.mainConcerns.includes("Other concern") && (
                  <div className="mt-3 max-w-xs mx-auto">
                    <Input
                      label=""
                      value={data.otherConcern}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, otherConcern: e.target.value })}
                      placeholder="Specify concern..."
                      className="text-sm py-2"
                    />
                  </div>
                )}
              </Section>
            )}

            {step === 12 && (
              <Section title="Timeline" subtitle="When do you need this completed?">
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input 
                      type="date" 
                      label="Preferred Start Date" 
                      value={data.startDate} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, startDate: e.target.value })} 
                    />
                    <Input 
                      type="date" 
                      label="Deadline" 
                      value={data.deadline} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, deadline: e.target.value })} 
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    <Checkbox 
                      label="I'm flexible on timeline" 
                      checked={data.flexibleOnTimeline} 
                      onChange={(v) => setData({ ...data, flexibleOnTimeline: v })} 
                    />
                  </div>
                </div>
              </Section>
            )}

            {step === 13 && (
              <Section title="Contact Information" subtitle="How can we reach you?">
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input 
                      label="Full Name" 
                      value={data.name} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, name: e.target.value })} 
                    />
                    <Input 
                      label="Company" 
                      value={data.company} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, company: e.target.value })} 
                    />
                    <Input 
                      type="email" 
                      label="Email" 
                      value={data.email} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, email: e.target.value })} 
                    />
                    <Input 
                      label="Phone / WhatsApp" 
                      value={data.phone} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, phone: e.target.value })} 
                    />
                  </div>
                  <Textarea 
                    label="Additional Notes (optional)" 
                    value={data.notes} 
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, notes: e.target.value })} 
                    placeholder="Anything else we should know about this project?"
                  />
                  <div className="text-center">
                    <Checkbox 
                      label="I agree to be contacted regarding this project" 
                      checked={data.consent} 
                      onChange={(v) => setData({ ...data, consent: v })} 
                    />
                  </div>
                </div>
              </Section>
            )}

            {step === 14 && (
              <Section title="Your Project Brief" subtitle="Review your complete project summary">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-white rounded-xl p-6 mb-6">
                    <div className="grid gap-6">
                      <div>
                        <h4 className="font-ramillas font-bold text-lg text-neutral-900 mb-2">Services & Project Type</h4>
                        <p className="font-grotesk text-neutral-700">
                          <strong>Services:</strong> {data.services.join(", ")}<br/>
                          <strong>Project Type:</strong> {data.projectTypes.join(", ")}<br/>
                          <strong>Location:</strong> {data.locations.join(", ")}
                        </p>
                      </div>
                      {data.projectSummary && (
                        <div>
                          <h4 className="font-ramillas font-bold text-lg text-neutral-900 mb-2">Project Summary</h4>
                          <p className="font-grotesk text-neutral-700">{data.projectSummary}</p>
                        </div>
                      )}
                      {data.goals.length > 0 && (
                        <div>
                          <h4 className="font-ramillas font-bold text-lg text-neutral-900 mb-2">Goals</h4>
                          <p className="font-grotesk text-neutral-700">{data.goals.join(", ")}</p>
                        </div>
                      )}
                      {data.audience && (
                        <div>
                          <h4 className="font-ramillas font-bold text-lg text-neutral-900 mb-2">Target Audience</h4>
                          <p className="font-grotesk text-neutral-700">{data.audience}</p>
                        </div>
                      )}
                      <div>
                        <h4 className="font-ramillas font-bold text-lg text-neutral-900 mb-2">Budget & Timeline</h4>
                        <p className="font-grotesk text-neutral-700">
                          <strong>Budget:</strong> {data.budget || "Not specified"}<br/>
                          {data.startDate && <><strong>Start:</strong> {data.startDate}<br/></>}
                          {data.deadline && <><strong>Deadline:</strong> {data.deadline}<br/></>}
                          {data.flexibleOnTimeline && <span className="text-green-600">Timeline is flexible</span>}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-ramillas font-bold text-lg text-neutral-900 mb-2">Contact</h4>
                        <p className="font-grotesk text-neutral-700">
                          <strong>Name:</strong> {data.name}<br/>
                          {data.company && <><strong>Company:</strong> {data.company}<br/></>}
                          <strong>Email:</strong> {data.email}<br/>
                          {data.phone && <><strong>Phone:</strong> {data.phone}<br/></>}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <button 
                      onClick={copyBrief} 
                      className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-grotesk font-semibold hover:bg-neutral-800 transition-colors"
                    >
                      Copy Brief
                    </button>
                    <button 
                      onClick={downloadBrief} 
                      className="px-6 py-3 border-2 border-neutral-300 rounded-xl font-grotesk font-semibold hover:border-neutral-400 transition-colors"
                    >
                      Download Brief
                    </button>
                  </div>
                </div>
              </Section>
            )}

            {/* DIRECT FLOW STEPS */}
            {step === 100 && (
              <Section title="What services do you need?" subtitle="Select all that apply">
                <div className="flex flex-wrap gap-3 justify-center">
                  {ALL_SERVICES.map((service) => (
                    <ColorfulServiceChip
                      key={service}
                      active={data.services.includes(service)}
                      onClick={() => {
                        setData({ ...data, services: toggleArray(data.services, service) });
                        setSelectedService(service);
                      }}
                    >
                      {service}
                    </ColorfulServiceChip>
                  ))}
                </div>
              </Section>
            )}

            {step === 101 && (
              <Section title="What's your main goal?" subtitle="What do you want to achieve with this project?">
                <div className="flex flex-wrap gap-2 justify-center">
                  {DIRECT_GOALS.map((goal) => (
                    <ColorfulServiceChip
                      key={goal}
                      active={data.directGoals.includes(goal)}
                      onClick={() => setData({ ...data, directGoals: toggleArray(data.directGoals, goal) })}
                    >
                      {goal}
                    </ColorfulServiceChip>
                  ))}
                </div>
              </Section>
            )}

            {step === 102 && (
              <Section title="Where will this be used?" subtitle="Select your target platforms or channels">
                <div className="flex flex-wrap gap-2 justify-center">
                  {DIRECT_PLATFORMS.map((platform) => (
                    <ColorfulServiceChip
                      key={platform}
                      active={data.directPlatforms.includes(platform)}
                      onClick={() => setData({ ...data, directPlatforms: toggleArray(data.directPlatforms, platform) })}
                    >
                      {platform}
                    </ColorfulServiceChip>
                  ))}
                </div>
              </Section>
            )}

            {step === 103 && (
              <Section title="When do you need this?" subtitle="Select your preferred timeline">
                <div className="flex flex-wrap gap-2 justify-center">
                  {DIRECT_TIMELINES.map((timeline) => (
                    <ColorfulServiceChip
                      key={timeline}
                      active={data.directTimeline === timeline}
                      onClick={() => setData({ ...data, directTimeline: timeline })}
                      compact={true}
                    >
                      {timeline}
                    </ColorfulServiceChip>
                  ))}
                </div>
              </Section>
            )}

            {step === 104 && (
              <Section title="What's your budget?" subtitle="Select your budget range">
                <div className="flex flex-wrap gap-2 justify-center">
                  {DIRECT_BUDGETS.map((budget) => (
                    <ColorfulServiceChip
                      key={budget}
                      active={data.directBudget === budget}
                      onClick={() => setData({ ...data, directBudget: budget })}
                      compact={true}
                    >
                      {budget}
                    </ColorfulServiceChip>
                  ))}
                </div>
              </Section>
            )}

            {step === 105 && (
              <div className="flex flex-col h-full">
                <Section title="Contact Information" subtitle="How can we reach you?" extraCompact={true}>
                  <div className="max-w-md mx-auto space-y-3 pb-8">
                    <div className="grid grid-cols-2 gap-3">
                      <Input 
                        label="Name" 
                        value={data.name} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, name: e.target.value })} 
                        compact={true}
                      />
                      <Input 
                        label="Company" 
                        value={data.company} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, company: e.target.value })} 
                        compact={true}
                      />
                    </div>
                    <Input 
                      type="email" 
                      label="Email" 
                      value={data.email} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, email: e.target.value })} 
                      compact={true}
                    />
                    <Input 
                      label="Phone / WhatsApp" 
                      value={data.phone} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, phone: e.target.value })} 
                      compact={true}
                    />
                    <Textarea 
                      label="Notes (optional)" 
                      value={data.notes} 
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setData({ ...data, notes: e.target.value })} 
                      placeholder="Any specific requirements?"
                      compact={true}
                    />
                    <div className="text-center pt-2">
                      <Checkbox 
                        label="I agree to be contacted regarding this project" 
                        checked={data.consent} 
                        onChange={(v) => setData({ ...data, consent: v })} 
                      />
                    </div>
                  </div>
                </Section>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Footer Navigation - only show for steps > 0 */}
        {step > 0 && (
          <div className="absolute bottom-0 right-0 w-3/5">
            <div 
              className="bg-gradient-to-t from-[#ebeef8] via-[#ebeef8] to-transparent h-6"
            ></div>
            <div 
              className="flex items-center justify-between px-12 py-4"
              style={{ backgroundColor: '#ebeef8' }}
            >
              <button 
                onClick={back} 
                className="font-grotesk font-semibold text-neutral-800 hover:text-neutral-900 transition-colors flex items-center gap-1 text-sm"
              >
                &lt; Back
              </button>
              
              {/* Next/Submit button logic */}
              {((data.knowsNeeds === "clear-idea" && step < 105) || (data.knowsNeeds === "need-guidance" && step < STEPS.length - 1)) ? (
                <button 
                  onClick={next} 
                  className="font-grotesk font-semibold text-neutral-800 hover:text-neutral-900 transition-colors flex items-center gap-1 text-sm"
                >
                  Next &gt;
                </button>
              ) : (
                <button 
                  onClick={() => {
                    alert("Thank you! Your project request has been submitted. We'll contact you soon to discuss next steps.");
                    handleClose();
                  }} 
                  className="font-grotesk font-semibold text-neutral-800 hover:text-neutral-900 transition-colors text-sm"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}