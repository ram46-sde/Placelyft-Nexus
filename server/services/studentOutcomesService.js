const mongoose = require('mongoose');
const PlacementOutcome = require('../models/PlacementOutcome');
const DriveApplication = require('../models/DriveApplication');

/**
 * Retrieves whitelisted placement outcomes and pending selections for the authenticated student.
 * Guarantees zero leakage of officer names, revocation reasons, audit history, or other students' data.
 * 
 * Returns:
 * {
 *   verifiedOutcomes: Array<{ company: string, role: string, verifiedAt: string, ctc?: number }>,
 *   pendingSelections: Array<{ applicationId: string, company: string, role: string }>
 * }
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.studentId Authenticated student ID
 * @param {string|mongoose.Types.ObjectId} params.collegeId Authenticated student's college ID
 * @returns {Promise<{ verifiedOutcomes: Array<Object>, pendingSelections: Array<Object> }>}
 */
async function getStudentOutcomesService({ studentId, collegeId }) {
  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
    throw new Error('Invalid student ID.');
  }
  if (!collegeId || !mongoose.Types.ObjectId.isValid(collegeId)) {
    throw new Error('Invalid college ID.');
  }

  const studentObjId = new mongoose.Types.ObjectId(studentId);
  const collegeObjId = new mongoose.Types.ObjectId(collegeId);

  // 1. Query verified outcomes for this student within their college
  const verifiedDocs = await PlacementOutcome.find({
    student: studentObjId,
    collegeId: collegeObjId,
    status: 'verified',
  })
    .populate({
      path: 'placementDrive',
      select: 'jobRole company',
      populate: { path: 'company', select: 'name' },
    })
    .sort({ verifiedAt: -1, _id: -1 });

  // Build verified application ID set for fast lookups
  const verifiedAppIdSet = new Set(
    verifiedDocs.map((doc) => doc.application.toString())
  );

  const verifiedOutcomes = verifiedDocs.map((doc) => {
    const company =
      (doc.placementDrive && doc.placementDrive.company && doc.placementDrive.company.name) ||
      'Company';
    const role = (doc.placementDrive && doc.placementDrive.jobRole) || 'Role';
    const verifiedAt = doc.verifiedAt ? new Date(doc.verifiedAt).toISOString() : null;

    const item = {
      company,
      role,
      verifiedAt,
    };

    if (
      doc.offerPackage &&
      typeof doc.offerPackage.ctc === 'number' &&
      !Number.isNaN(doc.offerPackage.ctc) &&
      doc.offerPackage.ctc > 0
    ) {
      item.ctc = doc.offerPackage.ctc;
    }

    return item;
  });

  // 2. Query Selected applications for this student within their college
  // Selected applications that have no verified outcome (or whose outcome was revoked) appear as pendingSelections
  const selectedApps = await DriveApplication.find({
    student: studentObjId,
    collegeId: collegeObjId,
    status: 'Selected',
  })
    .populate({
      path: 'placementDrive',
      select: 'jobRole company',
      populate: { path: 'company', select: 'name' },
    })
    .sort({ createdAt: -1, _id: -1 });

  const pendingSelections = [];
  for (const app of selectedApps) {
    const appIdStr = app._id.toString();
    if (!verifiedAppIdSet.has(appIdStr)) {
      pendingSelections.push({
        applicationId: appIdStr,
        company:
          (app.placementDrive && app.placementDrive.company && app.placementDrive.company.name) ||
          'Company',
        role: (app.placementDrive && app.placementDrive.jobRole) || 'Role',
      });
    }
  }

  return {
    verifiedOutcomes,
    pendingSelections,
  };
}

module.exports = {
  getStudentOutcomesService,
};

