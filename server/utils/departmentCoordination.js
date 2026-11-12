const crypto = require('crypto');
const mongoose = require('mongoose');
const Department = require('../models/Department');

/**
 * Generates a cryptographically strong unique operation identifier.
 * Uses RFC 4122 v4 UUID.
 * 
 * @returns {string}
 */
const generateOperationId = () => crypto.randomUUID();

/**
 * Atomically acquires a writer token for a single department.
 * Acquisition succeeds ONLY IF:
 * - The department exists and belongs to the specified collegeId
 * - isActive is true
 * - deletionState is 'open' (or unset on legacy documents)
 * - deletionToken is null
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.departmentId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @param {string} [params.writerId] Optional explicit writer identifier; generated if omitted
 * @returns {Promise<{ success: boolean, departmentId: any, writerId: string|null, code?: string, message?: string, department?: Object }>}
 */
const acquireWriterToken = async ({ departmentId, collegeId, writerId }) => {
  if (
    !departmentId ||
    !collegeId ||
    !mongoose.Types.ObjectId.isValid(departmentId) ||
    !mongoose.Types.ObjectId.isValid(collegeId)
  ) {
    return {
      success: false,
      departmentId,
      writerId: null,
      code: 'INVALID_PARAMETERS',
      message: 'Valid departmentId and collegeId ObjectIds are required.',
    };
  }

  const token = writerId && typeof writerId === 'string' ? writerId : generateOperationId();

  const department = await Department.findOneAndUpdate(
    {
      _id: departmentId,
      collegeId,
      isActive: true,
      $or: [
        { deletionState: 'open' },
        { deletionState: { $exists: false } },
      ],
      deletionToken: null,
    },
    {
      $push: { activeWriterIds: token },
    },
    { new: true }
  );

  if (!department) {
    return {
      success: false,
      departmentId,
      writerId: null,
      code: 'WRITER_TOKEN_REJECTED',
      message: 'Could not acquire writer token: Department is not active or is closing for deletion.',
    };
  }

  return {
    success: true,
    departmentId: department._id,
    writerId: token,
    department,
  };
};

/**
 * Releases a single writer token from a department.
 * Removes strictly the exact writerId from activeWriterIds.
 * College scope is strictly mandatory to enforce tenant isolation.
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.departmentId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @param {string} params.writerId
 * @returns {Promise<{ success: boolean, code?: string, message?: string }>}
 */
const releaseWriterToken = async ({ departmentId, collegeId, writerId }) => {
  if (
    !departmentId ||
    !collegeId ||
    !writerId ||
    typeof writerId !== 'string' ||
    !mongoose.Types.ObjectId.isValid(departmentId) ||
    !mongoose.Types.ObjectId.isValid(collegeId)
  ) {
    return {
      success: false,
      code: 'INVALID_PARAMETERS',
      message: 'Valid departmentId, collegeId, and writerId string are required.',
    };
  }

  const result = await Department.updateOne(
    {
      _id: departmentId,
      collegeId, // Strict college scoping: never falls back to _id only
    },
    {
      $pull: { activeWriterIds: writerId },
    }
  );

  if (result.matchedCount === 0) {
    return {
      success: false,
      code: 'DEPARTMENT_NOT_FOUND',
      message: 'Department not found in the specified college.',
    };
  }

  return { success: true };
};

/**
 * Releases all writer tokens acquired across a batch operation.
 * Idempotently attempts release for each token in the list.
 * Continues attempting remaining releases even if an individual release fails.
 * Returns success: true only when every requested release succeeds.
 * An already-absent token (idempotent no-op) counts as a successful release.
 * 
 * @param {Object} params
 * @param {Array<{ departmentId: any, writerId: string }>} params.tokens
 * @param {string|mongoose.Types.ObjectId} params.collegeId Mandatory college scope
 * @returns {Promise<{ success: boolean, releasedCount: number, failedCount: number, failures: Array<{ departmentId: any, code: string, message: string }>, code?: string, message?: string }>}
 */
