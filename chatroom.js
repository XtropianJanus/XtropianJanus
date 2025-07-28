document.addEventListener('DOMContentLoaded', () => {
    // --- Gun.js Initialization ---
    const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
    const user = gun.user();

    // --- Global Chatroom State ---
    let currentChatroomRef = null; // Gun reference to the currently active chatroom
    let currentChatroomID = null;   // ID of the currently active chatroom
    let currentMessageListener = null; // Stores the listener function for current chatroom messages
    let currentUserDisplayName = 'Anonymous'; // Default for initial messages or if profile not loaded yet
    let currentUserRole = 'user'; // Default role


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
    const chatroomList = document.getElementById('chatroom-list'); // Reference to the UL for chatrooms
    const currentChatroomNameHeader = document.getElementById('current-chatroom-name'); // Header for current chatroom name

    // ADMIN DOM ELEMENTS
    const manageUsersBtn = document.getElementById('manage-users-btn');
    const userManagementModal = document.getElementById('user-management-modal');
    const userManagementList = document.getElementById('user-management-list');
    const userManagementMessage = document.getElementById('user-management-message');


    // --- Helper Functions ---
    // Function to get current user's role and display name
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

        // Generate a unique ID for the message element to prevent re-adding on subsequent map.once calls
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        messageDiv.dataset.messageId = messageId; // Add data attribute for lookup

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

        // Check if message already exists before appending
        if (!messagesContainer.querySelector(`[data-message-id="${messageId}"]`)) {
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
    }

    // --- Chatroom Management Functions ---

    // Function to load and display chatrooms in the sidebar
    function loadChatrooms() {
        // Clear existing listeners for this specific `map().on` to prevent multiple instances
        // and ensure the list is built correctly on updates.
        // We'll clear the entire list and rebuild it, which is simpler for smaller lists.
        chatroomList.innerHTML = '';
        gun.get('chatrooms').map().on((chatroomData, chatroomID) => {
            // Only add if data is valid and chatroom is approved
            if (chatroomData && chatroomData.name && chatroomData.status === 'approved') {
                // Check if element already exists to prevent duplicates from .on()
                if (!document.querySelector(`#chatroom-list li[data-chatroom-id="${chatroomID}"]`)) {
                    const li = document.createElement('li');
                    li.textContent = `#${chatroomData.name}`;
                    li.dataset.chatroomId = chatroomID;
                    li.addEventListener('click', () => switchChatroom(chatroomID, chatroomData.name));

                    // Add active class if it's the current chatroom
                    if (chatroomID === currentChatroomID) {
                        li.classList.add('active');
                    }
                    chatroomList.appendChild(li);
                }
            } else if (chatroomData === null || (chatroomData && chatroomData.status !== 'approved')) {
                // Handle deletion or status change: remove from UI if it was approved and now deleted/nullified/rejected
                const existingLi = document.querySelector(`#chatroom-list li[data-chatroom-id="${chatroomID}"]`);
                if (existingLi) {
                    existingLi.remove();
                    // If the deleted chatroom was the current one, switch to general or prompt user
                    if (chatroomID === currentChatroomID) {
                        currentChatroomID = null;
                        currentChatroomRef = null;
                        messagesContainer.innerHTML = '<h2>Chatroom deleted or no longer available. Please select another.</h2>';
                        currentChatroomNameHeader.textContent = 'No Chatroom Selected';
                        if(currentMessageListener) {
                            // Ensure old listener is detached
                            gun.get('chatrooms').get(chatroomID).get('messages').map().off(currentMessageListener);
                            currentMessageListener = null;
                        }
                        // Try to switch to general if available
                        gun.get('chatrooms').map().once((data, id) => {
                            if (data && data.name === 'general' && data.status === 'approved') {
                                switchChatroom(id, 'general');
                            }
                        });
                    }
                }
            }
        });
    }

    // Function to switch to a different chatroom
    function switchChatroom(newChatroomID, newChatroomName) {
        // 1. Stop listening to old messages
        if (currentMessageListener && currentChatroomRef) {
            currentChatroomRef.get('messages').map().off(currentMessageListener);
            currentMessageListener = null;
            console.log(`Detached listener from old chatroom: ${currentChatroomID}`);
        }

        // 2. Clear current messages from UI
        messagesContainer.innerHTML = '';
        currentChatroomNameHeader.textContent = `#${newChatroomName}`;
        console.log(`Switched to chatroom: #${newChatroomName} (${newChatroomID})`);


        // 3. Update active chatroom in sidebar UI
        document.querySelectorAll('#chatroom-list li').forEach(li => {
            li.classList.remove('active');
            if (li.dataset.chatroomId === newChatroomID) {
                li.classList.add('active');
            }
        });

        // 4. Set new current chatroom reference and ID
        currentChatroomID = newChatroomID;
        currentChatroomRef = gun.get('chatrooms').get(newChatroomID);

        // 5. Load historical messages first, then attach listener for new messages
        // Use .once() to load existing messages. Gun delivers these in arbitrary order, so sorting would be needed for many messages.
        const loadedMessageIds = new Set(); // To prevent duplicates from .once() and .on()
        currentChatroomRef.get('messages').map().once((messageData, messageID) => {
            if (messageData && (messageData.text || messageData.imageData || messageData.imageUrl) && !loadedMessageIds.has(messageID)) {
                loadedMessageIds.add(messageID);
                gun.get('~' + messageData.sender).get('profile').once(profile => {
                    const senderDisplayName = profile && profile.displayname ? profile.displayname : messageData.sender.slice(0, 5) + '...';
                    const isOutgoing = user.is && messageData.sender === user.is.pub;
                    addNewMessage(messageData.text, senderDisplayName, isOutgoing, messageData.imageData, messageData.imageUrl);
                });
            }
        });

        // Now attach the .on() listener for future messages
        currentMessageListener = (messageData, messageID) => {
            if (messageData && (messageData.text || messageData.imageData || messageData.imageUrl) && !loadedMessageIds.has(messageID)) {
                loadedMessageIds.add(messageID); // Add to set for new messages too
                gun.get('~' + messageData.sender).get('profile').once(profile => {
                    const senderDisplayName = profile && profile.displayname ? profile.displayname : messageData.sender.slice(0, 5) + '...';
                    const isOutgoing = user.is && messageData.sender === user.is.pub;
                    addNewMessage(messageData.text, senderDisplayName, isOutgoing, messageData.imageData, messageData.imageUrl);
                });
            } else if (messageData === null && loadedMessageIds.has(messageID)) {
                // Handle message deletion (if a message is nullified in Gun)
                const existingMsgDiv = messagesContainer.querySelector(`[data-message-id="${messageID}"]`);
                if (existingMsgDiv) {
                    existingMsgDiv.remove();
                    loadedMessageIds.delete(messageID);
                }
            }
        };
        currentChatroomRef.get('messages').map().on(currentMessageListener);


        // Close sidebar on mobile after switching
        if (window.innerWidth <= 768 && isSidebarExpanded) {
            gsap.to(sidebarNav, { duration: 0.3, left: '-100vw', ease: "power2.in" });
            sidebar.classList.remove('expanded');
            isSidebarExpanded = false;
        }
    }

    // Function to ensure a default chatroom is active (or create it)
    async function ensureDefaultChatroomActive() {
        return new Promise(resolve => {
            let foundGeneral = false;
            // Use a temporary listener to find the 'general' chatroom
            const tempListener = (chatroomData, chatroomID) => {
                if (chatroomData && chatroomData.name === 'general' && chatroomData.status === 'approved') {
                    if (!foundGeneral) {
                        console.log("Found #general chatroom, switching to it.");
                        switchChatroom(chatroomID, chatroomData.name);
                        foundGeneral = true;
                        resolve(true);
                        // Once found, detach this temporary listener
                        gun.get('chatrooms').map().off(tempListener); // Detach specific listener instance
                    }
                }
            };
            // Attach the temporary listener
            gun.get('chatrooms').map().on(tempListener);

            // If after a short timeout, 'general' is not found, create it
            setTimeout(() => {
                if (!foundGeneral) {
                    console.log("No #general chatroom found, attempting to create.");
                    gun.get('chatrooms').set({
                        name: 'general',
                        description: 'The main chatroom for everyone!',
                        creator: 'System',
                        status: 'approved',
                        createdAt: Date.now()
                    }, (ack) => {
                        if (ack.err) {
                            console.error("Error creating default chatroom:", ack.err);
                            resolve(false);
                        } else {
                            console.log("Default #general chatroom creation initiated. Waiting for Gun to sync and switch.");
                            // The tempListener should now pick up the newly created chatroom and trigger switchChatroom
                            resolve(true);
                        }
                    });
                } else {
                    // If it was found within the timeout by tempListener, ensure resolve is called.
                    resolve(true);
                }
            }, 2000); // Increased timeout to 2 seconds for slower networks
        });
    }

    // --- User Management Functions ---

    function loadUserManagementList() {
        userManagementList.innerHTML = '';
        userManagementMessage.textContent = '';

        // Gun's '~' graph contains all user public keys mapped to aliases
        gun.get('~').map().on(async (aliasData, userPub) => {
            // aliasData here is just the alias string, userPub is the public key
            if (userPub && userPub !== user.is.pub) { // Don't list current user
                // Fetch the actual profile data using the public key
                gun.get('~' + userPub).get('profile').once(profileData => {
                    const displayname = profileData && profileData.displayname ? profileData.displayname : userPub.slice(0, 5) + '...';
                    const role = profileData && profileData.role ? profileData.role : 'user';

                    // Check if the user's LI element already exists to avoid duplicates from .on()
                    let existingLi = document.querySelector(`#user-management-list li[data-user-pub="${userPub}"]`);
                    if (existingLi) {
                        // Update existing entry
                        existingLi.querySelector('span').textContent = `${displayname} (${role})`;
                        existingLi.querySelector('select').value = role;
                    } else {
                        // Create new entry
                        const li = document.createElement('li');
                        li.dataset.userPub = userPub; // Store public key on the LI
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
            } else if (aliasData === null) { // User was deleted/nullified (e.g., if alias put(null))
                const existingLi = document.querySelector(`#user-management-list li[data-user-pub="${userPub}"]`);
                if (existingLi) {
                    existingLi.remove();
                }
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

            if (targetUserPub === user.is.pub) {
                userManagementMessage.textContent = "You cannot change your own role via this panel.";
                userManagementMessage.style.color = 'var(--danger-color)';
                return;
            }

            gun.get('~' + targetUserPub).get('profile').get('role').put(newRole, (ack) => {
                if (ack.err) {
                    console.error("Error updating role:", ack.err);
                    userManagementMessage.textContent = `Failed to update role for ${targetUserPub.slice(0, 5)}...: ${ack.err}`;
                    userManagementMessage.style.color = 'var(--danger-color)';
                } else {
                    // Fetch display name for success message
                    gun.get('~' + targetUserPub).get('profile').get('displayname').once(displayName => {
                        userManagementMessage.textContent = `Role for ${displayName || targetUserPub.slice(0,5)+'...'} updated to ${newRole}!`;
                        userManagementMessage.style.color = 'var(--success-color)';
                    });
                    // The .map().on listener for loadUserManagementList will automatically update the UI
                }
            });
        }
    });


    // --- Admin Bootstrap Function (FOR DEMO ONLY) ---
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
                location.reload();
            }
        });
    };


    // --- Initial Check for Login Status ---
    user.recall({ sessionStorage: true }, async (ack) => {
        if (!user.is) {
            console.log("Not logged in, redirecting to login page.");
            window.location.href = 'login.html';
        } else {
            console.log("Session recalled. Logged in as:", user.is.pub);
            await fetchUserProfile(); // Fetch user profile and set display name/role

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

            loadChatrooms(); // Start listening for chatroom list updates
            await ensureDefaultChatroomActive(); // Ensure a chatroom is selected and active
        }
    });

    // --- Logout Logic ---
    logoutBtn.addEventListener('click', () => {
        if (currentMessageListener && currentChatroomRef) {
            currentChatroomRef.get('messages').map().off(currentMessageListener);
            currentMessageListener = null;
        }
        user.leave();
        console.log("Logged out, redirecting to login page.");
        window.location.href = 'login.html';
    });

    // --- Chat App Event Listeners ---

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
                sender: user.is.pub, // Store public key as sender for accurate display name lookup
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
                    sender: user.is.pub, // Store public key as sender
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
                // Check if element already exists to prevent duplicates from .on()
                if (!document.querySelector(`#pending-list li[data-chatroom-id="${chatroomID}"]`)) {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>#${chatroomData.name} (by ${chatroomData.creator || 'Unknown'})</span>
                        <button class="btn success-btn approve-btn" data-chatroom-id="${chatroomID}">Approve</button>
                        <button class="btn danger-btn reject-btn" data-chatroom-id="${chatroomID}">Reject</button>
                    `;
                    pendingList.appendChild(li);
                    gsap.from(li, { duration: 0.4, y: 20, opacity: 0, ease: "power2.out" });
                }
            } else if (chatroomData === null || chatroomData.status === 'approved' || chatroomData.status === 'rejected') {
                // Remove from pending list if it was approved, rejected, or deleted
                const existingLi = document.querySelector(`#pending-list li[data-chatroom-id="${chatroomID}"]`);
                if (existingLi) {
                    existingLi.remove();
                }
            }
        });

        openModal(pendingModal);
    });

    // Manage Users Button Click
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

    [chatroomModal, pendingModal, userManagementModal].forEach(modal => {
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

        // IMPROVED: Check if chatroom with this name already exists more reliably
        const checkPromise = new Promise(resolve => {
            let found = false;
            // Use a temporary listener that detaches itself once it finds a match or finishes iterating
            const tempCheckListener = gun.get('chatrooms').map().on(function(data) {
                if (data && data.name === chatroomName) {
                    found = true;
                }
                // Detach the listener after a short delay to ensure it had time to check existing data
                // This is still a heuristic, a dedicated index would be better.
                setTimeout(() => {
                    this.off(); // Detach the listener
                    resolve(found);
                }, 50); // Short delay
            });
            // Fallback timeout in case map().on doesn't trigger for empty sets or very fast resolution
            setTimeout(() => {
                if (!found) {
                    tempCheckListener.off(); // Ensure it's off if timeout hits first
                    resolve(false);
                }
            }, 500); // Max wait for check
        });

        const nameExists = await checkPromise;

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
                            // loadChatrooms() is now handled by the .map().on listener which will update the list
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
