document.addEventListener('DOMContentLoaded', () => {
    const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
    const user = gun.user();

    const loginForm = document.getElementById('login-form');
    const loginAliasInput = document.getElementById('login-alias');
    const loginPasswordInput = document.getElementById('login-password');
    const loginMessage = document.getElementById('login-message');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login'); // Keep reference for active class

    // Helper to display messages
    function displayAuthMessage(element, message, isError = true) {
        element.textContent = message;
        element.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
    }

    // Redirect to signup page
    showSignupBtn.addEventListener('click', () => {
        window.location.href = 'signup.html';
    });

    // Set login button as active on this page
    showLoginBtn.classList.add('active');
    showSignupBtn.classList.remove('active');


    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const alias = loginAliasInput.value;
        const password = loginPasswordInput.value;

        displayAuthMessage(loginMessage, "Logging in...", false); // Indicate loading

        user.auth(alias, password, (ack) => {
            if (ack.err) {
                console.error("Login failed:", ack.err);
                displayAuthMessage(loginMessage, ack.err);
            } else {
                console.log("Logged in as:", ack.pub);
                displayAuthMessage(loginMessage, "Login successful! Redirecting...", false);
                // Redirect to the main chatroom page
                window.location.href = 'index.html';
            }
        });
    });

    // Optional: Check if already logged in on login page and redirect
    user.recall({ sessionStorage: true }, (ack) => {
        if (user.is) { // If user.is is not null/undefined, a session is active
            console.log("Already logged in, redirecting to chatroom.");
            window.location.href = 'index.html';
        }
    });
});