const releaseBatchWriterTokens = async ({ tokens, collegeId }) => {
  if (!collegeId || !mongoose.Types.ObjectId.isValid(collegeId)) {
    return {
      success: false,
      releasedCount: 0,
      failedCount: 0,
      failures: [],
      code: 'INVALID_PARAMETERS',
      message: 'Valid collegeId is required for batch release.',
    };
  }

  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { success: true, releasedCount: 0, failedCount: 0, failures: [] };
  }

  let releasedCount = 0;
  const failures = [];

  for (const token of tokens) {
    if (token && token.departmentId && token.writerId) {
      try {
        const res = await releaseWriterToken({
          departmentId: token.departmentId,
          collegeId,
          writerId: token.writerId,
        });
        if (res.success) {
          releasedCount++;
        } else {
          failures.push({
            departmentId: token.departmentId,
            code: res.code || 'RELEASE_FAILED',
            message: res.message || 'Writer token release returned failure.',
          });
        }
      } catch (err) {
        console.error(
          `[Token Release Error]: dept ${token.departmentId}, writer ${token.writerId}:`,
          err.message
        );
        failures.push({
          departmentId: token.departmentId,
          code: 'RELEASE_ERROR',
          message: err.message,
        });
      }
    }
  }

  return {
    success: failures.length === 0,
    releasedCount,
    failedCount: failures.length,
    failures,
  };
};

/**
 * Acquires writer tokens across multiple department IDs in a batch.
 * Guarantees:
 * - Duplicate department IDs in the input are deduplicated (no duplicate tokens created).
 * - If acquisition fails for ANY department, all tokens acquired earlier in the batch
 *   are immediately released before returning failure (zero unreleased tokens on partial failure).
 * 
 * @param {Object} params
 * @param {Array<string|mongoose.Types.ObjectId>} params.departmentIds
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @returns {Promise<{ success: boolean, tokens: Array<{ departmentId: any, writerId: string }>, failedDepartmentId?: any, code?: string, message?: string }>}
 */
const acquireBatchWriterTokens = async ({ departmentIds, collegeId }) => {
  if (!collegeId || !mongoose.Types.ObjectId.isValid(collegeId)) {
    return {
      success: false,
      tokens: [],
      code: 'INVALID_PARAMETERS',
      message: 'Valid collegeId is required.',
    };
  }

  if (!Array.isArray(departmentIds)) {
    return {
      success: false,
      tokens: [],
      code: 'INVALID_PARAMETERS',
      message: 'departmentIds must be an array.',
    };
  }

  // Deduplicate department IDs preserving ObjectId representations
  const uniqueDeptIds = [];
  const seenStrIds = new Set();

  for (const rawId of departmentIds) {
    if (!rawId) continue;
    const idStr = rawId.toString();
    if (!seenStrIds.has(idStr)) {
      seenStrIds.add(idStr);
      uniqueDeptIds.push(rawId);
    }
  }

  if (uniqueDeptIds.length === 0) {
    return { success: true, tokens: [] };
  }

  const acquiredTokens = [];

  for (const deptId of uniqueDeptIds) {
    const acquireRes = await acquireWriterToken({ departmentId: deptId, collegeId });
    if (!acquireRes.success) {
      // Partial acquisition failure: rollback all tokens acquired in this batch
      await releaseBatchWriterTokens({ tokens: acquiredTokens, collegeId });
      return {
        success: false,
        failedDepartmentId: deptId,
        tokens: [],
        code: 'BATCH_WRITER_TOKEN_REJECTED',
        message: `Failed to acquire writer token for department ${deptId}: ${acquireRes.message}`,
      };
    }

    acquiredTokens.push({
      departmentId: acquireRes.departmentId,
      writerId: acquireRes.writerId,
    });
  }

  return {
    success: true,
    tokens: acquiredTokens,
  };
};

