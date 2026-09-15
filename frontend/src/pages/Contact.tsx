/* ========================================
   Contact — Sales & support contact page
   ======================================== */

import { useState } from 'react';
import { useToast } from '../components/Toast';

interface FormData {
  name: string;
  company: string;
  email: string;
  plan: string;
  message: string;
}

const initialForm: FormData = { name: '', company: '', email: '', plan: '', message: '' };

const enterpriseFaqs = [
  {
    q: 'What is included in Enterprise plans?',
    a: 'Enterprise plans include unlimited API access, dedicated support, SSO/SAML integration, custom data retention, SLA guarantees, and on-boarding assistance. Pricing is tailored to your organization size.',
  },
  {
    q: 'Can you integrate with our ATS?',
    a: 'Yes — our REST API integrates with Greenhouse, Lever, Workday, Ashby, and any ATS with webhook support. We provide SDKs for Python, Node.js, and Java.',
  },
  {
    q: 'How quickly can we get started?',
    a: 'Most teams are live within 24 hours. API key provisioning is instant, and our dashboard requires zero setup. Enterprise integrations typically take 1-2 weeks.',
  },
  {
    q: 'Do you offer a pilot program?',
    a: 'Yes — we offer a 30-day pilot for Growth and Enterprise plans so you can evaluate the platform with your real hiring pipeline before committing.',
  },
];

export default function Contact() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [submitted, setSubmitted] = useState(false);
  const toast = useToast();

  const validate = (): boolean => {
    const errs: Partial<FormData> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.company.trim()) errs.company = 'Company is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    if (!form.plan) errs.plan = 'Please select a plan';
    if (!form.message.trim()) errs.message = 'Message is required';
    else if (form.message.trim().length < 10) errs.message = 'Message must be at least 10 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    // UI-only for now — no backend endpoint yet
    setSubmitted(true);
    toast.success('Message sent! Our team will respond within 24 hours.');
    setForm(initialForm);
    setErrors({});
  };

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const inputCls = (field: keyof FormData) =>
    `w-full px-4 py-3 border rounded-xl text-sm outline-none transition-colors ${
      errors[field] ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-200 bg-white focus:border-accent'
    }`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="grid lg:grid-cols-2 gap-12">
        {/* ───── Form ───── */}
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Get in Touch</h1>
          <p className="text-gray-500 mb-8">
            Interested in ManagerRate for your organization? Fill out the form and our team will respond within 24 hours.
          </p>

          {submitted && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <i className="fa-solid fa-circle-check text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Message sent successfully!</p>
                <p className="text-xs text-green-600 mt-0.5">We typically respond within 24 hours on business days.</p>
              </div>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Jane Smith"
                className={inputCls('name')}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
                placeholder="Acme Corp"
                className={inputCls('company')}
              />
              {errors.company && <p className="text-xs text-red-500 mt-1">{errors.company}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Work Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="jane@acme.com"
                className={inputCls('email')}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Plan of Interest</label>
              <select
                value={form.plan}
                onChange={(e) => update('plan', e.target.value)}
                className={inputCls('plan')}
              >
                <option value="">Select a plan...</option>
                <option value="starter">Starter — $99/mo</option>
                <option value="growth">Growth — $499/mo</option>
                <option value="enterprise">Enterprise — Custom</option>
              </select>
              {errors.plan && <p className="text-xs text-red-500 mt-1">{errors.plan}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                placeholder="Tell us about your team and how you plan to use ManagerRate..."
                className={inputCls('message')}
              />
              {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
            </div>

            <button
              onClick={handleSubmit}
              className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-md hover:shadow-lg"
            >
              Send Message
            </button>

            <p className="text-xs text-gray-400 text-center">
              By submitting, you agree to our Privacy Policy. We never share your information.
            </p>
          </div>
        </div>

        {/* ───── Info sidebar ───── */}
        <div className="space-y-8">
          {/* Contact info cards */}
          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-white">
            <h3 className="text-lg font-bold mb-6">Contact Information</h3>
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-envelope text-sm" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Email</p>
                  <p className="text-sm text-white/70">sales@managerrate.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-clock text-sm" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Response Time</p>
                  <p className="text-sm text-white/70">Within 24 hours on business days</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-headset text-sm" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Support</p>
                  <p className="text-sm text-white/70">support@managerrate.com</p>
                </div>
              </div>
            </div>
          </div>

          {/* Enterprise FAQ */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Enterprise Questions</h3>
            <div className="space-y-3">
              {enterpriseFaqs.map((faq, i) => (
                <details key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden group">
                  <summary className="px-5 py-3.5 cursor-pointer text-sm font-semibold text-gray-800 hover:bg-gray-50 transition flex items-center justify-between">
                    {faq.q}
                    <i className="fa-solid fa-chevron-down text-gray-400 text-xs group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-700 mb-4">Why Teams Trust Us</h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: 'fa-shield-halved', label: '100% Anonymous Reviews' },
                { icon: 'fa-lock', label: 'SOC 2 Compliant' },
                { icon: 'fa-chart-line', label: 'Data-Backed Insights' },
                { icon: 'fa-users', label: '10K+ Reviews Indexed' },
              ].map((badge) => (
                <div key={badge.label} className="flex items-center gap-2.5">
                  <i className={`fa-solid ${badge.icon} text-accent text-sm`} />
                  <span className="text-xs text-gray-600 font-medium">{badge.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
