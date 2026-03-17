const API_BASE_URL =
    window.WISEPOCKET_API_BASE_URL ||
    localStorage.getItem('wisepocket.apiBaseUrl') ||
    'http://localhost:3000/api';
const AUTH_TOKEN_KEY = 'wisepocket.authToken';
const AUTH_USER_KEY = 'wisepocket.authUser';
const ADVANCED_STORAGE_KEY = 'wisepocket.advanced.v1';
const BASE_CURRENCY = 'ARS';

const initialState = {
    localExpenses: [],
    subscriptions: [],
    budgets: { Ocio: 90000 },
    exchangeRates: { ARS: 1, USD: 1050, EUR: 1150 },
    lastRateUpdate: null
};

const cloneInitialState = () => JSON.parse(JSON.stringify(initialState));

const loadState = () => {
    try {
        const raw = localStorage.getItem(ADVANCED_STORAGE_KEY);
        if (!raw) {
            return cloneInitialState();
        }
        const parsed = JSON.parse(raw);
        return {
            ...cloneInitialState(),
            ...parsed,
            exchangeRates: {
                ...cloneInitialState().exchangeRates,
                ...(parsed.exchangeRates || {})
            },
            budgets: {
                ...cloneInitialState().budgets,
                ...(parsed.budgets || {})
            },
            localExpenses: Array.isArray(parsed.localExpenses) ? parsed.localExpenses : [],
            subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : []
        };
    } catch (_error) {
        return cloneInitialState();
    }
};

const state = loadState();
let backendExpenses = [];

const saveState = () => {
    localStorage.setItem(ADVANCED_STORAGE_KEY, JSON.stringify(state));
};

const authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
const authUser = (() => {
    try {
        return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
    } catch (_error) {
        return null;
    }
})();

const formExpense = document.getElementById('expenseForm');
const formSub = document.getElementById('subscriptionForm');
const formBudget = document.getElementById('budgetForm');
const formAdvisor = document.getElementById('advisorForm');
const formTicket = document.getElementById('ticketForm');
const formProfile = document.getElementById('profileForm');

