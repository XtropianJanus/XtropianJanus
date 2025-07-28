document.addEventListener('DOMContentLoaded', () => {
    // --- Gun.js Initialization ---
    const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
    const user = gun.user();

    // --- Global Chatroom State ---
    let currentChatroomRef = null;
    let currentChatroomID = null;
    let currentMessageListener = null;
    let currentUserDisplayName = 'Anonymous';
    let currentUserRole = 'user';


    // --- DOM Elements ---
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
    const chatroomList = document.getElementById('chatroom-list');
    const currentChatroomNameHeader = document.getElementById('current-chatroom-name');

    // NEW ADMIN DOM ELEMENTS
    const manageUsersBtn = document.getElementById('manage-users-btn');
    const userManagementModal = document.getElementById('user-management-modal');
    const userManagementList = document.getElementById('user-management-list');
    const userManagementMessage = document.getElementById('user-management-message');


    // --- Helper Functions ---
    async function fetchUserProfile() {
        return new Promise(resolve => {
            if (!user.is) {
                currentUserDisplayName = 'Anonymous';
                currentUserRole = 'user';
                return resolve({ displayname: currentUserDisplayName, role: currentUserRole });
            }
            user.get('profile').once(profile => {
                currentUserDisplayName = profile && profile.displayname ? profile.displayname : user.is.pub.slice(0, 5) + '...';
                currentUserRole = profile && profile.role ? profile.role : 'user';
                currentUserDisplaynameSpan.textContent = `Welcome, ${currentUserDisplayName}!`;

                // Show/hide admin section based on role
                if (currentUserRole === 'admin' || currentUserRole === 'moderator') {
                    adminSection.classList.remove('hidden');
                } else {
                    adminSection.classList.add('hidden');
                }
                resolve({ displayname: currentUserDisplayName, role: currentUserRole });
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

    // --- Chatroom Management Functions ---

    function loadChatrooms() {
        chatroomList.innerHTML = '';
        gun.get('chatrooms').map().on((chatroomData, chatroomID) => {
            if (chatroomData && chatroomData.status === 'approved') {
                const li = document.createElement('li');
                li.textContent = `#${chatroomData.name}`;
                li.dataset.chatroomId = chatroomID;
                li.addEventListener('click', () => switchChatroom(chatroomID, chatroomData.name));

                if (chatroomID === currentChatroomID) {
                    li.classList.add('active');
                }
                chatroomList.appendChild(li);
            }
        });
    }

    function switchChatroom(newChatroomID, newChatroomName) {
        if (currentMessageListener) {
            currentChatroomRef.get('messages').map().off(currentMessageListener);
            currentMessageListener = null;
        }

        messagesContainer.innerHTML = '';
        currentChatroomNameHeader.textContent = `#${newChatroomName}`;

        document.querySelectorAll('#chatroom-list li').forEach(li => {
            li.classList.remove('active');
            if (li.dataset.chatroomId === newChatroomID) {
                li.classList.add('active');
            }
        });

        currentChatroomID = newChatroomID;
        currentChatroomRef = gun.get('chatrooms').get(newChatroomID);

        currentMessageListener = (messageData, messageID) => {
            if (messageData && (messageData.text || messageData.imageData || messageData.imageUrl)) {
                const isOutgoing = user.is && messageData.sender === currentUserDisplayName;
                addNewMessage(messageData.text, messageData.sender, isOutgoing, messageData.imageData, messageData.imageUrl);
            }
        };
        currentChatroomRef.get('messages').map().on(currentMessageListener);

        if (window.innerWidth <= 768 && isSidebarExpanded) {
            gsap.to(sidebarNav, { duration: 0.3, left: '-100vw', ease: "power2.in" });
            sidebar.classList.remove('expanded');
            isSidebarExpanded = false;
        }
    }

    function createDefaultChatroomIfNeeded() {
        gun.get('chatrooms').once(allChatrooms => {
            let generalExists = false;
            let generalChatroomID = null;
            if (allChatrooms) {
                for (const key in allChatrooms) {
                    if (allChatrooms.hasOwnProperty(key) && allChatrooms[key] && allChatrooms[key].name === 'general' && allChatrooms[key].status === 'approved') {
                        generalExists = true;
                        generalChatroomID = key;
                        break;
                    }
                }
            }

            if (!generalExists) {
                console.log("Creating default #general chatroom...");
                gun.get('chatrooms').set({
                    name: 'general',
                    description: 'The main chatroom for everyone!',
                    creator: 'System',
                    status: 'approved',
                    createdAt: Date.now()
                }, (ack) => {
                    if (ack.err) {
                        console.error("Error creating default chatroom:", ack.err);
                    } else {
                        console.log("Default #general chatroom created.");
                        // After creation, reload chatrooms and switch to it
                        loadChatrooms();
                        gun.get('chatrooms').map().once((chatroomData, chatroomID) => {
                            if (chatroomData && chatroomData.name === 'general' && chatroomData.status === 'approved') {
                                switchChatroom(chatroomID, chatroomData.name);
                            }
                        });
                    }
                });
            } else {
                switchChatroom(generalChatroomID, 'general');
            }
        });
    }

    // --- User Management Functions (NEW) ---

    // Function to load all user profiles for management
    function loadUserManagementList() {
        userManagementList.innerHTML = ''; // Clear existing list
        userManagementMessage.textContent = ''; // Clear previous messages

        // Iterate over all users known to Gun
        // This is not efficient for many users in a production app; typically you'd have a backend API
        // or a dedicated Gun graph structure for user directories.
        gun.get('~').map().on(async (userAliasData, userPub) => {
            // userAliasData might be just the alias, or null for revoked users.
            // We need to get the public key from the alias, then fetch the profile.
            if (userPub && userPub !== user.is.pub) { // Don't list current user or null entries
                // Fetch the actual profile data using the public key
                gun.get('~' + userPub).get('profile').once(profileData => {
                    if (profileData) {
                        const displayname = profileData.displayname || userPub.slice(0, 5) + '...';
                        const role = profileData.role || 'user';

                        const li = document.createElement('li');
                        li.innerHTML = `
                            <span>${displayname} (${role})</span>
                            <select data-user-pub="${userPub}">
                                <option value="user" ${role === 'user' ? 'selected' : ''}>User</option>
                                <option value="moderator" ${role === 'moderator' ? 'selected' : ''}>Moderator</option>
                                <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                            <button class="btn primary-btn update-role-btn" data-user-pub="${userPub}">Update</button>
                        `;
                        userManagementList.appendChild(li);
                    }
                });
            }
        });
    }

    // Function to update a user's role
    userManagementList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('update-role-btn')) {
            const targetUserPub = e.target.dataset.userPub;
            const selectElement = userManagementList.querySelector(`select[data-user-pub="${targetUserPub}"]`);
            const newRole = selectElement.value;

            if (!user.is || currentUserRole !== 'admin') {
                userManagementMessage.textContent = "You must be an admin to change roles.";
                userManagementMessage.style.color = 'var(--danger-color)';
                return;
            }

            // Prevent an admin from demoting themselves or changing their own role via this panel
            if (targetUserPub === user.is.pub) {
                userManagementMessage.textContent = "You cannot change your own role via this panel.";
                userManagementMessage.style.color = 'var(--danger-color)';
                return;
            }

            // Update the user's profile on Gun
            gun.get('~' + targetUserPub).get('profile').get('role').put(newRole, (ack) => {
                if (ack.err) {
                    console.error("Error updating role:", ack.err);
                    userManagementMessage.textContent = `Failed to update role for ${targetUserPub.slice(0, 5)}...: ${ack.err}`;
                    userManagementMessage.style.color = 'var(--danger-color)';
                } else {
                    userManagementMessage.textContent = `Role for ${targetUserPub.slice(0, 5)}... updated to ${newRole}!`;
                    userManagementMessage.style.color = 'var(--success-color)';
                    // Reload the list to show updated role
                    loadUserManagementList();
                }
            });
        }
    });


    // --- Admin Bootstrap Function (FOR DEMO ONLY) ---
    // Expose this function globally for easy access from browser console
    window.bootstrapAdminRole = async function() {
        if (!user.is) {
            console.warn("Please log in first to bootstrap admin role.");
            return;
        }
        console.log("Attempting to set current user as admin...");
        user.get('profile').get('role').put('admin', (ack) => {
            if (ack.err) {
                console.error("Failed to set role to admin:", ack.err);
                alert("Failed to set role to admin. Check console for details.");
            } else {
                console.log("Role set to admin successfully! Please refresh the page.");
                alert("Your role has been set to admin. Please refresh the page to see changes.");
                // Force a reload to re-fetch profile and update UI
                location.reload();
            }
        });
    };


    // --- Initial Check for Login Status ---
    user.recall({ sessionStorage: true }, async (ack) => {
        if (!user.is) { // If not logged in
            console.log("Not logged in, redirecting to login page.");
            window.location.href = 'login.html'; // Redirect to login page
        } else {
            console.log("Session recalled. Logged in as:", user.is.pub);
            await fetchUserProfile(); // Fetch user profile and set display name/role

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

            loadChatrooms();
            createDefaultChatroomIfNeeded();
        }
    });

    // --- Logout Logic ---
    logoutBtn.addEventListener('click', () => {
        user.leave();
        console.log("Logged out, redirecting to login page.");
        window.location.href = 'login.html';
    });

    // --- Chat App Event Listeners (with login checks) ---

    // Sidebar toggle
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
        if (!user.is || !currentChatroomRef) {
            alert("Please log in and select a chatroom to send messages.");
            return;
        }

        if (text) {
            currentChatroomRef.get('messages').set({
                text: text,
                sender: currentUserDisplayName,
                timestamp: Date.now()
            }, (ack) => {
                if (ack.err) {
                    console.error("Error sending message:", ack.err);
                } else {
                    console.log("Message sent to Gun!");
                }
            });
            messageInput.value = '';
            messageInput.style.height = '45px';
        }
    });

    // Attach File
    attachBtn.addEventListener('click', () => {
        if (!user.is || !currentChatroomRef) {
            alert("Please log in and select a chatroom to upload images.");
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
                currentChatroomRef.get('messages').set({
                    imageData: imageDataUrl,
                    sender: currentUserDisplayName,
                    timestamp: Date.now()
                }, (ack) => {
                    if (ack.err) {
                        console.error("Error sending image:", ack.err);
                    } else {
                        console.log("Image sent to Gun!");
                    }
                });
            };
            reader.readAsDataURL(file);
        }
        imageUploadInput.value = '';
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    // Modals
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
        if (!user.is) {
            alert("Please log in to create a chatroom.");
            return;
        }
        if (currentUserRole !== 'admin' && currentUserRole !== 'moderator' && currentUserRole !== 'user') {
             alert("You do not have permission to create chatrooms.");
             return;
        }
        openModal(chatroomModal);
    });

    viewPendingBtn.addEventListener('click', async () => {
        if (!user.is) {
            alert("Please log in to view pending chatrooms.");
            return;
        }
        if (currentUserRole !== 'admin' && currentUserRole !== 'moderator') {
            alert("You do not have permission to view pending chatrooms.");
            return;
        }
        const pendingList = document.getElementById('pending-list');
        pendingList.innerHTML = '';

        gun.get('chatrooms').map().on((chatroomData, chatroomID) => {
            if (chatroomData && chatroomData.status === 'pending') {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>#${chatroomData.name} (by ${chatroomData.creator || 'Unknown'})</span>
                    <button class="btn success-btn approve-btn" data-chatroom-id="${chatroomID}">Approve</button>
                    <button class="btn danger-btn reject-btn" data-chatroom-id="${chatroomID}">Reject</button>
                `;
                pendingList.appendChild(li);
                gsap.from(li, { duration: 0.4, y: 20, opacity: 0, ease: "power2.out" });
            }
        });

        openModal(pendingModal);
    });

    // NEW: Manage Users Button Click
    manageUsersBtn.addEventListener('click', async () => {
        if (!user.is || currentUserRole !== 'admin') {
            alert("You must be an admin to manage users.");
            return;
        }
        loadUserManagementList();
        openModal(userManagementModal);
    });


    document.querySelectorAll('.close-button').forEach(button => {
        button.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal'));
        });
    });

    [chatroomModal, pendingModal, userManagementModal].forEach(modal => { // Added userManagementModal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    document.getElementById('create-chatroom-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user.is) {
            alert("Please log in to create a chatroom.");
            return;
        }
        const chatroomName = document.getElementById('chatroom-name').value.trim();
        const chatroomDesc = document.getElementById('chatroom-description').value.trim();

        if (!chatroomName) {
            alert("Chatroom name cannot be empty.");
            return;
        }

        // Check if chatroom with this name already exists
        let nameExists = false;
        gun.get('chatrooms').map().once((data) => {
            if (data && data.name === chatroomName) {
                nameExists = true;
            }
        });

        // Small delay to allow 'once' to complete. In a real app, use a Promise/async-await pattern
        setTimeout(() => {
            if (nameExists) {
                alert(`Chatroom with name "${chatroomName}" already exists. Please choose a different name.`);
                return;
            }

            gun.get('chatrooms').set({
                name: chatroomName,
                description: chatroomDesc,
                creator: currentUserDisplayName,
                status: 'pending',
                createdAt: Date.now()
            }, (ack) => {
                if (ack.err) {
                    console.error("Error requesting chatroom creation:", ack.err);
                    alert("Failed to request chatroom. Please try again.");
                } else {
                    console.log(`Chatroom "${chatroomName}" request submitted successfully. Waiting for approval.`);
                    alert(`Chatroom "${chatroomName}" submitted for approval!`);
                    closeModal(chatroomModal);
                }
            });
        }, 100); // Short delay
    });

    document.getElementById('pending-list').addEventListener('click', async (e) => {
        if (!user.is || (currentUserRole !== 'admin' && currentUserRole !== 'moderator')) {
            alert("You do not have permission to approve/reject chatrooms.");
            return;
        }

        const chatroomId = e.target.dataset.chatroomId;
        if (!chatroomId) return;

        if (e.target.classList.contains('approve-btn')) {
            gun.get('chatrooms').get(chatroomId).put({
                status: 'approved',
                approvedBy: currentUserDisplayName,
                approvedAt: Date.now()
            }, (ack) => {
                if (ack.err) {
                    console.error("Error approving chatroom:", ack.err);
                    alert("Failed to approve chatroom.");
                } else {
                    alert('Chatroom Approved!');
                    gsap.to(e.target.closest('li'), {
                        duration: 0.3, opacity: 0, x: 50, ease: "power2.in", onComplete: () => {
                            e.target.closest('li').remove();
                            loadChatrooms();
                        }
                    });
                }
            });
        } else if (e.target.classList.contains('reject-btn')) {
            gun.get('chatrooms').get(chatroomId).put({
                status: 'rejected',
                rejectedBy: currentUserDisplayName,
                rejectedAt: Date.now()
            }, (ack) => {
                if (ack.err) {
                    console.error("Error rejecting chatroom:", ack.err);
                    alert("Failed to reject chatroom.");
                } else {
                    alert('Chatroom Rejected!');
                    gsap.to(e.target.closest('li'), {
                        duration: 0.3, opacity: 0, x: -50, ease: "power2.in", onComplete: () => e.target.closest('li').remove()
                    });
                }
            });
        }
    });

});
