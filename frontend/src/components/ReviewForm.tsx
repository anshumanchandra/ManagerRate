/* ========================================
   ReviewForm — Modal for submitting reviews
   (with optional email verification)
   ======================================== */

import { useState, useEffect } from 'react';
import { StarInput } from './StarRating';
import { showToast } from './Toast';
import { submitReview, sendVerificationCode, confirmVerificationCode } from '../api/client';
import { sanitizeText, validateLinkedIn } from '../utils/sanitize';
import { CATEGORIES } from '../types';
import type { CategoryRatings, ReviewSubmission } from '../types';

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
  prefillName?: string;
  prefillLinkedin?: string;
}

type VerifyStatus = 'idle' | 'sending' | 'code-sent' | 'verifying' | 'verified' | 'skipped';

export default function ReviewForm({ isOpen, onClose, prefillName, prefillLinkedin }: ReviewFormProps) {
  const [managerName, setManagerName] = useState(prefillName || '');
  const [company, setCompany] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState(prefillLinkedin || '');
  const [ratings, setRatings] = useState<CategoryRatings>({});
  const [recommends, setRecommends] = useState(false);
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [advice, setAdvice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  /* ---------- Verification state ---------- */
  const [workEmail, setWorkEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [verifyError, setVerifyError] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer for "Send Code" button
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Sync prefill props
  useEffect(() => { setManagerName(prefillName || ''); }, [prefillName]);
  useEffect(() => { setLinkedinUrl(prefillLinkedin || ''); }, [prefillLinkedin]);

  /* ---------- Verification handlers ---------- */

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSendCode = async () => {
    if (!isValidEmail(workEmail)) {
      setVerifyError('Enter a valid work email address.');
      return;
    }
    setVerifyError('');
    setVerifyStatus('sending');
    try {
      const result = await sendVerificationCode(workEmail.trim());
      setVerifyStatus('code-sent');
      setCooldown(Math.ceil(result.expiresIn / 1000) || 60);
      showToast(result.message || 'Verification code sent!', 'success');
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Failed to send code');
      setVerifyStatus('idle');
    }
  };

  const handleConfirmCode = async () => {
    if (!verifyCode.trim()) {
      setVerifyError('Enter the 6-digit code from your email.');
      return;
    }
    setVerifyError('');
    setVerifyStatus('verifying');
    try {
      const result = await confirmVerificationCode(workEmail.trim(), verifyCode.trim());
      setVerificationToken(result.verificationToken);
      setVerifyStatus('verified');
      showToast('Email verified!', 'success');
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Invalid code');
      setVerifyStatus('code-sent');
    }
  };

  const handleSkipVerification = () => {
    setVerifyStatus('skipped');
    setVerificationToken('');
  };

  /* ---------- Validation ---------- */

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!managerName.trim() || managerName.trim().length < 2) errs.push('Manager name is required (min 2 characters).');
    if (!company.trim() || company.trim().length < 2) errs.push('Company name is required (min 2 characters).');
    if (!validateLinkedIn(linkedinUrl)) errs.push('Enter a valid LinkedIn URL (https://linkedin.com/in/...).');
    const unrated = CATEGORIES.filter((c) => !ratings[c] || ratings[c] < 1);
    if (unrated.length > 0) errs.push(`Rate all categories. Missing: ${unrated.slice(0, 3).join(', ')}${unrated.length > 3 ? '...' : ''}`);
    if (!pros.trim() || pros.trim().length < 10) errs.push('Pros must be at least 10 characters.');
    if (!cons.trim() || cons.trim().length < 10) errs.push('Cons must be at least 10 characters.');
    if (pros.length > 5000 || cons.length > 5000) errs.push('Review text must be under 5000 characters.');
    return errs;
  };

  /* ---------- Submit ---------- */

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setSubmitting(true);

    const normalized = validateLinkedIn(linkedinUrl);
    const payload: ReviewSubmission = {
      managerName: sanitizeText(managerName),
      company: sanitizeText(company),
      linkedinUrl: normalized || '',
      ratings: Object.fromEntries(
        CATEGORIES.map((c) => [c, Math.max(1, Math.min(5, ratings[c] || 1))])
      ),
      recommends,
      pros: sanitizeText(pros),
      cons: sanitizeText(cons),
      advice: sanitizeText(advice),
      ...(verificationToken ? { verificationToken } : {}),
    };

    try {
      const result = await submitReview(payload);
      showToast(result.message, 'success');
      if (result.notice) showToast(result.notice, 'info');
      resetForm();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setManagerName('');
    setCompany('');
    setLinkedinUrl('');
    setRatings({});
    setRecommends(false);
    setPros('');
    setCons('');
    setAdvice('');
    setErrors([]);
    setWorkEmail('');
    setVerifyCode('');
    setVerifyStatus('idle');
    setVerifyError('');
    setVerificationToken('');
    setCooldown(0);
  };

  if (!isOpen) return null;

  /* ---------- Verification badge ---------- */

  const verifyBadge =
    verifyStatus === 'verified' ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
        <i className="fa-solid fa-circle-check" />
        Verified
      </span>
    ) : verifyStatus === 'skipped' ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
        <i className="fa-solid fa-triangle-exclamation" />
        Unverified
      </span>
    ) : null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[200] flex justify-center items-start pt-8 pb-8 px-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-xl p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">
          <i className="fa-solid fa-pen-to-square mr-2 text-primary" />
          Write a Review
          {verifyBadge && <span className="ml-2 align-middle">{verifyBadge}</span>}
        </h2>
        <p className="text-sm text-gray-500 mb-5">Your review is fully anonymous. No one can see who submitted it.</p>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {errors.map((e, i) => (<p key={i} className="mb-0.5">• {e}</p>))}
          </div>
        )}

        {/* ======== Email Verification Section ======== */}
        <div className="mb-5 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">
              <i className="fa-solid fa-envelope-circle-check mr-1 text-primary" />
              Verify Your Work Email
              <span className="font-normal text-gray-400 ml-1">(optional)</span>
            </label>
            {verifyBadge}
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Verified reviews are more trusted. We'll send a one-time code — your email is never shown.
          </p>

          {verifyStatus === 'verified' ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <i className="fa-solid fa-circle-check" />
              <span className="font-medium">Email verified — your review will carry a ✅ Verified badge.</span>
            </div>
          ) : verifyStatus === 'skipped' ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                Skipped — review will be submitted as unverified.
              </span>
              <button
                onClick={() => setVerifyStatus('idle')}
                className="text-xs text-primary hover:underline"
              >
                Verify instead
              </button>
            </div>
          ) : (
            <>
              {/* Email input + Send Code */}
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="you@company.com"
                  disabled={verifyStatus === 'code-sent' || verifyStatus === 'verifying'}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary transition disabled:bg-gray-100 disabled:text-gray-500"
                />
                <button
                  onClick={handleSendCode}
                  disabled={verifyStatus === 'sending' || cooldown > 0}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {verifyStatus === 'sending' ? (
                    <><i className="fa-solid fa-spinner fa-spin mr-1" />Sending…</>
                  ) : cooldown > 0 ? (
                    `Resend (${cooldown}s)`
                  ) : verifyStatus === 'code-sent' ? (
                    'Resend Code'
                  ) : (
                    'Send Code'
                  )}
                </button>
              </div>

              {/* Code entry (shown after code sent) */}
              {(verifyStatus === 'code-sent' || verifyStatus === 'verifying') && (
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary transition font-mono tracking-widest text-center"
                  />
                  <button
                    onClick={handleConfirmCode}
                    disabled={verifyStatus === 'verifying' || verifyCode.length < 6}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifyStatus === 'verifying' ? (
                      <><i className="fa-solid fa-spinner fa-spin mr-1" />Verifying…</>
                    ) : (
                      'Verify'
                    )}
                  </button>
                </div>
              )}

              {/* Verification error */}
              {verifyError && (
                <p className="text-xs text-red-500 mb-2">
                  <i className="fa-solid fa-circle-exclamation mr-1" />{verifyError}
                </p>
              )}

              {/* Skip option */}
              <button
                onClick={handleSkipVerification}
                className="text-[11px] text-gray-400 hover:text-gray-600 transition"
              >
                Skip verification →
              </button>
            </>
          )}
        </div>

        {/* Manager Name */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Manager's Full Name</label>
          <input
            type="text"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="e.g. John Smith"
            maxLength={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary transition"
          />
        </div>

        {/* Company */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Company / Organization</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Amazon Web Services"
            maxLength={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary transition"
          />
        </div>

        {/* LinkedIn */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Manager's LinkedIn Profile URL
            <span className="font-normal text-gray-400 ml-1">— to confirm identity</span>
          </label>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/johnsmith"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary transition"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            <i className="fa-solid fa-circle-info mr-1" />
            Matches reviews to the right person across companies.
          </p>
        </div>

        {/* Star Ratings */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-2">Rate this Manager</label>
          <div className="max-h-64 overflow-y-auto pr-2">
            {CATEGORIES.map((cat) => (
              <StarInput
                key={cat}
                label={cat}
                value={ratings[cat] || 0}
                onChange={(val) => setRatings((prev) => ({ ...prev, [cat]: val }))}
              />
            ))}
          </div>
        </div>

        {/* Recommend */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-2">Would you recommend this manager?</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRecommends(!recommends)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                recommends ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform ${
                  recommends ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
            <span className="text-sm font-medium">{recommends ? 'Yes' : 'No'}</span>
          </div>
        </div>

        {/* Pros */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Pros <span className="font-normal text-gray-400">— What does this manager do well?</span>
          </label>
          <textarea
            value={pros}
            onChange={(e) => setPros(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Share what you appreciate..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary transition resize-y"
          />
          <p className="text-[11px] text-gray-400 text-right">{pros.length}/5000</p>
        </div>

        {/* Cons */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Cons <span className="font-normal text-gray-400">— What could they improve?</span>
          </label>
          <textarea
            value={cons}
            onChange={(e) => setCons(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Constructive feedback..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary transition resize-y"
          />
          <p className="text-[11px] text-gray-400 text-right">{cons.length}/5000</p>
        </div>

        {/* Advice */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Advice to Management <span className="font-normal text-gray-400">(Optional)</span>
          </label>
          <textarea
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
            rows={2}
            maxLength={3000}
            placeholder="Any advice for senior leadership?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary transition resize-y"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><i className="fa-solid fa-spinner fa-spin mr-2" />Submitting...</>
            ) : (
              'Submit Review'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
