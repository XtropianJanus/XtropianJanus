document.addEventListener('DOMContentLoaded', () => {
    const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
    const user = gun.user();

    const signupForm = document.getElementById('signup-form');
    const signupAliasInput = document.getElementById('signup-alias');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupDisplaynameInput = document.getElementById('signup-displayname');
    const signupMessage = document.getElementById('signup-message');
    const showLoginBtn = document.getElementById('show-login');
    const showSignupBtn = document.getElementById('show-signup');

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

        displayAuthMessage(signupMessage, "Creating account...", false);

        user.create(alias, password, (ack) => {
            if (ack.err) {
                console.error("Sign up failed:", ack.err);
                displayAuthMessage(signupMessage, ack.err);
            } else {
                console.log("Account created:", ack.pub);
                // Authenticate the user immediately after creation
                user.auth(alias, password, (authAck) => {
                    if (authAck.err) {
                        console.error("Auto-login after signup failed:", authAck.err);
                        displayAuthMessage(signupMessage, `Account created, but auto-login failed: ${authAck.err}. Please try logging in.`, true);
                        // Redirect to login page only if auto-auth fails
                        setTimeout(() => { // Small delay before redirecting
                            window.location.href = 'login.html';
                        }, 500);
                    } else {
                        console.log("Auto-logged in after signup. Saving profile...");
                        // Now that the user is authenticated, save the display name to their profile
                        user.get('profile').put({ displayname: displayname, role: 'user' }, (putAck) => {
                            if (putAck.err) {
                                console.error("Error saving profile after signup:", putAck.err);
                                displayAuthMessage(signupMessage, `Account created, but profile save failed: ${putAck.err}.`, true);
                                // Even if put fails, we can still try to go to chat, but user might not have correct display name
                                setTimeout(() => {
                                    window.location.href = 'index.html';
                                }, 1000); // Longer delay if profile save failed
                            } else {
                                console.log("Profile saved successfully after signup. Redirecting to chatroom...");
                                displayAuthMessage(signupMessage, "Account created! Redirecting to chatroom...", false);
                                // CRITICAL FIX: Add a short delay before redirecting to allow Gun to synchronize
                                setTimeout(() => {
                                    window.location.href = 'index.html';
                                }, 750); // Increased delay to 750ms for better synchronization
                            }
                        });
                    }
                });
            }
        });
    });

    // Optional: Check if already logged in on signup page and redirect
    user.recall({ sessionStorage: true }, (ack) => {
        if (user.is) {
            console.log("Already logged in, redirecting to chatroom.");
            window.location.href = 'index.html';
        }
    });
});