if (formExpense && formSub && formBudget && formAdvisor) {
    const ratesInfo = document.getElementById('ratesInfo');
    const kpiSummary = document.getElementById('kpiSummary');
    const subscriptionCommitted = document.getElementById('subscriptionCommitted');
    const subscriptionList = document.getElementById('subscriptionList');
    const recurrentHint = document.getElementById('recurrentHint');
    const badgeList = document.getElementById('badgeList');
    const expenseList = document.getElementById('expenseList');
    const advisorAnswer = document.getElementById('advisorAnswer');
    const authStatus = document.getElementById('authStatus');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileMessage = document.getElementById('profileMessage');
    const logoutBtn = document.getElementById('logoutBtn');
    const ticketMessage = document.getElementById('ticketMessage');
    const advisorPanelOutput = document.getElementById('advisorPanelOutput');
    const advisorOverviewBtn = document.getElementById('advisorOverviewBtn');
    const advisorPatternsBtn = document.getElementById('advisorPatternsBtn');
    const advisorUserId = document.getElementById('advisorUserId');

    const toMoney = (amount) => new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 2
    }).format(Number(amount || 0));

    const toShortDate = (isoDate) => {
        if (!isoDate) {
            return '-';
        }
        const date = new Date(`${isoDate}T00:00:00`);
        return date.toLocaleDateString('es-AR');
    };

    const toARS = (amount, currency) => {
        if (currency === BASE_CURRENCY) {
            return Number(amount || 0);
        }
        const rate = Number(state.exchangeRates[currency] || 0);
        return rate ? Number(amount || 0) * rate : Number(amount || 0);
    };

    const normalizedExpense = (expense) => ({
        id: expense.id || `local-${Math.random().toString(36).slice(2, 10)}`,
        concept: expense.concept || expense.commerce || '',
        commerce: expense.commerce || expense.concept || '',
        category: expense.category || 'Otros',
        amount: Number(expense.amount || 0),
        currency: expense.currency || 'ARS',
        date: expense.date || new Date().toISOString().slice(0, 10),
        participants: Math.max(1, Number(expense.participants || 1)),
        description: expense.description || ''
    });

    const getCurrentExpenses = () => {
        const source = authToken && backendExpenses.length ? backendExpenses : state.localExpenses;
        return source.map(normalizedExpense);
    };

    const getExpenseImpactARS = (expense) => {
        const participants = Math.max(1, Number(expense.participants || 1));
        return toARS(Number(expense.amount || 0), expense.currency) / participants;
    };

    const groupByCategoryARS = (expenses) => {
        return expenses.reduce((acc, expense) => {
            const key = expense.category || 'Otros';
            acc[key] = (acc[key] || 0) + getExpenseImpactARS(expense);
            return acc;
        }, {});
    };

    const summarizeWeek = (expenses) => {
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);

        return expenses.filter((expense) => {
            const date = new Date(`${expense.date}T00:00:00`);
            return date >= sevenDaysAgo && date <= now;
        });
    };

    const detectRecurringExpenses = (expenses) => {
        if (expenses.length < 2) {
            return [];
        }

        const sorted = [...expenses].sort((a, b) => (a.date < b.date ? -1 : 1));
        const bucket = {};

        sorted.forEach((expense) => {
            const roundedAmount = Math.round(Number(expense.amount || 0));
            const key = `${expense.concept.toLowerCase()}|${expense.category}|${roundedAmount}|${expense.currency}`;
            if (!bucket[key]) {
                bucket[key] = [];
            }
            bucket[key].push(expense);
        });

        return Object.values(bucket)
            .filter((arr) => arr.length >= 2)
            .filter((arr) => {
                const d1 = new Date(`${arr[arr.length - 2].date}T00:00:00`);
                const d2 = new Date(`${arr[arr.length - 1].date}T00:00:00`);
                const days = Math.abs((d2 - d1) / (1000 * 60 * 60 * 24));
                return days >= 27 && days <= 35;
            })
            .map((arr) => arr[arr.length - 1]);
    };

    const getCommittedNextMonth = () => {
        return state.subscriptions.reduce((acc, item) => {
            return acc + toARS(Number(item.amount || 0), item.currency);
        }, 0);
    };

    const getMonthKey = (isoDate) => {
        const date = new Date(`${isoDate}T00:00:00`);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    const getBadgeCategories = (expenses) => {
        const monthlyByCategory = {};

        expenses.forEach((expense) => {
            const category = expense.category || 'Otros';
            const monthKey = getMonthKey(expense.date);
            if (!monthlyByCategory[category]) {
                monthlyByCategory[category] = {};
            }
            monthlyByCategory[category][monthKey] = (monthlyByCategory[category][monthKey] || 0) + getExpenseImpactARS(expense);
        });

        return Object.entries(state.budgets)
            .filter(([, budget]) => Number(budget) > 0)
            .filter(([category, budget]) => {
                const monthly = monthlyByCategory[category] || {};
                const months = Object.keys(monthly).sort();
                if (months.length < 3) {
                    return false;
                }
                const recentThree = months.slice(-3);
                return recentThree.every((month) => monthly[month] <= Number(budget));
            })
            .map(([category]) => category);
    };

    const apiFetch = async (path, options = {}) => {
        const headers = {
            ...(options.headers || {})
        };

        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || 'Error de API');
        }

        return data;
    };

    const loadBackendExpenses = async () => {
        if (!authToken) {
            backendExpenses = [];
            return;
        }

        try {
            const data = await apiFetch('/expenses', { method: 'GET' });
            backendExpenses = Array.isArray(data) ? data : [];
        } catch (_error) {
            backendExpenses = [];
        }
    };

    const buildAdvisorContext = (expenses) => {
        const totalImpact = expenses.reduce((acc, expense) => acc + getExpenseImpactARS(expense), 0);
        const weekly = summarizeWeek(expenses);
        const weeklyByCategory = groupByCategoryARS(weekly);
        const topWeekly = Object.entries(weeklyByCategory).sort((a, b) => b[1] - a[1])[0];

        return {
            totalExpenses: expenses.length,
            totalImpactARS: Number(totalImpact.toFixed(2)),
            topWeeklyCategory: topWeekly ? topWeekly[0] : 'Sin datos',
            topWeeklyAmountARS: topWeekly ? Number(topWeekly[1].toFixed(2)) : 0,
            committedNextMonthARS: Number(getCommittedNextMonth().toFixed(2)),
            budgetCount: Object.keys(state.budgets).length,
            badges: getBadgeCategories(expenses)
        };
    };

    const answerLocally = (question, expenses) => {
        const q = question.toLowerCase();
        const weekly = summarizeWeek(expenses);
        const weeklyByCategory = groupByCategoryARS(weekly);
        const ordered = Object.entries(weeklyByCategory).sort((a, b) => b[1] - a[1]);
        const top = ordered[0];

        if (q.includes('esta semana') && q.includes('mas')) {
            if (!top) {
                return 'Todavia no hay gastos semanales para analizar.';
            }
            return `Esta semana gastaste mas en ${top[0]}: ${toMoney(top[1])} de impacto real.`;
        }

        if (q.includes('suscripcion') || q.includes('comprometido')) {
            return `Tu gasto comprometido para el proximo mes es ${toMoney(getCommittedNextMonth())}.`;
        }

        if (q.includes('divisa') || q.includes('dolar') || q.includes('euro')) {
            return `Cotizaciones actuales: USD ${toMoney(state.exchangeRates.USD)} por unidad y EUR ${toMoney(state.exchangeRates.EUR)} por unidad (base ARS).`;
        }

        if (q.includes('logro') || q.includes('medalla') || q.includes('meta')) {
            const badges = getBadgeCategories(expenses);
            if (!badges.length) {
                return 'Aun no tienes medallas activas. Define presupuestos y manten 3 meses consecutivos por debajo del tope.';
            }
            return `Tienes medallas en: ${badges.join(', ')}.`;
        }

        const totalImpact = expenses.reduce((acc, expense) => acc + getExpenseImpactARS(expense), 0);
        return `Resumen rapido: ${expenses.length} gastos cargados, impacto total ${toMoney(totalImpact)} y comprometido proximo mes ${toMoney(getCommittedNextMonth())}.`;
    };

    const askOpenAI = async (apiKey, question, expenses) => {
        const context = buildAdvisorContext(expenses);
        const prompt = `Contexto financiero del usuario en ARS: ${JSON.stringify(context)}. Pregunta: ${question}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Eres un asesor financiero personal que responde en espanol claro y practico.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            throw new Error('No se pudo obtener respuesta de OpenAI.');
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Sin respuesta del modelo.';
    };

    const askGemini = async (apiKey, question, expenses) => {
        const context = buildAdvisorContext(expenses);
        const prompt = `Eres un asesor financiero personal. Contexto del usuario en ARS: ${JSON.stringify(context)}. Pregunta: ${question}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 }
            })
        });

        if (!response.ok) {
            throw new Error('No se pudo obtener respuesta de Gemini.');
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta del modelo.';
    };

    const renderAuth = async () => {
        if (!authToken || !authUser) {
            authStatus.textContent = 'Sin sesion iniciada. Puedes usar modo local o iniciar desde login.';
            return;
        }

        authStatus.textContent = `Sesion activa: ${authUser.name} (${authUser.role})`;
        profileName.value = authUser.name || '';
        profileEmail.value = authUser.email || '';

        try {
            const me = await apiFetch('/auth/me', { method: 'GET' });
            profileName.value = me.name || '';
            profileEmail.value = me.email || '';
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(me));
        } catch (_error) {
            // Keep local auth fallback.
        }
    };

    const renderKpis = (expenses) => {
        const totalRawARS = expenses.reduce((acc, expense) => acc + toARS(Number(expense.amount || 0), expense.currency), 0);
        const totalImpactARS = expenses.reduce((acc, expense) => acc + getExpenseImpactARS(expense), 0);
        const sharedExpenses = expenses.filter((expense) => Number(expense.participants || 1) > 1).length;

        const cards = [
            `Gastos: ${expenses.length}`,
            `Total bruto: ${toMoney(totalRawARS)}`,
            `Impacto real: ${toMoney(totalImpactARS)}`,
            `Compartidos: ${sharedExpenses}`
        ];

        kpiSummary.innerHTML = cards.map((item) => `<span class="kpi-chip">${item}</span>`).join('');
    };

    const renderExpenses = (expenses) => {
        const recent = [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
        if (!recent.length) {
            expenseList.innerHTML = '<li class="list-group-item">Todavia no hay gastos cargados.</li>';
            return;
        }

        expenseList.innerHTML = recent.map((expense) => {
            const participants = Math.max(1, Number(expense.participants || 1));
            const impact = getExpenseImpactARS(expense);
            const sourceBadge = expense.id && String(expense.id).startsWith('local-') ? 'local' : 'api';
            return `
                <li class="list-group-item d-flex justify-content-between align-items-start gap-2">
                    <div>
                        <strong>${expense.concept}</strong>
                        <div class="small text-muted">${expense.category} | ${toShortDate(expense.date)} | ${expense.amount} ${expense.currency} | ${sourceBadge}</div>
                    </div>
                    <span class="badge rounded-pill text-bg-light">Impacto ${toMoney(impact)} (${participants} persona/s)</span>
                </li>
            `;
        }).join('');
    };

    const renderSubscriptions = (expenses) => {
        const committed = getCommittedNextMonth();
        subscriptionCommitted.innerHTML = `<span class="kpi-chip">Comprometido proximo mes: ${toMoney(committed)}</span>`;

        if (!state.subscriptions.length) {
            subscriptionList.innerHTML = '<li class="list-group-item">No hay suscripciones registradas.</li>';
        } else {
            subscriptionList.innerHTML = state.subscriptions.map((sub) => {
                return `<li class="list-group-item d-flex justify-content-between"><span>${sub.name} (dia ${sub.day})</span><strong>${sub.amount} ${sub.currency}</strong></li>`;
            }).join('');
        }

        const recurring = detectRecurringExpenses(expenses);
        recurrentHint.textContent = recurring.length
            ? `Posibles gastos recurrentes detectados: ${recurring.map((item) => item.concept).join(', ')}.`
            : 'Sin patrones recurrentes detectados todavia.';
    };

    const renderBadges = (expenses) => {
        const badges = getBadgeCategories(expenses);
        if (!badges.length) {
            badgeList.innerHTML = '<span class="kpi-chip">Sin medallas aun</span>';
            return;
        }
        badgeList.innerHTML = badges.map((category) => `<span class="badge-medal">Medalla ${category}</span>`).join('');
    };

    const renderRates = () => {
        const stamp = state.lastRateUpdate ? new Date(state.lastRateUpdate).toLocaleString('es-AR') : 'no disponible';
        ratesInfo.textContent = `Cotizaciones base ARS: USD ${toMoney(state.exchangeRates.USD)}, EUR ${toMoney(state.exchangeRates.EUR)}. Ultima actualizacion: ${stamp}.`;
    };

    const renderAll = () => {
        const expenses = getCurrentExpenses();
        renderRates();
        renderKpis(expenses);
        renderExpenses(expenses);
        renderSubscriptions(expenses);
        renderBadges(expenses);
    };

    const updateRates = async () => {
        try {
            const [usdResponse, eurResponse] = await Promise.all([
                fetch('https://dolarapi.com/v1/dolares/oficial'),
                fetch('https://open.er-api.com/v6/latest/USD')
            ]);

            if (!usdResponse.ok || !eurResponse.ok) {
                throw new Error('No se pudo consultar alguna API de divisas.');
            }

            const usdData = await usdResponse.json();
            const eurData = await eurResponse.json();

            const usdToArs = Number(usdData?.venta || usdData?.compra || 0);
            const usdToEur = Number(eurData?.rates?.EUR || 0);

            if (usdToArs > 0) {
                state.exchangeRates.USD = usdToArs;
            }
            if (usdToArs > 0 && usdToEur > 0) {
                state.exchangeRates.EUR = usdToArs / usdToEur;
            }

            state.lastRateUpdate = new Date().toISOString();
            saveState();
        } catch (_error) {
            // Keep fallback rates when APIs are unavailable.
        }

        renderRates();
    };

    formExpense.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(formExpense);
        const amount = Number(formData.get('amount') || 0);
        const splitWith = Math.max(0, Number(formData.get('splitWith') || 0));

        if (amount <= 0) {
            return;
        }

        const expensePayload = {
            commerce: String(formData.get('concept') || '').trim(),
            date: String(formData.get('date') || new Date().toISOString().slice(0, 10)),
            amount,
            category: String(formData.get('category') || 'Otros'),
            description: String(formData.get('concept') || '').trim(),
            currency: String(formData.get('currency') || 'ARS'),
            participants: splitWith + 1
        };

        if (authToken) {
            try {
                await apiFetch('/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(expensePayload)
                });
                await loadBackendExpenses();
            } catch (_error) {
                state.localExpenses.push({
                    ...expensePayload,
                    concept: expensePayload.commerce,
                    id: `local-${Math.random().toString(36).slice(2, 10)}`
                });
            }
        } else {
            state.localExpenses.push({
                ...expensePayload,
                concept: expensePayload.commerce,
                id: `local-${Math.random().toString(36).slice(2, 10)}`
            });
        }

        saveState();
        formExpense.reset();
        const dateInput = document.getElementById('expenseDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }
        renderAll();
    });

    formSub.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(formSub);

        const amount = Number(formData.get('amount') || 0);
        if (amount <= 0) {
            return;
        }

        state.subscriptions.push({
            name: String(formData.get('name') || '').trim(),
            amount,
            currency: String(formData.get('currency') || 'ARS'),
            day: Number(formData.get('day') || 1)
        });

        saveState();
        formSub.reset();
        renderAll();
    });

    formBudget.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(formBudget);

        const category = String(formData.get('category') || 'Otros');
        const amount = Number(formData.get('amount') || 0);
        if (amount <= 0) {
            return;
        }

        state.budgets[category] = amount;
        saveState();
        formBudget.reset();
        renderAll();
    });

    if (formTicket && ticketMessage) {
        formTicket.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!authToken) {
                ticketMessage.textContent = 'Necesitas iniciar sesion para usar OCR de tickets del backend.';
                return;
            }

            const data = new FormData(formTicket);
            ticketMessage.textContent = 'Procesando imagen con OCR...';

            try {
                const parsed = await apiFetch('/tickets/upload', {
                    method: 'POST',
                    body: data
                });

                const conceptInput = document.getElementById('expenseConcept');
                const amountInput = document.getElementById('expenseAmount');
                const dateInput = document.getElementById('expenseDate');
                const categoryInput = document.getElementById('expenseCategory');

                if (conceptInput) conceptInput.value = parsed.commerce || '';
                if (amountInput) amountInput.value = parsed.amount || '';
                if (dateInput) dateInput.value = parsed.date || new Date().toISOString().slice(0, 10);
                if (categoryInput) categoryInput.value = parsed.category || 'Otros';

                ticketMessage.textContent = 'Ticket interpretado. Revisa los datos y guarda el gasto.';
                formTicket.reset();
            } catch (error) {
                ticketMessage.textContent = error.message || 'No se pudo interpretar el ticket.';
            }
        });
    }

    if (formProfile && profileMessage) {
        formProfile.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!authToken) {
                profileMessage.textContent = 'Inicia sesion para editar perfil.';
                return;
            }

            const payload = {
                name: String(profileName.value || '').trim(),
                email: String(profileEmail.value || '').trim()
            };

            try {
                const updated = await apiFetch('/auth/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
                profileMessage.textContent = 'Perfil actualizado correctamente.';
                renderAuth();
            } catch (error) {
                profileMessage.textContent = error.message || 'No se pudo actualizar el perfil.';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
            window.location.href = '/login';
        });
    }

    formAdvisor.addEventListener('submit', async (event) => {
        event.preventDefault();

        const provider = document.getElementById('advisorProvider')?.value || 'local';
        const apiKey = (document.getElementById('advisorApiKey')?.value || '').trim();
        const question = (document.getElementById('advisorQuestion')?.value || '').trim();
        const expenses = getCurrentExpenses();

        if (!question) {
            return;
        }

        advisorAnswer.textContent = 'Analizando tu consulta...';

        try {
            if (provider === 'openai') {
                if (!apiKey) {
                    advisorAnswer.textContent = 'Falta API Key de OpenAI. Respuesta local: ' + answerLocally(question, expenses);
                    return;
                }
                advisorAnswer.textContent = await askOpenAI(apiKey, question, expenses);
                return;
            }

            if (provider === 'gemini') {
                if (!apiKey) {
                    advisorAnswer.textContent = 'Falta API Key de Gemini. Respuesta local: ' + answerLocally(question, expenses);
                    return;
                }
                advisorAnswer.textContent = await askGemini(apiKey, question, expenses);
                return;
            }

            advisorAnswer.textContent = answerLocally(question, expenses);
        } catch (error) {
            advisorAnswer.textContent = `${error.message} Respuesta local: ${answerLocally(question, expenses)}`;
        }
    });

    if (advisorOverviewBtn && advisorPanelOutput) {
        advisorOverviewBtn.addEventListener('click', async () => {
            if (!authToken) {
                advisorPanelOutput.textContent = 'Debes iniciar sesion como asesor.';
                return;
            }
            try {
                const data = await apiFetch('/advisor/overview', { method: 'GET' });
                advisorPanelOutput.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                advisorPanelOutput.textContent = error.message || 'No se pudo cargar overview.';
            }
        });
    }

    if (advisorPatternsBtn && advisorPanelOutput) {
        advisorPatternsBtn.addEventListener('click', async () => {
            const userId = String(advisorUserId?.value || '').trim();
            if (!authToken) {
                advisorPanelOutput.textContent = 'Debes iniciar sesion como asesor.';
                return;
            }
            if (!userId) {
                advisorPanelOutput.textContent = 'Ingresa un User ID para analizar.';
                return;
            }
            try {
                const data = await apiFetch(`/advisor/users/${encodeURIComponent(userId)}/patterns`, { method: 'GET' });
                advisorPanelOutput.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                advisorPanelOutput.textContent = error.message || 'No se pudo cargar patrones.';
            }
        });
    }

    const dateInput = document.getElementById('expenseDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }

    (async () => {
        await loadBackendExpenses();
        await renderAuth();
        renderAll();
        updateRates();
    })();
}
