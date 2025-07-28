document.addEventListener('DOMContentLoaded', () => {
    // --- Gun.js Initialization ---
    const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
    const user = gun.user();

    // --- DOM Elements (only chatroom related) ---
    const appContainer = document.getElementById('app-container');
    const currentUserDisplaynameSpan = document.getElementById('current-user-displayname');
    const logoutBtn = document.getElementById('logout-btn');
    const adminSection = document.getElementById('admin-section');

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

    // --- Initial Check for Login Status ---
    user.recall({ sessionStorage: true }, (ack) => {
        if (!user.is) { // If not logged in
            console.log("Not logged in, redirecting to login page.");
            window.location.href = 'login.html'; // Redirect to login page
        } else {
            console.log("Session recalled. Logged in as:", user.is.pub);
            // Animate the app container's initial appearance
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
                } else {
                    currentUserDisplaynameSpan.textContent = `Welcome, ${user.is.pub.slice(0, 5)}...!`;
                }
                if (profile && (profile.role === 'admin' || profile.role === 'moderator')) {
                    adminSection.classList.remove('hidden');
                } else {
                    adminSection.classList.add('hidden');
                }
            });

            // Initial messages (assuming general chatroom)
            messagesContainer.innerHTML = ''; // Clear initial dummy messages
            addNewMessage('Hey everyone, welcome to the chat!', 'Alice', false);
            addNewMessage('Thanks, Alice! Looking forward to this. Check out this link: https://gsap.com', 'You', true);
            addNewMessage('Cool! I\'m sharing a pic from my trip:', 'Bob', false, null, 'https://via.placeholder.com/200x150?text=Sample+Image');
        }
    });

    // --- Logout Logic ---
    logoutBtn.addEventListener('click', () => {
        user.leave();
        console.log("Logged out, redirecting to login page.");
        window.location.href = 'login.html'; // Redirect to login page
    });

    // --- Helper Functions ---
    async function getCurrentUserRole() {
        return new Promise(resolve => {
            if (!user.is) return resolve(null);
            user.get('profile').once(data => {
                resolve(data ? data.role : 'user');
            });
        });
    }

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

    async function getCurrentUserDisplayName() {
        return new Promise(resolve => {
            if (!user.is) return resolve(null);
            user.get('profile').once(data => {
                resolve(data ? data.displayname : user.is.pub.slice(0, 5) + '...');
            });
        });
    }

    // --- Chat App Event Listeners (with login checks) ---

    // Sidebar toggle (no changes needed)
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

    // Send Message
    sendMessageBtn.addEventListener('click', async () => {
        const text = messageInput.value.trim();
        if (!user.is) {
            alert("Please log in to send messages.");
            return;
        }
        const senderProfile = await getCurrentUserDisplayName();
        const senderName = senderProfile || 'Anonymous';

        if (text) {
            addNewMessage(text, senderName, true);
            // In a real app, you'd send this to Gun.js:
            // gun.get('chatrooms').get('general').get('messages').set({ text: text, sender: senderName, timestamp: Date.now() });
            messageInput.value = '';
            messageInput.style.height = '45px';
        }
    });

    // Attach File
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

    // Modals (with login/role checks)
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
        if (!user.is) {
            alert("Please log in to create a chatroom.");
            return;
        }
        const chatroomName = document.getElementById('chatroom-name').value;
        const chatroomDesc = document.getElementById('chatroom-description').value;
        console.log(`Requesting chatroom: ${chatroomName}, Description: ${chatroomDesc}`);
        alert(`Chatroom "${chatroomName}" submitted for approval!`);
        closeModal(chatroomModal);
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
        } else if (e.target.classList.contains('reject-btn')) {
            alert('Chatroom Rejected!');
            gsap.to(e.target.closest('li'), {
                duration: 0.3, opacity: 0, x: -50, ease: "power2.in", onComplete: () => e.target.closest('li').remove()
            });
        }
    });
});
