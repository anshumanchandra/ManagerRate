/* ========================================
   Pricing — Conversion-optimized pricing page
   ======================================== */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/* ---------- data ---------- */
const plans = [
  {
    name: 'Free',
    tagline: 'For individuals',
    monthlyPrice: 0,
    annualPrice: 0,
    highlight: false,
    cta: 'Get Started',
    ctaLink: '/managers',
    features: [
      'Browse unlimited manager reviews',
      'Submit anonymous reviews',
      'Search by name & company',
      'Basic manager profiles',
      'Helpful voting & reporting',
    ],
  },
  {
    name: 'Starter',
    tagline: 'For recruiting teams',
    monthlyPrice: 99,
    annualPrice: 79,
    highlight: false,
    cta: 'Start Free Trial',
    ctaLink: '/contact',
    features: [
      'Everything in Free',
      'API access — 1,000 requests/mo',
      'Leadership Reports (10/mo)',
      'Manager comparison (up to 3)',
      'Sentiment & trend analysis',
      'Email support',
    ],
  },
  {
    name: 'Growth',
    tagline: 'For HR & People Ops',
    monthlyPrice: 499,
    annualPrice: 399,
    highlight: true,
    badge: 'Most Popular',
    cta: 'Contact Sales',
    ctaLink: '/contact',
    features: [
      'Everything in Starter',
      'API access — 50,000 requests/mo',
      'Unlimited Leadership Reports',
      'Company Dashboard (real-time)',
      'Manager comparison (up to 10)',
      'Trend alerts & notifications',
      'Bulk screening (50 at once)',
      'Priority support',
    ],
  },
];

const comparisonFeatures = [
  { name: 'Browse reviews',           free: true,  starter: true,  growth: true  },
  { name: 'Submit reviews',           free: true,  starter: true,  growth: true  },
  { name: 'Search managers',          free: true,  starter: true,  growth: true  },
  { name: 'API access',               free: false, starter: '1K/mo', growth: '50K/mo' },
  { name: 'Leadership Reports',       free: false, starter: '10/mo', growth: 'Unlimited' },
  { name: 'Manager comparison',       free: false, starter: 'Up to 3', growth: 'Up to 10' },
  { name: 'Company Dashboard',        free: false, starter: false, growth: true  },
  { name: 'Trend alerts',             free: false, starter: false, growth: true  },
  { name: 'Bulk screening',           free: false, starter: false, growth: true  },
  { name: 'Sentiment analysis',       free: false, starter: true,  growth: true  },
  { name: 'Export & reporting',        free: false, starter: false, growth: true  },
  { name: 'Support',                  free: 'Community', starter: 'Email', growth: 'Priority' },
];

const faqs = [
  {
    q: 'Is the free plan really free forever?',
    a: 'Yes — browsing reviews, submitting reviews, and searching managers will always be free. We believe transparency should be accessible to everyone.',
  },
  {
    q: 'How does the free trial work?',
    a: 'The Starter plan comes with a 14-day free trial. No credit card required. You get full access to all Starter features during the trial period.',
  },
  {
    q: 'Can I switch plans anytime?',
    a: 'Absolutely. You can upgrade, downgrade, or cancel at any time. If you downgrade, you keep access until the end of your billing period.',
  },
  {
    q: 'How are Leadership Reports generated?',
    a: 'Our system analyzes all reviews for a manager — ratings across 11 categories, sentiment from pros/cons text, trends over time, and comparison to industry benchmarks. Reports are generated in seconds.',
  },
  {
    q: 'Is the data really anonymous?',
    a: 'Yes. We never store reviewer identities. Reviews are cryptographically separated from any session data. Even we cannot determine who wrote a specific review.',
  },
  {
    q: 'Do you offer enterprise pricing?',
    a: 'Yes — for organizations with 500+ managers or custom needs, we offer tailored enterprise plans with dedicated support, SSO, and custom integrations. Contact our sales team.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards and can arrange invoice-based billing for Growth and Enterprise plans.',
  },
  {
    q: 'Can I use the API to integrate with our ATS?',
    a: 'Yes! Our REST API integrates with any ATS (Greenhouse, Lever, Workday, etc.) so you can automatically screen managerial candidates during your hiring pipeline.',
  },
];

const testimonials = [
  {
    quote: 'We caught a red-flag hire that looked perfect on paper. ManagerRate saved us months of team disruption.',
    name: 'VP of People',
    company: 'Series C Fintech',
  },
  {
    quote: 'The Leadership Reports are incredibly detailed. We use them in every senior hiring committee now.',
    name: 'Head of Talent Acquisition',
    company: 'Enterprise SaaS',
  },
  {
    quote: 'Finally — a Glassdoor for managers. The anonymity means we get brutally honest feedback.',
    name: 'Chief People Officer',
    company: 'AI Startup',
  },
];

/* ---------- helpers ---------- */
function CheckIcon() {
  return <i className="fa-solid fa-check text-green-500 text-sm" />;
}
function XIcon() {
  return <i className="fa-solid fa-xmark text-gray-300 text-sm" />;
}
function CellValue({ value }: { value: boolean | string }) {
  if (value === true)  return <CheckIcon />;
  if (value === false) return <XIcon />;
  return <span className="text-sm text-gray-700 font-medium">{value}</span>;
}

