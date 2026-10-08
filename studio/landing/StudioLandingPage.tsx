import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SignInDialog from './SignInDialog';
import './studioLanding.css';

const CoreScene = lazy(() => import('./CoreScene'));

const ACCESS_MAIL = 'mailto:info@intiba.co.uk?subject=Studio%20access';

const STEPS = [
  {
    title: 'Diagnose',
    body: 'Agents read the brand, its competitors and its digital footprint. A challenger agent argues against the findings, and a simulated consumer panel tests them before anyone calls it insight.',
    detail: 'Sector research, perceptual maps, friction analysis, competitor discovery.',
  },
  {
    title: 'Strategy',
    body: 'Positioning, category entry points and a roadmap, built on eight marketing frameworks instead of a blank prompt. Nothing runs until you approve the strategy.',
    detail: 'Byron Sharp, Aaker, Keller, Blue Ocean and four more, tuned by sector.',
  },
  {
    title: 'Present',
    body: 'The strategy becomes something a client can feel: a cinematic showcase and a proposal page, written from the same analysis.',
    detail: 'Showcases, proposals and share links your client opens without an account.',
  },
  {
    title: 'Execute',
    body: 'Organic and paid from the same brief. Weekly content plans with captions in the brand’s voice, and Meta campaigns with audiences, creative and budget.',
    detail: 'Content calendar, client approvals, campaign builder, A/B tests.',
  },
  {
    title: 'Learn',
    body: 'Every morning at nine, agents review performance and suggest changes. Automation rules watch budgets, competitor ads are tracked, and client revisions are kept on record.',
    detail: 'Daily optimisation, budget alerts, ad library monitoring.',
  },
];

const FRAMEWORKS = [
  ['Category Entry Points', 'Which buying moments the brand should own'],
  ['Aaker Brand Identity', 'What the brand stands for beyond the product'],
  ['Keller CBBE', 'How awareness turns into loyalty'],
  ['Blue Ocean', 'Where competitors are not looking'],
  ['Cialdini', 'Which persuasion levers fit this audience'],
  ['Fogg Behavior Model', 'Where motivation, ability or the prompt breaks down'],
  ['Hook Model', 'How a habit forms around the product'],
  ['Kano', 'What delights customers and what they simply expect'],
];

const SECTORS = 'gastronomy, hospitality, retail, FMCG, health, education, tech, showrooms and corporate';

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

const useMedia = (query: string) => {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
};

/* ------------------------------ Onay demosu ------------------------------ */

const AdDecision: React.FC = () => {
  const [state, setState] = useState<'waiting' | 'approved' | 'rejected'>('waiting');
  return (
    <article className="sl-demo" aria-live="polite">
      <header className="sl-demo-head">
        <span className="sl-who is-agent">Campaign agent</span>
        <span className="sl-channel">Meta Ads</span>
      </header>
      <p className="sl-demo-title">Move ₺1,200 a day from “Broad, Turkey” to “Lookalike 2%”.</p>
      <p className="sl-demo-why">The lookalike set brought cost per lead down 31% over the last seven days. The broad set has not converted since Tuesday.</p>
      <dl className="sl-demo-meta">
        <div>
          <dt>Budget change</dt>
          <dd>−₺1,200 / +₺1,200</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>Reversible</dd>
        </div>
      </dl>
      {state === 'waiting' ? (
        <div className="sl-demo-actions">
          <button className="sl-btn is-human" onClick={() => setState('approved')}>
            Approve change
          </button>
          <button className="sl-btn is-quiet" onClick={() => setState('rejected')}>
            Reject
          </button>
        </div>
      ) : (
        <div className={`sl-demo-result is-${state}`}>
          {state === 'approved'
            ? 'Approved by you. The budget moves at midnight.'
            : 'Rejected. The agent keeps both budgets as they are.'}
          <button className="sl-link" onClick={() => setState('waiting')}>
            Undo
          </button>
        </div>
      )}
    </article>
  );
};

const POST_STAGES = ['Drafted by agent', 'Reviewed by you', 'Approved by client'];

