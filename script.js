document.addEventListener('DOMContentLoaded', () => {
    // --- Gun.js Initialization ---
    // Connect to a public Gun peer. For production, consider running your own.
    const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
    const user = gun.user(); // Get the Gun user module

    // --- DOM Elements ---
    const authScreen = document.getElementById('auth-screen');
    const appContainer = document.getElementById('app-container');

    // Auth Form Elements
    const showLoginBtn = document.getElementById('show-login');
    const showSignupBtn = document.getElementById('show-signup');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginMessage = document.getElementById('login-message');
    const signupMessage = document.getElementById('signup-message');

    // Login Form Inputs
    const loginAliasInput = document.getElementById('login-alias');
    const loginPasswordInput = document.getElementById('login-password');

    // Signup Form Inputs
    const signupAliasInput = document.getElementById('signup-alias');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupDisplaynameInput = document.getElementById('signup-displayname');

    // App Elements
    const currentUserDisplaynameSpan = document.getElementById('current-user-displayname');
    const logoutBtn = document.getElementById('logout-btn');
    const adminSection = document.getElementById('admin-section'); // For admin/mod specific controls


    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const messagesContainer = document.getElementById('messages-container');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const messageInput = document.getElementById('message-input');
    const attachBtn = document.getElementById('attach-btn');
    const imageUploadInput = document.getElementById('image-upload');
    const createChatroomBtn = document.getElementById('create-chatroom-btn');
    const viewPendingBtn = document.getElementById('view-pending-btn');
    const chatroomModal = document.getElementById('chatroom-modal');
    const pendingModal = document.getElementById('pending-modal');

    // --- Helper Functions ---

    // Function to display messages on auth forms
    function displayAuthMessage(element, message, isError = true) {
        element.textContent = message;
        element.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
        gsap.fromTo(element, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 });
    }

    // Function to toggle between login and signup forms
    function toggleAuthForm(showForm) {
        if (showForm === 'login') {
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
            showLoginBtn.classList.add('active');
            showSignupBtn.classList.remove('active');
        } else {
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            showLoginBtn.classList.remove('active');
            showSignupBtn.classList.add('active');
        }
        loginMessage.textContent = ''; // Clear messages on toggle
        signupMessage.textContent = '';
    }

    // Function to update UI based on login status
    function updateUI(loggedIn) {
        if (loggedIn) {
            authScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            // Initial animation for app container when logging in
            gsap.from(appContainer, {
                duration: 1.5,
                scale: 0.9,
                opacity: 0,
                ease: "power3.out",
                delay: 0.2
            });
            gsap.from('.sidebar', {
                duration: 1,
                x: -50,
                opacity: 0,
                ease: "power2.out",
                delay: 0.7
            });
            gsap.from('.chat-area', {
                duration: 1,
                x: 50,
                opacity: 0,
                ease: "power2.out",
                delay: 0.9
            });

            // Fetch and display user's display name and role
            user.get('profile').on(profile => {
                if (profile && profile.displayname) {
                    currentUserDisplaynameSpan.textContent = `Welcome, ${profile.displayname}!`;
                }
                if (profile && profile.role === 'admin' || profile.role === 'moderator') {
                    adminSection.classList.remove('hidden');
                } else {
                    adminSection.classList.add('hidden');
                }
            });

            // Initialize chat specific logic (like listening for messages)
            // For now, we'll keep the dummy messages, but you'd load real chat data here
            messagesContainer.innerHTML = ''; // Clear initial dummy messages
            addNewMessage('Hey everyone, welcome to the chat!', 'Alice', false);
            addNewMessage('Thanks, Alice! Looking forward to this. Check out this link: https://gsap.com', 'You', true);
            addNewMessage('Cool! I\'m sharing a pic from my trip:', 'Bob', false, null, 'https://via.placeholder.com/200x150?text=Sample+Image');


        } else {
            authScreen.classList.remove('hidden');
            appContainer.classList.add('hidden');
            currentUserDisplaynameSpan.textContent = ''; // Clear display name
            adminSection.classList.add('hidden'); // Hide admin section
        }
    }

    // Function to get current user's role (simplified)
    async function getCurrentUserRole() {
        return new Promise(resolve => {
            if (!user.is) return resolve(null); // Not logged in
            user.get('profile').once(data => {
                resolve(data ? data.role : 'user'); // Default to 'user' if no role found
            });
        });
    }

    // --- Event Listeners for Auth Forms ---

    showLoginBtn.addEventListener('click', () => toggleAuthForm('login'));
    showSignupBtn.addEventListener('click', () => toggleAuthForm('signup'));

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const alias = loginAliasInput.value;
        const password = loginPasswordInput.value;

        user.auth(alias, password, (ack) => {
            if (ack.err) {
                console.error("Login failed:", ack.err);
                displayAuthMessage(loginMessage, ack.err);
            } else {
                console.log("Logged in as:", ack.pub);
                displayAuthMessage(loginMessage, "Login successful!", false);
                // Clear inputs
                loginAliasInput.value = '';
                loginPasswordInput.value = '';
                updateUI(true); // Show the main app
            }
        });
    });

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const alias = signupAliasInput.value;
        const password = signupPasswordInput.value;
        const displayname = signupDisplaynameInput.value;

        if (!displayname.trim()) {
            displayAuthMessage(signupMessage, "Display name cannot be empty.");
            return;
        }

        user.create(alias, password, (ack) => {
            if (ack.err) {
                console.error("Sign up failed:", ack.err);
                displayAuthMessage(signupMessage, ack.err);
            } else {
                console.log("Account created:", ack.pub);
                displayAuthMessage(signupMessage, "Account created! You can now log in.", false);
                // Save display name to user's public profile
                user.get('profile').put({ displayname: displayname, role: 'user' }, (putAck) => {
                    if (putAck.err) console.error("Error saving profile:", putAck.err);
                });
                // Automatically log in after successful creation
                user.auth(alias, password, (authAck) => {
                    if (authAck.err) {
                        console.error("Auto-login failed:", authAck.err);
                        toggleAuthForm('login'); // Redirect to login if auto-auth fails
                    } else {
                        console.log("Auto-logged in after signup.");
                        // Clear inputs
                        signupAliasInput.value = '';
                        signupPasswordInput.value = '';
                        signupDisplaynameInput.value = '';
                        updateUI(true); // Show the main app
                    }
                });
            }
        });
    });

    logoutBtn.addEventListener('click', () => {
        user.leave();
        console.log("Logged out.");
        updateUI(false); // Show the auth screen
        // Optionally, clear chat messages on logout
        messagesContainer.innerHTML = '';
        gsap.to(appContainer, { duration: 0.5, opacity: 0, scale: 0.9, onComplete: () => {
            appContainer.classList.add('hidden');
            authScreen.classList.remove('hidden');
            gsap.fromTo(authScreen, { opacity: 0 }, { opacity: 1, duration: 0.5 });
        }});
    });


    // --- Existing Chat App Logic (Modified for User Context) ---

    let isSidebarExpanded = false;
    menuToggle.addEventListener('click', () => {
        isSidebarExpanded = !isSidebarExpanded;
        if (isSidebarExpanded) {
            gsap.to(sidebarNav, { duration: 0.3, left: '0vw', ease: "power2.out" });
            sidebar.classList.add('expanded');
        } else {
            gsap.to(sidebarNav, { duration: 0.3, left: '-100vw', ease: "power2.in" });
            sidebar.classList.remove('expanded');
        }
    });

    document.body.addEventListener('click', (e) => {
        if (isSidebarExpanded && !sidebar.contains(e.target) && window.innerWidth <= 768) {
            gsap.to(sidebarNav, { duration: 0.3, left: '-100vw', ease: "power2.in" });
            sidebar.classList.remove('expanded');
            isSidebarExpanded = false;
        }
    });

    function linkify(text) {
        const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+?\.[^\s]+)|([a-zA-Z0-9.\-]+?\.(com|org|net|gov|edu|io|co|uk|dev|app)[^\s]*)/g;
        return text.replace(urlRegex, (url) => {
            let fullUrl = url;
            if (!url.match(/^(https?:\/\/|ftp:\/\/)/)) {
                fullUrl = 'http://' + url;
            }
            return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

    // Modified addNewMessage to use current logged-in user's display name
    function addNewMessage(messageContent, sender, isOutgoing = false, imageData = null, imageUrl = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        if (isOutgoing) {
            messageDiv.classList.add('outgoing');
        } else {
            messageDiv.classList.add('incoming');
        }

        const avatarInitial = sender.charAt(0).toUpperCase();
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let contentHTML = '';
        if (imageData || imageUrl) {
            const imgSrc = imageData || imageUrl;
            contentHTML += `<div class="message-image-wrapper"><img src="${imgSrc}" alt="Shared Image" class="message-image"></div>`;
        }
        if (messageContent) {
            contentHTML += `<p>${linkify(messageContent)}</p>`;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatarInitial}</div>
            <div class="message-content">
                <span class="message-sender">${sender}</span>
                ${contentHTML}
                <span class="message-timestamp">${timestamp}</span>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        gsap.from(messageDiv, {
            duration: 0.5,
            y: 30,
            opacity: 0,
            scale: 0.9,
            ease: "back.out(1.7)",
            clearProps: "all"
        });
    }

    sendMessageBtn.addEventListener('click', async () => {
        const text = messageInput.value.trim();
        if (!user.is) { // Check if user is logged in
            alert("Please log in to send messages.");
            return;
        }
        const senderProfile = await getCurrentUserDisplayName(); // Get actual display name
        const senderName = senderProfile || 'Anonymous'; // Fallback

        if (text) {
            addNewMessage(text, senderName, true);
            // In a real app, you'd send this to Gun.js:
            // gun.get('chatrooms').get('general').get('messages').set({ text: text, sender: senderName, timestamp: Date.now() });
            messageInput.value = '';
            messageInput.style.height = '45px';
        }
    });

    // Helper to get current user's display name
    async function getCurrentUserDisplayName() {
        return new Promise(resolve => {
            if (!user.is) return resolve(null);
            user.get('profile').once(data => {
                resolve(data ? data.displayname : user.is.pub.slice(0, 5) + '...'); // Fallback to truncated public key
            });
        });
    }


    attachBtn.addEventListener('click', () => {
        if (!user.is) {
            alert("Please log in to upload images.");
            return;
        }
        imageUploadInput.click();
    });

    imageUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("File is too large. For production, images should be uploaded to a server and their URLs shared.");
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const imageDataUrl = e.target.result;
                const senderProfile = await getCurrentUserDisplayName();
                const senderName = senderProfile || 'Anonymous';

                addNewMessage('', senderName, true, imageDataUrl);
                // In a real app, you'd send this to Gun.js:
                // gun.get('chatrooms').get('general').get('messages').set({ sender: senderName, type: 'image', imageData: imageDataUrl, timestamp: Date.now() });
            };
            reader.readAsDataURL(file);
        }
        imageUploadInput.value = '';
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    // Modal Open/Close Animations (no changes here)
    function openModal(modalElement) {
        modalElement.style.display = 'flex';
        gsap.to(modalElement.querySelector('.modal-content'), {
            duration: 0.4,
            scale: 1,
            opacity: 1,
            ease: "back.out(1.7)"
        });
    }

    function closeModal(modalElement) {
        gsap.to(modalElement.querySelector('.modal-content'), {
            duration: 0.3,
            scale: 0.8,
            opacity: 0,
            ease: "power2.in",
            onComplete: () => {
                modalElement.style.display = 'none';
            }
        });
    }

    createChatroomBtn.addEventListener('click', async () => {
        const role = await getCurrentUserRole();
        if (!user.is) {
            alert("Please log in to create a chatroom.");
            return;
        }
        openModal(chatroomModal);
    });

    viewPendingBtn.addEventListener('click', async () => {
        const role = await getCurrentUserRole();
        if (!user.is || (role !== 'admin' && role !== 'moderator')) {
            alert("You do not have permission to view pending chatrooms.");
            return;
        }
        // In a real app, you'd fetch pending rooms here
        const pendingList = document.getElementById('pending-list');
        if (pendingList.children.length === 0) {
             const dummyItem = document.createElement('li');
             dummyItem.innerHTML = `
                <span>#dummy-room (by UserX)</span>
                <button class="btn success-btn approve-btn">Approve</button>
                <button class="btn danger-btn reject-btn">Reject</button>
             `;
             pendingList.appendChild(dummyItem);
             gsap.from(dummyItem, { duration: 0.4, y: 20, opacity: 0, ease: "power2.out" });
        }
        openModal(pendingModal);
    });

    document.querySelectorAll('.close-button').forEach(button => {
        button.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal'));
        });
    });

    [chatroomModal, pendingModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    document.getElementById('create-chatroom-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const role = await getCurrentUserRole();
        if (!user.is) { // Double check login
            alert("Please log in to create a chatroom.");
            return;
        }
        const chatroomName = document.getElementById('chatroom-name').value;
        const chatroomDesc = document.getElementById('chatroom-description').value;
        console.log(`Requesting chatroom: ${chatroomName}, Description: ${chatroomDesc}`);
        alert(`Chatroom "${chatroomName}" submitted for approval!`);
        closeModal(chatroomModal);
        // Integrate with gun.js requestChatroomCreation(chatroomName, chatroomDesc);
    });

    document.getElementById('pending-list').addEventListener('click', async (e) => {
        const role = await getCurrentUserRole();
        if (!user.is || (role !== 'admin' && role !== 'moderator')) {
            alert("You do not have permission to approve/reject chatrooms.");
            return;
        }
        if (e.target.classList.contains('approve-btn')) {
            alert('Chatroom Approved!');
            gsap.to(e.target.closest('li'), {
                duration: 0.3, opacity: 0, x: 50, ease: "power2.in", onComplete: () => e.target.closest('li').remove()
            });
            // Integrate with gun.js approveChatroom(id);
        } else if (e.target.classList.contains('reject-btn')) {
            alert('Chatroom Rejected!');
            gsap.to(e.target.closest('li'), {
                duration: 0.3, opacity: 0, x: -50, ease: "power2.in", onComplete: () => e.target.closest('li').remove()
            });
            // Integrate with gun.js rejectChatroom(id);
        }
    });

    // --- Initial Check on Load ---
    // Check if user is already logged in (e.g., from a previous session)
    user.recall({ sessionStorage: true }, (ack) => {
        if (ack.err) {
            console.warn("No active session or recall error:", ack.err);
            updateUI(false); // Show login screen
        } else {
            console.log("Session recalled. Logged in as:", ack.pub);
            // Fetch user profile immediately after recall
            user.get('profile').once(profile => {
                if (!profile) {
                    // If profile doesn't exist (e.g., old account without displayname)
                    // You might want to prompt for display name or set a default.
                    user.get('profile').put({ displayname: user.is.pub.slice(0, 5) + '...', role: 'user' });
                }
                updateUI(true); // Show main app
            });
        }
    });
});
