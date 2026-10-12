"use strict";

// =====================================================
// CONFIGURATION SUPABASE
// =====================================================

const SUPABASE_URL = "https://xlfacwapkeyjojabouvf.supabase.co";
const SUPABASE_KEY = "sb_publishable_40AfhYyblXZGRaz6qIHq8w_CirbqK66";

const POLL_MS = 5000;

document.addEventListener("DOMContentLoaded", () => {

    const $ = id => document.getElementById(id);

    // =====================================================
    // ÉLÉMENTS
    // =====================================================

    const authScreen = $("auth-screen");
    const mainApp = $("main-app");
    const welcomeForm = $("welcome-form");
    const loginForm = $("login-form");
    const registerForm = $("register-form");
    const loginButton = $("login-button");
    const registerButton = $("register-button");
    const authMessage = $("auth-message");
    const welcomeTitle = $("welcome-title");

    const postsContainer = $("posts-container");
    const emptyFeed = $("empty-feed");
    const postModal = $("post-modal");
    const postText = $("post-text");
    const postCounter = $("post-counter");
    const publishButton = $("publish-button");

    const homePage = $("home-page");
    const searchPage = $("search-page");
    const profilePage = $("profile-page");
    const friendsPage = $("friends-page");
    const messagesPage = $("messages-page");
    const storiesPage = $("stories-page");
    const chatPage = $("chat-page");
    const notebookPage = $("notebook-page");
    const roomPage = $("room-page");
    const groupsPage = $("groups-page");
    const groupChatPage = $("group-chat-page");

    const searchInput = $("user-search-input");
    const searchResults = $("search-results");

    const editProfileButton = $("edit-profile-button");
    const settingsButton = $("profile-settings-button");
    const settingsModal = $("settings-modal");
    const friendToggleButton = $("friend-toggle-button");
    const messageButton = $("message-button");
    const notebookButton = $("notebook-button");
    const customizeButton = $("customize-button");
    const logoutButton = $("logout-button");
    const editProfileModal = $("edit-profile-modal");
    const editName = $("edit-name");
    const editBio = $("edit-bio");
    const editBioCounter = $("edit-bio-counter");

    const conversationsContainer = $("conversations-container");
    const chatMessages = $("chat-messages");
    const chatInput = $("chat-input");
    const messagesBadge = $("messages-badge");
    const newMessageModal = $("new-message-modal");
    const newMessageSearch = $("new-message-search");
    const newMessageResults = $("new-message-results");

    // =====================================================
    // ÉTAT DE L'APPLICATION
    // =====================================================

    const state = {
        me: null,
        profiles: new Map(),
        friendIds: new Set(),
        posts: new Map(),
        messages: [],
        messagesSig: "",
        currentPage: homePage,
        viewedId: null,
        profileReturnPage: homePage,
        chatUserId: null,
        profileShownId: null,
        notebookFriendId: null,
        inRoom: false,
        openComments: new Set(),
        pendingMediaUrl: null,
        pendingLocation: null,
        stories: [],
        storyIndex: 0,
        storyTimer: null
    };

    let feedToken = 0;
    let profileToken = 0;
    let searchToken = 0;
    let newMessageToken = 0;
    let searchTimer = null;
    let newMessageTimer = null;
    let pollTimer = null;
    let pollBusy = false;
    let toastTimer = null;

    // =====================================================
    // OUTILS
    // =====================================================

    function escapeHTML(text) {
        const div = document.createElement("div");
        div.textContent = String(text ?? "");
        return div.innerHTML;
    }

    const initial = name =>
        String(name || "?").charAt(0).toUpperCase();

    const PERSON_COLORS = [
        "#FF7A6B", "#FFA53D", "#FFD23F", "#8FD14F",
        "#2EC4B6", "#4DA8FF", "#A78BFA", "#FF7DB1"
    ];

    function personColor(profile) {

        if (profile && profile.mood_color) {
            return profile.mood_color;
        }

        const seed = String(
            (profile && (profile.username || profile.id)) || ""
        );

        let hash = 0x811c9dc5;

        for (let i = 0; i < seed.length; i++) {
            hash ^= seed.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }

        hash ^= hash >>> 15;
        hash = Math.imul(hash, 0x2c1b3c6d) >>> 0;
        hash ^= hash >>> 12;
        hash = Math.imul(hash, 0x297a2d39) >>> 0;
        hash ^= hash >>> 15;

        return PERSON_COLORS[(hash >>> 0) % PERSON_COLORS.length];
    }

    function applyColor(element, profile) {
        element.style.setProperty("--c", personColor(profile));
        element.style.setProperty("--c-ink", "#171526");
    }

    function avatarInnerHTML(profile) {
        if (profile && profile.avatar_url) {
            return `<img src="${escapeHTML(profile.avatar_url)}" alt="">`;
        }
        return escapeHTML(initial(profile.name));
    }

    function avatarHTML(profile, className) {
        return `
            <div
                class="${className}"
                style="--c: ${personColor(profile)}; --c-ink: #171526;"
            >
                ${avatarInnerHTML(profile)}
            </div>
        `;
    }

    const ICONS = {
        heart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>`,
        comment: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H7l-4 3 1.5-4A8 8 0 1 1 20 11.5Z"></path></svg>`,
        trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`
    };

    async function q(request) {
        const { data, error } = await request;
        if (error) throw error;
        return data;
    }

    // =====================================================
    // UPLOAD VERS SUPABASE STORAGE
    // =====================================================

    async function uploadFile(file, folder = "posts") {

        if (!file) return null;

        if (!file.type.startsWith("image/")) {
            throw new Error("Seules les images sont acceptées.");
        }

        if (file.size > 5 * 1024 * 1024) {
            throw new Error("Image trop lourde (5 Mo maximum).");
        }

        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${state.me.id}/${folder}/${Date.now()}.${ext}`;

        const { error } = await sb.storage
            .from("chatly-media")
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            });

        if (error) throw error;

        const { data } = sb.storage
            .from("chatly-media")
            .getPublicUrl(path);

        return data.publicUrl;
    }

    function showToast(message) {
        $("toast").textContent = message;
        $("toast").classList.remove("hidden");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(
            () => $("toast").classList.add("hidden"),
            2800
        );
    }

    function reportError(error) {
        console.error(error);
        showToast(
            "Erreur : " +
            (error && error.message ? error.message : error)
        );
    }

    function safe(handler) {
        return async (...args) => {
            try {
                await handler(...args);
            } catch (error) {
                reportError(error);
            }
        };
    }

    function showAuthMessage(message, success = false) {
        authMessage.textContent = message;
        authMessage.style.color = success ? "#16a34a" : "#dc2626";
    }

    function timeAgo(iso) {

        const seconds = Math.max(
            0,
            (Date.now() - new Date(iso).getTime()) / 1000
        );

        if (seconds < 60) return "à l'instant";

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return "il y a " + minutes + " min";

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return "il y a " + hours + " h";

        const days = Math.floor(hours / 24);
        if (days < 7) return "il y a " + days + " j";

        return new Date(iso).toLocaleDateString(
            "fr-FR",
            { day: "numeric", month: "short" }
        );
    }

    function formatMessageTime(iso) {
        const date = new Date(iso);
        const isToday =
            date.toDateString() === new Date().toDateString();

        return date.toLocaleString(
            "fr-FR",
            isToday
                ? { hour: "2-digit", minute: "2-digit" }
                : { day: "2-digit", month: "2-digit" }
        );
    }

    function cacheProfiles(rows) {
        rows.forEach(profile => state.profiles.set(profile.id, profile));
    }

    async function refreshProfiles(ids) {
        const unique = [...new Set(ids)].filter(Boolean);

        if (unique.length === 0) return;

        cacheProfiles(
            await q(sb.from("profiles").select("*").in("id", unique))
        );
    }

    async function ensureProfiles(ids) {
        await refreshProfiles(
            [...new Set(ids)].filter(
                id => id && !state.profiles.has(id)
            )
        );
    }

    const profileOf = id =>
        state.profiles.get(id) ||
        { id, name: "Utilisateur", username: "inconnu" };

    // =====================================================
    // SUPABASE
    // =====================================================

    if (!window.supabase) {
        authScreen.classList.remove("hidden");
        showAuthMessage(
            "Impossible de charger Supabase. Vérifie ta connexion internet."
        );
        return;
    }

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // =====================================================
    // PAGES
    // =====================================================

    function showPage(page) {

        [
            homePage, searchPage, profilePage, friendsPage,
            messagesPage, storiesPage, chatPage,
            notebookPage, roomPage, groupsPage, groupChatPage
        ].forEach(item => item.classList.add("hidden"));

        page.classList.remove("hidden");

        state.currentPage = page;

        if (page !== profilePage) state.viewedId = null;
        if (page !== chatPage) state.chatUserId = null;
        if (page !== notebookPage) state.notebookFriendId = null;
        if (page !== roomPage && state.inRoom) leaveRoom();

        updateNavActive();

        window.scrollTo(0, 0);
    }

    function updateNavActive() {

        const page = state.currentPage;
        let activeId = null;

        if (page === homePage) activeId = "nav-home";
        else if (page === searchPage) activeId = "nav-search";
        else if (page === messagesPage || page === chatPage) activeId = "nav-messages";
        else if (page === profilePage && !state.viewedId) activeId = "nav-profile";

        document
            .querySelectorAll(".bottom-nav button")
            .forEach(button =>
                button.classList.toggle("active", button.id === activeId)
            );
    }

    // =====================================================
    // CONNEXION / INSCRIPTION
    // =====================================================

    function authErrorMessage(error) {

        const text = String(error && error.message || error);

        if (/invalid login credentials/i.test(text))
            return "E-mail ou mot de passe incorrect.";
        if (/already registered|already exists/i.test(text))
            return "Cet e-mail est déjà utilisé.";
        if (/not confirmed/i.test(text))
            return "Confirme d'abord ton e-mail (regarde ta boîte de réception).";
        if (/rate limit|too many/i.test(text))
            return "Trop de tentatives. Réessaie dans quelques minutes.";
        if (/password/i.test(text))
            return "Mot de passe refusé : " + text;
        if (/email/i.test(text) && /invalid/i.test(text))
            return "Adresse e-mail invalide.";

        return "Erreur : " + text;
    }

    function clearAuthForms() {
        document
            .querySelectorAll("#auth-screen input")
            .forEach(input => { input.value = ""; });
        authMessage.textContent = "";
    }

    function showWelcome() {
        welcomeForm.classList.remove("hidden");
        loginForm.classList.add("hidden");
        registerForm.classList.add("hidden");
        authMessage.textContent = "";
    }

    function showLogin() {
        welcomeForm.classList.add("hidden");
        registerForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
        authMessage.textContent = "";
    }

    function showRegister() {
        welcomeForm.classList.add("hidden");
        loginForm.classList.add("hidden");
        registerForm.classList.remove("hidden");
        authMessage.textContent = "";
    }

    $("welcome-login-button").addEventListener("click", showLogin);
    $("welcome-register-button").addEventListener("click", showRegister);

    $("show-register").addEventListener("click", showRegister);
    $("show-login").addEventListener("click", showLogin);

    document
        .querySelectorAll("#auth-screen [data-back]")
        .forEach(button =>
            button.addEventListener("click", showWelcome)
        );

    registerButton.addEventListener("click", async () => {

        const name = $("register-name").value.trim();
        const username = $("register-username").value
            .trim()
            .replace(/^@/, "")
            .toLowerCase();
        const email = $("register-email").value.trim();
        const password = $("register-password").value;
        const confirm = $("register-password-confirm").value;

        if (!name || !username || !email || !password || !confirm) {
            showAuthMessage("Remplis tous les champs.");
            return;
        }

        if (username.length < 3) {
            showAuthMessage("Le @username doit contenir au moins 3 caractères.");
            return;
        }

        if (!/^[a-z0-9_.]+$/.test(username) || username.length > 30) {
            showAuthMessage(
                "Le @username peut contenir lettres, chiffres, _ et . (30 max)."
            );
            return;
        }

        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            showAuthMessage("Adresse e-mail invalide.");
            return;
        }

        if (password !== confirm) {
            showAuthMessage("Les deux mots de passe ne correspondent pas.");
            return;
        }

        if (password.length < 6) {
            showAuthMessage("Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }

        registerButton.disabled = true;

        try {

            const available = await q(
                sb.rpc("username_available", { p_username: username })
            );

            if (!available) {
                showAuthMessage("Ce @username est déjà utilisé.");
                return;
            }

            const { data, error } = await sb.auth.signUp({
                email,
                password,
                options: { data: { name, username } }
            });

            if (error) {
                showAuthMessage(authErrorMessage(error));
                return;
            }

            if (data.session) {
                await startApp(data.user.id);
                clearAuthForms();
            } else {
                registerForm.classList.add("hidden");
                loginForm.classList.remove("hidden");
                $("login-email").value = email;
                showAuthMessage(
                    "Compte créé ! Confirme ton e-mail, puis connecte-toi.",
                    true
                );
            }

        } catch (error) {
            console.error(error);
            showAuthMessage(authErrorMessage(error));
        } finally {
            registerButton.disabled = false;
        }
    });

    loginButton.addEventListener("click", async () => {

        const email = $("login-email").value.trim();
        const password = $("login-password").value;

        if (!email || !password) {
            showAuthMessage("Entre ton e-mail et ton mot de passe.");
            return;
        }

        loginButton.disabled = true;

        try {

            const { data, error } = await sb.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                showAuthMessage(authErrorMessage(error));
                return;
            }

            await startApp(data.user.id);
            clearAuthForms();

        } catch (error) {
            console.error(error);
            showAuthMessage(authErrorMessage(error));
        } finally {
            loginButton.disabled = false;
        }
    });

    async function startApp(userId) {

        const profile = await q(
            sb.from("profiles").select("*").eq("id", userId).maybeSingle()
        );

        if (!profile) {
            await sb.auth.signOut();
            throw new Error(
                "Profil introuvable. Le script SQL a-t-il été exécuté dans Supabase ?"
            );
        }

        state.me = profile;
        cacheProfiles([profile]);

        await Promise.all([
            loadFriendIds(),
            refreshMessages()
        ]);

        enterApp();
    }

    function updateGreeting() {

        welcomeTitle.textContent = "Salut, " + state.me.name;

        const avatar = $("composer-avatar");
        avatar.textContent = initial(state.me.name);
        applyColor(avatar, state.me);
    }

    function enterApp() {

        authScreen.classList.add("hidden");
        mainApp.classList.remove("hidden");

        updateGreeting();

        showPage(homePage);

        loadPosts().catch(reportError);
        renderStoriesRow().catch(reportError);

        updateMessagesBadge();
        updateQuietButton();
        startPolling();
    }

    function showAuthScreen() {

        stopPolling();

        if (state.inRoom) leaveRoom();

        state.me = null;
        state.friendIds = new Set();
        state.messages = [];
        state.messagesSig = "";
        state.profileShownId = null;
        state.posts.clear();
        state.openComments.clear();
        state.pendingMediaUrl = null;
        state.pendingLocation = null;

        postsContainer
            .querySelectorAll(".post-card")
            .forEach(element => element.remove());

        [
            "profile-posts-container", "friends-container",
            "search-results", "conversations-container",
            "chat-messages", "new-message-results"
        ].forEach(id => { $(id).innerHTML = ""; });

        searchInput.value = "";

        postModal.classList.add("hidden");
        editProfileModal.classList.add("hidden");
        newMessageModal.classList.add("hidden");
        settingsModal.classList.add("hidden");
        mainApp.classList.add("hidden");

        showPage(homePage);

        welcomeForm.classList.remove("hidden");
        loginForm.classList.add("hidden");
        registerForm.classList.add("hidden");

        clearAuthForms();

        authScreen.classList.remove("hidden");
    }

    logoutButton.addEventListener("click", safe(async () => {
        await sb.auth.signOut();
        showAuthScreen();
    }));

    sb.auth.onAuthStateChange(event => {
        if (event === "SIGNED_OUT" && state.me) showAuthScreen();
    });

    // =====================================================
    // PERSONNALISATION DU FOND
    // =====================================================

    const BACKGROUNDS = ["default", "dusk", "mist", "sand", "night", "aurora"];

    let selectedBg = "default";

    try {
        const saved = localStorage.getItem("chatly_bg");
        if (saved && BACKGROUNDS.includes(saved)) selectedBg = saved;
    } catch (error) { /* stockage indisponible */ }

    function applyBackground(bg) {

        if (bg === "default") {
            document.body.removeAttribute("data-bg");
        } else {
            document.body.setAttribute("data-bg", bg);
        }

        try {
            localStorage.setItem("chatly_bg", bg);
        } catch (error) { /* stockage indisponible */ }
    }

    applyBackground(selectedBg);

    customizeButton.addEventListener("click", () => {

        settingsModal.classList.add("hidden");

        $("bg-picker").querySelectorAll(".bg-option").forEach(button =>
            button.classList.toggle("selected", button.dataset.bg === selectedBg)
        );

        $("customize-modal").classList.remove("hidden");
    });

    $("close-customize").addEventListener(
        "click",
        () => $("customize-modal").classList.add("hidden")
    );

    $("customize-modal").addEventListener("click", event => {
        if (event.target === $("customize-modal")) {
            $("customize-modal").classList.add("hidden");
        }
    });

    $("bg-picker").addEventListener("click", event => {

        const button = event.target.closest(".bg-option");
        if (!button) return;

        $("bg-picker").querySelectorAll(".bg-option").forEach(item =>
            item.classList.remove("selected")
        );

        button.classList.add("selected");
        selectedBg = button.dataset.bg;
    });

    $("save-customize").addEventListener("click", () => {
        applyBackground(selectedBg);
        $("customize-modal").classList.add("hidden");
        showToast("Apparence mise à jour.");
    });

    $("theme-button").addEventListener("click", () => {

        const next =
            document.documentElement.dataset.theme === "dark"
                ? "light"
                : "dark";

        document.documentElement.dataset.theme = next;

        try {
            localStorage.setItem("chatly_theme", next);
        } catch (error) { /* stockage indisponible */ }
    });

    $("nav-home").addEventListener("click", () => {
        showPage(homePage);
        loadPosts().catch(reportError);
        renderStoriesRow().catch(reportError);
    });

    // =====================================================
    // PUBLICATIONS
    // =====================================================

    async function hydratePosts(rows) {

        if (rows.length === 0) return [];

        const ids = rows.map(row => row.id);

        const [likes, comments] = await Promise.all([
            q(sb.from("post_likes").select("post_id, user_id").in("post_id", ids)),
            q(sb.from("comments").select("*").in("post_id", ids).order("created_at", { ascending: true }))
        ]);

        await refreshProfiles([
            ...rows.map(row => row.author_id),
            ...comments.map(comment => comment.author_id)
        ]);

        return rows.map(row => {

            const post = {
                ...row,
                likes: likes
                    .filter(like => like.post_id === row.id)
                    .map(like => like.user_id),
                comments: comments
                    .filter(comment => comment.post_id === row.id)
            };

            state.posts.set(post.id, post);
            return post;
        });
    }

    async function loadPosts() {

        const token = ++feedToken;

        const rows = await q(
            sb.from("posts")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50)
        );

        const posts = await hydratePosts(rows);

        if (token !== feedToken) return;

        postsContainer
            .querySelectorAll(".post-card, .post-echo")
            .forEach(element => element.remove());

        emptyFeed.classList.toggle("hidden", posts.length > 0);

        const echoes = findEchoes(posts);

        posts.forEach(post => {

            const echoWith = echoes.get(post.id);

            if (echoWith) {
                postsContainer.appendChild(
                    createEchoBadge(profileOf(echoWith.author_id))
                );
            }

            postsContainer.appendChild(createPostCard(post));
        });

        renderStoriesRow().catch(reportError);
    }

    const ECHO_STOPWORDS = new Set([
        "dans", "avec", "pour", "sans", "cette", "vous", "nous",
        "leur", "elle", "mais", "donc", "quoi", "plus", "moins",
        "très", "trop", "être", "avoir", "fait", "faire", "tout",
        "toute", "aussi", "alors", "comme", "quelque", "chose"
    ]);

    function findEchoes(posts) {

        const links = new Map();

        const words = post =>
            ((post.text || "").toLowerCase().match(/[a-zàâäéèêëïîôöùûüç]{5,}/g) || [])
                .filter(word => !ECHO_STOPWORDS.has(word));

        for (let i = 0; i < posts.length; i++) {

            const a = posts[i];
            if (links.has(a.id)) continue;

            for (let j = i + 1; j < posts.length; j++) {

                const b = posts[j];

                const eligible = id =>
                    id === state.me.id || state.friendIds.has(id);

                if (
                    a.author_id === b.author_id ||
                    links.has(b.id) ||
                    !eligible(a.author_id) ||
                    !eligible(b.author_id)
                ) continue;

                const hours = Math.abs(
                    new Date(a.created_at) - new Date(b.created_at)
                ) / 3600000;

                if (hours > 6) continue;

                const shared = words(a).find(word => words(b).includes(word));

                if (shared) {
                    links.set(b.id, a);
                    break;
                }
            }
        }

        return links;
    }

    function createEchoBadge(author) {

        const badge = document.createElement("div");
        badge.className = "post-echo";

        badge.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 17V7a4 4 0 0 1 4-4h2"></path>
                <path d="m9 5-2-2-2 2"></path>
                <path d="M17 7v10a4 4 0 0 1-4 4h-2"></path>
                <path d="m15 19 2 2 2-2"></path>
            </svg>
            Écho avec une publication de ${escapeHTML(author.name)}
        `;

        return badge;
    }

    function createPostCard(post) {

        const article = document.createElement("article");

        article.className = "post-card";
        article.dataset.postId = post.id;

        const author = profileOf(post.author_id);
        const liked = post.likes.includes(state.me.id);
        const isMine = post.author_id === state.me.id;

        const pop = post.justLiked === true;
        post.justLiked = false;

        applyColor(article, author);
        article.style.opacity = fadeOpacity(post);
        article.classList.toggle("post-revive", pop);

        article.innerHTML = `

            <div class="post-avatar">
                ${avatarInnerHTML(author)}
            </div>

            <div class="post-bubble">

                <div class="post-header">
                    <div class="post-author">
                        <strong>${escapeHTML(author.name)}</strong>
                        <span>@${escapeHTML(author.username)}</span>
                        <span>${timeAgo(post.created_at)}</span>
                    </div>
                </div>

                ${post.text ? `<div class="post-content">${escapeHTML(post.text)}</div>` : ""}

                ${post.location_name
                    ? `<div class="post-location">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${escapeHTML(post.location_name)}
                       </div>`
                    : ""}

                ${post.image_url
                    ? `<div class="post-image">
                        <img src="${escapeHTML(post.image_url)}"
                             alt=""
                             loading="lazy"
                             onerror="this.parentElement.style.display='none'">
                       </div>`
                    : ""}

                <div class="post-actions">

                    <button
                        class="post-like-button ${liked ? "liked" : ""} ${pop ? "pop" : ""}"
                        aria-label="J'aime"
                    >
                        ${ICONS.heart}
                        <span>${post.likes.length}</span>
                    </button>

                    <button
                        class="post-comment-button ${state.openComments.has(post.id) ? "is-open" : ""}"
                        aria-label="Commenter"
                    >
                        ${ICONS.comment}
                        <span>${post.comments.length}</span>
                    </button>

                    ${isMine
                        ? `<button class="post-delete-button" aria-label="Supprimer la publication">
                            ${ICONS.trash}
                           </button>`
                        : ""}

                </div>

                <div class="comments-section ${state.openComments.has(post.id) ? "" : "hidden"}">
                    <div class="comment-box">
                        <input
                            type="text"
                            class="comment-input"
                            placeholder="Écrire un commentaire..."
                            maxlength="500"
                        >
                        <button class="comment-submit">Publier</button>
                    </div>
                </div>

            </div>

        `;

        article
            .querySelector(".post-like-button")
            .addEventListener("click", safe(() => toggleLike(post.id)));

        article
            .querySelector(".post-comment-button")
            .addEventListener("click", () => toggleCommentBox(post.id));

        const deleteButton = article.querySelector(".post-delete-button");

        if (deleteButton) {
            deleteButton.addEventListener("click", safe(() => deletePost(post.id)));
        }

        const section = article.querySelector(".comments-section");
        const input = section.querySelector(".comment-input");
        const submit = section.querySelector(".comment-submit");

        const send = safe(async () => {
            submit.disabled = true;
            try {
                await addComment(post.id, input.value);
            } finally {
                submit.disabled = false;
            }
        });

        submit.addEventListener("click", send);

        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                send();
            }
        });

        post.comments.forEach(comment =>
            section.appendChild(createCommentElement(post, comment))
        );

        return article;
    }

    function toggleCommentBox(postId) {

        if (state.openComments.has(postId)) {
            state.openComments.delete(postId);
        } else {
            state.openComments.add(postId);
        }

        rerenderPost(postId);

        if (state.openComments.has(postId)) {
            const section = document.querySelector(
                `.post-card[data-post-id="${postId}"] .comment-input`
            );
            section?.focus();
        }
    }

    function fadeOpacity(post) {

        if (post.likes.length > 0 || post.comments.length > 0) return "1";

        const hours =
            (Date.now() - new Date(post.created_at).getTime()) / 3600000;

        const opacity = 1 - Math.min(hours / 72, 1) * 0.45;
        return opacity.toFixed(2);
    }

    function rerenderPost(postId) {

        const post = state.posts.get(postId);
        if (!post) return;

        document
            .querySelectorAll(`.post-card[data-post-id="${postId}"]`)
            .forEach(card => card.replaceWith(createPostCard(post)));
    }

    function openPostModal() {

        postModal.classList.remove("hidden");
        postText.focus();

        state.pendingMediaUrl = null;
        state.pendingLocation = null;

        $("post-image-input").value = "";
        $("post-image-preview").classList.add("hidden");
        $("post-image-preview").innerHTML = "";
        $("post-location-chip").classList.add("hidden");
        $("post-location-chip").innerHTML = "";
    }

    $("create-post-button").addEventListener("click", openPostModal);
    $("nav-create-post").addEventListener("click", openPostModal);

    $("close-post-modal").addEventListener("click", () => {
        postModal.classList.add("hidden");
        clearTimeout(draftTimer);
        setDrafting(false).catch(() => {});
    });

    postModal.addEventListener("click", event => {
        if (event.target === postModal) {
            postModal.classList.add("hidden");
        }
    });

    let draftTimer = null;

    postText.addEventListener("input", () => {

        postCounter.textContent = postText.value.length;

        clearTimeout(draftTimer);

        draftTimer = setTimeout(
            () => setDrafting(postText.value.trim().length > 0),
            1200
        );
    });

    async function setDrafting(active) {

        if (!state.me) return;

        const value = active
            ? new Date(Date.now() + 10 * 60000).toISOString()
            : null;

        try {
            const updated = await q(
                sb.from("profiles")
                    .update({ drafting_until: value })
                    .eq("id", state.me.id)
                    .select()
                    .single()
            );

            state.me = updated;
            cacheProfiles([updated]);
        } catch (error) {
            console.error("Statut « en train d'écrire » :", error);
        }
    }

    publishButton.addEventListener("click", safe(async () => {

        const text = postText.value.trim();

        if (!text && !state.pendingMediaUrl) {
            showToast("Écris quelque chose ou ajoute une photo.");
            return;
        }

        publishButton.disabled = true;

        try {

            const insert = {
                author_id: state.me.id,
                text: text || ""
            };

            if (state.pendingMediaUrl) insert.image_url = state.pendingMediaUrl;

            if (state.pendingLocation) {
                insert.location_name = state.pendingLocation.name;
                insert.location_lat = state.pendingLocation.lat;
                insert.location_lng = state.pendingLocation.lng;
            }

            const row = await q(
                sb.from("posts").insert(insert).select().single()
            );

            const post = { ...row, likes: [], comments: [] };
            state.posts.set(post.id, post);

            postText.value = "";
            postCounter.textContent = "0";
            postModal.classList.add("hidden");

            state.pendingMediaUrl = null;
            state.pendingLocation = null;
            $("post-image-preview").classList.add("hidden");
            $("post-image-preview").innerHTML = "";
            $("post-location-chip").classList.add("hidden");
            $("post-location-chip").innerHTML = "";
            $("post-image-input").value = "";

            clearTimeout(draftTimer);
            setDrafting(false).catch(() => {});

            emptyFeed.classList.add("hidden");

            if (state.currentPage === homePage) await loadPosts();
            if (state.currentPage === profilePage) loadProfile().catch(reportError);

        } finally {
            publishButton.disabled = false;
        }
    }));

    const likesInProgress = new Set();

    async function toggleLike(postId) {

        const post = state.posts.get(postId);
        if (!post || likesInProgress.has(postId)) return;

        likesInProgress.add(postId);

        try {
            const liked = post.likes.includes(state.me.id);

            if (liked) {
                await q(
                    sb.from("post_likes").delete()
                        .eq("post_id", postId)
                        .eq("user_id", state.me.id)
                );
                post.likes = post.likes.filter(id => id !== state.me.id);
            } else {
                await q(
                    sb.from("post_likes").insert({ post_id: postId, user_id: state.me.id })
                );
                post.likes = [...post.likes, state.me.id];
                post.justLiked = true;
            }

            rerenderPost(postId);
        } finally {
            likesInProgress.delete(postId);
        }
    }

    async function deletePost(postId) {

        const post = state.posts.get(postId);

        if (!post || post.author_id !== state.me.id) {
            showToast("Tu ne peux supprimer que tes propres publications.");
            return;
        }

        if (!confirm("Supprimer cette publication ?")) return;

        await q(sb.from("posts").delete().eq("id", postId));

        state.posts.delete(postId);

        document
            .querySelectorAll(`.post-card[data-post-id="${postId}"]`)
            .forEach(card => card.remove());

        emptyFeed.classList.toggle(
            "hidden",
            postsContainer.querySelector(".post-card") !== null
        );

        if (state.currentPage === profilePage) loadProfile().catch(reportError);
    }

    async function addComment(postId, text) {

        const cleanText = text.trim();
        const post = state.posts.get(postId);
        if (!cleanText || !post) return;

        const row = await q(
            sb.from("comments")
                .insert({
                    post_id: postId,
                    author_id: state.me.id,
                    text: cleanText
                })
                .select()
                .single()
        );

        post.comments = [...post.comments, row];
        rerenderPost(postId);

        document
            .querySelector(`.post-card[data-post-id="${postId}"] .comment-input`)
            ?.focus();
    }

    function createCommentElement(post, comment) {

        const author = profileOf(comment.author_id);
        const element = document.createElement("div");

        element.className = "comment";
        applyColor(element, author);

        element.innerHTML = `
            <div class="comment-avatar">
                ${avatarInnerHTML(author)}
            </div>
            <div class="comment-body">
                <div class="comment-top">
                    <strong>${escapeHTML(author.name)}</strong>
                    <span>${timeAgo(comment.created_at)}</span>
                </div>
                <div class="comment-text">${escapeHTML(comment.text)}</div>
            </div>
        `;

        if (comment.author_id === state.me.id) {
            const deleteButton = document.createElement("button");
            deleteButton.className = "comment-delete";
            deleteButton.setAttribute("aria-label", "Supprimer le commentaire");
            deleteButton.innerHTML = ICONS.trash;

            deleteButton.addEventListener(
                "click",
                safe(() => deleteComment(post.id, comment.id))
            );

            element.appendChild(deleteButton);
        }

        return element;
    }

    async function deleteComment(postId, commentId) {

        if (!confirm("Supprimer ce commentaire ?")) return;

        await q(sb.from("comments").delete().eq("id", commentId));

        const post = state.posts.get(postId);

        if (post) {
            post.comments = post.comments.filter(
                comment => comment.id !== commentId
            );
            rerenderPost(postId);
        }
    }

    // =====================================================
    // RECHERCHE
    // =====================================================

    let discoverTab = "people";

    function openSearch() {

        showPage(searchPage);
        searchInput.focus();

        discoverTab = "people";

        document.querySelectorAll(".discover-tab").forEach(item =>
            item.classList.toggle("active", item.dataset.tab === "people")
        );

        $("discover-people").classList.remove("hidden");
        $("discover-posts").classList.add("hidden");
        $("discover-groups").classList.add("hidden");

        displaySearchResults(searchInput.value).catch(reportError);
        loadSuggestions().catch(reportError);
    }

    $("search-button").addEventListener("click", openSearch);
    $("nav-search").addEventListener("click", openSearch);

    document.querySelectorAll(".discover-tab").forEach(tab => {

        tab.addEventListener("click", () => {

            discoverTab = tab.dataset.tab;

            document.querySelectorAll(".discover-tab").forEach(item =>
                item.classList.toggle("active", item === tab)
            );

            $("discover-people").classList.toggle("hidden", discoverTab !== "people");
            $("discover-posts").classList.toggle("hidden", discoverTab !== "posts");
            $("discover-groups").classList.toggle("hidden", discoverTab !== "groups");

            if (discoverTab === "posts") displayPostSearch(searchInput.value).catch(reportError);
            else if (discoverTab === "groups") loadDiscoverGroups().catch(reportError);
        });
    });

    async function loadSuggestions() {

        if (searchInput.value.trim()) {
            $("suggestions-title").classList.add("hidden");
            $("suggestions-results").innerHTML = "";
            return;
        }

        const rows = await q(sb.from("profiles").select("*").limit(30));
        cacheProfiles(rows);

        const others = rows.filter(
            user => user.id !== state.me.id && !state.friendIds.has(user.id)
        );

        if (others.length === 0) {
            $("suggestions-title").classList.add("hidden");
            $("suggestions-results").innerHTML = "";
            return;
        }

        $("suggestions-title").classList.remove("hidden");

        const box = $("suggestions-results");
        box.innerHTML = "";

        others.slice(0, 10).forEach(user => {

            const item = document.createElement("div");
            item.className = "user-result";

            item.innerHTML = `
                ${avatarHTML(user, "user-result-avatar")}
                <div class="user-result-info">
                    <strong>${escapeHTML(user.name)}</strong>
                    <span>@${escapeHTML(user.username)}</span>
                </div>
                <button class="friend-button">Ajouter</button>
                <button class="view-user-button">Voir</button>
            `;

            item.querySelector(".friend-button").addEventListener(
                "click",
                safe(async () => {
                    await toggleFriend(user.id);
                    await loadSuggestions();
                })
            );

            item.querySelector(".view-user-button").addEventListener(
                "click",
                () => showUserProfile(user.id)
            );

            box.appendChild(item);
        });
    }

    async function displayPostSearch(query) {

        const box = $("discover-posts-results");
        const clean = query.trim();

        if (!clean) {
            box.innerHTML = `
                <div class="search-empty">
                    Cherche un mot pour trouver des publications.
                </div>
            `;
            return;
        }

        const rows = await q(
            sb.from("posts")
                .select("*")
                .ilike("text", `%${clean.replace(/[%,()*]/g, "")}%`)
                .order("created_at", { ascending: false })
                .limit(30)
        );

        const posts = await hydratePosts(rows);
        box.innerHTML = "";

        if (posts.length === 0) {
            box.innerHTML = `
                <div class="search-empty">
                    Aucune publication ne contient ce mot.
                </div>
            `;
            return;
        }

        posts.forEach(post => box.appendChild(createPostCard(post)));
    }

    async function loadDiscoverGroups() {

        const box = $("discover-groups-results");

        const [groups, members] = await Promise.all([
            q(sb.from("groups").select("*").order("created_at", { ascending: false })),
            q(sb.from("group_members").select("group_id, user_id"))
        ]);

        if (groups.length === 0) {
            box.innerHTML = `
                <div class="search-empty">
                    Aucune salle pour le moment. Sois le premier à en créer une.
                </div>
            `;
            return;
        }

        const counts = new Map();
        members.forEach(row =>
            counts.set(row.group_id, (counts.get(row.group_id) || 0) + 1)
        );

        const myGroupIds = new Set(
            members
                .filter(row => row.user_id === state.me.id)
                .map(row => row.group_id)
        );

        box.innerHTML = "";

        groups.forEach(group => {

            const count = counts.get(group.id) || 1;
            const joined = myGroupIds.has(group.id);

            const card = document.createElement("div");
            card.className = "group-card";

            card.innerHTML = `
                <div class="group-avatar">${escapeHTML(initial(group.name))}</div>
                <div class="group-info">
                    <strong>${escapeHTML(group.name)}</strong>
                    <span>${escapeHTML(group.description || "Aucune description")}</span>
                </div>
                ${joined
                    ? `<span class="group-meta">${count} membre${count > 1 ? "s" : ""}</span>`
                    : `<button class="join-group-button">Rejoindre</button>`}
            `;

            if (joined) {
                card.addEventListener("click", () => openGroup(group.id, group.name));
            } else {
                card
                    .querySelector(".join-group-button")
                    .addEventListener("click", safe(async event => {
                        event.stopPropagation();
                        await q(sb.from("group_members")
                            .insert({ group_id: group.id, user_id: state.me.id })
                        );
                        await openGroup(group.id, group.name);
                    }));
            }

            box.appendChild(card);
        });
    }

    $("close-search-page").addEventListener("click", () => showPage(homePage));

    async function searchProfiles(query) {

        const clean = query.trim().replace(/^@/, "").replace(/[%,()*\\]/g, "").toLowerCase();
        if (!clean) return null;

        const pattern = `%${clean}%`;

        const groups = await Promise.all([
            q(sb.from("profiles").select("*").ilike("name", pattern).limit(20)),
            q(sb.from("profiles").select("*").ilike("username", pattern).limit(20)),
            q(sb.from("profiles").select("*").ilike("chatly_id", pattern).limit(20))
        ]);

        const unique = new Map();
        groups.flat().forEach(profile => unique.set(profile.id, profile));

        const results = [...unique.values()].sort(
            (a, b) => a.name.localeCompare(b.name, "fr")
        );

        cacheProfiles(results);
        return results;
    }

    async function displaySearchResults(query) {

        const token = ++searchToken;
        const results = await searchProfiles(query);

        if (token !== searchToken) return;

        if (results === null) {
            searchResults.innerHTML = `
                <div class="search-empty">Recherche des utilisateurs CHATLY.</div>
            `;
            return;
        }

        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="search-empty">Aucun utilisateur trouvé.</div>
            `;
            return;
        }

        searchResults.innerHTML = "";

        results.forEach(user => {

            const isMe = user.id === state.me.id;
            const isFriend = state.friendIds.has(user.id);

            const item = document.createElement("div");
            item.className = "user-result";

            item.innerHTML = `
                ${avatarHTML(user, "user-result-avatar")}
                <div class="user-result-info">
                    <strong>${escapeHTML(user.name)}</strong>
                    <span>@${escapeHTML(user.username)}</span>
                </div>
                ${isMe
                    ? `<button disabled>Ton profil</button>`
                    : `<button class="friend-button ${isFriend ? "is-friend" : ""}">
                        ${isFriend ? "Ami ✓" : "Ajouter"}
                       </button>
                       <button class="view-user-button">Voir</button>`}
            `;

            const friendButton = item.querySelector(".friend-button");
            const viewButton = item.querySelector(".view-user-button");

            if (friendButton) {
                friendButton.addEventListener("click", safe(async () => {
                    friendButton.disabled = true;
                    await toggleFriend(user.id);
                    await displaySearchResults(searchInput.value);
                }));
            }

            if (viewButton) {
                viewButton.addEventListener("click", () => showUserProfile(user.id));
            }

            searchResults.appendChild(item);
        });
    }

    searchInput.addEventListener("input", () => {

        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            if (discoverTab === "posts") {
                displayPostSearch(searchInput.value).catch(reportError);
            } else {
                displaySearchResults(searchInput.value).catch(reportError);
                loadSuggestions().catch(reportError);
            }
        }, 250);
    });

    // =====================================================
    // AMIS
    // =====================================================

    async function loadFriendIds() {

        const rows = await q(
            sb.from("friendships").select("friend_id").eq("user_id", state.me.id)
        );

        state.friendIds = new Set(rows.map(row => row.friend_id));
    }

    async function toggleFriend(userId) {

        if (!state.me || userId === state.me.id) return;

        const other = profileOf(userId);

        if (state.friendIds.has(userId)) {

            if (!confirm("Retirer " + other.name + " de tes amis ?")) return;

            await q(sb.rpc("remove_friend", { p_friend: userId }));
            state.friendIds.delete(userId);
            showToast(other.name + " a été retiré de tes amis.");

        } else {

            await q(sb.rpc("add_friend", { p_friend: userId }));
            state.friendIds.add(userId);
            showToast(other.name + " est maintenant dans tes amis.");
        }
    }

    $("friends-button").addEventListener("click", () => {
        showPage(friendsPage);
        loadFriends().catch(reportError);
    });

    $("close-friends-page").addEventListener("click", () => showPage(homePage));

    async function loadFriends() {

        const container = $("friends-container");
        await loadFriendIds();

        const ids = [...state.friendIds];

        if (ids.length === 0) {
            container.innerHTML = `
                <div class="search-empty">
                    Aucun ami pour le moment.
                    Trouve des personnes avec la recherche.
                </div>
            `;
            return;
        }

        await refreshProfiles(ids);
        container.innerHTML = "";

        ids
            .map(profileOf)
            .sort((a, b) => a.name.localeCompare(b.name, "fr"))
            .forEach(friend => {

                const item = document.createElement("div");
                item.className = "user-result";

                item.innerHTML = `
                    ${avatarHTML(friend, "user-result-avatar")}
                    <div class="user-result-info">
                        <strong>${escapeHTML(friend.name)}</strong>
                        <span>@${escapeHTML(friend.username)}</span>
                    </div>
                    <button class="view-user-button">Voir</button>
                `;

                item
                    .querySelector(".view-user-button")
                    .addEventListener("click", () => showUserProfile(friend.id));

                container.appendChild(item);
            });
    }

    // =====================================================
    // PROFIL
    // =====================================================

    $("nav-profile").addEventListener("click", () => {
        state.viewedId = null;
        showPage(profilePage);
        loadProfile().catch(reportError);
    });

    $("close-profile-page").addEventListener("click", () => {

        const target = state.viewedId ? state.profileReturnPage : homePage;

        showPage(target);

        if (target === searchPage) displaySearchResults(searchInput.value).catch(reportError);
        else if (target === friendsPage) loadFriends().catch(reportError);
        else loadPosts().catch(reportError);
    });

    function showUserProfile(userId) {

        state.profileReturnPage = state.currentPage;
        showPage(profilePage);
        state.viewedId = userId;
        updateNavActive();
        loadProfile().catch(reportError);
    }

    function renderProfileHeader(user, isOwn) {

        applyColor($("profile-card"), user);

        const avatarBox = $("profile-avatar");

        if (user.avatar_url) {
            avatarBox.innerHTML = `<img src="${escapeHTML(user.avatar_url)}" alt="">`;
        } else {
            avatarBox.textContent = initial(user.name);
        }

        $("profile-card").dataset.own = isOwn ? "true" : "false";

        const coverBox = $("profile-cover");

        if (user.cover_url) {
            coverBox.querySelector("img")?.remove();

            const img = document.createElement("img");
            img.src = user.cover_url;
            img.alt = "";
            coverBox.prepend(img);
        } else {
            coverBox.querySelector("img")?.remove();
        }

        $("profile-name").textContent = user.name;
        $("profile-username").textContent = "@" + user.username;
        $("profile-bio").textContent = user.bio || "";
        $("profile-id-value").textContent = user.chatly_id;

        settingsButton.classList.toggle("hidden", !isOwn);
        friendToggleButton.classList.toggle("hidden", isOwn);
        messageButton.classList.toggle("hidden", isOwn);
        notebookButton.classList.toggle(
            "hidden",
            isOwn || !state.friendIds.has(user.id)
        );

        if (!isOwn) {
            const isFriend = state.friendIds.has(user.id);
            friendToggleButton.textContent = isFriend ? "Retirer des amis" : "Ajouter en ami";
            friendToggleButton.classList.toggle("is-friend", isFriend);
        }

        $("timeline-chip").textContent = isOwn ? "Tout" : "Publications de " + user.name;

        renderProfileStatus(user, isOwn);
        renderFriendshipWeather(user, isOwn);

        state.profileShownId = user.id;
    }

    function renderFriendshipWeather(user, isOwn) {

        const box = $("friendship-weather");

        if (isOwn || !state.friendIds.has(user.id)) {
            box.classList.add("hidden");
            return;
        }

        const recent = getConversation(user.id).filter(
            message =>
                Date.now() - new Date(message.created_at).getTime()
                < 14 * 24 * 3600000
        ).length;

        let text;

        if (recent === 0) text = "☁️ Vous ne vous êtes pas écrit ces derniers temps";
        else if (recent < 5) text = "🌤️ Vous vous écrivez de temps en temps";
        else if (recent < 20) text = "☀️ Vous vous écrivez souvent en ce moment";
        else text = "🔥 Vous vous écrivez énormément ces derniers temps";

        box.textContent = text;
        box.classList.remove("hidden");
    }

    function renderProfileStatus(user, isOwn) {

        const box = $("profile-status");
        const parts = [];

        if (user.quiet_mode) {
            parts.push(
                `<span class="status-pill status-quiet">
                    🤫 ${isOwn ? "Silence activé" : "Lit sans répondre pour l'instant"}
                </span>`
            );
        }

        if (
            user.drafting_until &&
            new Date(user.drafting_until).getTime() > Date.now() &&
            !isOwn
        ) {
            parts.push(
                `<span class="status-pill status-drafting">
                    ✍️ Écrit quelque chose en ce moment
                </span>`
            );
        }

        box.innerHTML = parts.join("");
        box.classList.toggle("hidden", parts.length === 0);
    }

    function showProfileLoading() {

        $("profile-card").style.removeProperty("--c");
        $("profile-card").style.removeProperty("--c-ink");

        $("friendship-weather").classList.add("hidden");

        $("profile-avatar").textContent = "…";
        $("profile-name").textContent = "Chargement…";
        $("profile-username").textContent = "";
        $("profile-bio").textContent = "";
        $("profile-id-value").textContent = "–";
        $("profile-post-count").textContent = "–";
        $("profile-friend-count").textContent = "–";
        $("timeline-chip").textContent = "Publications";
        $("profile-posts-container").innerHTML = "";

        $("profile-status").classList.add("hidden");
        $("profile-status").innerHTML = "";

        [
            settingsButton,
            friendToggleButton, messageButton, notebookButton
        ].forEach(button => button.classList.add("hidden"));

        state.profileShownId = null;
    }

    async function loadProfile() {

        const token = ++profileToken;

        const isOwn = !state.viewedId || state.viewedId === state.me.id;
        const targetId = isOwn ? state.me.id : state.viewedId;

        if (state.profileShownId !== targetId) showProfileLoading();

        let user = state.me;

        if (isOwn) {
            renderProfileHeader(user, true);
        } else {
            user = await q(
                sb.from("profiles").select("*").eq("id", state.viewedId).maybeSingle()
            );

            if (token !== profileToken) return;

            if (!user) {
                showToast("Profil introuvable.");
                showPage(homePage);
                return;
            }

            cacheProfiles([user]);
            renderProfileHeader(user, false);
        }

        const [rows, friendRows] = await Promise.all([
            q(sb.from("posts").select("*").eq("author_id", user.id).order("created_at", { ascending: false })),
            isOwn ? null : q(sb.from("friendships").select("friend_id").eq("user_id", user.id))
        ]);

        const posts = await hydratePosts(rows);

        if (token !== profileToken) return;

        $("profile-post-count").textContent = posts.length;
        $("profile-friend-count").textContent = isOwn ? state.friendIds.size : friendRows.length;

        const container = $("profile-posts-container");
        container.innerHTML = "";

        if (posts.length === 0) {
            container.innerHTML = `
                <div class="search-empty">
                    ${isOwn
                        ? "Tu n'as encore aucune publication."
                        : "Aucune publication pour le moment."}
                </div>
            `;
            return;
        }

        posts.forEach(post => container.appendChild(createPostCard(post)));
    }

    friendToggleButton.addEventListener("click", safe(async () => {
        if (!state.viewedId) return;
        friendToggleButton.disabled = true;
        try {
            await toggleFriend(state.viewedId);
            await loadProfile();
        } finally {
            friendToggleButton.disabled = false;
        }
    }));

    messageButton.addEventListener("click", safe(async () => {
        if (state.viewedId) await openChat(state.viewedId);
    }));

    notebookButton.addEventListener("click", safe(async () => {
        if (state.viewedId) await openNotebook(state.viewedId);
    }));

    // =====================================================
    // CARNET À DEUX
    // =====================================================

    const notebookEntries = $("notebook-entries");
    const notebookInput = $("notebook-input");

    async function openNotebook(friendId) {

        await ensureProfiles([friendId]);
        const friend = state.profiles.get(friendId);

        if (!friend) {
            showToast("Utilisateur introuvable.");
            return;
        }

        showPage(notebookPage);
        state.notebookFriendId = friendId;
        $("notebook-title").textContent = "Carnet avec " + friend.name;
        notebookInput.value = "";

        await loadNotebook();
        notebookInput.focus();
    }

    async function loadNotebook() {

        const friendId = state.notebookFriendId;
        if (!friendId) return;

        const a = state.me.id < friendId ? state.me.id : friendId;
        const b = state.me.id < friendId ? friendId : state.me.id;

        const rows = await q(
            sb.from("notebook_entries")
                .select("*")
                .eq("user_a", a)
                .eq("user_b", b)
                .order("created_at", { ascending: true })
        );

        if (state.notebookFriendId !== friendId) return;

        notebookEntries.innerHTML = "";

        if (rows.length === 0) {
            notebookEntries.innerHTML = `
                <div class="notebook-empty">
                    Rien pour l'instant. Ce carnet n'appartient qu'à
                    vous deux : notez-y un souvenir ou une idée.
                </div>
            `;
            return;
        }

        rows.forEach(entry => {

            const mine = entry.author_id === state.me.id;
            const div = document.createElement("div");

            div.className = "notebook-entry" + (mine ? " mine" : "");

            div.innerHTML = `
                <div class="notebook-entry-text"></div>
                <div class="notebook-entry-meta">
                    <span></span>
                    <span>${formatMessageTime(entry.created_at)}</span>
                </div>
            `;

            div.querySelector(".notebook-entry-text").textContent = entry.text;
            div.querySelector(".notebook-entry-meta span").textContent =
                mine ? "Toi" : profileOf(entry.author_id).name;

            notebookEntries.appendChild(div);
        });

        window.scrollTo(0, document.body.scrollHeight);
    }

    async function sendNotebookEntry() {

        const text = notebookInput.value.trim();
        if (!text || !state.notebookFriendId) return;

        notebookInput.value = "";

        try {
            await q(sb.rpc("write_notebook", {
                p_friend: state.notebookFriendId,
                p_text: text
            }));
            await loadNotebook();
        } catch (error) {
            notebookInput.value = text;
            throw error;
        }

        notebookInput.focus();
    }

    $("notebook-send").addEventListener("click", safe(sendNotebookEntry));

    notebookInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            safe(sendNotebookEntry)();
        }
    });

    $("close-notebook-page").addEventListener("click", () => {

        const friendId = state.notebookFriendId;
        showPage(profilePage);
        state.viewedId = friendId;
        loadProfile().catch(reportError);
    });

    // =====================================================
    // SILENCE
    // =====================================================

    const quietButton = $("quiet-button");

    function updateQuietButton() {

        const active = !!state.me.quiet_mode;

        quietButton.textContent = active ? "🤫 Silence activé" : "🤫 Activer le silence";
        quietButton.classList.toggle("is-active", active);
    }

    quietButton.addEventListener("click", safe(async () => {

        quietButton.disabled = true;

        try {
            const updated = await q(
                sb.from("profiles")
                    .update({ quiet_mode: !state.me.quiet_mode })
                    .eq("id", state.me.id)
                    .select()
                    .single()
            );

            state.me = updated;
            cacheProfiles([updated]);
            updateQuietButton();

            showToast(
                updated.quiet_mode
                    ? "Le silence est activé : tes amis le verront sur ton profil."
                    : "Silence désactivé."
            );

            if (state.currentPage === profilePage) await loadProfile();
        } finally {
            quietButton.disabled = false;
        }
    }));

    // =====================================================
    // RÉGLAGES
    // =====================================================

    settingsButton.addEventListener("click", () => {
        updateQuietButton();
        settingsModal.classList.remove("hidden");
    });

    $("close-settings").addEventListener("click", () => settingsModal.classList.add("hidden"));

    settingsModal.addEventListener("click", event => {
        if (event.target === settingsModal) settingsModal.classList.add("hidden");
    });

    editProfileButton.addEventListener("click", () => {

        settingsModal.classList.add("hidden");

        editName.value = state.me.name;
        editBio.value = state.me.bio || "";
        editBioCounter.textContent = editBio.value.length;

        renderMoodPicker(state.me.mood_color);

        editProfileModal.classList.remove("hidden");
        editName.focus();
    });

    $("close-edit-profile").addEventListener(
        "click", () => editProfileModal.classList.add("hidden")
    );

    editProfileModal.addEventListener("click", event => {
        if (event.target === editProfileModal) editProfileModal.classList.add("hidden");
    });

    editBio.addEventListener("input", () => {
        editBioCounter.textContent = editBio.value.length;
    });

    let selectedMoodColor = null;

    function renderMoodPicker(current) {

        selectedMoodColor = current || null;

        const box = $("mood-picker");
        box.innerHTML = "";

        const swatch = (color, label) => {

            const button = document.createElement("button");

            button.type = "button";
            button.className = "mood-swatch";
            button.setAttribute("aria-label", label);

            if (color) button.style.background = color;
            else button.classList.add("mood-auto");

            button.classList.toggle("selected", color === selectedMoodColor);

            button.addEventListener("click", () => {
                selectedMoodColor = color;
                box.querySelectorAll(".mood-swatch").forEach(item =>
                    item.classList.toggle("selected", item === button)
                );
            });

            return button;
        };

        box.appendChild(swatch(null, "Couleur automatique"));
        PERSON_COLORS.forEach(color => box.appendChild(swatch(color, "Couleur " + color)));
    }

    $("save-profile-button").addEventListener("click", safe(async () => {

        const name = editName.value.trim();

        if (!name) {
            showToast("Ton nom ne peut pas être vide.");
            return;
        }

        const saveButton = $("save-profile-button");
        saveButton.disabled = true;

        try {
            const updated = await q(
                sb.from("profiles")
                    .update({
                        name,
                        bio: editBio.value.trim(),
                        mood_color: selectedMoodColor
                    })
                    .eq("id", state.me.id)
                    .select()
                    .single()
            );

            state.me = updated;
            cacheProfiles([updated]);

            updateGreeting();

            editProfileModal.classList.add("hidden");
            showToast("Profil mis à jour.");

            await Promise.all([loadProfile(), loadPosts()]);
        } finally {
            saveButton.disabled = false;
        }
    }));

    // =====================================================
    // MESSAGES
    // =====================================================

    function messagesSignature(rows) {

        const unread = rows.filter(
            message => message.receiver_id === state.me.id && !message.read
        ).length;

        return (
            rows.length + ":" +
            (rows.length ? rows[rows.length - 1].id : 0) + ":" +
            unread
        );
    }

    async function refreshMessages() {

        const me = state.me.id;

        const rows = await q(
            sb.from("messages")
                .select("*")
                .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
                .order("created_at", { ascending: false })
                .limit(500)
        );

        rows.reverse();

        const signature = messagesSignature(rows);
        const changed = signature !== state.messagesSig;

        state.messages = rows;
        state.messagesSig = signature;

        return changed;
    }

    function otherUserId(message) {
        return message.sender_id === state.me.id
            ? message.receiver_id
            : message.sender_id;
    }

    function getConversation(userId) {
        return state.messages.filter(
            message => otherUserId(message) === userId
        );
    }

    function updateMessagesBadge() {

        const unread = state.me
            ? state.messages.filter(
                message => message.receiver_id === state.me.id && !message.read
            ).length
            : 0;

        messagesBadge.textContent = unread > 99 ? "99+" : unread;
        messagesBadge.classList.toggle("hidden", unread === 0);
    }

    async function markConversationRead(userId) {

        const unread = state.messages.filter(
            message =>
                message.sender_id === userId &&
                message.receiver_id === state.me.id &&
                !message.read
        );

        if (unread.length > 0) {

            await q(
                sb.from("messages")
                    .update({ read: true })
                    .eq("receiver_id", state.me.id)
                    .eq("sender_id", userId)
                    .eq("read", false)
            );

            unread.forEach(message => { message.read = true; });
            state.messagesSig = messagesSignature(state.messages);
        }

        updateMessagesBadge();
    }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(pollMessages, POLL_MS);
    }

    function stopPolling() {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    async function pollMessages() {

        if (!state.me || document.hidden || pollBusy) return;

        pollBusy = true;

        try {
            const changed = await refreshMessages();

            if (changed && state.me) {

                await ensureProfiles(state.messages.map(otherUserId));
                updateMessagesBadge();

                if (state.currentPage === messagesPage) await loadConversations();

                if (state.currentPage === chatPage && state.chatUserId) {
                    await markConversationRead(state.chatUserId);
                    renderChat();
                }
            }

            if (state.me && state.currentPage === profilePage && state.viewedId) {
                await refreshProfiles([state.viewedId]);
                const user = state.profiles.get(state.viewedId);

                if (user && state.profileShownId === user.id) {
                    renderProfileStatus(user, false);
                }
            }
        } catch (error) {
            console.error("Vérification régulière :", error);
        } finally {
            pollBusy = false;
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) pollMessages();
    });

    function openMessages() {
        showPage(messagesPage);
        loadConversations().catch(reportError);
    }

    async function loadConversations() {

        await ensureProfiles(state.messages.map(otherUserId));

        const conversations = new Map();

        state.messages.forEach(message => {

            const other = otherUserId(message);

            if (!conversations.has(other)) {
                conversations.set(other, { last: message, unread: 0 });
            }

            const entry = conversations.get(other);
            entry.last = message;

            if (message.receiver_id === state.me.id && !message.read) {
                entry.unread++;
            }
        });

        conversationsContainer.innerHTML = "";

        if (conversations.size === 0) {
            conversationsContainer.innerHTML = `
                <div class="search-empty">
                    Aucune conversation pour le moment.
                    Appuie sur « Nouveau message » pour écrire à quelqu'un.
                </div>
            `;
            return;
        }

        [...conversations.entries()]
            .sort((a, b) => new Date(b[1].last.created_at) - new Date(a[1].last.created_at))
            .forEach(([userId, entry]) => {

                const user = profileOf(userId);
                const preview = (entry.last.sender_id === state.me.id ? "Toi : " : "") + entry.last.text;

                const item = document.createElement("div");
                item.className = "user-result conversation" + (entry.unread > 0 ? " unread" : "");
                item.setAttribute("role", "button");
                item.tabIndex = 0;

                item.innerHTML = `
                    ${avatarHTML(user, "user-result-avatar")}
                    <div class="user-result-info">
                        <strong>${escapeHTML(user.name)}</strong>
                        <span>${escapeHTML(preview)}</span>
                    </div>
                    <div class="conversation-meta">
                        <span class="conversation-time">
                            ${formatMessageTime(entry.last.created_at)}
                        </span>
                        ${entry.unread > 0
                            ? `<span class="conversation-unread">${entry.unread}</span>`
                            : ""}
                    </div>
                `;

                const open = safe(() => openChat(userId));

                item.addEventListener("click", open);
                item.addEventListener("keydown", event => {
                    if (event.key === "Enter") open();
                });

                conversationsContainer.appendChild(item);
            });
    }

    async function openChat(userId) {

        if (!state.me || userId === state.me.id) return;

        await ensureProfiles([userId]);
        const other = state.profiles.get(userId);

        if (!other) {
            showToast("Utilisateur introuvable.");
            return;
        }

        showPage(chatPage);
        state.chatUserId = userId;

        applyColor(chatPage, other);

        $("chat-avatar").textContent = initial(other.name);
        $("chat-name").textContent = other.name;
        $("chat-username").textContent = "@" + other.username;

        renderChat();

        chatInput.value = "";
        chatInput.focus();

        await markConversationRead(userId);
    }

    function renderChat() {

        if (!state.me || !state.chatUserId) return;

        const conversation = getConversation(state.chatUserId);
        chatMessages.innerHTML = "";

        if (conversation.length === 0) {
            const empty = document.createElement("div");
            empty.className = "chat-empty";
            empty.textContent = "Aucun message pour le moment. Dis bonjour !";
            chatMessages.appendChild(empty);
            return;
        }

        let lastDay = "";

        conversation.forEach(message => {

            const date = new Date(message.created_at);
            const day = date.toDateString();

            if (day !== lastDay) {

                const separator = document.createElement("div");
                separator.className = "chat-day";

                separator.textContent =
                    day === new Date().toDateString()
                        ? "Aujourd'hui"
                        : date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

                chatMessages.appendChild(separator);
                lastDay = day;
            }

            const bubble = document.createElement("div");
            bubble.className = "chat-bubble " + (message.sender_id === state.me.id ? "mine" : "theirs");

            const text = document.createElement("div");
            text.className = "chat-text";
            text.textContent = message.text;

            const time = document.createElement("span");
            time.className = "chat-time";
            time.textContent = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

            bubble.appendChild(text);
            bubble.appendChild(time);
            chatMessages.appendChild(bubble);
        });

        window.scrollTo(0, document.body.scrollHeight);
    }

    async function sendChatMessage() {

        const text = chatInput.value.trim();
        if (!text || !state.me || !state.chatUserId) return;

        const receiverId = state.chatUserId;
        chatInput.value = "";

        try {
            const row = await q(
                sb.from("messages")
                    .insert({
                        sender_id: state.me.id,
                        receiver_id: receiverId,
                        text
                    })
                    .select()
                    .single()
            );

            state.messages.push(row);
            state.messagesSig = messagesSignature(state.messages);

            if (state.chatUserId === receiverId) renderChat();
        } catch (error) {
            chatInput.value = text;
            throw error;
        }

        chatInput.focus();
    }

    $("chat-send").addEventListener("click", safe(sendChatMessage));

    chatInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            safe(sendChatMessage)();
        }
    });

    $("close-chat-page").addEventListener("click", openMessages);

    async function renderNewMessageResults() {

        const token = ++newMessageToken;
        const query = newMessageSearch.value.trim();

        let results;

        if (query) {
            results = ((await searchProfiles(query)) || []).filter(
                user => user.id !== state.me.id
            );
        } else {
            await refreshProfiles([...state.friendIds]);
            results = [...state.friendIds]
                .map(profileOf)
                .sort((a, b) => a.name.localeCompare(b.name, "fr"));
        }

        if (token !== newMessageToken) return;

        newMessageResults.innerHTML = "";

        if (results.length === 0) {
            newMessageResults.innerHTML = `
                <div class="search-empty">
                    ${query
                        ? "Aucun utilisateur trouvé."
                        : "Tu n'as pas encore d'amis. Cherche un utilisateur par son nom ou son @username."}
                </div>
            `;
            return;
        }

        results.forEach(user => {

            const item = document.createElement("div");
            item.className = "user-result";

            item.innerHTML = `
                ${avatarHTML(user, "user-result-avatar")}
                <div class="user-result-info">
                    <strong>${escapeHTML(user.name)}</strong>
                    <span>@${escapeHTML(user.username)}</span>
                </div>
                <button class="write-button">Écrire</button>
            `;

            item
                .querySelector(".write-button")
                .addEventListener("click", safe(async () => {
                    newMessageModal.classList.add("hidden");
                    await openChat(user.id);
                }));

            newMessageResults.appendChild(item);
        });
    }

    $("new-message-button").addEventListener("click", () => {

        newMessageSearch.value = "";
        newMessageModal.classList.remove("hidden");
        newMessageSearch.focus();

        renderNewMessageResults().catch(reportError);
    });

    newMessageSearch.addEventListener("input", () => {
        clearTimeout(newMessageTimer);
        newMessageTimer = setTimeout(
            () => renderNewMessageResults().catch(reportError),
            250
        );
    });

    $("close-new-message").addEventListener(
        "click", () => newMessageModal.classList.add("hidden")
    );

    newMessageModal.addEventListener("click", event => {
        if (event.target === newMessageModal) newMessageModal.classList.add("hidden");
    });

    $("messages-button").addEventListener("click", openMessages);
    $("nav-messages").addEventListener("click", openMessages);

    $("close-messages-page").addEventListener("click", () => showPage(homePage));

    // =====================================================
    // STORIES
    // =====================================================

    async function fetchStories() {

        const rows = await q(
            sb.from("stories")
                .select("*")
                .order("created_at", { ascending: false })
        );

        const byAuthor = new Map();

        rows.forEach(story => {
            if (!byAuthor.has(story.author_id)) {
                byAuthor.set(story.author_id, story);
            }
        });

        const visible = [...byAuthor.values()].filter(story =>
            story.author_id === state.me.id ||
            state.friendIds.has(story.author_id)
        );

        visible.sort((a, b) => {
            if (a.author_id === state.me.id) return 1;
            if (b.author_id === state.me.id) return -1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        state.stories = visible;
        return visible;
    }

    async function renderStoriesRow() {

        const row = $("stories-row");
        if (!row || !state.me) return;

        row.innerHTML = "";

        await fetchStories();

        const mine = document.createElement("div");
        mine.className = "story story-add";
        mine.innerHTML = `
            <div class="story-ring plain">
                <div class="story-inner">+</div>
            </div>
            <div class="story-name">Ma story</div>
        `;
        mine.addEventListener("click", () => {

            const own = state.stories.find(s => s.author_id === state.me.id);

            if (own) {
                openStoryViewer(own);
            } else {
                openPostModal();
                showToast("Ajoute une photo puis clique « Publier en story »");
            }
        });
        row.appendChild(mine);

        state.stories.forEach(story => {

            if (story.author_id === state.me.id) return;

            const author = profileOf(story.author_id);
            const color = personColor(author);

            const el = document.createElement("div");
            el.className = "story";

            el.innerHTML = `
                <div class="story-ring">
                    <div class="story-inner" style="background:${color};--c-ink:#fff;">
                        ${avatarInnerHTML(author)}
                    </div>
                </div>
                <div class="story-name">${escapeHTML(author.name.split(" ")[0])}</div>
            `;

            el.addEventListener("click", () => openStoryViewer(story));
            row.appendChild(el);
        });
    }

    async function renderStoriesGrid() {

        const grid = $("stories-grid");
        if (!grid) return;

        await fetchStories();
        grid.innerHTML = "";

        const addTile = document.createElement("div");
        addTile.className = "story-tile story-tile-add";
        addTile.textContent = "+";
        addTile.addEventListener("click", () => openPostModal());
        grid.appendChild(addTile);

        if (state.stories.length === 0) {
            const empty = document.createElement("div");
            empty.className = "search-empty";
            empty.style.gridColumn = "1 / -1";
            empty.textContent = "Aucune story active. Les stories de tes amis apparaîtront ici.";
            grid.appendChild(empty);
            return;
        }

        state.stories.forEach(story => {

            const author = profileOf(story.author_id);
            const color = personColor(author);

            const tile = document.createElement("div");
            tile.className = "story-tile";

            tile.innerHTML = `
                <img src="${escapeHTML(story.image_url)}" alt="" loading="lazy">
                <div class="story-tile-author">
                    <span class="story-tile-avatar" style="background:${color};">
                        ${avatarInnerHTML(author)}
                    </span>
                    ${escapeHTML(author.name.split(" ")[0])}
                </div>
            `;

            tile.addEventListener("click", () => openStoryViewer(story));
            grid.appendChild(tile);
        });
    }

    function openStoryViewer(story) {

        state.storyIndex = state.stories.findIndex(s => s.id === story.id);
        if (state.storyIndex < 0) state.storyIndex = 0;

        $("story-viewer").classList.remove("hidden");
        showStoryAtIndex(state.storyIndex);
    }

    function showStoryAtIndex(index) {

        const story = state.stories[index];
        if (!story) return closeStoryViewer();

        const author = profileOf(story.author_id);
        const color = personColor(author);

        const avatarBox = $("story-viewer-avatar");
        avatarBox.style.background = color;
        avatarBox.innerHTML = avatarInnerHTML(author);

        $("story-viewer-name").textContent = author.name;
        $("story-viewer-time").textContent = timeAgo(story.created_at);

        $("story-viewer-media").innerHTML =
            `<img src="${escapeHTML(story.image_url)}" alt="">`;

        $("story-viewer-text").textContent = story.text || "";

        startStoryProgress();
    }

    function startStoryProgress() {

        stopStoryProgress();

        const bar = $("story-progress-bar");
        bar.style.width = "0%";

        const duration = 5000;
        const start = Date.now();

        state.storyTimer = setInterval(() => {

            const elapsed = Date.now() - start;
            const percent = Math.min(100, (elapsed / duration) * 100);
            bar.style.width = percent + "%";

            if (percent >= 100) nextStory();
        }, 50);
    }

    function stopStoryProgress() {
        clearInterval(state.storyTimer);
        state.storyTimer = null;
    }

    function nextStory() {
        state.storyIndex++;
        if (state.storyIndex >= state.stories.length) closeStoryViewer();
        else showStoryAtIndex(state.storyIndex);
    }

    function prevStory() {
        state.storyIndex--;
        if (state.storyIndex < 0) state.storyIndex = 0;
        showStoryAtIndex(state.storyIndex);
    }

    function closeStoryViewer() {
        stopStoryProgress();
        $("story-viewer").classList.add("hidden");
        state.storyIndex = 0;
    }

    $("story-viewer-close").addEventListener("click", closeStoryViewer);
    $("story-next").addEventListener("click", nextStory);
    $("story-prev").addEventListener("click", prevStory);

    $("story-viewer").addEventListener("click", event => {

        if (event.target.closest("button")) return;

        const x = event.clientX;
        const w = window.innerWidth;

        if (x < w * 0.3) prevStory();
        else nextStory();
    });

    document.addEventListener("keydown", event => {

        if ($("story-viewer").classList.contains("hidden")) return;

        if (event.key === "Escape") closeStoryViewer();
        if (event.key === "ArrowRight") nextStory();
        if (event.key === "ArrowLeft") prevStory();
    });

    $("stories-button").addEventListener("click", safe(async () => {
        showPage(storiesPage);
        await renderStoriesGrid();
    }));

    $("close-stories-page").addEventListener("click", () => showPage(homePage));

    // =====================================================
    // SALLES DE GROUPE
    // =====================================================

    let groupPollTimer = null;

    $("groups-button").addEventListener("click", safe(async () => {
        showPage(groupsPage);
        await loadGroups();
    }));

    $("close-groups-page").addEventListener("click", () => showPage(homePage));

    async function loadGroups() {

        const container = $("groups-container");

        const rows = await q(
            sb.from("group_members").select("group_id").eq("user_id", state.me.id)
        );

        const groupIds = rows.map(row => row.group_id);

        if (groupIds.length === 0) {
            container.innerHTML = `
                <div class="search-empty">
                    Tu n'as encore aucune salle de groupe.
                    Crée-en une, ou demande à un ami de t'inviter.
                </div>
            `;
            return;
        }

        const [groups, members] = await Promise.all([
            q(sb.from("groups").select("*").in("id", groupIds)),
            q(sb.from("group_members").select("group_id").in("group_id", groupIds))
        ]);

        const counts = new Map();
        members.forEach(row =>
            counts.set(row.group_id, (counts.get(row.group_id) || 0) + 1)
        );

        groups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        container.innerHTML = "";

        groups.forEach(group => {

            const count = counts.get(group.id) || 1;
            const card = document.createElement("div");
            card.className = "group-card";

            card.innerHTML = `
                <div class="group-avatar">${escapeHTML(initial(group.name))}</div>
                <div class="group-info">
                    <strong>${escapeHTML(group.name)}</strong>
                    <span>${escapeHTML(group.description || "Aucune description")}</span>
                </div>
                <div class="group-meta">${count} membre${count > 1 ? "s" : ""}</div>
            `;

            card.addEventListener("click", () => openGroup(group.id, group.name));
            container.appendChild(card);
        });
    }

    $("create-group-button").addEventListener("click", () => {
        $("group-name").value = "";
        $("group-description").value = "";
        $("group-desc-counter").textContent = "0";
        $("create-group-modal").classList.remove("hidden");
        $("group-name").focus();
    });

    $("close-create-group").addEventListener(
        "click", () => $("create-group-modal").classList.add("hidden")
    );

    $("create-group-modal").addEventListener("click", event => {
        if (event.target === $("create-group-modal")) $("create-group-modal").classList.add("hidden");
    });

    $("group-description").addEventListener("input", () => {
        $("group-desc-counter").textContent = $("group-description").value.length;
    });

    $("confirm-create-group").addEventListener("click", safe(async () => {

        const name = $("group-name").value.trim();
        const description = $("group-description").value.trim();

        if (!name) {
            showToast("Donne un nom à ta salle.");
            return;
        }

        const button = $("confirm-create-group");
        button.disabled = true;

        try {
            const group = await q(
                sb.rpc("create_group", { p_name: name, p_description: description })
            );

            $("create-group-modal").classList.add("hidden");
            showToast("Salle créée.");

            await openGroup(group.id, group.name);
        } finally {
            button.disabled = false;
        }
    }));

    async function openGroup(groupId, groupName) {

        showPage(groupChatPage);

        state.currentGroupId = groupId;
        $("group-chat-name").textContent = groupName;

        await refreshGroupMembership();
        await renderGroupMessages();

        $("group-input").value = "";
        $("group-input").focus();

        clearInterval(groupPollTimer);

        groupPollTimer = setInterval(() => {
            if (state.currentGroupId === groupId && !document.hidden) {
                renderGroupMessages().catch(error =>
                    console.error("Salle de groupe :", error)
                );
            }
        }, 4000);
    }

    function stopGroupPolling() {
        clearInterval(groupPollTimer);
        groupPollTimer = null;
    }

    async function refreshGroupMembership() {

        const rows = await q(
            sb.from("group_members").select("user_id").eq("group_id", state.currentGroupId)
        );

        state.groupMembers = new Set(rows.map(row => row.user_id));

        const count = state.groupMembers.size;
        $("group-chat-meta").textContent = count + " membre" + (count > 1 ? "s" : "");
    }

    async function renderGroupMessages() {

        const groupId = state.currentGroupId;

        const rows = await q(
            sb.from("group_messages")
                .select("*")
                .eq("group_id", groupId)
                .order("created_at", { ascending: true })
                .limit(200)
        );

        if (state.currentGroupId !== groupId) return;

        await ensureProfiles(rows.map(row => row.author_id));

        const box = $("group-messages");

        if (rows.length === 0) {
            box.innerHTML = `
                <div class="chat-empty">
                    Aucun message pour le moment. Sois le premier à écrire.
                </div>
            `;
            return;
        }

        box.innerHTML = "";

        rows.forEach(row => {

            const author = profileOf(row.author_id);
            const mine = row.author_id === state.me.id;

            const bubble = document.createElement("div");
            bubble.className = "chat-bubble " + (mine ? "mine" : "theirs");

            applyColor(bubble, author);

            bubble.innerHTML = `
                ${mine
                    ? ""
                    : `<strong style="display:block;font-size:12px;opacity:.75;margin-bottom:2px;">
                        ${escapeHTML(author.name)}
                       </strong>`}
                <div class="chat-text">${escapeHTML(row.text)}</div>
            `;

            box.appendChild(bubble);
        });

        box.scrollTop = box.scrollHeight;
    }

    async function sendGroupMessage() {

        const input = $("group-input");
        const text = input.value.trim();
        const groupId = state.currentGroupId;

        if (!text || !groupId) return;
        input.value = "";

        try {
            await q(sb.from("group_messages")
                .insert({ group_id: groupId, author_id: state.me.id, text })
            );
            await renderGroupMessages();
        } catch (error) {
            input.value = text;
            throw error;
        }

        input.focus();
    }

    $("group-send").addEventListener("click", safe(sendGroupMessage));

    $("group-input").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            safe(sendGroupMessage)();
        }
    });

    $("close-group-chat").addEventListener("click", safe(async () => {
        stopGroupPolling();
        showPage(groupsPage);
        await loadGroups();
    }));

    // =====================================================
    // SALLE VIDE
    // =====================================================

    const roomMessagesBox = $("room-messages");
    const roomComposer = $("room-composer");
    const roomEmptyState = $("room-empty-state");
    const roomInfo = $("room-info");
    const roomInput = $("room-input");

    let roomHeartbeatTimer = null;
    let roomPollTimer = null;

    $("room-button").addEventListener("click", safe(enterRoom));
    $("close-room-page").addEventListener("click", () => showPage(homePage));

    async function enterRoom() {

        showPage(roomPage);
        state.inRoom = true;

        await q(sb.rpc("room_heartbeat"));

        roomHeartbeatTimer = setInterval(() => {
            if (state.inRoom) {
                sb.rpc("room_heartbeat").then(({ error }) => {
                    if (error) console.error("Présence dans la salle :", error);
                });
            }
        }, 8000);

        await refreshRoom();

        roomPollTimer = setInterval(() => {
            if (state.inRoom && !document.hidden) {
                refreshRoom().catch(error => console.error("Salle vide :", error));
            }
        }, 3000);
    }

    function leaveRoom() {

        state.inRoom = false;

        clearInterval(roomHeartbeatTimer);
        clearInterval(roomPollTimer);

        roomHeartbeatTimer = null;
        roomPollTimer = null;

        sb.rpc("room_leave").then(({ error }) => {
            if (error) console.error("Sortie de la salle :", error);
        });
    }

    async function refreshRoom() {

        const presence = await q(
            sb.from("room_presence").select("user_id, last_seen")
        );

        const activeIds = presence
            .filter(row => Date.now() - new Date(row.last_seen).getTime() < 20000)
            .map(row => row.user_id);

        const othersCount = activeIds.filter(id => id !== state.me.id).length;
        const isLive = activeIds.length >= 2;

        roomInfo.textContent =
            othersCount === 0
                ? "Tu es seul pour l'instant. Attends qu'une autre personne arrive."
                : othersCount === 1
                    ? "Une autre personne est là avec toi."
                    : othersCount + " autres personnes sont là avec toi.";

        roomEmptyState.classList.toggle("hidden", isLive);
        roomMessagesBox.classList.toggle("hidden", !isLive);
        roomComposer.classList.toggle("hidden", !isLive);

        if (!isLive) return;

        await ensureProfiles(activeIds);

        const rows = await q(
            sb.from("room_messages")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50)
        );

        rows.reverse();
        await refreshProfiles([...new Set(rows.map(row => row.author_id))]);

        roomMessagesBox.innerHTML = "";

        if (rows.length === 0) {
            const empty = document.createElement("div");
            empty.className = "chat-empty";
            empty.textContent = "La salle vient de s'ouvrir. Dis bonjour !";
            roomMessagesBox.appendChild(empty);
            return;
        }

        rows.forEach(message => {

            const author = profileOf(message.author_id);
            const mine = message.author_id === state.me.id;

            const bubble = document.createElement("div");
            bubble.className = "chat-bubble " + (mine ? "mine" : "theirs");

            if (!mine) applyColor(bubble, author);

            const text = document.createElement("div");
            text.className = "chat-text";
            text.textContent = (mine ? "" : author.name + " — ") + message.text;

            bubble.appendChild(text);
            roomMessagesBox.appendChild(bubble);
        });

        window.scrollTo(0, document.body.scrollHeight);
    }

    async function sendRoomMessage() {

        const text = roomInput.value.trim();
        if (!text || !state.inRoom) return;

        roomInput.value = "";

        try {
            await q(sb.from("room_messages").insert({
                author_id: state.me.id,
                text
            }));
            await refreshRoom();
        } catch (error) {
            roomInput.value = text;
            throw error;
        }

        roomInput.focus();
    }

    $("room-send").addEventListener("click", safe(sendRoomMessage));

    roomInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            safe(sendRoomMessage)();
        }
    });

    // =====================================================
    // NOTIFICATIONS
    // =====================================================

    $("notification-button").addEventListener(
        "click",
        () => showToast("Aucune nouvelle notification.")
    );

    // =====================================================
    // UPLOAD DE PHOTO
    // =====================================================

    $("post-image-button").addEventListener("click", () => {
        $("post-image-input").click();
    });

    $("post-image-input").addEventListener("change", safe(async event => {

        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const preview = $("post-image-preview");
        const localUrl = URL.createObjectURL(file);

        preview.innerHTML = `
            <img src="${localUrl}" alt="">
            <button type="button" class="remove-media" aria-label="Retirer">×</button>
        `;
        preview.classList.remove("hidden");
        preview.classList.add("uploading");

        preview.querySelector(".remove-media").addEventListener("click", () => {
            state.pendingMediaUrl = null;
            $("post-image-input").value = "";
            preview.classList.add("hidden");
            preview.classList.remove("uploading");
            preview.innerHTML = "";
        });

        try {
            const url = await uploadFile(file, "posts");
            state.pendingMediaUrl = url;
            preview.querySelector("img").src = url;
            showToast("Photo ajoutée ✓");
        } catch (error) {
            reportError(error);
            preview.classList.add("hidden");
            preview.innerHTML = "";
            state.pendingMediaUrl = null;
        } finally {
            preview.classList.remove("uploading");
        }
    }));

    // =====================================================
    // LIEU
    // =====================================================

    $("post-location-button").addEventListener("click", safe(async () => {

        if (!navigator.geolocation) return askLocationManually();

        const button = $("post-location-button");
        button.disabled = true;

        navigator.geolocation.getCurrentPosition(

            async position => {

                const { latitude, longitude } = position.coords;
                let name = "Ma position";

                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=fr`
                    );
                    const data = await res.json();

                    name =
                        (data.address && (
                            data.address.city ||
                            data.address.town ||
                            data.address.village ||
                            data.address.county
                        )) ||
                        (data.display_name && data.display_name.split(",")[0]) ||
                        "Ma position";
                } catch (_) { /* pas grave */ }

                setPendingLocation({ name, lat: latitude, lng: longitude });
                button.disabled = false;
            },

            () => {
                button.disabled = false;
                askLocationManually();
            },

            { timeout: 8000, enableHighAccuracy: false }
        );
    }));

    function askLocationManually() {

        const name = prompt("Où es-tu ? (ville, lieu)");
        if (!name || !name.trim()) return;
        setPendingLocation({ name: name.trim(), lat: null, lng: null });
    }

    function setPendingLocation(location) {

        state.pendingLocation = location;

        const chip = $("post-location-chip");

        chip.innerHTML = `
            📍 ${escapeHTML(location.name)}
            <button type="button" aria-label="Retirer">×</button>
        `;
        chip.classList.remove("hidden");

        chip.querySelector("button").addEventListener("click", () => {
            state.pendingLocation = null;
            chip.classList.add("hidden");
            chip.innerHTML = "";
        });
    }

    // =====================================================
    // PHOTO DE PROFIL ET DE COUVERTURE
    // =====================================================

    const profilePhotoInput = document.createElement("input");
    profilePhotoInput.type = "file";
    profilePhotoInput.accept = "image/*";
    profilePhotoInput.style.display = "none";
    document.body.appendChild(profilePhotoInput);

    let profilePhotoTarget = null;

    function openProfilePhotoPicker(target) {

        if (state.viewedId) {
            showToast("Tu ne peux modifier que ton propre profil.");
            return;
        }

        profilePhotoTarget = target;
        profilePhotoInput.value = "";
        profilePhotoInput.click();
    }

    $("profile-avatar").addEventListener("click", () => {
        openProfilePhotoPicker("avatar");
    });

    $("profile-cover").addEventListener("click", () => {
        openProfilePhotoPicker("cover");
    });

    $("profile-avatar").addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProfilePhotoPicker("avatar");
        }
    });

    $("profile-cover").addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProfilePhotoPicker("cover");
        }
    });

    profilePhotoInput.addEventListener("change", safe(async event => {

        const file = event.target.files && event.target.files[0];
        if (!file || !profilePhotoTarget) return;

        const target = profilePhotoTarget;
        profilePhotoTarget = null;

        const box = target === "avatar"
            ? $("profile-avatar")
            : $("profile-cover");

        box.style.opacity = "0.6";

        try {
            const folder = target === "avatar" ? "avatars" : "covers";
            const url = await uploadFile(file, folder);

            const update = target === "avatar"
                ? { avatar_url: url }
                : { cover_url: url };

            const updated = await q(
                sb.from("profiles")
                    .update(update)
                    .eq("id", state.me.id)
                    .select()
                    .single()
            );

            state.me = updated;
            cacheProfiles([updated]);

            await loadProfile();
            loadPosts().catch(reportError);

            showToast(
                target === "avatar"
                    ? "Photo de profil mise à jour ✓"
                    : "Photo de couverture mise à jour ✓"
            );
        } finally {
            box.style.opacity = "";
        }
    }));

    // =====================================================
    // PUBLIER EN STORY
    // =====================================================

    $("publish-story-button").addEventListener("click", safe(async () => {

        if (!state.pendingMediaUrl) {
            showToast("Ajoute d'abord une photo pour la story.");
            return;
        }

        const button = $("publish-story-button");
        button.disabled = true;

        try {
            const text = postText.value.trim();

            await q(
                sb.from("stories").insert({
                    author_id: state.me.id,
                    image_url: state.pendingMediaUrl,
                    text: text || null
                })
            );

            postText.value = "";
            postCounter.textContent = "0";

            state.pendingMediaUrl = null;
            state.pendingLocation = null;

            $("post-image-preview").classList.add("hidden");
            $("post-image-preview").innerHTML = "";
            $("post-image-input").value = "";
            $("post-location-chip").classList.add("hidden");
            $("post-location-chip").innerHTML = "";

            postModal.classList.add("hidden");

            showToast("Story publiée ✨");

            await renderStoriesRow();

            if (state.currentPage === storiesPage) {
                await renderStoriesGrid();
            }
        } finally {
            button.disabled = false;
        }
    }));

    // =====================================================
    // DÉMARRAGE
    // =====================================================

    (async function init() {

        try {
            const { data } = await sb.auth.getSession();

            if (data.session) {
                await startApp(data.session.user.id);
                return;
            }
        } catch (error) {
            console.error(error);
            showAuthMessage(authErrorMessage(error));
        }

        authScreen.classList.remove("hidden");
    })();

    console.log("CHATLY est prêt 🚀");

});