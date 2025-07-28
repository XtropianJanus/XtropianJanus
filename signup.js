document.addEventListener('DOMContentLoaded', () => {
    const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
    const user = gun.user();

    const signupForm = document.getElementById('signup-form');
    const signupAliasInput = document.getElementById('signup-alias');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupDisplaynameInput = document.getElementById('signup-displayname');
    const signupMessage = document.getElementById('signup-message');
    const showLoginBtn = document.getElementById('show-login');
    const showSignupBtn = document.getElementById('show-signup'); // Keep reference for active class

    // Helper to display messages
    function displayAuthMessage(element, message, isError = true) {
        element.textContent = message;
        element.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
    }

    // Redirect to login page
    showLoginBtn.addEventListener('click', () => {
        window.location.href = 'login.html';
    });

    // Set signup button as active on this page
    showSignupBtn.classList.add('active');
    showLoginBtn.classList.remove('active');


    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const alias = signupAliasInput.value;
        const password = signupPasswordInput.value;
        const displayname = signupDisplaynameInput.value;

        if (!displayname.trim()) {
            displayAuthMessage(signupMessage, "Display name cannot be empty.");
            return;
        }

        displayAuthMessage(signupMessage, "Creating account...", false); // Indicate loading

        user.create(alias, password, (ack) => {
            if (ack.err) {
                console.error("Sign up failed:", ack.err);
                displayAuthMessage(signupMessage, ack.err);
            } else {
                console.log("Account created:", ack.pub);
                // Save display name to user's public profile
                user.get('profile').put({ displayname: displayname, role: 'user' }, (putAck) => {
                    if (putAck.err) console.error("Error saving profile:", putAck.err);
                });
                displayAuthMessage(signupMessage, "Account created! Redirecting to login...", false);
                // Redirect to login page after successful creation
                window.location.href = 'login.html';
            }
        });
    });

    // Optional: Check if already logged in on signup page and redirect
    user.recall({ sessionStorage: true }, (ack) => {
        if (user.is) { // If user.is is not null/undefined, a session is active
            console.log("Already logged in, redirecting to chatroom.");
            window.location.href = 'index.html';
        }
    });
});
