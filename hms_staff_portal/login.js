// If already logged in, skip straight to the portal.
if (hmsIsLoggedIn()) {
  window.location.href = 'index.html';
}

function showLoginFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const err = document.getElementById('err-' + inputId);
  if (input) input.classList.add('input-invalid');
  if (err) {
    if (message) err.textContent = message;
    err.style.display = 'block';
  }
}

function clearLoginFieldError(inputId) {
  const input = document.getElementById(inputId);
  const err = document.getElementById('err-' + inputId);
  if (input) input.classList.remove('input-invalid');
  if (err) err.style.display = 'none';
}

function showLoginAlert(message) {
  const alertBox = document.getElementById('loginAlert');
  const alertText = document.getElementById('loginAlertText');
  alertText.textContent = message;
  alertBox.style.display = 'block';
}

function hideLoginAlert() {
  document.getElementById('loginAlert').style.display = 'none';
}

function handleStaffLoginSubmit() {
  hideLoginAlert();
  clearLoginFieldError('loginUsername');
  clearLoginFieldError('loginPassword');

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  let valid = true;
  if (!username) {
    showLoginFieldError('loginUsername', 'Username is required.');
    valid = false;
  }
  if (!password) {
    showLoginFieldError('loginPassword', 'Password is required.');
    valid = false;
  }
  if (!valid) return;

  const deptKey = hmsAuthenticate(username, password);
  if (!deptKey) {
    showLoginAlert('Incorrect username or password. Please check your credentials and try again.');
    showLoginFieldError('loginPassword', '');
    document.getElementById('err-loginPassword').style.display = 'none';
    return;
  }

  hmsCreateSession(deptKey);
  window.location.href = 'index.html';
}