/**
 * Atomically claims a department deletion operation.
 * Claim succeeds ONLY IF:
 * - The department exists and belongs to the specified collegeId
 * - deletionState is 'open' (or unset on legacy documents)
 * - deletionToken is null
 * 
 * Transitions document to:
 * - deletionState: 'closing'
 * - deletionToken: unique operation ID
 * - deletionStartedAt: Date.now()
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.departmentId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @param {string} [params.deletionToken] Optional explicit deletion token; generated if omitted
 * @returns {Promise<{ success: boolean, departmentId: any, deletionToken: string|null, deletionStartedAt?: Date, code?: string, message?: string, department?: Object }>}
 */
const claimDepartmentDeletion = async ({ departmentId, collegeId, deletionToken }) => {
  if (
    !departmentId ||
    !collegeId ||
    !mongoose.Types.ObjectId.isValid(departmentId) ||
    !mongoose.Types.ObjectId.isValid(collegeId)
  ) {
    return {
      success: false,
      departmentId,
      deletionToken: null,
      code: 'INVALID_PARAMETERS',
      message: 'Valid departmentId and collegeId ObjectIds are required.',
    };
  }

  const token = deletionToken && typeof deletionToken === 'string' ? deletionToken : generateOperationId();
  const startedAt = new Date();

  const department = await Department.findOneAndUpdate(
    {
      _id: departmentId,
      collegeId,
      $or: [
        { deletionState: 'open' },
        { deletionState: { $exists: false } },
      ],
      deletionToken: null,
    },
    {
      $set: {
        deletionState: 'closing',
        deletionToken: token,
        deletionStartedAt: startedAt,
      },
    },
    { new: true }
  );

  if (!department) {
    return {
      success: false,
      departmentId,
      deletionToken: null,
      code: 'DELETION_CLAIM_REJECTED',
      message: 'Could not claim deletion operation: Department not found or deletion is already in progress.',
    };
  }

  return {
    success: true,
    departmentId: department._id,
    deletionToken: token,
    deletionStartedAt: startedAt,
    department,
  };
};

/**
 * Restores a department to open state from closing state.
 * Restoration succeeds ONLY IF:
 * - The department matches _id AND collegeId
 * - deletionToken strictly matches the caller's operation token
 * - deletionState is 'closing'
 * 
 * Transitions document to:
 * - deletionState: 'open'
 * - deletionToken: null
 * - deletionStartedAt: null
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.departmentId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @param {string} params.deletionToken Caller's claimed deletion token
 * @returns {Promise<{ success: boolean, departmentId: any, code?: string, message?: string, department?: Object }>}
 */
const restoreDepartmentDeletion = async ({ departmentId, collegeId, deletionToken }) => {
  if (
    !departmentId ||
    !collegeId ||
    !mongoose.Types.ObjectId.isValid(departmentId) ||
    !mongoose.Types.ObjectId.isValid(collegeId)
  ) {
    return {
      success: false,
      departmentId,
      code: 'INVALID_PARAMETERS',
      message: 'Valid departmentId and collegeId ObjectIds are required.',
    };
  }

  if (!deletionToken || typeof deletionToken !== 'string') {
    return {
      success: false,
      departmentId,
      code: 'INVALID_DELETION_TOKEN',
      message: 'A non-empty string deletionToken is required for restoration.',
    };
  }

  const department = await Department.findOneAndUpdate(
    {
      _id: departmentId,
      collegeId,
      deletionToken, // Strict ownership check
      deletionState: 'closing',
    },
    {
      $set: {
        deletionState: 'open',
        deletionToken: null,
        deletionStartedAt: null,
      },
    },
    { new: true }
  );

  if (!department) {
    return {
      success: false,
      departmentId,
      code: 'RESTORATION_FAILED',
      message: 'Could not restore department deletion state: Department not found, not in closing state, or deletionToken mismatch.',
    };
  }

  return {
    success: true,
    departmentId: department._id,
    department,
  };
};

module.exports = {
  generateOperationId,
  acquireWriterToken,
  releaseWriterToken,
  acquireBatchWriterTokens,
  releaseBatchWriterTokens,
  claimDepartmentDeletion,
  restoreDepartmentDeletion,
};

