/* ========================================
   Home Page — Landing with mission & CTA
   ======================================== */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface HomeProps {
  onWriteReview: () => void;
}

export default function Home({ onWriteReview }: HomeProps) {
  const navigate = useNavigate();
  const revealRefs = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addRef = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Hero */}
      <section className="hero-gradient text-white rounded-2xl px-6 py-16 text-center mb-8 relative overflow-hidden">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 leading-tight">
          Every Voice Matters.<br />
          Every Manager <span className="text-blue-300">Improves.</span>
        </h1>
        <p className="text-base sm:text-lg opacity-85 max-w-xl mx-auto mb-7 leading-relaxed">
          ManagerRate is a fully anonymous platform where employees share honest feedback about their managers — driving accountability, transparency, and better leadership across every company.
        </p>
        <div className="flex gap-3 justify-center flex-wrap relative z-10">
          <button onClick={onWriteReview} className="px-7 py-3 bg-white text-navy font-semibold rounded-xl hover:bg-blue-50 hover:-translate-y-0.5 transition-all">
            Write a Review
          </button>
          <button onClick={() => navigate('/managers')} className="px-7 py-3 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
            Browse Managers
          </button>
        </div>
      </section>

      {/* Mission */}
      <div ref={addRef} className="reveal grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-7">
          <h3 className="text-base font-bold mb-2 flex items-center gap-2">
            <i className="fa-solid fa-bullseye text-primary text-lg" /> Why We Built This
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Great organizations are built on great leadership. Yet most companies lack a safe, anonymous channel for employees to share candid feedback about their managers. ManagerRate was created to fill that gap — giving every team member a voice without fear of retaliation.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-7">
          <h3 className="text-base font-bold mb-2 flex items-center gap-2">
            <i className="fa-solid fa-globe text-primary text-lg" /> How It Changes the World
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            When managers receive honest, constructive feedback, cultures transform. Teams become more engaged, turnover drops, and innovation flourishes. ManagerRate helps create workplaces where people genuinely thrive — one review at a time.
          </p>
        </div>
      </div>

      {/* How it works */}
      <section ref={addRef} className="reveal mb-8">
        <h2 className="text-xl font-bold text-center mb-6">How It Works</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: 'fa-pen-to-square', num: '1', title: 'Name Your Manager', desc: 'Type your manager\'s name, their company, and paste their LinkedIn profile link to confirm identity.' },
            { icon: 'fa-star', num: '2', title: 'Rate Anonymously', desc: 'Rate across 11 leadership categories and share detailed pros, cons, and advice. Your identity is never stored.' },
            { icon: 'fa-chart-line', num: '3', title: 'Insights Emerge', desc: 'Reviews are grouped by company — so a manager\'s track record follows them across their career.' },
            { icon: 'fa-arrows-rotate', num: '4', title: 'Culture Transforms', desc: 'Transparent ratings empower employees everywhere to make informed decisions about their leaders.' },
          ].map((step, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:-translate-y-1 hover:shadow-md transition-all">
              <i className={`fa-solid ${step.icon} text-2xl text-primary mb-3 block`} />
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-3">{step.num}</div>
              <h4 className="font-semibold text-sm mb-1">{step.title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Impact */}
      <section ref={addRef} className="reveal bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-10 text-white text-center mb-8">
        <h2 className="text-xl font-bold mb-1">The Impact of Honest Feedback</h2>
        <p className="text-sm opacity-60 mb-7">Research shows organizations with strong feedback cultures outperform their peers</p>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { icon: 'fa-chart-line', stat: '34% Higher', desc: 'Employee engagement with regular upward feedback mechanisms' },
            { icon: 'fa-user-check', stat: '27% Lower', desc: 'Voluntary turnover when employees feel their voice is heard' },
            { icon: 'fa-rocket', stat: '2x Faster', desc: 'Leadership development with consistent anonymous feedback' },
          ].map((item, i) => (
            <div key={i} className="p-4 hover:scale-105 transition-transform rounded-xl">
              <i className={`fa-solid ${item.icon} text-3xl text-blue-400 mb-3 block`} />
              <h3 className="text-lg font-bold mb-1">{item.stat}</h3>
              <p className="text-xs opacity-70 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For Organizations */}
      <section ref={addRef} className="reveal mb-8">
        <h2 className="text-xl font-bold text-center mb-1">
          <i className="fa-solid fa-building-shield mr-2" />Built for Organizations That Care
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6 max-w-2xl mx-auto">
          ManagerRate isn't just for employees — it's a powerful hiring and culture tool for organizations that refuse to compromise on work environment.
        </p>

        <div className="bg-gradient-to-r from-blue-50 to-primary-light border border-blue-200 rounded-2xl p-7 mb-5">
          <h3 className="text-base font-bold text-navy mb-2 flex items-center gap-2">
            <i className="fa-solid fa-user-tie text-xl" /> Hire the Right Managers, Not Just the Right Resumes
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            A candidate's resume tells you where they worked and what they shipped — but it says nothing about <strong>how they led</strong>. ManagerRate gives your hiring committee something no interview can: <strong>the unfiltered truth from the people who reported to them.</strong>
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          {[
            { icon: 'fa-magnifying-glass-chart', title: 'Due Diligence on Leadership Hires', desc: 'Search candidates by name or LinkedIn. See their ratings across every company.', bullets: ['Ratings across 11 dimensions', 'Cross-company track record', 'Red flags before the offer'] },
            { icon: 'fa-hand-holding-heart', title: 'Protect Your Work Culture', desc: 'One toxic manager can dismantle years of culture-building in months.', bullets: ['Spot poor leadership patterns', 'Validate empathy alignment', 'Prevent culture-destroying hires'] },
            { icon: 'fa-coins', title: 'Save the Real Cost of a Bad Hire', desc: 'A bad manager costs 6-9 months salary per lost team member.', bullets: ['Prevent costly turnover', 'Avoid disengaged teams', 'Data-backed hiring decisions'] },
          ].map((card, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 relative overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-primary" />
              <i className={`fa-solid ${card.icon} text-2xl text-primary mb-3 block`} />
              <h4 className="font-semibold text-sm mb-2">{card.title}</h4>
              <p className="text-xs text-gray-600 mb-2 leading-relaxed">{card.desc}</p>
              <ul className="text-xs text-gray-500 space-y-1 ml-3 list-disc">
                {card.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <blockquote className="bg-white border-l-4 border-primary rounded-r-xl p-6">
          <p className="text-sm text-gray-600 italic leading-relaxed mb-2">
            "We started checking ManagerRate profiles before extending offers to senior leaders. In the first year, we avoided two hires that looked perfect on paper but had consistent patterns of micromanagement and favoritism."
          </p>
          <span className="text-xs font-semibold text-gray-400">— VP of People Operations, Series C Startup</span>
        </blockquote>
      </section>

      {/* Values */}
      <section ref={addRef} className="reveal mb-8">
        <h2 className="text-xl font-bold text-center mb-6">Our Core Principles</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: 'fa-shield-halved', color: 'text-primary', title: '100% Anonymous', desc: 'We never store reviewer identities. Not even admins can see who submitted a review.' },
            { icon: 'fa-scale-balanced', color: 'text-green-600', title: 'Fair & Constructive', desc: 'We encourage balanced feedback — strengths alongside areas for growth.' },
            { icon: 'fa-eye', color: 'text-orange-500', title: 'Transparent Insights', desc: 'All aggregated data is visible to everyone. No hidden reports, no gatekeepers.' },
          ].map((v, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:-translate-y-1 hover:shadow-md transition-all">
              <i className={`fa-solid ${v.icon} ${v.color} text-2xl mb-3 block`} />
              <h4 className="font-semibold text-sm mb-1">{v.title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section ref={addRef} className="reveal bg-primary rounded-2xl p-10 text-center text-white mb-6">
        <h2 className="text-xl font-bold mb-2">Ready to Make Your Voice Heard?</h2>
        <p className="text-sm opacity-85 mb-5">Your anonymous review can spark the leadership change your team deserves.</p>
        <button onClick={onWriteReview} className="px-8 py-3 bg-white text-primary font-bold rounded-xl hover:bg-blue-50 hover:-translate-y-0.5 transition-all">
          Write Your First Review
        </button>
      </section>

      <footer className="text-center py-5 text-xs text-gray-400 border-t border-gray-200">
        ManagerRate — Empowering employees to shape better leadership, one review at a time.
      </footer>
    </div>
  );
}
