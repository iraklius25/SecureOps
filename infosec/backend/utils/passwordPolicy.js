const MIN_LENGTH = 12;

function validatePassword(password) {
  if (!password || password.length < MIN_LENGTH)
    return `Password must be at least ${MIN_LENGTH} characters`;
  if (!/[A-Z]/.test(password))
    return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password))
    return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password))
    return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(password))
    return 'Password must contain at least one special character';
  return null;
}

module.exports = { validatePassword, MIN_LENGTH };
