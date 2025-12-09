// popup.js

const loginView = document.getElementById("loginView");
const saveView = document.getElementById("saveView");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginButton = document.getElementById("loginButton");
const saveButton = document.getElementById("saveButton");
const messageEl = document.getElementById("message");

function setMessage(text, isError = false) {
  messageEl.textContent = text || "";
  messageEl.style.color = isError ? "red" : "inherit";
}

function showLoggedIn() {
  loginView.style.display = "none";
  saveView.style.display = "block";
}

function showLoggedOut() {
  loginView.style.display = "block";
  saveView.style.display = "none";
}

// --- CHECK IF ALREADY LOGGED IN (same as /api/auth/me) ---

async function checkAuth() {
  try {
    const res = await fetch("https://sarahgiggar.com/api/auth/me", {
      method: "GET",
      credentials: "include"
    });

    if (res.ok) {
      showLoggedIn();
      setMessage("");
    } else {
      showLoggedOut();
      setMessage("Please sign in to Sarah’s portal.", true);
    }
  } catch (err) {
    console.error("Auth check error:", err);
    showLoggedOut();
    setMessage("Unable to reach sarahgiggar.com.", true);
  }
}

// initial check when popup opens
checkAuth();

// --- LOGIN USING THE SAME FLOW AS useAuth().login ---

loginButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    setMessage("Please enter email and password.", true);
    return;
  }

  setMessage("Signing in...");

  try {
    const res = await fetch("https://sarahgiggar.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      // Give the browser a moment to process Set-Cookie, mirroring your React code
      await new Promise(resolve => setTimeout(resolve, 150));
      await checkAuth();
      if (saveView.style.display === "block") {
        setMessage("Signed in. You can now save pages.");
      } else {
        setMessage("Sign-in did not complete correctly.", true);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Login failed.", true);
    }
  } catch (err) {
    console.error("Login error:", err);
    setMessage("Error talking to sarahgiggar.com.", true);
  }
});

saveButton.addEventListener("click", async () => {
  setMessage("Saving...", null);

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      setMessage("No active tab found.", "error");
      return;
    }

    // Ask content script for a snapshot
    const snapshot = await browser.tabs.sendMessage(tab.id, {
      type: "extractProductSnapshot"
    });

    if (!snapshot || !snapshot.url) {
      setMessage("Could not read product details from this page.", "error");
      return;
    }

    const res = await fetch(
      "https://sarahgiggar.com/api/admin/wardrobe-library/quick-add",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ snapshot })
      }
    );

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {}

    if (res.status === 401) {
      showLoggedOut();
      setMessage("Session expired. Please sign in again.", "error");
      return;
    }

    if (!res.ok || data.success === false) {
      const msg = data.error || `Could not save item (HTTP ${res.status}).`;
      setMessage(msg, "error");
      return;
    }

    const name = data.item?.name || snapshot.productTitle || "item";
    setMessage(`Saved “${name}” to Sarah’s wardrobe ✨`, "success");
    setTimeout(() => window.close(), 1000);
  } catch (err) {
    console.error("Save error:", err);
    setMessage("Error talking to sarahgiggar.com.", "error");
  }
});
