document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. GLOBAL STATE VARIABLES
    // ==========================================
    let currentLanguage = "English";
    let chatImagesArray = []; 
    let healthImageBase64 = null; 
    let isLoggedIn = false;
    let currentUser = null;
    let sessionChatHistory = []; 
    let currentPostId = null; // Tracks the active community post

    // ==========================================
    // 2. NAVIGATION & SETTINGS LOGIC
    // ==========================================
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsPanel = document.getElementById("settingsPanel");
    const navButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    const goToTab = (tabId) => {
        navButtons.forEach(b => b.classList.remove("active"));
        tabContents.forEach(t => { t.classList.remove("active"); t.style.display = "none"; });
        
        const targetBtn = document.querySelector(`[data-target="${tabId}"]`);
        const targetTab = document.getElementById(tabId);
        
        if (targetBtn) targetBtn.classList.add("active");
        if (targetTab) { targetTab.classList.add("active"); targetTab.style.display = "block"; }
    };

    navButtons.forEach(btn => btn.addEventListener("click", () => goToTab(btn.getAttribute("data-target"))));

    settingsBtn.addEventListener("click", (e) => { 
        e.stopPropagation(); 
        settingsPanel.classList.toggle("active"); 
    });

    document.addEventListener("click", (e) => { 
        if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsPanel.classList.remove("active"); 
        }
    });

    document.getElementById("themeToggle").addEventListener("change", (e) => {
        document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
    });

    // ==========================================
    // 3. AUTHENTICATION & PROFILE (SQLite)
    // ==========================================
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const loggedInDashboard = document.getElementById("loggedInDashboard");
    const settingsAuthBtn = document.getElementById("settingsAuthBtn");

    document.getElementById("showSignup").addEventListener("click", (e) => { 
        e.preventDefault(); loginForm.classList.add("hidden"); signupForm.classList.remove("hidden"); 
    });
    document.getElementById("showLogin").addEventListener("click", (e) => { 
        e.preventDefault(); signupForm.classList.add("hidden"); loginForm.classList.remove("hidden"); 
    });

    const updateAuthUI = () => {
        if (isLoggedIn) {
            loginForm.classList.add("hidden"); 
            signupForm.classList.add("hidden"); 
            loggedInDashboard.classList.remove("hidden");
            document.getElementById("profileNameDisplay").innerText = `Welcome, ${currentUser}!`;
            settingsAuthBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Logout`;
        } else {
            loggedInDashboard.classList.add("hidden"); 
            loginForm.classList.remove("hidden");
            settingsAuthBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
        }
    };

    settingsAuthBtn.addEventListener("click", () => {
        settingsPanel.classList.remove("active");
        if (isLoggedIn) { 
            isLoggedIn = false; currentUser = null; updateAuthUI(); alert("Logged out successfully."); 
        } else { 
            goToTab("tab-profile"); 
        }
    });

    // Login API Call
    document.getElementById("doLoginBtn").addEventListener("click", async () => {
        const user = document.getElementById("loginUser").value.trim();
        const pass = document.getElementById("loginPass").value.trim();
        const err = document.getElementById("loginError");
        if (!user || !pass) return;

        try {
            const res = await fetch('/api/login', { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, password: pass }) 
            });
            const data = await res.json();
            if (data.success) {
                err.style.display = "none";
                isLoggedIn = true; currentUser = data.name;
                document.getElementById("loginUser").value = ""; document.getElementById("loginPass").value = "";
                updateAuthUI();
            } else {
                err.innerText = data.error; err.style.display = "block";
            }
        } catch (e) { console.error("Login failed"); }
    });

    // Signup API Call
    document.getElementById("doSignupBtn").addEventListener("click", async () => {
        const name = document.getElementById("regName").value.trim();
        const email = document.getElementById("regEmail").value.trim();
        const phone = document.getElementById("regPhone").value.trim();
        const pass = document.getElementById("regPass").value;
        const confirm = document.getElementById("regConfirm").value;
        const err = document.getElementById("regError");

        if (!name || !email || pass !== confirm) { 
            err.innerText = "Check required fields and passwords."; err.style.display = "block"; return; 
        }

        try {
            const res = await fetch('/api/signup', { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, phone, password: pass }) 
            });
            const data = await res.json();
            if (data.success) {
                err.style.display = "none";
                isLoggedIn = true; currentUser = data.name;
                updateAuthUI();
            } else {
                err.innerText = data.error; err.style.display = "block";
            }
        } catch (e) { console.error("Signup failed"); }
    });

    document.getElementById("doLogoutBtn").addEventListener("click", () => { 
        isLoggedIn = false; currentUser = null; updateAuthUI(); 
    });

    // Profile Editing (Frontend)
    const editProfileBtn = document.getElementById("editProfileBtn");
    const editProfileContainer = document.getElementById("editProfileContainer");
    const saveProfileBtn = document.getElementById("saveProfileBtn");
    const editNameInput = document.getElementById("editNameInput");

    editProfileBtn.addEventListener("click", () => { 
        editProfileContainer.classList.toggle("hidden"); 
        editNameInput.value = currentUser; 
    });
    
    saveProfileBtn.addEventListener("click", () => {
        if (editNameInput.value.trim()) {
            currentUser = editNameInput.value.trim();
            document.getElementById("profileNameDisplay").innerText = `Welcome, ${currentUser}!`;
            editProfileContainer.classList.add("hidden");
        }
    });

    // ==========================================
    // 4. COMMUNITY LOGIC (SQLite Powered)
    // ==========================================
    const communityMainView = document.getElementById("communityMainView");
    const communityDetailView = document.getElementById("communityDetailView");
    const feed = document.getElementById("communityFeed");
    const postCommentsContainer = document.getElementById("postCommentsContainer");

    const loadPosts = async () => {
        const res = await fetch('/api/posts');
        const posts = await res.json();
        feed.innerHTML = '';
        posts.forEach(post => {
            const postHTML = `
                <div class="community-post view-post-btn" data-id="${post.id}" style="cursor: pointer; border-left: 4px solid #ccc; transition: background 0.2s;">
                    <strong>${post.author}:</strong> ${post.content}
                    <p style="color: var(--text-light); font-size: 0.8rem; margin-top: 8px;"><i class="fa-regular fa-comment"></i> Click to view comments</p>
                </div>`;
            feed.insertAdjacentHTML('beforeend', postHTML);
        });
    };

    // Load posts initially
    loadPosts();

    // Create a new post
    document.getElementById("postCommBtn").addEventListener("click", async () => {
        if (!isLoggedIn) { alert("Please log in to post."); goToTab("tab-profile"); return; }
        const input = document.getElementById("communityInput");
        if(input.value.trim()) {
            await fetch('/api/posts', { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ author: currentUser, content: input.value.trim() }) 
            });
            input.value = ""; 
            loadPosts(); 
        }
    });

    // Open a post's detail view
    feed.addEventListener("click", async (e) => {
        const postDiv = e.target.closest('.view-post-btn');
        if (postDiv) {
            currentPostId = postDiv.getAttribute("data-id");
            document.getElementById("focusedPostContent").innerHTML = `<strong>${postDiv.querySelector('strong').innerText}</strong> ${postDiv.childNodes[2].nodeValue}`;
            communityMainView.classList.add("hidden");
            communityDetailView.classList.remove("hidden");
            loadComments(currentPostId);
        }
    });

    // Go back to main feed
    document.getElementById("backToFeedBtn").addEventListener("click", () => {
        communityDetailView.classList.add("hidden");
        communityMainView.classList.remove("hidden");
        currentPostId = null;
    });

    // Load comments for a specific post
    const loadComments = async (postId) => {
        const res = await fetch(`/api/comments/${postId}`);
        const comments = await res.json();
        postCommentsContainer.innerHTML = '';
        if (comments.length === 0) {
            postCommentsContainer.innerHTML = '<p style="color: var(--text-light); font-style: italic;">No comments yet. Be the first to reply!</p>';
        } else {
            comments.forEach(c => {
                postCommentsContainer.insertAdjacentHTML('beforeend', `<div class="comment"><strong>${c.author}:</strong> ${c.content}</div>`);
            });
        }
    };

    // Submit a comment on a post
    document.getElementById("submitReplyBtn").addEventListener("click", async () => {
        if (!isLoggedIn) { alert("Please log in to reply."); goToTab("tab-profile"); return; }
        const input = document.getElementById("replyInput");
        if (input.value.trim() && currentPostId) {
            await fetch(`/api/comments/${currentPostId}`, { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ author: currentUser, content: input.value.trim() }) 
            });
            input.value = "";
            loadComments(currentPostId); 
        }
    });

    // ==========================================
    // 5. LANGUAGE TRANSLATION LOGIC
    // ==========================================
    const translations = {
        "English": { 
            navChat: "AI Assistant", navHealth: "Crop Health", navComm: "Community", navProf: "Profile",
            title: "AgriSmart AI", 
            welcome: "Hello! Ask me about farming practices, or upload images of your crops! I will remember our conversation.", 
            chatPlaceholder: "Type or upload images...",
            healthTitle: "Deep Crop Analysis",
            healthDesc: "Upload a clear image of a leaf or soil to get NPK levels, health ratings, and expert suggestions.",
            commTitle: "Community Support"
        },
        "Telugu": { 
            navChat: "AI అసిస్టెంట్", navHealth: "పంట ఆరోగ్యం", navComm: "సంఘం", navProf: "ప్రొఫైల్",
            title: "అగ్రిస్మార్ట్ AI", 
            welcome: "నమస్కారం! వ్యవసాయ పద్ధతులు గురించి అడగండి లేదా పంట చిత్రాలను అప్‌లోడ్ చేయండి! నేను మన సంభాషణను గుర్తుంచుకుంటాను.", 
            chatPlaceholder: "టైప్ చేయండి లేదా చిత్రం అప్‌లోడ్ చేయండి...",
            healthTitle: "లోతైన పంట విశ్లేషణ",
            healthDesc: "NPK స్థాయిలు, ఆరోగ్య రేటింగ్‌లు మరియు నిపుణుల సలహాలను పొందడానికి ఆకు లేదా నేల యొక్క స్పష్టమైన చిత్రాన్ని అప్‌లోడ్ చేయండి.",
            commTitle: "సంఘం మద్దతు"
        },
        "Hindi": { 
            navChat: "AI सहायक", navHealth: "फसल स्वास्थ्य", navComm: "समुदाय", navProf: "प्रोफ़ाइल",
            title: "एग्रीस्मार्ट AI", 
            welcome: "नमस्ते! खेती के तरीकों के बारे में पूछें, या अपनी फसलों की तस्वीरें अपलोड करें! मुझे हमारी बातचीत याद रहेगी।", 
            chatPlaceholder: "टाइप करें या चित्र अपलोड करें...",
            healthTitle: "गहन फसल विश्लेषण",
            healthDesc: "NPK स्तर, स्वास्थ्य रेटिंग और विशेषज्ञ सुझाव प्राप्त करने के लिए पत्ती या मिट्टी की एक स्पष्ट तस्वीर अपलोड करें।",
            commTitle: "समुदाय समर्थन"
        }
    };

    document.getElementById("langSelect").addEventListener("change", (e) => { 
        currentLanguage = e.target.value; 
        const t = translations[currentLanguage];
        
        document.getElementById("nav-chat").innerHTML = `<i class='fa-solid fa-robot'></i> ${t.navChat}`;
        document.getElementById("nav-health").innerHTML = `<i class='fa-solid fa-microscope'></i> ${t.navHealth}`;
        document.getElementById("nav-comm").innerHTML = `<i class='fa-solid fa-users'></i> ${t.navComm}`;
        document.getElementById("nav-prof").innerHTML = `<i class='fa-solid fa-user'></i> ${t.navProf}`;
        
        document.getElementById("ui-title").innerHTML = `<i class='fa-solid fa-leaf'></i> ${t.title}`;
        document.getElementById("ui-welcome").innerText = t.welcome;
        document.getElementById("chatInput").placeholder = t.chatPlaceholder;
        
        document.getElementById("ui-health-title").innerHTML = `<i class='fa-solid fa-seedling'></i> ${t.healthTitle}`;
        document.getElementById("ui-health-desc").innerText = t.healthDesc;
        document.getElementById("ui-comm-title").innerHTML = `<i class='fa-solid fa-users'></i> ${t.commTitle}`;
    });

    // ==========================================
    // 6. AI ASSISTANT CHAT LOGIC
    // ==========================================
    const chatInput = document.getElementById("chatInput");
    const chatWindow = document.getElementById("chatWindow");
    const chatImageInput = document.getElementById("chatImageInput");
    const imagePreviewContainer = document.getElementById("imagePreviewContainer");
    
    document.getElementById("attachBtn").addEventListener("click", () => chatImageInput.click());

    const renderPreviews = () => {
        imagePreviewContainer.innerHTML = '';
        if(chatImagesArray.length === 0) { imagePreviewContainer.classList.add("hidden"); return; }
        imagePreviewContainer.classList.remove("hidden");
        chatImagesArray.forEach((imgBase64, index) => {
            imagePreviewContainer.insertAdjacentHTML('beforeend', `<div class="preview-wrapper"><img src="${imgBase64}"><button class="remove-img-btn" data-index="${index}"><i class="fa-solid fa-times"></i></button></div>`);
        });
        document.querySelectorAll(".remove-img-btn").forEach(btn => btn.addEventListener("click", (e) => { 
            chatImagesArray.splice(e.currentTarget.getAttribute("data-index"), 1); renderPreviews(); 
        }));
    };

    chatImageInput.addEventListener("change", (e) => {
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => { chatImagesArray.push(event.target.result); renderPreviews(); };
            reader.readAsDataURL(file);
        });
        chatImageInput.value = ""; 
    });

    const handleChat = async () => {
        const message = chatInput.value.trim();
        if (!message && chatImagesArray.length === 0) return;

        // Display User Message
        const msgDiv = document.createElement("div"); 
        msgDiv.classList.add("message", "user-message");
        let htmlContent = `<span class="msg-text">`;
        chatImagesArray.forEach(img => { htmlContent += `<img src="${img}" style="height: 80px; border-radius: 8px; margin: 2px;"><br>`; });
        htmlContent += `${message}</span>
            <div class="message-actions">
                <i class="fa-regular fa-copy action-icon copy-btn" title="Copy Text"></i>
            </div>`;
        msgDiv.innerHTML = htmlContent; 
        chatWindow.appendChild(msgDiv); 
        chatWindow.scrollTop = chatWindow.scrollHeight;

        if (message) sessionChatHistory.push({ role: "user", text: message });
        
        const dataToSend = { message: message, images: [...chatImagesArray], language: currentLanguage, history: sessionChatHistory };
        chatInput.value = ""; chatImagesArray = []; renderPreviews();

        const typingId = "typing-" + Date.now();
        chatWindow.insertAdjacentHTML('beforeend', `<div id="${typingId}" class="message bot-message"><i class="fa-solid fa-ellipsis fa-fade"></i></div>`);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        try {
            const response = await fetch("/api/chat", { 
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dataToSend) 
            });
            const data = await response.json();
            
            document.getElementById(typingId).remove();
            
            // Display AI Message
            const botDiv = document.createElement("div"); 
            botDiv.classList.add("message", "bot-message", "markdown-body");
            
            const textSpan = document.createElement("span");
            textSpan.className = "msg-text";
            textSpan.innerHTML = marked.parse(data.reply);
            botDiv.appendChild(textSpan);

            const actionsDiv = document.createElement("div");
            actionsDiv.className = "message-actions";
            actionsDiv.innerHTML = `
                <i class="fa-solid fa-volume-high action-icon speak-btn" title="Read Aloud"></i>
                <i class="fa-regular fa-copy action-icon copy-btn" title="Copy Text"></i>
            `;
            botDiv.appendChild(actionsDiv);
            
            chatWindow.appendChild(botDiv); 
            chatWindow.scrollTop = chatWindow.scrollHeight;
            sessionChatHistory.push({ role: "model", text: data.reply });
        } catch (error) {
            document.getElementById(typingId).remove();
            chatWindow.insertAdjacentHTML('beforeend', `<div class="message bot-message">Connection error. Please try again.</div>`);
        }
    };

    document.getElementById("sendBtn").addEventListener("click", handleChat);
    chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") handleChat(); });

    // ==========================================
    // 7. MESSAGE ACTIONS (COPY & SPEAK)
    // ==========================================
    chatWindow.addEventListener("click", (e) => {
        // Copy functionality
        if (e.target.classList.contains("copy-btn")) {
            const textToCopy = e.target.closest('.message').querySelector('.msg-text').innerText;
            navigator.clipboard.writeText(textToCopy);
            e.target.classList.remove("fa-copy", "fa-regular");
            e.target.classList.add("fa-check", "fa-solid");
            setTimeout(() => {
                e.target.classList.remove("fa-check", "fa-solid");
                e.target.classList.add("fa-copy", "fa-regular");
            }, 2000);
        }
        
        // Speak functionality
        if (e.target.classList.contains("speak-btn")) {
            const textToSpeak = e.target.closest('.message').querySelector('.msg-text').innerText;
            window.speechSynthesis.cancel(); 
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            if (currentLanguage === "Telugu") utterance.lang = "te-IN";
            else if (currentLanguage === "Hindi") utterance.lang = "hi-IN";
            else utterance.lang = "en-IN";
            window.speechSynthesis.speak(utterance);
        }
    });

    // ==========================================
    // 8. VOICE INPUT
    // ==========================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const voiceBtn = document.getElementById("voiceBtn");
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN'; 
        voiceBtn.addEventListener("click", () => { 
            recognition.start(); chatInput.placeholder = "Listening..."; voiceBtn.style.color = "#e74c3c"; 
        });
        recognition.onresult = (e) => { 
            chatInput.value = e.results[0][0].transcript; handleChat(); 
        };
        recognition.onend = () => { 
            chatInput.placeholder = translations[currentLanguage].chatPlaceholder; voiceBtn.style.color = ""; 
        };
    }

    // ==========================================
    // 9. CROP HEALTH ANALYSIS
    // ==========================================
    const healthImageInput = document.getElementById("healthImageInput");
    const healthImagePreview = document.getElementById("healthImagePreview");
    const healthResult = document.getElementById("healthResult");

    healthImageInput.addEventListener("change", (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => { 
                healthImageBase64 = event.target.result; 
                healthImagePreview.src = healthImageBase64; 
                healthImagePreview.classList.remove("hidden"); 
                healthResult.classList.add("hidden"); 
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    document.getElementById("analyzeHealthBtn").addEventListener("click", async () => {
        if (!healthImageBase64) {
            alert("Please select a crop image first!");
            return;
        }
        
        healthResult.classList.remove("hidden"); 
        healthResult.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...`; 
        healthResult.style.display = "block";
        
        try {
            const response = await fetch("/api/crop_health", { 
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: healthImageBase64, language: currentLanguage }) 
            });
            const data = await response.json();
            
            healthResult.innerHTML = marked.parse(data.reply);
            healthResult.style.backgroundColor = "var(--chat-bot-bg)"; 
            healthResult.style.padding = "15px"; 
            healthResult.style.borderRadius = "8px"; 
            healthResult.style.borderLeft = "4px solid var(--primary-green)";
        } catch (error) {
            healthResult.innerHTML = `<span style="color: #e74c3c;">Error analyzing health metrics.</span>`;
        }
    });
});
