const API_BASE_URL =
    window.WISEPOCKET_API_BASE_URL ||
    localStorage.getItem('wisepocket.apiBaseUrl') ||
    'http://localhost:3000/api';
const AUTH_TOKEN_KEY = 'wisepocket.authToken';
const AUTH_USER_KEY = 'wisepocket.authUser';

const form = document.getElementById('loginForm');
const message = document.getElementById('loginMessage');
const registerForm = document.getElementById('registerForm');
const registerMessage = document.getElementById('registerMessage');

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = 'Validando credenciales...';

    const formData = new FormData(form);
    const payload = {
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || '')
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            message.textContent = data.message || 'No se pudo iniciar sesion.';
            return;
        }

        localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        message.textContent = `Bienvenido, ${data.user.name}. Login correcto.`;
        form.reset();
        setTimeout(() => {
            window.location.href = '/#funcionalidades-avanzadas';
        }, 500);
    } catch (error) {
        message.textContent = 'No se pudo conectar con el backend. Verifica que la API de Railway este activa.';
    }
});

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    registerMessage.textContent = 'Creando cuenta...';

    const formData = new FormData(registerForm);
    const payload = {
        name: String(formData.get('name') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || '')
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            registerMessage.textContent = data.message || 'No se pudo crear la cuenta.';
            return;
        }

        localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        registerMessage.textContent = `Cuenta creada. Bienvenido/a, ${data.user.name}.`;
        registerForm.reset();
        setTimeout(() => {
            window.location.href = '/#funcionalidades-avanzadas';
        }, 500);
    } catch (error) {
        registerMessage.textContent = 'No se pudo conectar con el backend. Verifica que la API de Railway este activa.';
    }
});
