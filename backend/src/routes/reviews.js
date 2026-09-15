// ==========================================
// Review Routes V2 — POST /api/reviews
// ==========================================
// Features: All V2 fields, review evolution, bombing detection,
// one-review-per-employment-period, enhanced moderation,
// server-side email verification (V2.1).

const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { sanitizeText, validateLinkedInUrl } = require('../utils/sanitize');
const { getAnonymousHash, getIpHash } = require('../utils/anonymize');
const { moderateReview } = require('../services/moderationService');
const { detectBombing } = require('../services/bombingDetection');
const { validateReview, validateReport, validateUUID } = require('../middleware/validator');
const { reviewLimiter, voteLimiter, reportLimiter } = require('../middleware/rateLimiter');
const { CATEGORIES, STRENGTHS, WEAKNESSES } = require('../config/categories');
const { verifyJwt, hashEmail } = require('./verify');

/**
 * POST /api/reviews
 * Submit an anonymous review (V2 — full fields).
 * Rate limited: 3 per hour per IP.
 *
 * V2.1: Accepts optional `verificationToken` from the email
 * verification flow. If present and valid, the review is marked
 * as verified and the hashed email is stored for audit.
 */
router.post('/', reviewLimiter, validateReview, async function (req, res) {
  try {
    var b = req.body;

    // ── 0. Verify email token (optional) ──────────────────
    var verified = false;
    var emailHash = null;
    var domainVerified = false;

    if (b.verificationToken) {
      var tokenPayload = verifyJwt(b.verificationToken);

      if (tokenPayload && tokenPayload.purpose === 'email_verification') {
        verified = true;
        emailHash = tokenPayload.sub;               // Already a SHA-256 hash
        domainVerified = Boolean(tokenPayload.domainMatch);

        // Ensure the token's company matches the review's company
        // (prevents using a verification from company A to review company B)
        if (tokenPayload.company &&
            tokenPayload.company.toLowerCase() !== b.company.trim().toLowerCase()) {
          return res.status(400).json({
            error: 'Verification token was issued for a different company.',
            detail: 'Please verify your email for the correct company.',
          });
        }
      }
      // If token is invalid/expired, we don't reject — the review
      // just goes through as unverified. This keeps the flow
      // backwards-compatible.
    }

    // 1. Sanitize all text inputs
    var cleanName = sanitizeText(b.managerName);
    var cleanCompany = sanitizeText(b.company);
    var cleanPros = sanitizeText(b.pros);
    var cleanCons = sanitizeText(b.cons);
    var cleanAdvice = b.advice ? sanitizeText(b.advice) : null;
    var cleanCity = b.city ? sanitizeText(b.city) : null;
    var cleanDept = b.department ? sanitizeText(b.department) : null;
    var cleanTitle = b.managerTitle ? sanitizeText(b.managerTitle) : null;

    // 2. Validate & normalize LinkedIn URL
    var linkedinData;
    try {
      linkedinData = validateLinkedInUrl(b.linkedinUrl);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // 3. Content moderation (V2 — includes defamation, quality checks)
    var moderation = moderateReview({
      pros: cleanPros,
      cons: cleanCons,
      advice: cleanAdvice,
    });

    // Reject low-quality content
    if (!moderation.quality) {
      return res.status(400).json({
        error: 'Review content is too short or lacks meaningful feedback.',
        detail: moderation.qualityReason,
      });
    }

    var reviewStatus = moderation.safe ? 'published' : 'flagged';

    // 4. Anonymous hash for abuse prevention
    var ipHash = getAnonymousHash(req);

    // 5. Atomic find-or-create manager (with V2 fields)
    var manager;
    try {
      manager = await prisma.manager.upsert({
        where: { linkedinSlug: linkedinData.slug },
        update: {
          // Update optional fields if not already set
          city: undefined, // Don't overwrite — handled below
          department: undefined,
        },
        create: {
          name: cleanName,
          linkedinUrl: linkedinData.url,
          linkedinSlug: linkedinData.slug,
          city: cleanCity,
          department: cleanDept,
          businessUnit: null,
          title: cleanTitle,
        },
      });

      // Update city/dept/title if currently null and new review provides them
      var updates = {};
      if (!manager.city && cleanCity) updates.city = cleanCity;
      if (!manager.department && cleanDept) updates.department = cleanDept;
      if (!manager.title && cleanTitle) updates.title = cleanTitle;
      if (Object.keys(updates).length > 0) {
        manager = await prisma.manager.update({
          where: { id: manager.id },
          data: updates,
        });
      }
    } catch (prismaError) {
      if (prismaError.code === 'P2002') {
        manager = await prisma.manager.findUnique({
          where: { linkedinSlug: linkedinData.slug },
        });
        if (!manager) {
          return res.status(500).json({ error: 'Failed to create manager. Please try again.' });
        }
      } else {
        throw prismaError;
      }
    }

    // 6. Review bombing detection
    var bombing = await detectBombing(manager.id, cleanCompany);
    if (bombing.bombing) {
      reviewStatus = 'held';
    }

    // 7. One-review-per-employment-period check
    //    Same IP + same manager: if review exists and is <6 months old → reject
    //    If review exists and is >6 months old → allow as evolution (update)
    var existingReview = await prisma.review.findFirst({
      where: {
        managerId: manager.id,
        ipHash: ipHash,
      },
      orderBy: { createdAt: 'desc' },
    });

    var isEvolution = false;
    var originalReviewId = null;
    var evolutionVersion = 1;

    if (existingReview) {
      var sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

      if (new Date(existingReview.createdAt) > sixMonthsAgo) {
        return res.status(429).json({
          error: 'You have already reviewed this manager. You can update your review after 6 months.',
          existingReviewDate: existingReview.createdAt,
        });
      }

      // Allow evolution — this is an update
      isEvolution = true;
      originalReviewId = existingReview.id;

      // Count existing evolutions to get version number
      var existingEvolutions = await prisma.reviewEvolution.count({
        where: { originalReviewId: existingReview.id },
      });
      evolutionVersion = existingEvolutions + 2; // +2 because original is version 1
    }

    // 8. Validate strengths/weaknesses are from allowed list
    var validStrengths = (b.strengths || []).filter(function (s) {
      return STRENGTHS.indexOf(s) !== -1;
    });
    var validWeaknesses = (b.weaknesses || []).filter(function (w) {
      return WEAKNESSES.indexOf(w) !== -1;
    });

    // ── 9. Determine verification status ──────────────────
    var verificationStatus;
    if (verified && domainVerified) {
      verificationStatus = 'verified';          // Email verified + domain matches
    } else if (verified) {
      verificationStatus = 'email_verified';    // Email verified but unknown company domain
    } else {
      verificationStatus = 'unverified';        // No verification attempted
    }

    // 10. Create review with ratings in atomic transaction
    var review = await prisma.$transaction(async function (tx) {
      var newReview = await tx.review.create({
        data: {
          managerId: manager.id,
          company: cleanCompany,
          recommends: Boolean(b.recommends),
          pros: cleanPros,
          cons: cleanCons,
          advice: cleanAdvice,
          status: reviewStatus,
          ipHash: ipHash,
          // V2 fields
          tenure: b.tenure,
          relationship: b.relationship,
          currentEmployee: Boolean(b.currentEmployee),
          workAgain: b.workAgain,
          strengths: validStrengths,
          weaknesses: validWeaknesses,
          // V2.1 — verification fields
          verificationStatus: verificationStatus,
          verified: verified,
          emailHash: emailHash,                   // SHA-256, NOT plain text
        },
      });

      // Create individual ratings
      var ratingRecords = CATEGORIES.map(function (cat) {
        return {
          reviewId: newReview.id,
          category: cat,
          score: Math.max(1, Math.min(5, parseInt(b.ratings[cat], 10))),
        };
      });
      await tx.rating.createMany({ data: ratingRecords });

      // Create review evolution link if this is an update
      if (isEvolution && originalReviewId) {
        await tx.reviewEvolution.create({
          data: {
            originalReviewId: originalReviewId,
            updatedReviewId: newReview.id,
            version: evolutionVersion,
          },
        });
      }

      return newReview;
    }, { isolationLevel: 'Serializable' });

    // 11. Build response
    var response = {
      success: true,
      message: 'Review submitted anonymously. Thank you!',
      reviewId: review.id,
      verified: verified,
    };

    if (verified) {
      response.verificationLevel = verificationStatus;
    }

    if (isEvolution) {
      response.evolution = true;
      response.version = evolutionVersion;
      response.message = 'Review updated! Version ' + evolutionVersion + ' recorded. Your review evolution is now tracked.';
    }

    if (reviewStatus === 'flagged') {
      response.notice = 'Your review is under moderation. It will appear once approved.';
      response.moderationFlags = moderation.flags;
    }

    if (reviewStatus === 'held') {
      response.notice = 'Unusual activity detected. Your review is being held for a brief review.';
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('POST /api/reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/reviews/:id/helpful
 * Vote a review as helpful (anonymous, deduplicated).
 */
router.post('/:id/helpful', voteLimiter, validateUUID, async function (req, res) {
  try {
    var reviewId = req.params.id;
    var voterHash = getAnonymousHash(req);

    var review = await prisma.review.findUnique({
      where: { id: reviewId, status: 'published' },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Block self-voting
    if (review.ipHash === voterHash) {
      return res.status(403).json({ error: 'Cannot vote on your own review' });
    }

    // Toggle vote in atomic transaction
    var result = await prisma.$transaction(async function (tx) {
      var existingVote = await tx.helpfulVote.findUnique({
        where: { reviewId_voterHash: { reviewId: reviewId, voterHash: voterHash } },
      });

      if (existingVote) {
        await tx.helpfulVote.delete({ where: { id: existingVote.id } });
        var count1 = await tx.helpfulVote.count({ where: { reviewId: reviewId } });
        return { voted: false, helpfulCount: count1 };
      } else {
        await tx.helpfulVote.create({ data: { reviewId: reviewId, voterHash: voterHash } });
        var count2 = await tx.helpfulVote.count({ where: { reviewId: reviewId } });
        return { voted: true, helpfulCount: count2 };
      }
    }, { isolationLevel: 'Serializable' });

    return res.json(result);

  } catch (error) {
    console.error('POST /api/reviews/:id/helpful error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/reviews/:id/report
 * Report a review for moderation.
 */
router.post('/:id/report', reportLimiter, validateUUID, validateReport, async function (req, res) {
  try {
    var reviewId = req.params.id;
    var reason = req.body.reason;
    var details = req.body.details;
    var reporterHash = getIpHash(req);

    var review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Duplicate report check
    var existingReport = await prisma.report.findFirst({
      where: { reviewId: reviewId, reporterHash: reporterHash },
    });

    if (existingReport) {
      return res.status(409).json({ error: 'You have already reported this review' });
    }

    await prisma.report.create({
      data: {
        reviewId: reviewId,
        reason: sanitizeText(reason),
        details: details ? sanitizeText(details) : null,
        reporterHash: reporterHash,
      },
    });

    // Auto-flag review if it has 3+ reports
    var reportCount = await prisma.report.count({
      where: { reviewId: reviewId, status: 'pending' },
    });

    if (reportCount >= 3 && review.status === 'published') {
      await prisma.review.update({
        where: { id: reviewId },
        data: { status: 'flagged' },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Report submitted. Our team will review it shortly.',
    });

  } catch (error) {
    console.error('POST /api/reviews/:id/report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
