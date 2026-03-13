function show(platform, enabled, useSettingsInsteadOfPreferences) {
    // 1. Get the clean name injected by Swift (or fallback)
    const appName = window.APP_DISPLAY_NAME || document.title || "Sarah's Wardrobe";

    // 2. Set the platform class on the body (so CSS can do its job)
    document.body.classList.add(`platform-${platform}`);

    // 3. Update the text dynamically based on the platform
    // We target the generic .state-on / .state-off classes directly
    if (platform === 'ios') {
        const onDiv = document.querySelector('.state-on');
        const offDiv = document.querySelector('.state-off');
        const unknownDiv = document.querySelector('.state-unknown');

        if (onDiv) onDiv.innerText = `${appName} is currently on. You can turn it off in Settings.`;
        if (offDiv) offDiv.innerText = `${appName} is currently off. You can turn it on in Settings.`;
        if (unknownDiv) unknownDiv.innerText = `You can turn on ${appName} in Settings.`;
    }
    else if (useSettingsInsteadOfPreferences) {
        // Mac specific logic (already in your script, but cleaned up here)
        const onDiv = document.querySelector('.state-on');
        const offDiv = document.querySelector('.state-off');
        const unknownDiv = document.querySelector('.state-unknown');
        const openPrefBtn = document.querySelector('.open-preferences');

        if (onDiv) onDiv.innerText = `${appName}’s extension is currently on. You can turn it off in Safari Settings.`;
        if (offDiv) offDiv.innerText = `${appName}’s extension is currently off. You can turn it on in Safari Settings.`;
        if (unknownDiv) unknownDiv.innerText = `You can turn on ${appName} in Safari Settings.`;
        if (openPrefBtn) openPrefBtn.innerText = "Quit and Open Safari Settings…";
    }

    // 4. Toggle visibility
    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);

