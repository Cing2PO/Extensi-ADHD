/**
 * Auth Controller - Manages Authentication UI, Forms, Modal & Session State
 */

import { getAuthSession, loginUser, registerUser, logoutUser } from '../services/authService.js';

export function initAuthController(callbacks = {}) {
  // DOM Elements
  const headerAuthContainer = document.getElementById('header-auth-container');
  const btnHeaderAuth = document.getElementById('btn-header-auth');
  const userChipName = document.getElementById('auth-user-chip-name');

  const authModal = document.getElementById('auth-modal');
  const btnCloseAuthModal = document.getElementById('btn-close-auth-modal');

  const tabAuthLogin = document.getElementById('tab-auth-login');
  const tabAuthRegister = document.getElementById('tab-auth-register');

  const formLogin = document.getElementById('auth-form-login');
  const formRegister = document.getElementById('auth-form-register');

  const loginEmailInput = document.getElementById('auth-login-email');
  const loginPasswordInput = document.getElementById('auth-login-password');
  const btnLoginSubmit = document.getElementById('btn-login-submit');
  const loginErrorBox = document.getElementById('auth-login-error');

  const regNameInput = document.getElementById('auth-reg-name');
  const regEmailInput = document.getElementById('auth-reg-email');
  const regPasswordInput = document.getElementById('auth-reg-password');
  const btnRegSubmit = document.getElementById('btn-register-submit');
  const regErrorBox = document.getElementById('auth-reg-error');

  const btnLogout = document.getElementById('btn-auth-logout');

  let currentActiveTab = 'login'; // 'login' | 'register'

  // Helper: Switch Auth Modal Tabs
  function switchTab(targetTab) {
    currentActiveTab = targetTab;
    if (targetTab === 'login') {
      if (tabAuthLogin) tabAuthLogin.classList.add('active');
      if (tabAuthRegister) tabAuthRegister.classList.remove('active');
      if (formLogin) formLogin.classList.remove('hidden');
      if (formRegister) formRegister.classList.add('hidden');
    } else {
      if (tabAuthRegister) tabAuthRegister.classList.add('active');
      if (tabAuthLogin) tabAuthLogin.classList.remove('active');
      if (formRegister) formRegister.classList.remove('hidden');
      if (formLogin) formLogin.classList.add('hidden');
    }
    clearErrors();
  }

  function clearErrors() {
    if (loginErrorBox) {
      loginErrorBox.textContent = '';
      loginErrorBox.classList.add('hidden');
    }
    if (regErrorBox) {
      regErrorBox.textContent = '';
      regErrorBox.classList.add('hidden');
    }
  }

  function showLoginError(msg) {
    if (loginErrorBox) {
      loginErrorBox.textContent = msg;
      loginErrorBox.classList.remove('hidden');
    } else if (window.Swal) {
      window.Swal.fire('Login Gagal', msg, 'error');
    }
  }

  function showRegError(msg) {
    if (regErrorBox) {
      regErrorBox.textContent = msg;
      regErrorBox.classList.remove('hidden');
    } else if (window.Swal) {
      window.Swal.fire('Registrasi Gagal', msg, 'error');
    }
  }

  function openAuthModal(defaultTab = 'login') {
    switchTab(defaultTab);
    if (authModal) authModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeAuthModal() {
    if (authModal) authModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    clearErrors();
  }

  // Update Header User Profile UI
  async function refreshUserUI() {
    const { currentUser, accessToken } = await getAuthSession();
    if (accessToken && currentUser) {
      if (userChipName) userChipName.textContent = currentUser.name || currentUser.email || 'Pengguna';
      if (btnHeaderAuth) btnHeaderAuth.classList.add('is-logged-in');
      if (btnLogout) btnLogout.classList.remove('hidden');
    } else {
      if (userChipName) userChipName.textContent = '🔑 Login';
      if (btnHeaderAuth) btnHeaderAuth.classList.remove('is-logged-in');
      if (btnLogout) btnLogout.classList.add('hidden');
    }
  }

  // Handle Login Submit
  async function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    clearErrors();

    const email = loginEmailInput ? loginEmailInput.value.trim() : '';
    const password = loginPasswordInput ? loginPasswordInput.value.trim() : '';

    if (!email || !password) {
      showLoginError('Email dan password wajib diisi.');
      return;
    }

    if (btnLoginSubmit) {
      btnLoginSubmit.disabled = true;
      btnLoginSubmit.textContent = 'Memproses...';
    }

    try {
      const result = await loginUser(email, password);
      closeAuthModal();
      await refreshUserUI();

      if (window.Swal) {
        window.Swal.fire({
          icon: 'success',
          title: 'Login Berhasil!',
          text: `Selamat datang kembali, ${result.user.name || result.user.email}!`,
          timer: 2000,
          showConfirmButton: false
        });
      }

      if (typeof callbacks.onLoginSuccess === 'function') {
        callbacks.onLoginSuccess(result);
      }
    } catch (err) {
      showLoginError(err.message || 'Login gagal.');
    } finally {
      if (btnLoginSubmit) {
        btnLoginSubmit.disabled = false;
        btnLoginSubmit.textContent = 'Masuk Akun';
      }
    }
  }

  // Handle Register Submit
  async function handleRegisterSubmit(e) {
    if (e) e.preventDefault();
    clearErrors();

    const name = regNameInput ? regNameInput.value.trim() : '';
    const email = regEmailInput ? regEmailInput.value.trim() : '';
    const password = regPasswordInput ? regPasswordInput.value.trim() : '';

    if (!name || !email || !password) {
      showRegError('Semua kolom wajib diisi.');
      return;
    }

    if (password.length < 6) {
      showRegError('Password minimal terdiri dari 6 karakter.');
      return;
    }

    if (btnRegSubmit) {
      btnRegSubmit.disabled = true;
      btnRegSubmit.textContent = 'Mendaftarkan...';
    }

    try {
      const result = await registerUser(name, email, password);
      closeAuthModal();
      await refreshUserUI();

      if (window.Swal) {
        window.Swal.fire({
          icon: 'success',
          title: 'Registrasi Berhasil!',
          text: `Akun berhasil dibuat. Selamat datang, ${result.user.name}!`,
          timer: 2000,
          showConfirmButton: false
        });
      }

      if (typeof callbacks.onLoginSuccess === 'function') {
        callbacks.onLoginSuccess(result);
      }
    } catch (err) {
      showRegError(err.message || 'Registrasi gagal.');
    } finally {
      if (btnRegSubmit) {
        btnRegSubmit.disabled = false;
        btnRegSubmit.textContent = 'Daftar Akun Baru';
      }
    }
  }

  // Handle Logout
  async function handleLogout() {
    if (window.Swal) {
      const res = await window.Swal.fire({
        title: 'Keluar Akun?',
        text: 'Anda akan kembali ke Guest Mode.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Logout',
        cancelButtonText: 'Batal'
      });
      if (!res.isConfirmed) return;
    }

    await logoutUser();
    await refreshUserUI();

    if (window.Swal) {
      window.Swal.fire({
        icon: 'info',
        title: 'Berhasil Logout',
        timer: 1500,
        showConfirmButton: false
      });
    }

    if (typeof callbacks.onLogout === 'function') {
      callbacks.onLogout();
    }
  }

  // Event Listeners
  if (btnHeaderAuth) {
    btnHeaderAuth.addEventListener('click', async () => {
      const { accessToken } = await getAuthSession();
      if (accessToken) {
        // Show Logout confirmation or user options
        handleLogout();
      } else {
        openAuthModal('login');
      }
    });
  }

  if (btnCloseAuthModal) btnCloseAuthModal.addEventListener('click', closeAuthModal);
  if (tabAuthLogin) tabAuthLogin.addEventListener('click', () => switchTab('login'));
  if (tabAuthRegister) tabAuthRegister.addEventListener('click', () => switchTab('register'));

  if (formLogin) formLogin.addEventListener('submit', handleLoginSubmit);
  if (formRegister) formRegister.addEventListener('submit', handleRegisterSubmit);
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  // Initial UI Setup
  refreshUserUI();

  return {
    openAuthModal,
    closeAuthModal,
    refreshUserUI,
    handleLogout
  };
}
