document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.querySelector('.app-container');
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const messagesContainer = document.getElementById('messages-container');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const messageInput = document.getElementById('message-input');
    const attachBtn = document.getElementById('attach-btn'); // New
    const imageUploadInput = document.getElementById('image-upload'); // New
    const createChatroomBtn = document.getElementById('create-chatroom-btn');
    const viewPendingBtn = document.getElementById('view-pending-btn');
    const chatroomModal = document.getElementById('chatroom-modal');
    const pendingModal = document.getElementById('pending-modal');

    // --- GSAP Animations ---

    // 1. Initial Page Load Animation
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

    // 2. Sidebar Toggle Animation (for mobile)
    let isSidebarExpanded = false;
    menuToggle.addEventListener('click', () => {
        isSidebarExpanded = !isSidebarExpanded;
        if (isSidebarExpanded) {
            gsap.to(sidebarNav, {
                duration: 0.3,
                x: '0%',
                ease: "power2.out"
            });
            sidebar.classList.add('expanded');
        } else {
            gsap.to(sidebarNav, {
                duration: 0.3,
                x: '-100%',
                ease: "power2.in"
            });
            sidebar.classList.remove('expanded');
        }
    });

    // Close sidebar if expanded and clicking outside on mobile (simplified)
    document.body.addEventListener('click', (e) => {
        if (isSidebarExpanded && !sidebar.contains(e.target) && window.innerWidth <= 768) {
            gsap.to(sidebarNav, {
                duration: 0.3,
                x: '-100%',
                ease: "power2.in"
            });
            sidebar.classList.remove('expanded');
            isSidebarExpanded = false;
        }
    });

    // Helper function to convert URLs to clickable links
    function linkify(text) {
        // Regex to find URLs (http, https, ftp, www. and .com/.net etc.)
        const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+?\.[^\s]+)|([a-zA-Z0-9.\-]+?\.(com|org|net|gov|edu|io|co|uk|dev|app)[^\s]*)/g;
        return text.replace(urlRegex, (url) => {
            let fullUrl = url;
            if (!url.match(/^(https?:\/\/|ftp:\/\/)/)) {
                fullUrl = 'http://' + url; // Prepend http if missing
            }
            return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

    // 3. New Message Entry Animation
    // Now accepts imageData (Base64) or imageUrl (external URL)
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
            // Apply linkify only to text content, not image data
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

        // Append to container first (hidden for animation)
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom immediately

        // GSAP animation for the new message
        gsap.from(messageDiv, {
            duration: 0.5,
            y: 30,
            opacity: 0,
            scale: 0.9,
            ease: "back.out(1.7)",
            clearProps: "all" // Remove inline styles after animation
        });
    }

    // Example: Send message button click
    sendMessageBtn.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text) {
            addNewMessage(text, 'You', true); // Simulating an outgoing message
            // Here you would integrate with Gun.js to send the message
            // gun.get('chatrooms').get(currentChatroomId).get('messages').set({ text: text, sender: 'You', type: 'text' });
            messageInput.value = '';
            messageInput.style.height = '45px'; // Reset textarea height
        }
    });

    // Logic for Image Upload
    attachBtn.addEventListener('click', () => {
        imageUploadInput.click(); // Trigger the hidden file input click
    });

    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // Limit to 2MB for Base64 demo
                alert("File is too large. For production, images should be uploaded to a server and their URLs shared.");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const imageDataUrl = e.target.result; // This is the Base64 string
                addNewMessage('', 'You', true, imageDataUrl); // Send as an image message
                // Here you would integrate with Gun.js:
                // gun.get('chatrooms').get(currentChatroomId).get('messages').set({
                //     sender: 'You',
                //     type: 'image',
                //     imageData: imageDataUrl // Or imageUrl if uploaded to a service
                // });
            };
            reader.readAsDataURL(file); // Read file as Base64 Data URL
        }
        imageUploadInput.value = ''; // Clear the input so same file can be selected again
    });


    // Adjust textarea height dynamically
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    // 4. Modal Open/Close Animations
    function openModal(modalElement) {
        modalElement.style.display = 'flex'; // Make it display flex for centering
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
                modalElement.style.display = 'none'; // Hide after animation
            }
        });
    }

    // Event listeners for modals
    createChatroomBtn.addEventListener('click', () => openModal(chatroomModal));
    viewPendingBtn.addEventListener('click', () => {
        // In a real app, you'd fetch pending rooms here
        // For demonstration, let's add a dummy pending item if none exists
        const pendingList = document.getElementById('pending-list');
        if (pendingList.children.length === 0) {
             const dummyItem = document.createElement('li');
             dummyItem.innerHTML = `
                <span>#dummy-room (by UserX)</span>
                <button class="btn success-btn approve-btn">Approve</button>
                <button class="btn danger-btn reject-btn">Reject</button>
             `;
             pendingList.appendChild(dummyItem);
             // GSAP animation for newly added pending item
             gsap.from(dummyItem, { duration: 0.4, y: 20, opacity: 0, ease: "power2.out" });
        }
        openModal(pendingModal);
    });

    // Close buttons for modals
    document.querySelectorAll('.close-button').forEach(button => {
        button.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal'));
        });
    });

    // Close modal when clicking outside content
    [chatroomModal, pendingModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    // Form submission for chatroom creation (dummy)
    document.getElementById('create-chatroom-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const chatroomName = document.getElementById('chatroom-name').value;
        const chatroomDesc = document.getElementById('chatroom-description').value;
        console.log(`Requesting chatroom: ${chatroomName}, Description: ${chatroomDesc}`);
        alert(`Chatroom "${chatroomName}" submitted for approval!`);
        closeModal(chatroomModal);
        // Integrate with gun.js requestChatroomCreation(chatroomName, chatroomDesc);
    });

    // Dummy Approve/Reject logic for pending list
    document.getElementById('pending-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('approve-btn')) {
            alert('Chatroom Approved!');
            // Integrate with gun.js approveChatroom(id);
            gsap.to(e.target.closest('li'), {
                duration: 0.3, opacity: 0, x: 50, ease: "power2.in", onComplete: () => e.target.closest('li').remove()
            });
        } else if (e.target.classList.contains('reject-btn')) {
            alert('Chatroom Rejected!');
            // Integrate with gun.js rejectChatroom(id);
            gsap.to(e.target.closest('li'), {
                duration: 0.3, opacity: 0, x: -50, ease: "power2.in", onComplete: () => e.target.closest('li').remove()
            });
        }
    });

    // Initial messages (demonstrating link and image)
    // Remove existing dummy messages from HTML to let JS add them
    messagesContainer.innerHTML = '';
    addNewMessage('Hey everyone, welcome to the chat!', 'Alice', false);
    addNewMessage('Thanks, Alice! Looking forward to this. Check out this link: https://gsap.com', 'You', true);
    addNewMessage('Cool! I\'m sharing a pic from my trip:', 'Bob', false, null, 'https://via.placeholder.com/200x150?text=Sample+Image');
});