/* ---------- component ---------- */
export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [visible, setVisible] = useState<Set<number>>(new Set());

  /* scroll-reveal */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = sectionRefs.current.indexOf(e.target as HTMLDivElement);
          if (e.isIntersecting && idx >= 0) {
            setVisible((prev) => new Set(prev).add(idx));
          }
        });
      },
      { threshold: 0.1 }
    );
    sectionRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const reveal = (idx: number) =>
    `transition-all duration-700 ${visible.has(idx) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`;

  const setRef = (idx: number) => (el: HTMLDivElement | null) => {
    sectionRefs.current[idx] = el;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* ───── Hero ───── */}
      <div ref={setRef(0)} className={`text-center mb-12 ${reveal(0)}`}>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
          Start free. Upgrade when you need leadership intelligence for hiring.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${!annual ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-accent' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${annual ? 'translate-x-7' : ''}`}
            />
          </button>
          <span className={`text-sm font-medium ${annual ? 'text-gray-900' : 'text-gray-400'}`}>
            Annual <span className="text-green-600 font-bold text-xs ml-1">Save 20%</span>
          </span>
        </div>
      </div>

      {/* ───── Plan cards ───── */}
      <div ref={setRef(1)} className={`grid md:grid-cols-3 gap-6 mb-20 ${reveal(1)}`}>
        {plans.map((plan, i) => {
          const price = annual ? plan.annualPrice : plan.monthlyPrice;
          const savedPerYear = plan.monthlyPrice > 0 ? (plan.monthlyPrice - plan.annualPrice) * 12 : 0;
          return (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                plan.highlight
                  ? 'border-accent bg-white shadow-lg ring-1 ring-accent/20'
                  : 'border-gray-200 bg-white'
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {plan.highlight && plan.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                  {plan.badge}
                </span>
              )}

              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{plan.tagline}</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{plan.name}</h3>

              <div className="mt-5 mb-6">
                <span className="text-5xl font-extrabold text-gray-900">${price}</span>
                {price > 0 && <span className="text-gray-400 text-base ml-1">/month</span>}
                {annual && savedPerYear > 0 && (
                  <p className="text-green-600 text-sm font-semibold mt-1">
                    Save ${savedPerYear}/year
                  </p>
                )}
              </div>

              <Link
                to={plan.ctaLink}
                className={`block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all ${
                  plan.highlight
                    ? 'bg-accent text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </Link>

              <ul className="mt-7 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <i className={`fa-solid fa-check mt-0.5 ${plan.highlight ? 'text-accent' : 'text-green-500'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ───── Social proof ───── */}
      <div ref={setRef(2)} className={`mb-20 ${reveal(2)}`}>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
          Trusted by Hiring Teams Everywhere
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <i key={s} className="fa-solid fa-star text-yellow-400 text-sm" />
                ))}
              </div>
              <p className="text-gray-600 text-sm italic leading-relaxed mb-4">"{t.quote}"</p>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400">{t.company}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───── Feature comparison ───── */}
      <div ref={setRef(3)} className={`mb-20 ${reveal(3)}`}>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Feature Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600 w-1/3">Feature</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-600">Free</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-gray-600">Starter</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-accent bg-accent/5">Growth</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((row, i) => (
                <tr key={row.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="py-3.5 px-6 text-sm text-gray-700">{row.name}</td>
                  <td className="py-3.5 px-4 text-center"><CellValue value={row.free} /></td>
                  <td className="py-3.5 px-4 text-center"><CellValue value={row.starter} /></td>
                  <td className="py-3.5 px-4 text-center bg-accent/[.02]"><CellValue value={row.growth} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───── FAQ ───── */}
      <div ref={setRef(4)} className={`mb-16 max-w-3xl mx-auto ${reveal(4)}`}>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
              >
                <span className="text-sm font-semibold text-gray-800">{faq.q}</span>
                <i className={`fa-solid fa-chevron-down text-gray-400 text-xs transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openFaq === i ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-6 pb-4 text-sm text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───── Bottom CTA ───── */}
      <div ref={setRef(5)} className={`text-center bg-gradient-to-r from-navy to-blue-800 rounded-2xl p-12 text-white ${reveal(5)}`}>
        <h2 className="text-2xl font-bold mb-3">Ready to Make Better Leadership Hires?</h2>
        <p className="text-white/70 mb-6 max-w-lg mx-auto">
          Start with our free plan today. Upgrade when you need leadership intelligence for your hiring pipeline.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Link
            to="/managers"
            className="px-8 py-3 bg-white text-navy rounded-xl font-bold hover:bg-gray-100 transition shadow"
          >
            Browse Managers — Free
          </Link>
          <Link
            to="/contact"
            className="px-8 py-3 border-2 border-white/30 text-white rounded-xl font-bold hover:bg-white/10 transition"
          >
            Talk to Sales
          </Link>
        </div>
      </div>
    </div>
  );
}
