// Universal runtime translations for pages without explicit data-i18n coverage.
// This is a safety-net layer: it translates any text nodes that were not handled
// by the primary data-i18n attribute system (i18n.js).
(function () {
  var path = String(window.location.pathname || '').toLowerCase();
  var htmlLang = String(document.documentElement.getAttribute('lang') || '').toLowerCase();
  var stored = String(localStorage.getItem('klarity-lang') || 'es').toLowerCase();
  var lang = stored;
  if (path === '/en' || path.endsWith('/src/html/en.html') || htmlLang === 'en') {
    lang = 'en';
  }
  if (lang !== 'en') return;

  // Sorted longest-first at compile time; entries are [spanish, english].
  // Only include strings that cannot be covered by data-i18n keys.
  var replacements = [
    // ── Long sentences first (avoids partial-match issues) ──────────────────
    ['Klarity unifica tus gastos, tickets y presupuestos en un solo lugar. Obtene recomendaciones de un asesor financiero real y convierte tus numeros en decisiones claras.', 'Klarity unifies your expenses, receipts and budgets in one place. Get recommendations from a real financial advisor and turn your numbers into clear decisions.'],
    ['Klarity unifica tus gastos, tickets y presupuestos en un solo lugar. Obtene recomendaciones de un asesor financiero real y convierte tus números en decisiones claras.', 'Klarity unifies your expenses, receipts and budgets in one place. Get recommendations from a real financial advisor and turn your numbers into clear decisions.'],
    ['Klarity unifica tus gastos, tickets y presupuestos en un solo lugar.', 'Klarity unifies your expenses, receipts and budgets in one place.'],
    ['Obtene recomendaciones de un asesor financiero real y convierte tus numeros en decisiones claras.', 'Get recommendations from a real financial advisor and turn your numbers into clear decisions.'],
    ['Registra gastos en segundos, analiza patrones con IA y toma decisiones que realmente importan.', 'Log expenses in seconds, analyse patterns with AI and make decisions that actually matter.'],
    ['Absolutamente. Todos los datos se transmiten con cifrado TLS y se almacenan en servidores seguros. Nunca pedimos datos bancarios ni acceso a tus cuentas. Solo registras lo que vos queres.', 'Absolutely. All data is transmitted with TLS encryption and stored on secure servers. We never ask for banking credentials or account access.'],
    ['Si, el plan Free es completamente gratuito y no requiere tarjeta. Solo necesitas un email para registrarte. El plan Pro tiene 30 dias de prueba gratuita.', 'Yes, the Free plan is completely free and requires no card. You only need an email address to sign up. The Pro plan includes a 30-day free trial.'],
    ['Subis una foto o PDF del comprobante y nuestra IA (Tesseract.js) extrae automaticamente el monto, la fecha y sugiere una categoria. En el plan Free tenes 5 escaneos por mes, ilimitados en Pro.', 'Upload a photo or PDF and our AI (Tesseract.js) extracts the amount, date and suggests a category automatically. The Free plan includes 5 scans per month; unlimited on Pro.'],
    ['Los usuarios registran sus gastos y consultan el chatbot. Los asesores financieros certificados pueden ver y analizar los gastos de sus clientes. Los administradores gestionan la plataforma completa.', 'Users log expenses and consult the chatbot. Certified financial advisors can view and analyse their clients\' spending. Admins manage the entire platform.'],
    ['Si. Podes exportar todos tus gastos en formato CSV o PDF en cualquier momento. Tus datos son tuyos y siempre podes llevartelos.', 'Yes. You can export all your expenses as CSV or PDF at any time. Your data is yours and you can always take it with you.'],
    ['Proba el sistema en vivo: multi-divisa, suscripciones, gastos compartidos, asesor y gamificacion.', 'Try the system live: multi-currency, subscriptions, shared expenses, advisor and gamification.'],
    ['Sin configuraciones complicadas. Empeza en minutos y ve resultados desde el primer dia.', 'No complex setup. Start in minutes and see results from day one.'],
    ['Registro en 30 segundos. Solo email y contraseña, sin datos bancarios. La seguridad es nuestra prioridad.', 'Sign up in 30 seconds. Just email and password — no banking data required. Security is our top priority.'],
    ['Ingrasa manualmente o fotografia tu ticket y la IA extrae los datos automaticamente con OCR. Multidivisa incluido.', 'Add manually or photograph your receipt and AI extracts the data automatically with OCR. Multi-currency included.'],
    ['Accede al panel del asesor, consulta el chatbot financiero personalizado y cumple tus metas con gamificacion.', 'Access the advisor panel, consult the personalised financial chatbot and hit your goals.'],
    ['Sin integraciones bancarias complejas ni migraciones manuales.', 'No complex bank integrations or manual data migrations.'],
    ['Fotografia cualquier comprobante y la inteligencia artificial extrae monto, fecha y categoria automaticamente.', 'Photograph any receipt and AI extracts the amount, date and category automatically.'],
    ['Registra en ARS, USD o EUR. Klarity convierte en tiempo real y unifica tu vision financiera sin importar la moneda.', 'Log in ARS, USD or EUR. Klarity converts in real time and unifies your financial view regardless of currency.'],
    ['Preguntale al chatbot sobre tus patrones de consumo, proyecciones y estrategias de ahorro. Disponible 24/7.', 'Ask the chatbot about your spending patterns, projections and saving strategies. Available 24/7.'],
    ['Gestiona tus gastos recurrentes. Klarity te avisa antes de cada vencimiento y calcula el total mensual comprometido.', 'Manage your recurring expenses. Klarity alerts you before each due date and calculates your committed monthly total.'],
    ['Divide cualquier gasto entre varias personas. Klarity calcula cuanto le corresponde a cada uno automaticamente.', 'Split any expense among multiple people. Klarity automatically calculates each person\'s share.'],
    ['Cumple metas de gasto mensual y gana medallas. La motivacion hace que ahorrar sea algo que quieras hacer.', 'Hit your monthly spending goals and earn badges. Motivation makes saving something you actually want to do.'],
    ['Miles de usuarios ya controlan sus finanzas con Klarity. Estas son sus historias.', 'Thousands of users already control their finances with Klarity. These are their stories.'],
    ['Comenza gratis, actualiza cuando quieras. Sin compromisos, sin letras chicas.', 'Start free, upgrade whenever you want. No commitments, no hidden terms.'],
    ['Cada herramienta fue diseñada para que entiendas tus finanzas, no para que las compliques.', 'Every tool is designed to help you understand your finances, not complicate them.'],
    ['Unete a miles de personas que ya conocen exactamente a donde va su dinero. Sin tarjeta, sin compromisos.', 'Join thousands of people who already know exactly where their money goes. No card, no commitment.'],
    ['Ya son +12.000 usuarios. Plan gratuito para siempre disponible.', 'Already +12,000 users. Free plan available forever.'],
    ['Proyecto Ingeniería Web II · Universidad', 'Web Engineering II Project · University'],
    ['Registra consumos, analiza categorias y recibe recomendaciones de tu asesor financiero. Todo en un solo lugar.', 'Track spending, analyse categories and get recommendations from your financial advisor. All in one place.'],
    ['Tus credenciales no se muestran en pantalla. Usa cuentas temporales para pruebas y verifica el flujo completo por correo.', 'Your credentials are never displayed on screen. Use temporary accounts for testing and verify the full flow via email.'],
    ['¿Seguro que quieres eliminar este gasto? Esta acción no se puede deshacer.', 'Are you sure you want to delete this expense? This action cannot be undone.'],
    ['Todavía no hay suficientes gastos repetidos para estimar compromisos.', 'There are not yet enough repeated expenses to estimate commitments.'],
    ['Registra los gastos el mismo día para no olvidarlos.', 'Log expenses the same day so you do not forget them.'],
    ['Usar la misma categoría te ayuda a ver patrones.', 'Using the same category helps you spot patterns.'],
    ['¿Tienes ticket? Súbelo en la sección OCR y se añade solo.', 'Have a receipt? Upload it in the OCR section and it is added automatically.'],
    ['Aquí aparecerá el texto extraído del ticket...', 'Extracted receipt text will appear here...'],
    ['Haz una consulta al asesor para obtener análisis personalizados de tus gastos.', 'Ask the advisor for a personalised analysis of your expenses.'],
    ['Lista de usuarios asignados a tu asesoría', 'List of users assigned to your advisory'],
    ['Gastos e historial de un usuario específico', 'Expenses and history of a specific user'],
    ['Introduce un ID de usuario para ver su resumen.', 'Enter a user ID to view their overview.'],
    ['Análisis de comportamiento financiero por usuario', 'Financial behaviour analysis by user'],
    ['Introduce un ID para ver análisis de patrones.', 'Enter an ID to view pattern analysis.'],
    ['Genera sugerencias personalizadas de ahorro', 'Generate personalised savings suggestions'],
    ['Selecciona un cliente y genera recomendaciones.', 'Select a client and generate recommendations.'],
    ['Aun no hay recomendaciones guardadas.', 'No saved recommendations yet.'],
    ['Datos de tu cuenta de asesor', 'Your advisor account details'],
    ['No hay timeline disponible para este cliente.', 'No timeline available for this client.'],
    ['Sin distribución por categoría disponible.', 'No category distribution available.'],
    ['Estadísticas de la plataforma Klarity', 'Klarity platform statistics'],
    ['Todos los usuarios de la plataforma', 'All users on the platform'],
    ['Nuevos usuarios (últimos 6 meses)', 'New users (last 6 months)'],
    ['Vista de gastos (scope según permisos del backend)', 'Expense view (scope based on backend permissions)'],
    ['Comprueba la conectividad con el backend', 'Check connectivity with the backend'],
    ['No se pudo actualizar cotización en vivo, usando referencia local.', 'Could not update live exchange rate, using local fallback.'],
    ['No se pudo actualizar cotizacion en vivo, usando referencia local.', 'Could not update live exchange rate, using local fallback.'],
    ['No se detectó un importe válido en el ticket.', 'No valid amount was detected in the receipt.'],
    ['No se pudo guardar el gasto desde OCR', 'Could not save expense from OCR'],
    ['Ticket procesado y gasto guardado automáticamente.', 'Receipt processed and expense saved automatically.'],
    ['Medalla al cumplir 3 meses seguidos por debajo del tope.', 'Badge awarded for staying below the cap for 3 consecutive months.'],
    ['Disponible para cuentas con rol asesor.', 'Available for accounts with the advisor role.'],
    ['Posibles gastos recurrentes detectados:', 'Possible recurring expenses detected:'],
    ['Sin patrones recurrentes detectados todavia.', 'No recurring patterns detected yet.'],
    ['No se pudo actualizar cotización en vivo', 'Could not update live exchange rate'],
    ['No se pudo actualizar cotizacion en vivo', 'Could not update live exchange rate'],
    ['No se pudo interpretar el ticket.', 'Could not parse the receipt.'],
    ['Necesitas iniciar sesion para usar OCR de tickets del backend.', 'You need to log in to use backend receipt OCR.'],
    ['Procesando imagen con OCR...', 'Processing image with OCR...'],
    ['Ticket interpretado. Revisa los datos y guarda el gasto.', 'Receipt parsed. Review the data and save the expense.'],
    ['Inicia sesion para editar perfil.', 'Log in to edit your profile.'],
    ['Perfil actualizado correctamente.', 'Profile updated successfully.'],
    ['No se pudo actualizar el perfil.', 'Could not update profile.'],
    ['Analizando tu consulta...', 'Analysing your query...'],
    ['Falta API Key de OpenAI. Respuesta local:', 'OpenAI API key missing. Local response:'],
    ['Falta API Key de Gemini. Respuesta local:', 'Gemini API key missing. Local response:'],
    ['Debes iniciar sesion como asesor.', 'You must be logged in as an advisor.'],
    ['No se pudo cargar overview.', 'Could not load overview.'],
    ['Ingresa un User ID para analizar.', 'Enter a User ID to analyse.'],
    ['No se pudo cargar patrones.', 'Could not load patterns.'],
    ['Sin sesion iniciada. Puedes usar modo local o iniciar desde login.', 'No active session. You can use local mode or log in.'],
    ['Todavia no hay gastos cargados.', 'No expenses loaded yet.'],
    ['Comprometido proximo mes:', 'Committed next month:'],
    ['No hay suscripciones registradas.', 'No subscriptions registered.'],
    ['Cotizaciones base ARS:', 'Base ARS exchange rates:'],
    ['Ultima actualizacion:', 'Last updated:'],
    ['Cuenta creada. Verifica tu correo para iniciar sesion.', 'Account created. Verify your email to log in.'],
    ['Buscar cliente por nombre o email', 'Search client by name or email'],
    ['Introduce un ID de cliente.', 'Enter a client ID.'],
    ['Ingresa un User ID para analizar.', 'Enter a User ID to analyse.'],
    ['Confirmar cambio de rol para', 'Confirm role change for'],

    // ── Shorter phrases ─────────────────────────────────────────────────────
    ['¿Tenes dudas? Nosotros las respondemos.', 'Have questions? We have answers.'],
    ['¿Es seguro guardar mis datos financieros en Klarity?', 'Is it safe to store my financial data in Klarity?'],
    ['¿Puedo usar Klarity sin tarjeta de credito?', 'Can I use Klarity without a credit card?'],
    ['¿Como funciona el OCR de tickets?', 'How does receipt OCR work?'],
    ['¿Que diferencia hay entre usuario, asesor y admin?', 'What is the difference between a user, advisor and admin?'],
    ['¿Puedo exportar mis datos?', 'Can I export my data?'],
    ['Análisis personalizado de tus finanzas', 'Personalised analysis of your finances'],
    ['Tres pasos para tener claridad total', 'Three steps to complete financial clarity'],
    ['Funciones que hacen la diferencia', 'Features that make the difference'],
    ['Personas reales, resultados reales', 'Real people, real results'],
    ['Simple y transparente', 'Simple and transparent'],
    ['Para quienes toman en serio sus finanzas', 'For those serious about their finances'],
    ['Probar Pro gratis 30 dias', 'Try Pro free for 30 days'],
    ['Crea tu cuenta gratis', 'Create your free account'],
    ['Registra tus gastos y tickets', 'Log your expenses and receipts'],
    ['Optimiza con tu asesor financiero', 'Optimise with your financial advisor'],
    ['Empieza en minutos, no dias', 'Start in minutes, not days'],
    ['Ingreso rapido de gastos', 'Fast expense entry'],
    ['OCR para tickets fisicos y digitales', 'OCR for physical and digital receipts'],
    ['Asesor financiero incluido', 'Financial advisor included'],
    ['Gamificacion y metas mensuales', 'Gamification and monthly goals'],
    ['Hasta 100 gastos por mes', 'Up to 100 expenses per month'],
    ['Categorias automaticas', 'Automatic categories'],
    ['OCR de tickets (5/mes)', 'Receipt OCR (5/month)'],
    ['Chatbot financiero basico', 'Basic financial chatbot'],
    ['Asesor financiero personal', 'Personal financial advisor'],
    ['Reportes y visualizaciones avanzadas', 'Advanced reports and visualisations'],
    ['Reportes avanzados', 'Advanced reports'],
    ['Multi-divisa avanzado', 'Advanced multi-currency'],
    ['Soporte prioritario', 'Priority support'],
    ['Gastos ilimitados', 'Unlimited expenses'],
    ['OCR ilimitado', 'Unlimited OCR'],
    ['Todos los derechos reservados.', 'All rights reserved.'],
    ['Gestión financiera inteligente', 'Smart financial management'],
    ['Gestion financiera inteligente', 'Smart financial management'],
    ['Sin tarjeta requerida', 'No card required'],
    ['Gratis para siempre', 'Free forever'],
    ['Datos 100% seguros', '100% secure data'],
    ['Proceso simple', 'Simple process'],
    ['Todo incluido', 'All included'],
    ['Lo que dicen', 'Testimonials'],
    ['Preguntas frecuentes', 'Frequently asked questions'],
    ['Lab financiero', 'Financial lab'],
    ['Demo interactiva completa', 'Full interactive demo'],
    ['Comenzar gratis', 'Start for free'],
    ['Cómo funciona', 'How it works'],
    ['Como funciona', 'How it works'],
    ['Funciones', 'Features'],
    ['Precios', 'Pricing'],
    ['Sabe exactamente', 'Know exactly'],
    ['adónde va tu dinero.', 'where your money goes.'],
    ['a donde va tu dinero.', 'where your money goes.'],
    ['Conoce exactamente', 'Know exactly'],
    ['Ver demo', 'Watch demo'],
    ['Resumen del mes', 'Monthly overview'],
    ['Presup.', 'Budget'],
    ['Ahorrado', 'Saved'],
    ['Supermercado', 'Supermarket'],
    ['Farmacia', 'Pharmacy'],
    ['gastos registrados', 'logged expenses'],
    ['asesores certificados', 'certified advisors'],
    ['% satisfaccion', '% satisfaction'],
    ['satisfaccion', 'satisfaction rate'],
    ['/ siempre', '/ forever'],
    ['USD / mes', 'USD / month'],
    ['MAS POPULAR', 'MOST POPULAR'],
    ['Sesion y perfil', 'Session and profile'],
    ['Sin sesion iniciada.', 'No active session.'],
    ['Guardar perfil', 'Save profile'],
    ['Cerrar sesion', 'Log out'],
    ['Carga de ticket con OCR (IA)', 'Receipt upload with OCR (AI)'],
    ['Imagen del ticket', 'Receipt image'],
    ['Interpretar', 'Parse'],
    ['Registro multi-divisa', 'Multi-currency entry'],
    ['Alimentacion', 'Food'],
    ['Ocio', 'Leisure'],
    ['Agregar suscripcion', 'Add subscription'],
    ['Chatbot asesor financiero', 'Financial advisor chatbot'],
    ['Asesor local', 'Local advisor'],
    ['API Key (opcional)', 'API Key (optional)'],
    ['Tu consulta', 'Your question'],
    ['Escribe una pregunta para obtener recomendaciones.', 'Type a question to get recommendations.'],
    ['Gamificacion de metas', 'Goal gamification'],
    ['Tope ARS/mes', 'ARS monthly cap'],
    ['Panel de asesor financiero', 'Financial advisor panel'],
    ['User ID a analizar', 'User ID to analyse'],
    ['Ver overview global', 'View global overview'],
    ['Ver patrones del usuario', 'View user patterns'],
    ['Ingresa tus credenciales para continuar.', 'Enter your credentials to continue.'],
    ['Crear tu cuenta', 'Create your account'],
    ['Volver al inicio', 'Back to home'],
    ['Acceso seguro', 'Secure access'],
    ['Control diario de gastos con IA', 'Daily expense tracking with AI'],
    ['OCR de tickets y comprobantes', 'OCR for receipts and invoices'],
    ['Asesor financiero personalizado', 'Personalised financial advisor'],
    ['Datos cifrados y 100% seguros', 'Encrypted and 100% secure data'],
    ['Recuperar cuenta', 'Reset password'],
    ['Reenviar verificacion', 'Resend verification'],
    ['Reenviar verificación', 'Resend verification'],
    ['Continuar con Google', 'Continue with Google'],
    ['Crear cuenta con Google', 'Sign up with Google'],
    ['Actualizar contrasena', 'Update password'],
    ['Actualizar contraseña', 'Update password'],
    ['Cuentas demo disponibles', 'Demo accounts available'],
    ['Validando credenciales...', 'Validating credentials...'],
    ['Entrando...', 'Signing in...'],
    ['Creando cuenta...', 'Creating account...'],
    ['Creando...', 'Creating...'],
    ['Credenciales incorrectas.', 'Invalid credentials.'],
    ['No se pudo crear la cuenta.', 'Could not create the account.'],
    ['No se pudo conectar con el servidor.', 'Could not connect to the server.'],
    ['Bienvenido/a. Redirigiendo...', 'Welcome. Redirecting...'],
    ['Cuenta creada. Redirigiendo...', 'Account created. Redirecting...'],
    ['Herramientas', 'Tools'],
    ['Mis gastos', 'My expenses'],
    ['Buscar gastos...', 'Search expenses...'],
    ['Notificaciones', 'Notifications'],
    ['Cambiar tema', 'Toggle theme'],
    ['Hola — cargando...', 'Hello — loading...'],
    ['Total este mes', 'Total this month'],
    ['Mayor categoría', 'Top category'],
    ['Gastos totales', 'Total expenses'],
    ['Último gasto', 'Last expense'],
    ['Gasto por categoría', 'Spending by category'],
    ['Últimos gastos', 'Latest expenses'],
    ['Actualizar', 'Refresh'],
    ['Insights rápidos', 'Quick insights'],
    ['Mes actual vs anterior', 'Current month vs previous'],
    ['Comercio más frecuente', 'Most frequent merchant'],
    ['Historial completo', 'Full history'],
    ['Todas las categorías', 'All categories'],
    ['Registra un nuevo gasto manualmente', 'Log a new expense manually'],
    ['Nuevo gasto', 'New expense'],
    ['Concepto *', 'Description *'],
    ['ej. Supermercado', 'e.g. Supermarket'],
    ['Importe *', 'Amount *'],
    ['Este gasto es mensual (alquiler, suscripción, etc.)', 'This is a recurring monthly expense (rent, subscription, etc.)'],
    ['Consejos rápidos', 'Quick tips'],
    ['Extracción automática de texto con OCR', 'Automatic OCR text extraction'],
    ['Fotografía o archivo', 'Photo or file'],
    ['Imagen del ticket (JPG, PNG, PDF)', 'Receipt image (JPG, PNG, PDF)'],
    ['Procesar ticket', 'Process receipt'],
    ['Texto extraído', 'Extracted text'],
    ['Controla cuánto gastas por categoría', 'Track how much you spend per category'],
    ['Moneda de visualización', 'Display currency'],
    ['Comprometido del próximo mes', 'Committed for next month'],
    ['Comprometido del proximo mes', 'Committed for next month'],
    ['Análisis personalizado de tus finanzas', 'Personalised analysis of your finances'],
    ['Consultar asesor', 'Ask advisor'],
    ['Gestiona tu cuenta', 'Manage your account'],
    ['Datos de cuenta', 'Account details'],
    ['Tu nombre', 'Your name'],
    ['Guardar cambios', 'Save changes'],
    ['Información de sesión', 'Session information'],
    ['Sesión iniciada:', 'Logged in:'],
    ['Abrir menú lateral', 'Open side menu'],
    ['Cerrar menú lateral', 'Close side menu'],
    ['Eliminar gasto', 'Delete expense'],
    ['Sin movimiento en los últimos 2 meses', 'No activity in the last 2 months'],
    ['Nuevo gasto este mes:', 'New spending this month:'],
    ['Categoría sugerida aplicada:', 'Suggested category applied:'],
    ['Detectado como gasto mensual.', 'Detected as a monthly expense.'],
    ['No se detectó categoría automática para este concepto.', 'No automatic category detected for this description.'],
    ['Gasto guardado correctamente.', 'Expense saved successfully.'],
    ['Procesando imagen...', 'Processing image...'],
    ['Límite casi alcanzado', 'Limit almost reached'],
    ['Gasto elevado', 'High spending'],
    ['Total estimado próximo mes', 'Estimated total for next month'],
    ['Total estimado proximo mes', 'Estimated total for next month'],
    ['Consultando al asesor...', 'Asking the advisor...'],
    ['Problema principal', 'Main issue'],
    ['Solución recomendada', 'Recommended solution'],
    ['Próximo paso', 'Next step'],
    ['Perfil actualizado.', 'Profile updated.'],
    ['Total clientes', 'Total clients'],
    ['Activos este mes', 'Active this month'],
    ['Gasto promedio', 'Average spend'],
    ['Clientes registrados', 'Registered clients'],
    ['Alto riesgo', 'High risk'],
    ['Saludable', 'Healthy'],
    ['Evolución del gasto', 'Spending trend'],
    ['Puntos de timeline', 'Timeline points'],
    ['Promedio período', 'Period average'],
    ['Alertas de pico', 'Peak alerts'],
    ['Total gastado', 'Total spent'],
    ['Cantidad de gastos', 'Number of expenses'],
    ['Ticket promedio', 'Average transaction'],
    ['Categoría principal:', 'Top category:'],
    ['Distribución de roles', 'Role distribution'],
    ['Últimos usuarios registrados', 'Recently registered users'],
    ['Buscar por nombre o email', 'Search by name or email'],
    ['Información de entorno', 'Environment info'],
    ['Hora del servidor:', 'Server time:'],
    ['Cuenta de administrador', 'Administrator account'],
    ['Tipo de cambio actualizado:', 'Exchange rate updated:'],
    ['Tipo de cambio actualizado', 'Exchange rate updated'],
    ['Sesion activa:', 'Active session:'],
    ['Total bruto:', 'Gross total:'],
    ['Impacto real:', 'Actual impact:'],
    ['Compartidos:', 'Shared:'],
    ['persona/s', 'person(s)'],
    ['no disponible', 'not available'],
    ['registros', 'records'],
    ['% usado', '% used'],
    ['Sin medallas aun', 'No badges yet'],
    ['Seleccionar cliente', 'Select client'],
    ['Ver resumen', 'View overview'],
    ['Ver patrones', 'View patterns'],
    ['Generar recomendaciones', 'Generate recommendations'],
    ['Historial guardado', 'Saved history'],
    ['Introduce un ID.', 'Enter an ID.'],
    ['Total usuarios', 'Total users'],
    ['Cambiar rol', 'Change role'],
    ['API accesible (HTTP', 'API reachable (HTTP'],
    ['Sin usuarios', 'No users'],
    ['Sesiones', 'Sessions'],
    // ── Single words (last, to avoid false-positive partial replacements) ───
    ['Suscripciones', 'Subscriptions'],
    ['Vivienda', 'Housing'],
    ['Transporte', 'Transport'],
    ['Salud', 'Health'],
    ['Otros', 'Other'],
    ['Servicio', 'Service'],
    ['Proveedor', 'Provider'],
    ['Parámetros', 'Parameters'],
    ['Resultado', 'Result'],
    ['Patrones', 'Patterns'],
    ['Volver', 'Back'],
    ['Admins', 'Admins'],
    ['Usuarios', 'Users'],
    ['Asesores', 'Advisors'],
    ['Guardar', 'Save'],
    ['Cancelar', 'Cancel'],
    ['Eliminar', 'Delete'],
    ['Impacto', 'Impact'],
    ['Medalla', 'Badge'],
    ['Sistema', 'System'],
    ['Principal', 'Main'],
    ['Cuenta', 'Account'],
    ['Estado', 'Status'],
    ['Acciones', 'Actions'],
    ['Concepto', 'Description'],
    ['Moneda', 'Currency'],
    ['Importe', 'Amount'],
    ['Pregunta', 'Question'],
    ['Respuesta', 'Response'],
    ['Menú', 'Menu'],
    ['Nuevo', 'New'],
    ['dia', 'day'],
  ];

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  var compiled = replacements
    .slice()
    .sort(function (a, b) { return b[0].length - a[0].length; })
    .map(function (pair) {
      return [new RegExp(escapeRegExp(pair[0]), 'g'), pair[1]];
    });

  function translateText(text) {
    var out = text;
    for (var i = 0; i < compiled.length; i += 1) {
      out = out.replace(compiled[i][0], compiled[i][1]);
    }
    return out;
  }

  function translateAttributes(el) {
    var attrs = ['placeholder', 'title', 'aria-label'];
    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      var value = el.getAttribute(attr);
      if (value) {
        var translated = translateText(value);
        if (translated !== value) {
          el.setAttribute(attr, translated);
        }
      }
    }
  }

  function translateNode(node) {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      var next = translateText(node.nodeValue || '');
      if (next !== node.nodeValue) {
        node.nodeValue = next;
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
    translateAttributes(node);

    var children = node.childNodes;
    for (var i = 0; i < children.length; i += 1) {
      translateNode(children[i]);
    }
  }

  function translateDocument() {
    translateNode(document.body);
    document.documentElement.lang = 'en';
  }

  var mo = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i += 1) {
      var mutation = mutations[i];
      if (mutation.type === 'characterData' && mutation.target) {
        translateNode(mutation.target);
      }
      if (mutation.type === 'childList' && mutation.addedNodes) {
        for (var j = 0; j < mutation.addedNodes.length; j += 1) {
          translateNode(mutation.addedNodes[j]);
        }
      }
      if (mutation.type === 'attributes' && mutation.target) {
        translateAttributes(mutation.target);
      }
    }
  });

  function start() {
    translateDocument();
    mo.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