const PostDecision: React.FC = () => {
  const [stage, setStage] = useState(1);
  return (
    <article className="sl-demo" aria-live="polite">
      <header className="sl-demo-head">
        <span className="sl-who is-agent">Content agent</span>
        <span className="sl-channel">Instagram carousel, Thursday</span>
      </header>
      <div className="sl-post">
        <div className="sl-post-media" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="sl-post-caption">
          Hand-blown in Istanbul, one breath at a time. Three shapes, made for the table you actually use.
        </p>
      </div>
      <ol className="sl-track">
        {POST_STAGES.map((s, i) => (
          <li key={s} className={i < stage ? 'is-done' : i === stage ? 'is-now' : ''}>
            {s}
          </li>
        ))}
      </ol>
      <div className="sl-demo-actions">
        {stage === 1 && (
          <button className="sl-btn is-human" onClick={() => setStage(2)}>
            Approve and send to client
          </button>
        )}
        {stage === 2 && (
          <>
            <button className="sl-btn is-human" onClick={() => setStage(3)}>
              Simulate client approval
            </button>
            <button className="sl-btn is-quiet" onClick={() => setStage(1)}>
              Take back for revision
            </button>
          </>
        )}
        {stage === 3 && (
          <div className="sl-demo-result is-approved">
            Ready to publish. Editing is locked until someone takes it back for revision.
            <button className="sl-link" onClick={() => setStage(1)}>
              Start over
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

/* ------------------------------ Sayfa ------------------------------ */

const StudioLandingPage: React.FC = () => {
  const [active, setActive] = useState(-1);
  const [signInOpen, setSignInOpen] = useState(false);
  const openSignIn = useCallback(() => setSignInOpen(true), []);
  const closeSignIn = useCallback(() => setSignInOpen(false), []);
  const [webgl] = useState(hasWebGL);
  const mobile = useMedia('(max-width: 760px)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Studio by intiba';
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const lane = Number((e.target as HTMLElement).dataset.lane);
          setActive(lane);
        });
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    if (heroRef.current) io.observe(heroRef.current);
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="sl-root">
      <nav className="sl-nav" aria-label="Studio">
        <Link to="/" className="sl-wordmark">
          intiba <strong>Studio</strong>
        </Link>
        <div className="sl-nav-actions">
          <a href={ACCESS_MAIL} className="sl-nav-link">
            Request access
          </a>
          <button type="button" className="sl-btn is-ink is-small" onClick={openSignIn}>
            Sign in
          </button>
        </div>
      </nav>

      <div className="sl-stage">
        <div className="sl-canvas" aria-hidden="true">
          {webgl ? (
            <Suspense fallback={<div className="sl-fallback" />}>
              <CoreScene active={active} mobile={mobile} reduced={reduced} />
            </Suspense>
          ) : (
            <div className="sl-fallback" />
          )}
        </div>

        <header className="sl-hero" ref={heroRef} data-lane={-1}>
          <h1 className="sl-h1">
            Agents run your marketing.
            <br />
            You sign off.
          </h1>
          <p className="sl-lede">
            Studio diagnoses a brand, writes its strategy and runs it across content and paid ads. Thirty agents share one
            brand memory, and nothing reaches a client or a budget until a person approves it.
          </p>
          <div className="sl-cta">
            <a href={ACCESS_MAIL} className="sl-btn is-cobalt">
              Request access
            </a>
            <a href="#how" className="sl-btn is-quiet">
              See how it works
            </a>
          </div>
          <p className="sl-legend">
            <span className="sl-dot is-agent" /> Agent work
            <span className="sl-dot is-human" /> Approved by a person
          </p>
        </header>

        <section id="how" className="sl-steps" aria-label="How Studio works">
          {STEPS.map((s, i) => (
            <article
              key={s.title}
              className={`sl-step${active === i ? ' is-active' : ''}`}
              data-lane={i}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
            >
              <div className="sl-step-copy">
                <p className="sl-step-index">
                  Step {i + 1} of {STEPS.length}
                </p>
                <h2 className="sl-h2">{s.title}</h2>
                <p className="sl-step-body">{s.body}</p>
                <p className="sl-step-detail">{s.detail}</p>
              </div>
            </article>
          ))}
        </section>
      </div>

      <section className="sl-gate" aria-labelledby="gate-title">
        <div className="sl-gate-intro">
          <h2 id="gate-title" className="sl-h2">
            Agents propose. People decide.
          </h2>
          <p>
            Every move that spends money or speaks for a brand stops at a person. New campaigns, ad sets and ads are
            created paused. A post goes to the client only after someone on your team approves it, and an approved post
            is locked against edits. Try it.
          </p>
        </div>
        <div className="sl-demos">
          <AdDecision />
          <PostDecision />
        </div>
      </section>

      <section className="sl-frameworks" aria-labelledby="fw-title">
        <div className="sl-fw-intro">
          <h2 id="fw-title" className="sl-h2">
            Strategy with a method behind it.
          </h2>
          <p>
            The strategy agents don’t improvise. Each analysis runs through established marketing models, adjusted for{' '}
            {SECTORS}.
          </p>
        </div>
        <ul className="sl-fw-list">
          {FRAMEWORKS.map(([name, what]) => (
            <li key={name}>
              <span className="sl-fw-name">{name}</span>
              <span className="sl-fw-what">{what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sl-count" aria-label="Studio in numbers">
        <p>
          <span className="is-agent">18</span> agents for diagnosis and strategy.{' '}
          <span className="is-agent">12</span> agents for campaigns. <span className="is-agent">60</span> ad-platform
          tools, <span className="is-human">21 of which wait for a human</span> before they act.
        </p>
      </section>

      <section className="sl-roadmap" aria-labelledby="road-title">
        <h2 id="road-title" className="sl-h3">
          What works today, and what comes next
        </h2>
        <div className="sl-road-cols">
          <div>
            <h3>Working now</h3>
            <ul>
              <li>Brand diagnosis and strategy</li>
              <li>Meta Ads agent with approvals</li>
              <li>Weekly content plans and client sign-off</li>
              <li>Daily performance review</li>
            </ul>
          </div>
          <div>
            <h3>In development</h3>
            <ul>
              <li>One brand voice shared by content and ads</li>
              <li>AI visuals and reels from real product photos</li>
              <li>Scheduled publishing</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="sl-final">
        <h2 className="sl-h1 is-final">Bring Studio to your brand.</h2>
        <div className="sl-cta">
          <a href={ACCESS_MAIL} className="sl-btn is-cobalt">
            Request access
          </a>
          <button type="button" className="sl-btn is-quiet" onClick={openSignIn}>
            Sign in
          </button>
        </div>
        <p className="sl-foot">Studio is built and used by intiba, a brand and marketing studio.</p>
      </footer>

      <SignInDialog open={signInOpen} onClose={closeSignIn} />
    </div>
  );
};

export default StudioLandingPage;
