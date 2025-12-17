// popup.js

// DOM Elements
const saveView = document.getElementById("saveView");
const saveButton = document.getElementById("saveButton");
const messageEl = document.getElementById("message");
const previewContainer = document.getElementById("previewContainer");

// State
let currentSnapshot = null;
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// --- 1. THE "KICK" (Force iPad Size) ---
// We check SCREEN width (the device), because window.innerWidth starts small!
if (window.screen.width > 600) {
    document.body.style.width = "450px";
    document.documentElement.style.width = "450px";
}

// --- 2. Helper Functions ---
function setMessage(text, type = "info") {
  if (!messageEl) return;
  messageEl.textContent = text || "";
  messageEl.style.display = text ? "block" : "none";
  if (type === "error") messageEl.style.color = "#ef4444";
  else if (type === "success") messageEl.style.color = "#22c55e";
  else messageEl.style.color = "#6b7280";
}

// --- 3. Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and grab data in parallel
  const [isAuthenticated] = await Promise.all([
    checkAuth(),
    tryExtractData()
  ]);

  if (!isAuthenticated) {
    showLoginMessage();
  } else {
    if (saveView) saveView.style.display = "block";
  }
});

// --- 4. Auth & Login Logic ---
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

function showLoginMessage() {
  // We use the new CSS classes here instead of inline styles
  document.body.innerHTML = `
    <div class="sg-popup" style="display: flex; flex-direction: column; justify-content: center; height: 100vh;">
        <header class="sg-header">
            <div class="sg-monogram">SG</div>
            <h1 class="sg-title">Login Required</h1>
            <p class="sg-subtitle">Please log in to SarahGiggar.com to save items.</p>
        </header>
        <a href="https://sarahgiggar.com/login" target="_blank" class="sg-btn sg-btn-primary" style="text-decoration: none; text-align: center;">
           Go to Login
        </a>
    </div>
  `;
}

// --- 5. Data Extraction ---
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
    if (saveButton) setMessage("Please refresh the page.", "info");
  }
}

// --- 6. RENDER PREVIEW (Fixed: Brought back the "+4" Badge) ---
function renderPreview(data) {
  if (!previewContainer) return;
  
  previewContainer.classList.remove("sg-hidden");
  previewContainer.innerHTML = '';

  // 1. Create a Wrapper for Image + Badge (So they stick together)
  const imgContainer = document.createElement("div");
  imgContainer.style.position = "relative";
  imgContainer.style.width = "80px";
  imgContainer.style.height = "80px";
  imgContainer.style.flexShrink = "0";

  // 2. The Image
  const img = document.createElement("img");
  img.src = data.imageBase64 || data.imageUrl || "";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.borderRadius = "6px";
  img.style.display = "block";
  imgContainer.appendChild(img);

  // 3. The Badge (Only if we have extra images)
  const galleryCount = (data.galleryBase64 || []).length;
  if (galleryCount > 0) {
      const badge = document.createElement("div");
      badge.textContent = `+${galleryCount}`;
      badge.style.position = "absolute";
      badge.style.bottom = "4px";
      badge.style.right = "4px";
      badge.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
      badge.style.color = "#ffffff";
      badge.style.fontSize = "10px";
      badge.style.fontWeight = "bold";
      badge.style.padding = "2px 6px";
      badge.style.borderRadius = "4px";
      badge.style.pointerEvents = "none"; // Let clicks pass through to image
      imgContainer.appendChild(badge);
  }

  // Add the wrapper to the main container
  previewContainer.appendChild(imgContainer);

  // 4. Meta/Info Container (Right Side)
  const metaDiv = document.createElement("div");
  metaDiv.style.flex = "1";
  metaDiv.style.display = "flex";
  metaDiv.style.flexDirection = "column";
  metaDiv.style.overflow = "hidden";

  // Brand
  const brandEl = document.createElement("div");
  brandEl.textContent = (data.brand || data.retailerDomain || "Unknown").toUpperCase();
  brandEl.style.fontSize = "11px";
  brandEl.style.fontWeight = "700";
  brandEl.style.color = "#9ca3af";
  brandEl.style.marginBottom = "4px";
  metaDiv.appendChild(brandEl);

  // Title
  const titleEl = document.createElement("div");
  titleEl.textContent = data.name || data.title || "Unknown Item";
  titleEl.style.fontSize = "14px";
  titleEl.style.fontWeight = "600";
  titleEl.style.color = "#111827";
  titleEl.style.marginBottom = "4px";
  titleEl.style.whiteSpace = "nowrap";
  titleEl.style.overflow = "hidden";
  titleEl.style.textOverflow = "ellipsis";
  metaDiv.appendChild(titleEl);

  // Price
  if (data.price) {
    const priceEl = document.createElement("div");
    priceEl.textContent = data.price;
    priceEl.style.fontSize = "14px";
    priceEl.style.color = "#4b5563";
    metaDiv.appendChild(priceEl);
  }

  previewContainer.appendChild(metaDiv);

  if (saveButton) saveButton.textContent = "Save to Wardrobe";
}

// --- 7. Save Logic ---
if (saveButton) {
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
          showLoginMessage();
        } else {
          throw new Error(data.error || "Server error");
        }
      } catch (err) {
        setMessage(err.message, "error");
        saveButton.disabled = false;
        saveButton.textContent = "Try Again";
      }
    });
}
