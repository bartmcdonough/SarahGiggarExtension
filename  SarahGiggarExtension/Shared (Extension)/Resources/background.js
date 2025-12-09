// background.js
// Background/service worker logic for saving URLs to Sarah's wardrobe.

const API_ENDPOINT = "https://sarahgiggar.com/api/admin/wardrobe-library/quick-add";

// Cross-browser helpers
const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);

async function postQuickAdd(url) {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // include cookies for admin auth
      body: JSON.stringify({ url })
    });

    const contentType = res.headers.get("content-type") || "";
    const isJSON = contentType.includes("application/json");
    const body = isJSON ? await res.json().catch(() => null) : await res.text().catch(() => "");

    if (!res.ok) {
      const errorMsg = body && body.error
        ? body.error
        : (typeof body === "string" && body.length ? body : "Failed to quick-add");
      console.error("Quick add failed:", res.status, errorMsg);
      return { ok: false, status: res.status, error: errorMsg };
    }

    return { ok: true, status: res.status, data: body };
  } catch (e) {
    console.error("Quick add network error:", e);
    return { ok: false, error: String(e) };
  }
}

// Handle messages from popup or other parts
if (ext && ext.runtime && typeof ext.runtime.onMessage !== "undefined") {
  ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "quickAdd" && typeof message.url === "string") {
      postQuickAdd(message.url).then(sendResponse);
      return true; // keep message channel open
    }
    // Not handled
    return false;
  });
}

// Context menu to save current page or link
if (ext && ext.contextMenus && typeof ext.contextMenus.create === "function") {
  try {
    if (ext.contextMenus.removeAll) {
      ext.contextMenus.removeAll(() => {
        // cleaned existing menus (if any)
      });
    }
    ext.contextMenus.create({
      id: "quickAddPage",
      title: "Save to Sarah’s wardrobe",
      contexts: ["page", "link"]
    });
  } catch (e) {
    // Ignore errors if the menu already exists (MV3 service worker reloads)
  }

  if (typeof ext.contextMenus.onClicked !== "undefined") {
    ext.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === "quickAddPage") {
        const url = info.linkUrl || info.pageUrl || (tab && tab.url) || "";
        if (url) {
          postQuickAdd(url);
        }
      }
    });
  }
}

// Commands (keyboard shortcuts). Define a command named "quickAdd" in manifest.json
if (ext && ext.commands && typeof ext.commands.onCommand !== "undefined") {
  ext.commands.onCommand.addListener(async (command) => {
    if (command === "quickAdd") {
      try {
        const queryTabs = (queryInfo) =>
          ext.tabs && typeof ext.tabs.query === "function"
            ? (ext.tabs.query.length === 1
                ? ext.tabs.query(queryInfo)
                : new Promise((resolve) => ext.tabs.query(queryInfo, resolve)))
            : Promise.resolve([]);
        const [tab] = await queryTabs({ active: true, currentWindow: true });
        const url = tab && tab.url;
        if (url) {
          await postQuickAdd(url);
        }
      } catch (e) {
        console.error("quickAdd command failed:", e);
      }
    }
  });
}
