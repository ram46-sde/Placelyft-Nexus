const mongoose = require('mongoose');
const Department = require('../models/Department');
const DriveAttendance = require('../models/DriveAttendance');
const StudentProfile = require('../models/StudentProfile');
const PlacementOutcome = require('../models/PlacementOutcome');
const {
  normalizeDepartmentKey,
  validateAlias,
  validateHodContact,
} = require('../utils/departmentResolver');
const { validateOfficerCollegeContext } = require('./officerController');
const coord = require('../utils/departmentCoordination');

const POLL_INTERVAL_MS = 50;
const DRAIN_TIMEOUT_MS = 5000;

/**
 * @desc    List active departments for the authenticated officer's college
 * @route   GET /api/officer/departments
 * @access  Private (Placement Officer)
 */
const getOfficerDepartments = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    // Scoped strictly to authenticated officer's college and active departments
    const departments = await Department.find({
      collegeId: req.user.collegeId,
      isActive: true,
    })
      .select('_id name code aliases hodContact isCustom isActive createdAt updatedAt')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: departments.length,
      departments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update HOD contact information for a department
 * @route   PUT /api/officer/departments/:id/hod-contact
 * @access  Private (Placement Officer)
 */
const updateDepartmentHodContact = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department ID format.',
      });
    }

    // Tenant isolation: Scoped find query by _id AND collegeId
    // Returns 404 for missing or cross-college departments to prevent existence leakage
    const department = await Department.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.',
      });
    }

    // Strict whitelist: Only process the 4 hodContact fields from req.body
    const { name, email, phone, officeLocation } = req.body || {};
    const rawContactPayload = {};
    if (name !== undefined) rawContactPayload.name = name;
    if (email !== undefined) rawContactPayload.email = email;
    if (phone !== undefined) rawContactPayload.phone = phone;
    if (officeLocation !== undefined) rawContactPayload.officeLocation = officeLocation;

    const validation = validateHodContact(rawContactPayload);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid HOD contact details.',
        errors: validation.errors,
      });
    }

    if (!department.hodContact) {
      department.hodContact = {};
    }

    // Semantics: Only fields present in req.body are changed.
    // An empty string or null clears that field. Omitted fields stay as they are.
    if (name !== undefined) {
      department.hodContact.name = validation.sanitized.name || undefined;
    }
    if (email !== undefined) {
      department.hodContact.email = validation.sanitized.email || undefined;
    }
    if (phone !== undefined) {
      department.hodContact.phone = validation.sanitized.phone || undefined;
    }
    if (officeLocation !== undefined) {
      department.hodContact.officeLocation = validation.sanitized.officeLocation || undefined;
    }

    await department.save();

    res.status(200).json({
      success: true,
      message: 'HOD contact updated successfully.',
      department,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update / replace aliases for a department
 * @route   PUT /api/officer/departments/:id/aliases
 * @access  Private (Placement Officer)
 */
const updateDepartmentAliases = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department ID format.',
      });
    }

    // Tenant isolation: Scoped find query by _id AND collegeId
    const department = await Department.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.',
      });
    }

    const { aliases } = req.body || {};
    if (!Array.isArray(aliases)) {
      return res.status(400).json({
        success: false,
        message: 'aliases must be an array of strings.',
      });
    }

    if (aliases.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'A department may have at most 10 aliases.',
      });
    }

    // Validate individual aliases and check for internal duplicates within the payload
    const normalizedSeen = new Set();
    const validatedAliases = [];

    for (const rawAlias of aliases) {
      const aliasValidation = validateAlias(rawAlias);
      if (!aliasValidation.valid) {
        return res.status(400).json({
          success: false,
          message: aliasValidation.error,
        });
      }

      if (normalizedSeen.has(aliasValidation.normalized)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate alias detected in payload: "${rawAlias.trim()}".`,
        });
      }
      normalizedSeen.add(aliasValidation.normalized);
      validatedAliases.push(rawAlias.trim());
    }

    // Self-conflict check: An alias cannot match this department's own name or code
    const ownNormalizedName = normalizeDepartmentKey(department.name);
    const ownNormalizedCode = normalizeDepartmentKey(department.code);

    for (const normA of normalizedSeen) {
      if (normA === ownNormalizedName || normA === ownNormalizedCode) {
        return res.status(400).json({
          success: false,
          message: `An alias cannot be identical to the department's own name or code.`,
        });
      }
    }

    // College-wide conflict check:
    // Compare against active AND inactive departments within the same college
    // to prevent hijacking or collision with inactive departments
    const allCollegeDepts = await Department.find({
      collegeId: req.user.collegeId,
    });

    for (const otherDept of allCollegeDepts) {
      if (otherDept._id.toString() === department._id.toString()) {
        continue;
      }

      const otherNormName = normalizeDepartmentKey(otherDept.name);
      const otherNormCode = normalizeDepartmentKey(otherDept.code);

      for (const normA of normalizedSeen) {
        if (normA === otherNormName) {
          return res.status(400).json({
            success: false,
            message: `Alias conflicts with existing department name: "${otherDept.name}".`,
          });
        }
        if (normA === otherNormCode) {
          return res.status(400).json({
            success: false,
            message: `Alias conflicts with existing department code: "${otherDept.code}".`,
          });
        }
        if (Array.isArray(otherDept.aliases)) {
          for (const otherAlias of otherDept.aliases) {
            if (normalizeDepartmentKey(otherAlias) === normA) {
              return res.status(400).json({
                success: false,
                message: `Alias "${otherAlias}" is already used by department "${otherDept.name}".`,
              });
            }
          }
        }
      }
    }

    department.aliases = validatedAliases;
    await department.save();

    res.status(200).json({
      success: true,
      message: 'Department aliases updated successfully.',
      department,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new department for the authenticated officer's college
 * @route   POST /api/officer/departments
 * @access  Private (Placement Officer)
 */
const createDepartment = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    // Tenant protection: Prevent client-supplied collegeId from assigning to another college
    if (req.body && req.body.collegeId && req.body.collegeId.toString() !== req.user.collegeId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot specify or change collegeId. Department is automatically assigned to your college.',
      });
    }

    const { name, code, aliases, hodContact, isCustom } = req.body || {};

    // 1. Required name check
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required.',
      });
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Department name must be between 2 and 100 characters.',
      });
    }

    // 2. Required code check
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Department code is required.',
      });
    }
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length < 2 || trimmedCode.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Department code must be between 2 and 20 characters.',
      });
    }

    // 3. Aliases validation
    let validatedAliases = [];
    if (aliases !== undefined) {
      if (!Array.isArray(aliases)) {
        return res.status(400).json({
          success: false,
          message: 'aliases must be an array of strings.',
        });
      }
      if (aliases.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'A department may have at most 10 aliases.',
        });
      }
      const normalizedSeen = new Set();
      for (const rawAlias of aliases) {
        const aliasValidation = validateAlias(rawAlias);
        if (!aliasValidation.valid) {
          return res.status(400).json({
            success: false,
            message: aliasValidation.error,
          });
        }
        if (normalizedSeen.has(aliasValidation.normalized)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate alias detected in payload: "${rawAlias.trim()}".`,
          });
        }
        normalizedSeen.add(aliasValidation.normalized);
        validatedAliases.push(rawAlias.trim());
      }
    }

    // 4. HOD contact validation
    let sanitizedHod = undefined;
    if (hodContact !== undefined && hodContact !== null) {
      if (typeof hodContact !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'hodContact must be an object.',
        });
      }
      const hodValidation = validateHodContact(hodContact);
      if (!hodValidation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid HOD contact details.',
          errors: hodValidation.errors,
        });
      }
      sanitizedHod = hodValidation.sanitized;
    }

    // 5. Duplicate and conflict checks scoped strictly to authenticated officer's college
    const allCollegeDepts = await Department.find({
      collegeId: req.user.collegeId,
    });

    const targetNormName = normalizeDepartmentKey(trimmedName);
    const targetNormCode = normalizeDepartmentKey(trimmedCode);

    for (const other of allCollegeDepts) {
      const otherNormName = normalizeDepartmentKey(other.name);
      const otherNormCode = normalizeDepartmentKey(other.code);

      if (otherNormName === targetNormName) {
        return res.status(400).json({
          success: false,
          message: `Department name already exists in this college: "${other.name}".`,
        });
      }
      if (otherNormCode === targetNormCode) {
        return res.status(400).json({
          success: false,
          message: `Department code already exists in this college: "${other.code}".`,
        });
      }
    }

    // Check alias conflict with own name or code
    for (const a of validatedAliases) {
      const normA = normalizeDepartmentKey(a);
      if (normA === targetNormName || normA === targetNormCode) {
        return res.status(400).json({
          success: false,
          message: `An alias cannot be identical to the department's own name or code.`,
        });
      }
    }

    // Check alias conflict with existing departments in this college
    for (const other of allCollegeDepts) {
      const otherNormName = normalizeDepartmentKey(other.name);
      const otherNormCode = normalizeDepartmentKey(other.code);

      for (const a of validatedAliases) {
        const normA = normalizeDepartmentKey(a);
        if (normA === otherNormName) {
          return res.status(400).json({
            success: false,
            message: `Alias conflicts with existing department name: "${other.name}".`,
          });
        }
        if (normA === otherNormCode) {
          return res.status(400).json({
            success: false,
            message: `Alias conflicts with existing department code: "${other.code}".`,
          });
        }
        if (Array.isArray(other.aliases)) {
          for (const otherA of other.aliases) {
            if (normalizeDepartmentKey(otherA) === normA) {
              return res.status(400).json({
                success: false,
                message: `Alias "${otherA}" is already used by department "${other.name}".`,
              });
            }
          }
        }
      }
    }

    const newDepartment = await Department.create({
      collegeId: req.user.collegeId,
      name: trimmedName,
      code: trimmedCode,
      isCustom: isCustom !== undefined ? !!isCustom : true,
      isActive: true,
      ...(sanitizedHod ? { hodContact: sanitizedHod } : {}),
      aliases: validatedAliases,
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully.',
      department: newDepartment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an existing department belonging to the officer's college
 * @route   PUT /api/officer/departments/:id
 * @access  Private (Placement Officer)
 */
const updateDepartment = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department ID format.',
      });
    }

    // Scoped lookup strictly to officer's college
    const department = await Department.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.',
      });
    }

    // Reject protected fields
    const FORBIDDEN_FIELDS = ['_id', 'collegeId', 'isActive', 'createdAt', 'updatedAt', '__v'];
    for (const f of FORBIDDEN_FIELDS) {
      if (req.body && req.body[f] !== undefined) {
        return res.status(400).json({
          success: false,
          message: `Cannot modify protected field: ${f}.`,
        });
      }
    }

    const { name, code, aliases, hodContact } = req.body || {};

    let targetName = department.name;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Department name cannot be empty.',
        });
      }
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Department name must be between 2 and 100 characters.',
        });
      }
      targetName = trimmed;
    }

    let targetCode = department.code;
    if (code !== undefined) {
      if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Department code cannot be empty.',
        });
      }
      const trimmed = code.trim().toUpperCase();
      if (trimmed.length < 2 || trimmed.length > 20) {
        return res.status(400).json({
          success: false,
          message: 'Department code must be between 2 and 20 characters.',
        });
      }
      targetCode = trimmed;
    }

    let targetAliases = department.aliases || [];
    if (aliases !== undefined) {
      if (!Array.isArray(aliases)) {
        return res.status(400).json({
          success: false,
          message: 'aliases must be an array of strings.',
        });
      }
      if (aliases.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'A department may have at most 10 aliases.',
        });
      }
      const normalizedSeen = new Set();
      const validatedList = [];
      for (const rawAlias of aliases) {
        const aliasValidation = validateAlias(rawAlias);
        if (!aliasValidation.valid) {
          return res.status(400).json({
            success: false,
            message: aliasValidation.error,
          });
        }
        if (normalizedSeen.has(aliasValidation.normalized)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate alias detected in payload: "${rawAlias.trim()}".`,
          });
        }
        normalizedSeen.add(aliasValidation.normalized);
        validatedList.push(rawAlias.trim());
      }
      targetAliases = validatedList;
    }

    // Duplicate conflict checks against other departments in the same college
    const allCollegeDepts = await Department.find({
      collegeId: req.user.collegeId,
    });

    const targetNormName = normalizeDepartmentKey(targetName);
    const targetNormCode = normalizeDepartmentKey(targetCode);

    for (const other of allCollegeDepts) {
      if (other._id.toString() === department._id.toString()) continue;

      const otherNormName = normalizeDepartmentKey(other.name);
      const otherNormCode = normalizeDepartmentKey(other.code);

      if (otherNormName === targetNormName) {
        return res.status(400).json({
          success: false,
          message: `Department name already exists in this college: "${other.name}".`,
        });
      }
      if (otherNormCode === targetNormCode) {
        return res.status(400).json({
          success: false,
          message: `Department code already exists in this college: "${other.code}".`,
        });
      }
    }

    // Check alias conflict with own name or code
    for (const a of targetAliases) {
      const normA = normalizeDepartmentKey(a);
      if (normA === targetNormName || normA === targetNormCode) {
        return res.status(400).json({
          success: false,
          message: `An alias cannot be identical to the department's own name or code.`,
        });
      }
    }

    // Check alias conflict with other departments in this college
    for (const other of allCollegeDepts) {
      if (other._id.toString() === department._id.toString()) continue;

      const otherNormName = normalizeDepartmentKey(other.name);
      const otherNormCode = normalizeDepartmentKey(other.code);

      for (const a of targetAliases) {
        const normA = normalizeDepartmentKey(a);
        if (normA === otherNormName) {
          return res.status(400).json({
            success: false,
            message: `Alias conflicts with existing department name: "${other.name}".`,
          });
        }
        if (normA === otherNormCode) {
          return res.status(400).json({
            success: false,
            message: `Alias conflicts with existing department code: "${other.code}".`,
          });
        }
        if (Array.isArray(other.aliases)) {
          for (const otherA of other.aliases) {
            if (normalizeDepartmentKey(otherA) === normA) {
              return res.status(400).json({
                success: false,
                message: `Alias "${otherA}" is already used by department "${other.name}".`,
              });
            }
          }
        }
      }
    }

    // HOD contact validation
    if (hodContact !== undefined) {
      if (hodContact === null || typeof hodContact !== 'object') {
        department.hodContact = undefined;
      } else {
        const hodValidation = validateHodContact(hodContact);
        if (!hodValidation.valid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid HOD contact details.',
            errors: hodValidation.errors,
          });
        }
        department.hodContact = hodValidation.sanitized;
      }
    }

    department.name = targetName;
    department.code = targetCode;
    department.aliases = targetAliases;

    await department.save();

    res.status(200).json({
      success: true,
      message: 'Department updated successfully.',
      department,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Permanently delete a department if no dependent records exist,
 *          using the coordinated deletion gate protocol (Stage 3).
 * @route   DELETE /api/officer/departments/:id
 * @access  Private (Placement Officer)
 */
const deleteDepartment = async (req, res, next) => {
  let deletionToken = null;
  let gateClaimed = false;
  let successfullyDeleted = false;

  const attemptRestoration = async (departmentId, collegeId, token) => {
    if (!gateClaimed || successfullyDeleted || !token) return;
    gateClaimed = false;
    try {
      const restoreRes = await coord.restoreDepartmentDeletion({
        departmentId,
        collegeId,
        deletionToken: token,
      });
      if (!restoreRes.success) {
        console.error('[CRITICAL] Department deletion gate restoration failed:', {
          departmentId: departmentId ? departmentId.toString() : null,
          collegeId: collegeId ? collegeId.toString() : null,
          deletionToken: token,
          result: restoreRes,
        });
      }
      return restoreRes;
    } catch (err) {
      console.error('[CRITICAL] Exception while restoring department deletion gate:', {
        departmentId: departmentId ? departmentId.toString() : null,
        collegeId: collegeId ? collegeId.toString() : null,
        deletionToken: token,
        error: err.message,
      });
      return { success: false, code: 'RESTORATION_EXCEPTION', message: err.message };
    }
  };

  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department ID format.',
      });
    }

    // Step A. Pre-check target department existence in this college
    const targetDept = await Department.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    });

    if (!targetDept) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.',
      });
    }

    if (targetDept.deletionState === 'closing' || Boolean(targetDept.deletionToken)) {
      return res.status(409).json({
        success: false,
        code: 'DELETION_CLAIM_REJECTED',
        message: 'Could not claim deletion operation: Department not found or deletion is already in progress.',
      });
    }

    // Generate unique operation token and atomically claim the deletion gate
    deletionToken = coord.generateOperationId();
    const claimRes = await coord.claimDepartmentDeletion({
      departmentId: id,
      collegeId: req.user.collegeId,
      deletionToken,
    });

    if (!claimRes.success) {
      return res.status(409).json({
        success: false,
        code: claimRes.code || 'DELETION_CLAIM_REJECTED',
        message: claimRes.message || 'Could not claim deletion operation: Deletion is already in progress.',
      });
    }

    gateClaimed = true;

    // Step B. Wait for active writers to drain (poll activeWriterIds at 50ms intervals up to 5000ms)
    const startTime = Date.now();
    let writersDrained = false;

    while (Date.now() - startTime < DRAIN_TIMEOUT_MS) {
      const current = await Department.findOne({
        _id: id,
        collegeId: req.user.collegeId,
      }).select('activeWriterIds deletionState deletionToken name');

      if (!current || current.deletionToken !== deletionToken || current.deletionState !== 'closing') {
        // Ownership lost
        return res.status(409).json({
          success: false,
          code: 'DELETION_OWNERSHIP_LOST',
          message: 'Deletion ownership was lost or modified by another request.',
        });
      }

      if (!current.activeWriterIds || current.activeWriterIds.length === 0) {
        writersDrained = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!writersDrained) {
      await attemptRestoration(id, req.user.collegeId, deletionToken);
      return res.status(409).json({
        success: false,
        code: 'ACTIVE_WRITERS_DRAIN_TIMEOUT',
        message: 'Cannot delete department: Timed out waiting for active operations to complete.',
      });
    }

    // Step C. Verify deletion ownership before dependency checks
    const ownedDept = await Department.findOne({
      _id: id,
      collegeId: req.user.collegeId,
      deletionState: 'closing',
      deletionToken,
    });

    if (!ownedDept) {
      return res.status(409).json({
        success: false,
        code: 'DELETION_OWNERSHIP_LOST',
        message: 'Deletion ownership was lost or modified by another request.',
      });
    }

    // Step D. Check dependencies across DriveAttendance, StudentProfile, PlacementOutcome
    const [attendanceCount, studentProfileCount, outcomeCount] = await Promise.all([
      DriveAttendance.countDocuments({
        collegeId: req.user.collegeId,
        $or: [
          { departmentId: ownedDept._id },
          { departmentName: ownedDept.name },
        ],
      }),
      StudentProfile.countDocuments({
        collegeId: req.user.collegeId,
        departmentId: ownedDept._id,
      }),
      PlacementOutcome.countDocuments({
        collegeId: req.user.collegeId,
        $or: [
          { 'departmentSnapshot.departmentId': ownedDept._id },
          { 'departmentSnapshot.departmentName': ownedDept.name },
        ],
      }),
    ]);

    const totalDependents = attendanceCount + studentProfileCount + outcomeCount;
    if (totalDependents > 0) {
      await attemptRestoration(id, req.user.collegeId, deletionToken);

      const reasons = [];
      if (attendanceCount > 0) reasons.push(`${attendanceCount} attendance record(s)`);
      if (studentProfileCount > 0) reasons.push(`${studentProfileCount} student profile(s)`);
      if (outcomeCount > 0) reasons.push(`${outcomeCount} placement outcome(s)`);

      return res.status(409).json({
        success: false,
        code: 'DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS',
        message: `Cannot delete department "${ownedDept.name}" because ${reasons.join(', ')} reference it. Historical records cannot be deleted.`,
        details: {
          attendanceRecords: attendanceCount,
          studentProfiles: studentProfileCount,
          placementOutcomes: outcomeCount,
        },
      });
    }

    // Step E. Delete safely: Conditional delete strictly matching _id, collegeId, closing state, and exact deletionToken
    const deleted = await Department.findOneAndDelete({
      _id: id,
      collegeId: req.user.collegeId,
      deletionState: 'closing',
      deletionToken,
    });

    if (!deleted) {
      return res.status(409).json({
        success: false,
        code: 'DELETION_CONDITIONAL_DELETE_FAILED',
        message: 'Could not complete department deletion: Ownership was lost or department was concurrently modified.',
      });
    }

    successfullyDeleted = true;

    return res.status(200).json({
      success: true,
      message: `Department "${deleted.name}" permanently deleted.`,
    });
  } catch (error) {
    // Step F. Error recovery: attempt ownership-checked restoration if gate was claimed
    await attemptRestoration(req.params?.id, req.user?.collegeId, deletionToken);
    next(error);
  }
};

module.exports = {
  getOfficerDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  updateDepartmentHodContact,
  updateDepartmentAliases,
};
