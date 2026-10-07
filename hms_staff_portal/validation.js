// ====================================================================
// St. Jude HMS — Field Validation Helpers
// Generic, reusable validators used by every "Add/Admit/Update" form
// across the departments (Reception, Doctor, Laboratory, Pharmacy,
// Billing). Each validate*Form() function returns a plain object of
// trimmed values on success, or null after displaying inline errors.
// ====================================================================

const HMS_VALIDATION_PATTERNS = {
  // Letters, spaces, periods, apostrophes, hyphens — e.g. "Dr. Aris Thorne", "Mary-Jane O'Neil"
  personName: /^[A-Za-z][A-Za-z.\-'\s]{1,79}$/,
  // "58 Years • Female (A+)" style, but kept lenient: needs at least one digit and one letter
  ageGender: /^(?=.*\d)(?=.*[A-Za-z]).{4,60}$/,
  // Accepts +91 98111 22334, 9811122334, (91) 9811-122334 etc: 7-15 digits total, optional +, spaces, hyphens, parens
  phone: /^\+?[\d\s\-().]{7,20}$/,
  // Vitals mini-formats
  bloodPressure: /^\d{2,3}\s*\/\s*\d{2,3}\s*(mmHg)?$/i,
  percentage: /^\d{1,3}\s*%$/,
  heartRate: /^\d{2,3}\s*(bpm)?$/i,
  temperature: /^\d{2,3}(\.\d{1,2})?\s*°?[FC]?$/i,
};

function hmsShowFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.classList.add('input-invalid');
  let err = document.getElementById('err-' + inputId);
  if (!err) {
    err = document.createElement('div');
    err.id = 'err-' + inputId;
    err.className = 'field-error';
    // If the input is inside a flex wrapper (e.g. +91 prefix container),
    // insert the error element after the flex wrapper so it appears cleanly below!
    const flexParent = input.closest('div[style*="display: flex"], div[style*="display:flex"]');
    if (flexParent && flexParent.parentElement) {
      flexParent.insertAdjacentElement('afterend', err);
    } else {
      input.insertAdjacentElement('afterend', err);
    }
  }
  err.textContent = message;
  err.style.display = 'block';
}

function hmsClearFieldError(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.classList.remove('input-invalid');
  const err = document.getElementById('err-' + inputId);
  if (err) err.style.display = 'none';
}

function hmsClearFieldErrors(inputIds) {
  inputIds.forEach(hmsClearFieldError);
}

// Runs a list of {id, label, value, rules} checks. `rules` is an array of
// functions taking the trimmed value and returning an error string (or
// null/undefined if valid). Shows all failing fields at once and returns
// true only if every field passed.
function hmsValidateFields(fieldChecks) {
  let allValid = true;
  let firstInvalidEl = null;
  fieldChecks.forEach(({ id, value, rules }) => {
    hmsClearFieldError(id);
    for (const rule of rules) {
      const error = rule(value);
      if (error) {
        hmsShowFieldError(id, error);
        allValid = false;
        if (!firstInvalidEl) {
          firstInvalidEl = document.getElementById(id);
        }
        break;
      }
    }
  });
  if (firstInvalidEl) {
    try {
      firstInvalidEl.focus();
      firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
  }
  return allValid;
}

// ---- Common rule builders ----
function ruleRequired(label) {
  return (v) => (!v || !v.trim()) ? `${label} is required.` : null;
}
function ruleMinLength(n, label) {
  return (v) => (v && v.trim().length < n) ? `${label} must be at least ${n} characters.` : null;
}
function rulePattern(pattern, message) {
  return (v) => (v && !pattern.test(v.trim())) ? message : null;
}
function rulePositiveNumber(label) {
  return (v) => {
    const n = parseFloat(v);
    if (v === '' || v === null || v === undefined || isNaN(n)) return `${label} must be a valid number.`;
    if (n <= 0) return `${label} must be greater than zero.`;
    return null;
  };
}

// Age: integer, 0–150, no negatives
function ruleNonNegativeInt(label) {
  return (v) => {
    const n = parseInt(v, 10);
    if (v === '' || v === null || v === undefined || isNaN(n)) return `${label} must be a valid number.`;
    if (n < 0) return `${label} cannot be negative.`;
    if (!Number.isInteger(n) || String(n) !== String(v).trim()) return `${label} must be a whole number.`;
    if (n > 150) return `${label} must be 150 or below.`;
    return null;
  };
}

// Phone: exactly 10 digits, no spaces, no +, no special chars
function ruleExactDigits10(label) {
  return (v) => {
    const trimmed = (v || '').trim();
    if (!trimmed) return `${label} is required.`;
    if (!/^\d{10}$/.test(trimmed)) return `${label} must be exactly 10 digits with no spaces or symbols.`;
    return null;
  };
}

// Vitals: numeric float only (positive)
function ruleNumericFloat(label) {
  return (v) => {
    const trimmed = (v || '').trim();
    if (!trimmed) return `${label} is required.`;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return `${label} must be a numeric value (e.g. 98.6).`;
    if (parseFloat(trimmed) <= 0) return `${label} must be greater than zero.`;
    return null;
  };
}

// DOB: valid date, between 150 years ago and current date
function ruleValidDob(label) {
  return (v) => {
    const trimmed = (v || '').trim();
    if (!trimmed) return `${label} is required.`;
    const parts = trimmed.split('-');
    let d;
    if (parts.length === 3 && parts[0].length === 4) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(trimmed);
    }
    if (isNaN(d.getTime())) return `${label} must be a valid date.`;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) return `${label} cannot be after the current date.`;
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 150);
    minDate.setHours(0, 0, 0, 0);
    if (d < minDate) return `${label} cannot be more than 150 years ago (maximum age is 150 years).`;
    return null;
  };
}

