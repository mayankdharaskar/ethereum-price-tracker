document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------
    // Auth helpers (localStorage)
    // ---------------------------
    const USERS_KEY = 'auth.users.v1';
    const SESSION_KEY = 'auth.session.v1';

    const getUsers = () => {
        try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
        catch { return []; }
    };
    const saveUsers = (arr) => localStorage.setItem(USERS_KEY, JSON.stringify(arr));
    const getSession = () => {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
        catch { return null; }
    };
    const setSession = (email) => localStorage.setItem(SESSION_KEY, JSON.stringify({ email, ts: Date.now() }));
    const clearSession = () => localStorage.removeItem(SESSION_KEY);

    // crypto: hash("salt:password") -> hex
    const toHex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    const sha256 = async (text) => {
        const enc = new TextEncoder().encode(text);
        const hash = await crypto.subtle.digest('SHA-256', enc);
        return toHex(hash);
    };

    // simple salt per user (email-based + random)
    const makeSalt = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

    // ---------------------------
    // UI nodes
    // ---------------------------
    const authCard = document.getElementById('authCard');
    const priceCard = document.getElementById('priceCard');
    const topbar = document.getElementById('topbar');
    const whoami = document.getElementById('whoami');
    const logoutBtn = document.getElementById('logoutBtn');

    // Tabs & forms
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');

    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const signupPassword2 = document.getElementById('signupPassword2');
    const signupError = document.getElementById('signupError');

    // ETH widgets (existing app features)
    const apiUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,inr';
    const ethPriceUSD = document.getElementById('ethPriceUSD');
    const ethPriceINR = document.getElementById('ethPriceINR');
    const countdownElement = document.getElementById('countdown');
    const lastUpdatedElement = document.getElementById('lastUpdated');
    let countdown = 10;
    let lastUSDPrice = null;
    let lastINRPrice = null;
    let intervalId = null;

    const fetchEthereumPrice = async () => {
        try {
            const response = await axios.get(apiUrl);
            const priceUSD = response.data.ethereum.usd;
            const priceINR = response.data.ethereum.inr;

            if (lastUSDPrice !== null) {
                ethPriceUSD.style.color = priceUSD > lastUSDPrice ? '#00ff9d' : '#ff4d4d';
            }
            if (lastINRPrice !== null) {
                ethPriceINR.style.color = priceINR > lastINRPrice ? '#ffd700' : '#ff4d4d';
            }

            lastUSDPrice = priceUSD;
            lastINRPrice = priceINR;

            ethPriceUSD.textContent = `$${priceUSD}`;
            ethPriceINR.textContent = `₹${priceINR.toLocaleString('en-IN')}`;
            lastUpdatedElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        } catch (error) {
            ethPriceUSD.textContent = 'Failed to load';
            ethPriceINR.textContent = '';
            lastUpdatedElement.textContent = '';
            console.error('Error fetching Ethereum price:', error);
        }
    };

    const startCountdown = () => {
        clearInterval(intervalId);
        countdown = 10;
        intervalId = setInterval(() => {
            countdown--;
            countdownElement.textContent = `Next update in: ${countdown}s`;
            if (countdown === 0) {
                fetchEthereumPrice();
                countdown = 10;
            }
        }, 1000);
    };

    // ---------------------------
    // Auth UI logic
    // ---------------------------
    const showLogin = () => {
        tabLogin.classList.add('active'); tabSignup.classList.remove('active');
        loginForm.classList.remove('hidden'); signupForm.classList.add('hidden');
        loginError.textContent = ''; signupError.textContent = '';
    };
    const showSignup = () => {
        tabSignup.classList.add('active'); tabLogin.classList.remove('active');
        signupForm.classList.remove('hidden'); loginForm.classList.add('hidden');
        loginError.textContent = ''; signupError.textContent = '';
    };

    tabLogin.addEventListener('click', showLogin);
    tabSignup.addEventListener('click', showSignup);

    // Login submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const email = loginEmail.value.trim().toLowerCase();
        const pwd = loginPassword.value;

        const users = getUsers();
        const user = users.find(u => u.email === email);
        if (!user) {
            loginError.textContent = 'No account found for this email.';
            return;
        }
        const hash = await sha256(`${user.salt}:${pwd}`);
        if (hash !== user.passwordHash) {
            loginError.textContent = 'Incorrect password.';
            return;
        }
        setSession(email);
        onAuthed();
    });

    // Signup submit
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signupError.textContent = '';

        const email = signupEmail.value.trim().toLowerCase();
        const p1 = signupPassword.value;
        const p2 = signupPassword2.value;

        if (!email || !p1) { signupError.textContent = 'Email and password are required.'; return; }
        if (p1.length < 6) { signupError.textContent = 'Password must be at least 6 characters.'; return; }
        if (p1 !== p2) { signupError.textContent = 'Passwords do not match.'; return; }

        const users = getUsers();
        if (users.some(u => u.email === email)) {
            signupError.textContent = 'Account already exists. Try logging in.';
            return;
        }
        const salt = makeSalt();
        const passwordHash = await sha256(`${salt}:${p1}`);
        users.push({ email, salt, passwordHash, createdAt: Date.now() });
        saveUsers(users);

        // Auto-login after signup
        setSession(email);
        onAuthed();
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        clearSession();
        onSignedOut();
    });

    // ---------------------------
    // Auth state transitions
    // ---------------------------
    function onAuthed() {
        const session = getSession();
        whoami.textContent = session?.email || '';
        authCard.classList.add('hidden');
        topbar.classList.remove('hidden');
        priceCard.classList.remove('hidden');
        // start ETH tracker
        fetchEthereumPrice();
        startCountdown();
    }

    function onSignedOut() {
        whoami.textContent = '';
        topbar.classList.add('hidden');
        priceCard.classList.add('hidden');
        authCard.classList.remove('hidden');
        clearInterval(intervalId);
    }

    // ---------------------------
    // Init
    // ---------------------------
    const session = getSession();
    if (session?.email) {
        onAuthed();
    } else {
        onSignedOut();
    }
});