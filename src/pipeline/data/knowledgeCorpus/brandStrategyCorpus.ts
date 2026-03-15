export interface KnowledgeEntry {
  id: string;
  title: string;
  author: string;
  source: string;
  category:
    | 'positioning'
    | 'identity'
    | 'growth'
    | 'behavioral'
    | 'narrative'
    | 'digital'
    | 'cultural'
    | 'measurement'
    | 'case_study';
  frameworks: string[];
  sector: string[];
  language: 'en';
  content: string;
  keyPrinciples: string[];
  tags: string[];
}

export const BRAND_STRATEGY_CORPUS: KnowledgeEntry[] = [
  {
    id: 'dunford-positioning-quickstart',
    title: 'A Quickstart Guide to Positioning',
    author: 'April Dunford',
    source: 'aprildunford.com',
    category: 'positioning',
    frameworks: ['Dunford 5-Component Positioning', 'Competitive Alternatives Analysis'],
    sector: [],
    language: 'en',
    content:
      "Positioning defines how your product is a leader at delivering something that a well-defined set of customers cares a lot about. The Five Components: 1) Competitive Alternatives - what customers would do if your solution didn't exist. 2) Unique Attributes - capabilities your offering provides that alternatives lack. 3) Customer Value - translate unique features into tangible benefits. 4) Target Customer Segmentation - identify which buyers care most about your specific value proposition. 5) Market Category - choose the context where your differentiation becomes obvious. Example: A mobile database product initially positioned as 'Microsoft Access killer' had 94/100 customers who didn't remember purchasing. After discovering 6 customers transformed operations using it on mobile devices, repositioned as 'Embeddable Database for Mobile Devices' — massive growth, acquired for hundreds of millions. Trap 1: Misdefining competitive alternatives — don't list every theoretically possible competitor, focus on actual alternatives customers consider. Trap 2: Forcing new category creation — 90% of recently public tech companies positioned in existing markets.",
    keyPrinciples: [
      'Start with competitive alternatives, not your own features',
      "Positioning is context-setting, like a movie's opening scene",
      'All five components are interdependent',
      'Test with prospects, iterate if results disappoint',
      'Being first to market ≠ being first in the mind',
    ],
    tags: ['positioning', 'differentiation', 'competitive-analysis', 'B2B', 'SaaS'],
  },
  {
    id: 'ries-trout-positioning',
    title: 'Positioning: The Battle for Your Mind',
    author: 'Al Ries & Jack Trout',
    source: 'Book Summary',
    category: 'positioning',
    frameworks: ['Positioning Ladder', 'Own a Word', 'Line Extension Trap'],
    sector: [],
    language: 'en',
    content:
      "Positioning is about what exists in the prospect's mind, not market reality. Three eras: Product Era (1950s features), Image Era (reputation), Positioning Era (first-mover in mind). Products occupy a mental ladder — top rung is category leader. To topple a leader requires repositioning THEM, not promoting your superiority. Avis 'We try harder' worked because it repositioned Hertz as complacent. Leader Strategy: expand the entire category rather than attack competitors. Follower Strategy: find something to be first in — smaller may be better. Own a word in the mind. The Line Extension Trap: adding brand name to new products dilutes positioning. Xerox = copiers; Xerox computers = confusion. Six Questions: 1) Current position? 2) Desired position? 3) Competition? 4) Sufficient budget? 5) Long-term commitment? 6) Does everything align? Core insight: The best positioning looks inevitable in hindsight but requires courage to implement.",
    keyPrinciples: [
      "Positioning originates in customer's mind, not yours",
      "Own a specific word in the prospect's mind",
      'Avoid head-to-head combat with leaders',
      'Line extensions dilute brand meaning',
      'Simplicity and focus win',
      'Smaller niches you own beat bigger markets you share',
    ],
    tags: ['positioning', 'mind-share', 'category-leadership', 'line-extension'],
  },
  {
    id: 'neumeier-brand-gap-zag',
    title: 'The Brand Gap & Zag: Radical Differentiation',
    author: 'Marty Neumeier',
    source: 'Book Summary',
    category: 'positioning',
    frameworks: ['Onlyness Test', 'Zag Framework', 'Swap Test', 'Hand Test'],
    sector: [],
    language: 'en',
    content:
      "A brand is a customer's gut feeling about a product, service, or company. Charismatic brands — where customers believe there's no substitute — command premium prices. The Onlyness Test: 'Our [offering] is the only [category] that [benefit].' Extended: WHAT (category), HOW (differentiation), WHO (audience), WHERE (geography), WHY (need state), WHEN (trend). Trueline vs Tagline: trueline is internal truth (Nike: helps find inner athlete), tagline is public expression ('Just do it'). Radical differentiation: when everybody zigs, zag. Four components: Purpose, Vision, Trend, Zag. Pick an enemy — define what you're against. Brand tests: Swap Test (replace brand name with competitor — if not worse, improve), Hand Test (cover trademark — can audience still identify you?). Five naming criteria: Distinctiveness, Brevity (4 syllables max), Appropriateness, Pronounceability, Extendibility.",
    keyPrinciples: [
      "Brand = customer's gut feeling, not your logo",
      'Onlyness is the most powerful test of strategic position',
      "You can't advertise your way to onlyness — start with it",
      "If you can't say why you're different in a few words, fix your company",
      'Pick an enemy — the old way of doing things',
    ],
    tags: ['differentiation', 'onlyness', 'brand-testing', 'naming'],
  },
  {
    id: 'aaker-brand-vision',
    title: "David Aaker's Brand Vision Model",
    author: 'David Aaker / Rob Meyerson',
    source: 'howbrandsarebuilt.com',
    category: 'identity',
    frameworks: ['Brand Vision Model', 'Four Perspectives', 'Core vs Extended Identity'],
    sector: [],
    language: 'en',
    content:
      "Aaker developed this model in 1995. Three-Circle Structure: Brand Essence (center) — single internally-focused thought. Core Vision Elements (inner) — 2-5 most central and differentiating attributes. Extended Vision Elements (outer) — 6-12 total elements adding texture. Four Perspectives: 1) Brand-as-Product (functional), 2) Brand-as-Organization (values, culture), 3) Brand-as-Person (personality, relationship), 4) Brand-as-Symbol (visual imagery, heritage). Each perspective has multiple element categories (12 total) — not all must be filled. Brand Personality 5 Dimensions (Jennifer Aaker): Sincerity, Excitement, Competence, Sophistication, Ruggedness — these 5 explain 92% of variance. Brand Essence example: Disneyland = 'Family Magic', Panasonic = 'Ideas for Life'. The model avoids rigid fill-in-the-box approaches — elements included only when relevant.",
    keyPrinciples: [
      'Brands have multiple dimensions, not a single message',
      'Core identity is 2-5 most differentiating attributes',
      'Brand essence is internal inspiration, not tagline',
      'Four perspectives ensure comprehensive thinking',
      'Flexibility > rigid templates',
    ],
    tags: ['brand-identity', 'personality', 'brand-essence', 'four-perspectives'],
  },
  {
    id: 'kapferer-identity-prism',
    title: 'The Brand Identity Prism',
    author: 'Jean-Noel Kapferer',
    source: 'howbrandsarebuilt.com',
    category: 'identity',
    frameworks: ['Brand Identity Prism', 'Six Facets'],
    sector: [],
    language: 'en',
    content:
      "Created in 1996. Six interconnected facets: 1) Physique — visual/physical characteristics (iPhone minimalist design). 2) Personality — brand character (Coca-Cola: happiness). 3) Culture — foundational values (Ferrari: Italian luxury, Toyota: heijunka). 4) Self-Image — how customers see themselves through the brand (BMW: 'Don't Postpone Joy'). 5) Reflection — stereotypical audience in advertising (soft drinks: youthful teens). 6) Relationship — connection type (BMW: serious-yet-playful). External facets (Physique, Relationship, Reflection) are visible; Internal facets (Personality, Culture, Self-image) are within the brand's spirit. Sender side (Physique, Personality) = how brand presents itself. Receiver side (Reflection, Self-Image) = how customers see themselves. Strength comes from alignment across all six facets.",
    keyPrinciples: [
      'Six facets must align coherently',
      'External vs Internal dimensions both matter',
      'Culture is often underestimated but foundational',
      'Self-Image is how customers see themselves through you',
      "Reflection is NOT your actual audience — it's the projected image",
    ],
    tags: ['brand-identity', 'prism', 'culture', 'self-image', 'personality'],
  },
  {
    id: 'keller-cbbe-pyramid',
    title: 'Customer-Based Brand Equity Pyramid',
    author: 'Kevin Lane Keller',
    source: 'Multiple academic sources',
    category: 'measurement',
    frameworks: ['CBBE Pyramid', 'Brand Resonance Model'],
    sector: [],
    language: 'en',
    content:
      'Four-level pyramid: 1) Identity/Salience (foundation) — how easily and often brand is recalled. 2) Meaning — Performance (functional needs) + Imagery (psychological/social needs). 3) Response — Judgments (quality, credibility, superiority) + Feelings (warmth, fun, excitement, security, social approval, self-respect). 4) Resonance (pinnacle) — Loyalty (behavioral repeat purchase) + Attachment (love it) + Community (sense of belonging) + Engagement (active advocacy). Building blocks must be sequential — can\'t skip levels. Salience is prerequisite for everything. Brand equity is customer-based when customer responds more favorably to a product when brand is identified vs when it is not.',
    keyPrinciples: [
      'Brand equity lives in customer perceptions',
      'Must build sequentially — no shortcuts',
      'Salience (awareness) is the foundation',
      'Performance + Imagery create meaning',
      'Resonance = loyalty + attachment + community + engagement',
    ],
    tags: ['brand-equity', 'measurement', 'pyramid', 'resonance', 'salience'],
  },
  {
    id: 'byron-sharp-brands-grow',
    title: 'How Brands Grow: Mental Availability & CEPs',
    author: 'Byron Sharp / Jenni Romaniuk',
    source: 'Ehrenberg-Bass Institute',
    category: 'growth',
    frameworks: ['Mental Availability', 'Category Entry Points', 'Distinctive Brand Assets'],
    sector: [],
    language: 'en',
    content:
      'Mental availability = probability a buyer will notice, recognize, or think of a brand in buying situations. Category Entry Points (CEPs) are all thoughts/motives that trigger category purchase — the why, when, where, with whom, with what. More CEPs connected to brand = higher chance of being bought. Five CEP dimensions: Why (motivations), When (timing), Where (locations), With Whom (social contexts), With What (complementary). Distinctive Brand Assets = non-brand-name elements (colors, characters, sounds, shapes) people associate with brand. For growth: reach more buyers (penetration) rather than increasing frequency. Emotional campaigns are twice as efficient as rational. Share of Voice must exceed Share of Market to grow. The 60/40 rule (Binet & Field): 60% brand building, 40% activation. Fame campaigns report the greatest profit growth.',
    keyPrinciples: [
      'Growth comes from penetration, not loyalty',
      'Connect brand to more Category Entry Points',
      'Distinctive assets build mental availability',
      'Emotional advertising is 2x more efficient than rational',
      'SOV must exceed SOM to grow',
      '60% brand building, 40% activation',
    ],
    tags: ['growth', 'mental-availability', 'CEPs', 'distinctive-assets', 'penetration'],
  },
  {
    id: 'binet-field-long-short',
    title: 'The Long and the Short of It',
    author: 'Les Binet & Peter Field',
    source: 'IPA Effectiveness Awards',
    category: 'measurement',
    frameworks: ['60/40 Rule', 'SOV Theory', 'Fame Campaigns'],
    sector: [],
    language: 'en',
    content:
      'Analysis of 996 IPA campaigns (1980-2010). 8 key findings: 1) Optimal budget: 60% brand building, 40% activation. 2) Emotional campaigns are 2x as likely for top-box profit growth. 3) Campaign duration matters — effects compound over time. 4) Penetration (new customers) drives 3x more business effects than retention. 5) Broad reach beats narrow targeting. 6) High-salience campaigns doubled success likelihood. 7) SOV is the most important driver of long-term growth — brands with SOV > SOM tend to grow, those below shrink. 8) Fame campaigns report greatest profit growth across all metrics. Long-term investment delivers double the profit of short-term. Brand building effects accumulate and create pricing power, while activation creates immediate but temporary sales spikes.',
    keyPrinciples: [
      '60% brand building, 40% activation is optimal',
      'Emotional beats rational 2:1 in profit impact',
      'Penetration trumps loyalty 3:1',
      'SOV > SOM = growth; SOV < SOM = decline',
      'Fame campaigns deliver the greatest profit',
      'Long-term investment = double the profit',
    ],
    tags: ['effectiveness', 'measurement', 'budget-allocation', 'SOV', 'emotional-advertising'],
  },
  {
    id: 'fogg-behavior-map',
    title: 'Fogg Behavior Model: B = MAP',
    author: 'BJ Fogg',
    source: 'behaviormodel.org / Stanford',
    category: 'behavioral',
    frameworks: ['B=MAP', 'Tiny Habits', 'Simplicity Factors'],
    sector: [],
    language: 'en',
    content:
      'Behavior = Motivation x Ability x Prompt. When behavior doesn\'t occur, at least one element is missing. Motivation: three core motivators — sensation (physical), anticipation (emotional), belonging (social). Ability: six factors — time, money, physical effort, mental effort (brain cycles), social deviance, non-routine. Prompt types: Spark (boosts low motivation), Facilitator (makes easier when ability is low), Signal (simple reminder when both are high). Key insight: motivation and ability trade off — if one is low, the other must rise. Design principle: make target behavior EASY before trying to motivate. Reduce friction before adding incentives. When designing action plans: assess each action on M, A, P separately. If M and A are both below threshold, shrink the action until it passes.',
    keyPrinciples: [
      'Behavior requires all three: Motivation, Ability, Prompt',
      'Make it easy before trying to motivate',
      'Motivation and ability trade off',
      'Spark for low motivation, Facilitator for low ability',
      "Shrink the action until it's achievable",
    ],
    tags: ['behavioral-science', 'habit-design', 'motivation', 'action-design'],
  },
  {
    id: 'cialdini-persuasion-7',
    title: 'The 7 Principles of Persuasion',
    author: 'Robert Cialdini',
    source: 'Multiple marketing applications',
    category: 'behavioral',
    frameworks: ['7 Principles of Influence', 'Ethical Persuasion'],
    sector: [],
    language: 'en',
    content:
      "Seven principles: 1) Reciprocity — give first, then ask. Disabled American Veterans doubled contribution rates by including personalized address labels. 2) Commitment/Consistency — small steps lead to big commitments. Newsletter → demo → purchase. 3) Social Proof — people follow what others do when uncertain. 4) Authority — expert endorsement holds credibility. Knowledge of product, field, trends. 5) Liking — we buy from people we like. Similarity creates liking, compliments create liking. 6) Scarcity — limited availability increases desire. Must be genuine. 7) Unity — 'we are the same tribe' shared identity. Ethical guardrails: scarcity claims must be real, social proof must be verifiable, authority must be genuine. The boundary between persuasion and manipulation: persuasion informs and helps good decisions, manipulation exploits and hides information.",
    keyPrinciples: [
      'Give before asking (reciprocity)',
      'Small commitments lead to big ones',
      'People follow the crowd when uncertain',
      'Genuine authority trumps self-proclaimed expertise',
      'Scarcity must be real, not manufactured',
      'Unity/belonging is the newest and most powerful principle',
    ],
    tags: ['persuasion', 'behavioral-science', 'ethics', 'messaging'],
  },
  {
    id: 'eyal-hook-model',
    title: 'The Hooked Model: Manufacturing Desire',
    author: 'Nir Eyal',
    source: 'nirandfar.com',
    category: 'behavioral',
    frameworks: ['Hook Model', 'Variable Reward Types', 'Internal vs External Triggers'],
    sector: ['tech', 'digital'],
    language: 'en',
    content:
      'Four-phase cycle: 1) Trigger — external (emails, ads, notifications) or internal (emotions, routines). Goal: transition from external to internal triggers. 2) Action — behavior in anticipation of reward. Leverage motivation + ability to increase likelihood. Reduce friction. 3) Variable Reward — unpredictable feedback creates desire. Three types: Tribe (social validation), Hunt (gaining resources/info), Self (mastery, completion). Predictable rewards don\'t create desire — variability is key. 4) Investment — effort that strengthens the habit loop. Time, data, social capital. Investment improves the service for next cycle. Each complete pass reinforces the habit. Companies with internal triggers eliminate marketing dependency. Ethical note: habits can enhance lives or exploit into addictions — designers must choose.',
    keyPrinciples: [
      'Internal triggers are more powerful than external',
      'Variable rewards drive compulsive engagement',
      'Investment creates switching costs and personalization',
      'Each cycle reinforces the next',
      'Design for habit, not just transaction',
    ],
    tags: ['habit-design', 'product', 'engagement', 'variable-reward', 'tech'],
  },
  {
    id: 'miller-storybrand-sb7',
    title: 'StoryBrand 7-Part Framework',
    author: 'Donald Miller',
    source: 'storybrand.com',
    category: 'narrative',
    frameworks: ['SB7 Framework', 'Hero-Guide Dynamic'],
    sector: [],
    language: 'en',
    content:
      "Seven steps: 1) Character (Hero = Customer) — define what your customer WANTS. 2) Problem — external problem (practical), internal problem (emotional), philosophical problem ('this shouldn't be'). 3) Guide (your brand) — two qualities: Empathy (understand their pain) + Authority (expertise to solve). 4) Plan — step-by-step process to work with you (removes fear). 5) Call to Action — direct ('Buy Now') or transitional ('Download Guide'). 6) Success — paint the picture of life after your solution. 7) Failure — what happens without your solution (stakes). Core insight: your business is NOT the hero. The customer is. You are the guide. Empathy + Authority = trust. The villain is the problem, not competitors. Every human being wakes up and sees themselves as the hero of a story — brands that recognize this win.",
    keyPrinciples: [
      'Customer is the hero, brand is the guide',
      'Three levels of problem: external, internal, philosophical',
      'Guide needs empathy AND authority',
      'Plan removes fear and clarifies next steps',
      'Show both success and failure — stakes matter',
    ],
    tags: ['storytelling', 'narrative', 'brand-messaging', 'hero-journey'],
  },
  {
    id: 'godin-this-is-marketing',
    title: 'This is Marketing: Smallest Viable Audience',
    author: 'Seth Godin',
    source: 'Book Notes',
    category: 'positioning',
    frameworks: ['Smallest Viable Audience', 'Permission Marketing', 'Status Roles'],
    sector: [],
    language: 'en',
    content:
      "Marketing is about change — finding the smallest viable audience, understanding their worldview, creating something they'll be proud to spread. Five steps: 1) Invent something worth making. 2) Design for a specific small group. 3) Craft narratives matching their dreams. 4) Spread through aligned channels. 5) Show up consistently for years. 'People like us do things like this' — tribal identity drives decisions. We sell feelings, status, and connection, not tasks or stuff. Permission Marketing: earn the right to continue conversations. Brand test: if you disappeared, would people care? Two-attribute strategy: find two overlooked characteristics and claim the extreme position. Story architecture: Story of Self (your journey), Story of Us (belonging), Story of Now (urgency).",
    keyPrinciples: [
      'Smallest viable audience, not biggest possible reach',
      'People like us do things like this',
      'We sell feelings, status, connection — not products',
      'Permission > interruption',
      'If you disappeared, would anyone care?',
    ],
    tags: ['positioning', 'audience', 'permission', 'tribal', 'storytelling'],
  },
  {
    id: 'sutherland-alchemy',
    title: 'Alchemy: The Psychology of Irrational Marketing',
    author: 'Rory Sutherland',
    source: 'lennysnewsletter.com / Ogilvy',
    category: 'behavioral',
    frameworks: ['MAYA Principle', 'Psycho-logical Thinking', 'Controlled Irrationality'],
    sector: [],
    language: 'en',
    content:
      "Psychology over logic — apply how people actually make choices, not how economists predict. MAYA Principle: Most Advanced Yet Acceptable — balance novelty with familiarity. Distinctiveness matters — small idiosyncrasies create memorability. 'The right amount of weird' differentiates without alienating. Less functionality can be better. Fame changes everything — from outbound to inbound. Seriousness can backfire — 'the urge to appear serious is a disaster in marketing.' Key insight: 'People don't think what they feel, don't say what they think, and don't do what they say.' The opposite of a good idea can be another good idea. Both high-touch and no-touch hotel check-ins can work. Think from first principles — question inherited assumptions. Marketing requires understanding human psychology's complexity — contradictions, non-rational preferences, need for meaning beyond utility.",
    keyPrinciples: [
      'Psychology over logic in all decisions',
      'MAYA: Most Advanced Yet Acceptable',
      'The right amount of weird creates distinctiveness',
      'Fame is a multiplier across all business',
      'The opposite of a good idea can be another good idea',
    ],
    tags: ['behavioral-science', 'irrationality', 'distinctiveness', 'fame'],
  },
  {
    id: 'holt-cultural-branding',
    title: 'Cultural Branding: How Brands Become Icons',
    author: 'Douglas Holt',
    source: 'culturalstrategygroup.com',
    category: 'cultural',
    frameworks: ['Cultural Branding', 'Identity Myths', 'Cultural Contradictions'],
    sector: [],
    language: 'en',
    content:
      "Cultural branding: brands advance an ideology that resolves a profound cultural tension at a particular historical moment, using content from subcultural materials. Four steps: 1) Brand advances an ideology. 2) That resolves a profound cultural tension. 3) At a particular moment in history due to societal shifts. 4) Via content from subcultural source materials. Key axioms: Cultural Contradictions — iconic brands address acute societal contradictions. Identity Myths — brands develop imaginary worlds offering escape, allowing consumers to reduce identity burden. Populist Worlds — myths operate at margins where intrinsically motivated people remain unaffected by mainstream. Activist Performance — iconic brands lead culture, enabling consumers to think differently about themselves. Breakthrough Over Consistency — success relies on precisely timed masterful performances, not regular communications. Creates 'cultural halo effect' enhancing perceived quality.",
    keyPrinciples: [
      'Brands resolve cultural tensions, not just functional needs',
      'Identity myths offer escape from everyday reality',
      'Source materials come from subcultures, not mainstream',
      'Breakthrough moments > consistent messaging',
      'Cultural contradictions are the fuel for iconic brands',
    ],
    tags: ['cultural-branding', 'identity-myths', 'ideology', 'subculture'],
  },
  {
    id: 'pollard-four-points',
    title: 'The Four Points Strategy Framework',
    author: 'Mark Pollard',
    source: 'Sweathead',
    category: 'positioning',
    frameworks: ['Four Points Strategy', 'Human Problem-Insight-Advantage-Strategy'],
    sector: [],
    language: 'en',
    content:
      "Four Points Framework: 1) Human Problem — what makes life slightly worse. No human tension, no campaign. 2) Insight — not a data point, it's a 'why'. Explains why people do what they do. 3) Advantage — what your brand has that fixes the specific friction. Must be a specific tool. 4) Strategy — connects Problem, Insight, and Advantage into a single aggressive sentence. A marching order for the creative team. To get good at strategy: start with words, continue with words, finish with words. Strategy is making meaning from mess. Words do this.",
    keyPrinciples: [
      'No human tension = no campaign',
      "Insight is a 'why', not a data point",
      'Advantage must specifically fix the identified friction',
      'Strategy = one aggressive sentence connecting all three',
      'Strategy is making meaning from mess',
    ],
    tags: ['strategy', 'creative-brief', 'insight', 'advertising'],
  },
  {
    id: 'brandstruck-top10-cases',
    title: 'Top 10 Brand Case Studies Every Strategist Should Know',
    author: 'BrandStruck',
    source: 'brandstruck.co',
    category: 'case_study',
    frameworks: ['Brand Architecture', 'Purpose Branding', 'Repositioning'],
    sector: [],
    language: 'en',
    content:
      "1) Apple — ecosystem architecture, high lock-in. 2) Red Bull — created energy drink category through extreme sports culture. 3) Dove — 'Campaign for Real Beauty' emotional repositioning, 700% sales boost in some markets. 4) Aviva — phased rebranding, awareness restored in 3 months. 5) Tropicana — FAILED redesign, 20% sales drop in 2 months by removing distinctive assets. Key lesson: protect distinctive assets in FMCG. 6) Amazon — successful brand stretch across unrelated categories using sub-brands. 7) P&G — house of brands, 80 independent brands competing same categories, 19% vs Unilever 10% margin. 8) IKEA — 'better everyday life for many people' as guiding principle permeating everything. 9) Patagonia — authentic purpose at business core, not marketing tactic. 10) Microsoft — repositioned around cloud/AI, brand value $61B → $352.5B (2014-2024). Key lessons: brand extensions reinforce umbrella brand, purpose only works at business core, rebranding requires budget + leadership + employee buy-in.",
    keyPrinciples: [
      'Protect distinctive brand assets (Tropicana lesson)',
      'Purpose must be at business core, not marketing tactic',
      'Brand extensions should reinforce, not dilute',
      'Category creation requires cultural positioning',
      'Leadership drives substantive brand transformation',
    ],
    tags: ['case-study', 'brand-architecture', 'repositioning', 'purpose'],
  },
];
