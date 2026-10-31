const mongoose = require('mongoose');
const Department = require('../models/Department');
const {
  normalizeDepartmentKey,
  validateAlias,
  validateHodContact,
} = require('../utils/departmentResolver');
const { validateOfficerCollegeContext } = require('./officerController');

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

module.exports = {
  getOfficerDepartments,
  updateDepartmentHodContact,
  updateDepartmentAliases,
};
