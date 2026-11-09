const mongoose = require('mongoose');
const PlacementOutcome = require('../models/PlacementOutcome');
const DriveApplication = require('../models/DriveApplication');

/**
 * Computes college-scoped verified placement metrics via server-side aggregation.
 * Guarantees zero loading of document collections into Node.js server memory.
 * 
 * Returns additive shape:
 * {
 *   verifiedSelections: number, // distinct students with at least one outcome of status 'verified'
 *   verifiedOffers: number,     // count of outcomes with status 'verified'
 *   highestPackage: { ctc: number, unit: "LPA" } | null, // max CTC over verified outcomes (ignores missing CTC, null if none)
 *   needsVerification: number   // applications with status 'Selected' that have no verified outcome
 * }
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.collegeId Authenticated officer's college ID
 * @param {Object} [params.filters] Optional filter extension (e.g. batch, date range)
 * @returns {Promise<{ verifiedSelections: number, verifiedOffers: number, highestPackage: { ctc: number, unit: string } | null, needsVerification: number }>}
 */
async function getPlacementMetricsService({ collegeId, filters = {} }) {
  if (!collegeId || !mongoose.Types.ObjectId.isValid(collegeId)) {
    throw new Error('Invalid college ID format for placement metrics.');
  }

  const collegeObjId = new mongoose.Types.ObjectId(collegeId);

  // 1. Outcome aggregation match filter (college-scoped, status: 'verified')
  const outcomeMatch = {
    collegeId: collegeObjId,
    status: 'verified',
  };

  // Structured for future filter extensions (e.g. verifiedAt range or batch) without rewriting pipeline
  if (filters.verifiedAtStart || filters.verifiedAtEnd) {
    outcomeMatch.verifiedAt = {};
    if (filters.verifiedAtStart) {
      outcomeMatch.verifiedAt.$gte = new Date(filters.verifiedAtStart);
    }
    if (filters.verifiedAtEnd) {
      outcomeMatch.verifiedAt.$lte = new Date(filters.verifiedAtEnd);
    }
  }

  // Server-side facet aggregation for verified selections, verified offers, and highest package
  const outcomeFacet = await PlacementOutcome.aggregate([
    { $match: outcomeMatch },
    {
      $facet: {
        offersAndPackage: [
          {
            $group: {
              _id: null,
              verifiedOffers: { $sum: 1 },
              maxCtc: {
                $max: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$offerPackage.ctc', null] },
                        { $gt: ['$offerPackage.ctc', 0] },
                      ],
                    },
                    '$offerPackage.ctc',
                    null,
                  ],
                },
              },
            },
          },
        ],
        distinctStudents: [
          { $group: { _id: '$student' } },
          { $count: 'count' },
        ],
      },
    },
  ]);

  const offersInfo = outcomeFacet[0]?.offersAndPackage?.[0];
  const verifiedOffers = offersInfo?.verifiedOffers || 0;
  const rawMaxCtc = offersInfo?.maxCtc;

  const highestPackage =
    rawMaxCtc !== null &&
    rawMaxCtc !== undefined &&
    typeof rawMaxCtc === 'number' &&
    !Number.isNaN(rawMaxCtc) &&
    rawMaxCtc > 0
      ? { ctc: rawMaxCtc, unit: 'LPA' }
      : null;

  const distinctInfo = outcomeFacet[0]?.distinctStudents?.[0];
  const verifiedSelections = distinctInfo?.count || 0;

  // 2. Needs Verification: Selected applications without a verified outcome
  // Approach 1 ($lookup): server-side left-outer join on application ID with negative condition
  const appMatch = {
    collegeId: collegeObjId,
    status: 'Selected',
  };

  const needsVerificationResult = await DriveApplication.aggregate([
    { $match: appMatch },
    {
      $lookup: {
        from: 'placementoutcomes',
        localField: '_id',
        foreignField: 'application',
        as: 'outcomes',
      },
    },
    {
      $match: {
        outcomes: {
          $not: {
            $elemMatch: { status: 'verified' },
          },
        },
      },
    },
    {
      $count: 'count',
    },
  ]);

  const needsVerification = needsVerificationResult[0]?.count || 0;

  return {
    verifiedSelections,
    verifiedOffers,
    highestPackage,
    needsVerification,
  };
}

module.exports = {
  getPlacementMetricsService,
};

