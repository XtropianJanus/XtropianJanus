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
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Keep scrolled to bottom

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

    // Function to load and display chatrooms in the sidebar
    function loadChatrooms() {
        chatroomList.innerHTML = ''; // Clear existing list
        gun.get('chatrooms').map().on((chatroomData, chatroomID) => {
            if (chatroomData && chatroomData.status === 'approved') {
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
        });
    }

    // Function to switch to a different chatroom
    function switchChatroom(newChatroomID, newChatroomName) {
        // 1. Stop listening to old messages
        if (currentMessageListener) {
            // Detach the previous listener
            currentChatroomRef.get('messages').map().off(currentMessageListener);
            currentMessageListener = null; // Clear the listener
        }

        // 2. Clear current messages from UI
        messagesContainer.innerHTML = '';
        currentChatroomNameHeader.textContent = `#${newChatroomName}`;

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

        // 5. Start listening for new messages in the new chatroom
        // Store the listener function to be able to turn it off later
        currentMessageListener = (messageData, messageID) => {
            if (messageData && messageData.text || messageData.imageData || messageData.imageUrl) {
                // Determine if the message is outgoing (sent by current user)
                const isOutgoing = user.is && messageData.sender === currentUserDisplayName;
                addNewMessage(messageData.text, messageData.sender, isOutgoing, messageData.imageData, messageData.imageUrl);
            }
        };

        // Listen for all messages in the current chatroom
        // Note: .map().on() will fire for existing messages AND new ones.
        currentChatroomRef.get('messages').map().on(currentMessageListener);

        // Close sidebar on mobile after switching
        if (window.innerWidth <= 768 && isSidebarExpanded) {
            gsap.to(sidebarNav, { duration: 0.3, left: '-100vw', ease: "power2.in" });
            sidebar.classList.remove('expanded');
            isSidebarExpanded = false;
        }
    }

    // Function to create a default chatroom if none exists
    function createDefaultChatroomIfNeeded() {
        gun.get('chatrooms').once(allChatrooms => {
            let generalExists = false;
            if (allChatrooms) {
                for (const key in allChatrooms) {
                    if (allChatrooms.hasOwnProperty(key) && allChatrooms[key] && allChatrooms[key].name === 'general' && allChatrooms[key].status === 'approved') {
                        generalExists = true;
                        break;
                    }
                }
            }

            if (!generalExists) {
                console.log("Creating default #general chatroom...");
                const generalChatroomID = gun.get('chatrooms').set({
                    name: 'general',
                    description: 'The main chatroom for everyone!',
                    creator: 'System', // Or a specific admin's public key
                    status: 'approved',
                    createdAt: Gun.SEA.work(Date.now().toString(), null, null, { name: 'SHA-256' })
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
                // If general exists, find its ID and switch to it
                gun.get('chatrooms').map().once((chatroomData, chatroomID) => {
                    if (chatroomData && chatroomData.name === 'general' && chatroomData.status === 'approved') {
                        switchChatroom(chatroomID, chatroomData.name);
                    }
                });
            }
        });
    }


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

            loadChatrooms(); // Load approved chatrooms into the sidebar
            createDefaultChatroomIfNeeded(); // Ensure a default chatroom exists and switch to it
        }
    });

    // --- Logout Logic ---
    logoutBtn.addEventListener('click', () => {
        user.leave();
        console.log("Logged out, redirecting to login page.");
        window.location.href = 'login.html'; // Redirect to login page
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
            // Send message to Gun.js
            currentChatroomRef.get('messages').set({
                text: text,
                sender: currentUserDisplayName, // Use the fetched display name
                timestamp: Date.now()
            }, (ack) => {
                if (ack.err) {
                    console.error("Error sending message:", ack.err);
                } else {
                    console.log("Message sent to Gun!");
                    // The addNewMessage will be triggered by the Gun.js listener
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
                // Send image data (Base64) to Gun.js
                currentChatroomRef.get('messages').set({
                    imageData: imageDataUrl,
                    sender: currentUserDisplayName,
                    timestamp: Date.now()
                }, (ack) => {
                    if (ack.err) {
                        console.error("Error sending image:", ack.err);
                    } else {
                        console.log("Image sent to Gun!");
                        // The addNewMessage will be triggered by the Gun.js listener
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
        if (!user.is) {
            alert("Please log in to create a chatroom.");
            return;
        }
        if (currentUserRole !== 'admin' && currentUserRole !== 'moderator' && currentUserRole !== 'user') { // Allow regular users to request creation
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
        // In a real app, you'd fetch pending rooms here from Gun.js
        const pendingList = document.getElementById('pending-list');
        pendingList.innerHTML = ''; // Clear existing dummy pending items
        
        gun.get('chatrooms').map().on((chatroomData, chatroomID) => {
            if (chatroomData && chatroomData.status === 'pending') {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>#${chatroomData.name} (by ${chatroomData.creator ? chatroomData.creator.slice(0, 5) + '...' : 'Unknown'})</span>
                    <button class="btn success-btn approve-btn" data-chatroom-id="${chatroomID}">Approve</button>
                    <button class="btn danger-btn reject-btn" data-chatroom-id="${chatroomID}">Reject</button>
                `;
                pendingList.appendChild(li);
                gsap.from(li, { duration: 0.4, y: 20, opacity: 0, ease: "power2.out" });
            }
        });

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
        gun.get('chatrooms').map().once((data, key) => {
            if (data && data.name === chatroomName) {
                alert(`Chatroom with name "${chatroomName}" already exists. Please choose a different name.`);
                return;
            }
        });

        gun.get('chatrooms').set({
            name: chatroomName,
            description: chatroomDesc,
            creator: currentUserDisplayName, // Use display name as creator
            status: 'pending', // Requires approval
            createdAt: Date.now() // Use simple timestamp for sorting/uniqueness for now
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
                            loadChatrooms(); // Reload chatrooms to show the new one
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
