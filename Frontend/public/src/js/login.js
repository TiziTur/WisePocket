// ============================================================
// KLARITY — login.js
// ============================================================
const API_BASE_URL =
    window.WISEPOCKET_API_BASE_URL ||
    'https://wisepocket-production.up.railway.app/api';

const TOKEN_KEY = 'klarity_token';
const USER_KEY  = 'klarity_user';

// ── Helpers ───────────────────────────────────────────────
function redirectByRole(role) {
    const r = (role || '').toLowerCase();
    if (r === 'advisor') { window.location.href = '/advisor'; return; }
    if (r === 'admin')   { window.location.href = '/admin';   return; }
    window.location.href = '/dashboard';
}

function saveSession(data, remember) {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, data.accessToken);
    store.setItem(USER_KEY,  JSON.stringify(data.user || {}));
}

function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Already logged in? ────────────────────────────────────
(function() {
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (token) {
        try {
            const user = JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || '{}');
            redirectByRole(user.role);
        } catch { window.location.href = '/dashboard'; }
    }
})();

// ── Login form ────────────────────────────────────────────
const form    = document.getElementById('loginForm');
const message = document.getElementById('loginMessage');

if (form) {
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        message.innerHTML = '<span style="color:var(--k-muted)">Validando credenciales...</span>';
        if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

        const payload = {
            email:    String(document.getElementById('email').value || '').trim(),
            password: String(document.getElementById('password').value || '')
        };

        try {
            const response = await fetch(API_BASE_URL + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                message.innerHTML = '<span style="color:var(--k-danger,#ef4444)"><i class="bi bi-exclamation-circle me-1"></i>' + escHtml(data.message || 'Credenciales incorrectas.') + '</span>';
                return;
            }

            message.innerHTML = '<span style="color:var(--k-success,#10b981)"><i class="bi bi-check-circle me-1"></i>Bienvenido/a. Redirigiendo...</span>';
            saveSession(data, true);
            setTimeout(() => redirectByRole(data.user && data.user.role), 600);
        } catch {
            message.innerHTML = '<span style="color:var(--k-danger,#ef4444)"><i class="bi bi-wifi-off me-1"></i>No se pudo conectar con el servidor.</span>';
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        }
    });
}

// ── Register form ─────────────────────────────────────────
const registerForm    = document.getElementById('registerForm');
const registerMessage = document.getElementById('registerMessage');

if (registerForm) {
    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const btn = registerForm.querySelector('button[type="submit"]');
        registerMessage.innerHTML = '<span style="color:var(--k-muted)">Creando cuenta...</span>';
        if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }

        const payload = {
            name:     String(document.getElementById('registerName').value || '').trim(),
            email:    String(document.getElementById('registerEmail').value || '').trim(),
            password: String(document.getElementById('registerPassword').value || '')
        };

        try {
            const response = await fetch(API_BASE_URL + '/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                registerMessage.innerHTML = '<span style="color:var(--k-danger,#ef4444)"><i class="bi bi-exclamation-circle me-1"></i>' + escHtml(data.message || 'No se pudo crear la cuenta.') + '</span>';
                return;
            }

            registerMessage.innerHTML = '<span style="color:var(--k-success,#10b981)"><i class="bi bi-check-circle me-1"></i>Cuenta creada. Redirigiendo...</span>';
            saveSession(data, true);
            setTimeout(() => redirectByRole(data.user && data.user.role), 600);
        } catch {
            registerMessage.innerHTML = '<span style="color:var(--k-danger,#ef4444)"><i class="bi bi-wifi-off me-1"></i>No se pudo conectar con el servidor.</span>';
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Crear cuenta'; }
        }
    });
}
