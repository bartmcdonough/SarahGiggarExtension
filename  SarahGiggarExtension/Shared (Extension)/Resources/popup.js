/**
 * popup.js
 * Handles UI interactions, auth check, and saving MULTIPLE images.
 * LAYOUT UPDATE: Price moves to metadata column; Button becomes static.
 */

// DOM Elements
const loginView = document.getElementById("loginView");
const saveView = document.getElementById("saveView");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginButton = document.getElementById("loginButton");
const saveButton = document.getElementById("saveButton");
const messageEl = document.getElementById("message");
const previewContainer = document.getElementById("previewContainer");

// State
let currentSnapshot = null;
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// --- Helper Functions ---

function setMessage(text, type = "info") {
  messageEl.textContent = text || "";
  messageEl.style.display = text ? "block" : "none";
  if (type === "error") messageEl.style.color = "#ef4444";
  else if (type === "success") messageEl.style.color = "#22c55e";
  else messageEl.style.color = "#6b7280";
}

function showView(viewName) {
  if (viewName === "login") {
    loginView.style.display = "block";
    saveView.style.display = "none";
  } else {
    loginView.style.display = "none";
    saveView.style.display = "block";
  }
}

// --- 1. Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
  const [isAuthenticated] = await Promise.all([
    checkAuth(),
    tryExtractData()
  ]);

  if (!isAuthenticated) showView("login");
  else showView("save");
});

// --- 2. Authentication Logic ---

async function checkAuth() {
  try {
    const res = await fetch("https://sarahgiggar.com/api/auth/me", {
      method: "GET",
      credentials: "include"
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

loginButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return setMessage("Enter email & password", "error");

  setMessage("Signing in...");
  loginButton.disabled = true;

  try {
    const res = await fetch("https://sarahgiggar.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      await new Promise(r => setTimeout(r, 500));
      if (await checkAuth()) {
        showView("save");
        setMessage("");
      } else setMessage("Session failed.", "error");
    } else {
      setMessage("Login failed.", "error");
    }
  } catch (err) {
    setMessage("Network error.", "error");
  } finally {
    loginButton.disabled = false;
  }
});

// --- 3. Extraction Logic ---

async function tryExtractData() {
  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return;

    const snapshot = await Promise.race([
      browserAPI.tabs.sendMessage(tabs[0].id, { type: "extractProductSnapshot" }),
      new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 2500))
    ]);
    
    if (snapshot && snapshot.url) {
      currentSnapshot = snapshot;
      renderPreview(snapshot);
    } else {
      setMessage("No product details found.", "error");
    }
  } catch (err) {
    setMessage("Please refresh the page.", "info");
  }
}

// --- 4. RENDER PREVIEW (Updated Layout) ---

function renderPreview(data) {
  previewContainer.classList.remove("sg-hidden");
  previewContainer.style.display = "flex";
  previewContainer.style.flexDirection = "row";
  previewContainer.style.alignItems = "center"; // Vertical center
  previewContainer.style.gap = "12px";
  previewContainer.style.textAlign = "left";
  previewContainer.style.padding = "12px";
  previewContainer.style.border = "1px solid #e5e7eb";
  previewContainer.style.borderRadius = "8px";
  previewContainer.style.backgroundColor = "#fff";

  // Clear existing content
  previewContainer.innerHTML = '';

  // --- LEFT COLUMN: Image ---
  const leftCol = document.createElement("div");
  leftCol.style.position = "relative";
  leftCol.style.width = "70px"; // Slightly smaller for tighter layout
  leftCol.style.height = "90px";
  leftCol.style.flexShrink = "0";

  // Image
  const img = document.createElement("img");
  img.src = data.imageBase64 || data.imageUrl || "";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.borderRadius = "4px";
  img.style.display = "block";
  leftCol.appendChild(img);

  // Badge (+4)
  const galleryCount = (data.galleryBase64 || []).length;
  if (galleryCount > 0) {
    const badge = document.createElement("div");
    badge.textContent = `+${galleryCount}`;
    badge.style.position = "absolute";
    badge.style.bottom = "4px";
    badge.style.right = "4px";
    badge.style.background = "rgba(0,0,0,0.6)";
    badge.style.color = "white";
    badge.style.fontSize = "10px";
    badge.style.padding = "2px 5px";
    badge.style.borderRadius = "4px";
    badge.style.fontWeight = "600";
    leftCol.appendChild(badge);
  }
  
  // --- RIGHT COLUMN: Info ---
  const rightCol = document.createElement("div");
  rightCol.style.flex = "1";
  rightCol.style.display = "flex";
  rightCol.style.flexDirection = "column";
  rightCol.style.justifyContent = "center";
  rightCol.style.overflow = "hidden";

  // 1. Brand
  const brandEl = document.createElement("div");
  brandEl.textContent = (data.brand || data.retailerDomain).toUpperCase();
  brandEl.style.fontSize = "10px";
  brandEl.style.fontWeight = "600";
  brandEl.style.color = "#9ca3af"; // Light gray
  brandEl.style.letterSpacing = "0.5px";
  brandEl.style.marginBottom = "2px";
  rightCol.appendChild(brandEl);

  // 2. Title
  const titleEl = document.createElement("div");
  titleEl.textContent = data.name || data.title; // Handle both just in case
  titleEl.style.fontSize = "13px";
  titleEl.style.fontWeight = "600";
  titleEl.style.color = "#111827";
  titleEl.style.lineHeight = "1.3";
  titleEl.style.marginBottom = "4px"; // Space for price
  titleEl.style.display = "-webkit-box";
  titleEl.style.webkitLineClamp = "2";
  titleEl.style.webkitBoxOrient = "vertical";
  titleEl.style.overflow = "hidden";
  rightCol.appendChild(titleEl);

  // 3. Price (NEW LOCATION)
  if (data.price) {
    const priceEl = document.createElement("div");
    priceEl.textContent = data.price;
    priceEl.style.fontSize = "13px";
    priceEl.style.fontWeight = "400"; // Regular weight for price
    priceEl.style.color = "#4b5563"; // Medium gray
    rightCol.appendChild(priceEl);
  }

  // Append Columns
  previewContainer.appendChild(leftCol);
  previewContainer.appendChild(rightCol);

  // --- Button Update (CLEANER) ---
  saveButton.textContent = "Save to Wardrobe";
}

// --- 5. Save Logic ---

saveButton.addEventListener("click", async () => {
  if (!currentSnapshot) return;

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  
  try {
    const res = await fetch("https://sarahgiggar.com/api/admin/wardrobe-library/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ snapshot: currentSnapshot })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      setMessage("Saved to Library! ✨", "success");
      saveButton.textContent = "Saved";
      setTimeout(() => window.close(), 1500);
    } else if (res.status === 401) {
      showView("login");
      setMessage("Session expired.", "error");
    } else {
      throw new Error(data.error || "Server error");
    }
  } catch (err) {
    setMessage(err.message, "error");
    saveButton.disabled = false;
    saveButton.textContent = "Try Again";
  }
});
