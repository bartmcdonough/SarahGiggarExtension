/**
 * content.js
 * FINAL VERSION (Gilt Price Fix)
 * 1. Nuclear Price Search: Walks text nodes if selectors fail.
 * 2. Gilt Specifics: support for 'product-prices__price' and discount structures.
 * 3. Robust Brand & Image logic retained.
 */

// ---------------------------------------------------------
// 1. HELPER FUNCTIONS
// ---------------------------------------------------------

async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return null;
  }
}

function cleanPrice(text) {
  if (!text) return null;
  
  // Regex: matches $128, $128.00, 1,200.00
  const match = text.match(/[\$£€¥]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
  
  if (match) {
    let rawNum = parseFloat(match[1].replace(/,/g, ''));
    // Filter out huge numbers (concatenation bugs) and tiny numbers (likely shipping or installments)
    if (rawNum > 10000) return null;
    if (rawNum < 1) return null; // Ignore $0.00 placeholders
    
    return match[0].trim();
  }
  return null;
}

function cleanBrand(text) {
  if (!text) return null;
  let clean = text.trim();
  clean = clean.replace(/^@/, '');
  clean = clean.replace(/^www\./i, '').replace(/\.com$/i, '').replace(/\.net$/i, '');
  if ((clean.includes('-') || clean.includes('_')) && !clean.includes(' ')) {
    clean = clean.replace(/[-_]/g, ' ');
  }
  clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
  if (clean === clean.toLowerCase() || clean === clean.toUpperCase()) {
    clean = clean.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
  return clean.trim();
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));


// ---------------------------------------------------------
// 2. MAIN SCANNING LOGIC
// ---------------------------------------------------------

async function scanPage() {
  const doc = document;
  const url = location.href;
  const retailerDomain = location.hostname.replace(/^www\./, "");

  let ldData = { images: [] };
  let candidateImages = [];

  // --- A. JSON-LD Extraction ---
  const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  ldScripts.forEach((el) => {
    try {
      const json = JSON.parse(el.textContent);
      const nodes = Array.isArray(json) ? json : [json];
      const flattened = nodes.flatMap(n => n["@graph"] || n);
      const product = flattened.find(n => n["@type"] === "Product");

      if (product) {
        if (product.name) ldData.name = product.name;
        if (product.brand) ldData.brand = (typeof product.brand === 'string') ? product.brand : product.brand.name;
        const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        if (offer && offer.price) ldData.price = offer.price;
        let imgs = product.image || product.imageUrl;
        if (imgs) {
          if (!Array.isArray(imgs)) imgs = [imgs];
          imgs.forEach(img => {
            const src = (typeof img === "object") ? img.url : img;
            if (src) candidateImages.push({ url: src, score: 2000 });
          });
        }
      }
    } catch (e) { }
  });

  // --- B. Meta Tags ---
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.content;
  const ogImage = doc.querySelector('meta[property="og:image"]')?.content;
  const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.content;
  const metaBrand = doc.querySelector('meta[property="product:brand"]')?.content ||
                    doc.querySelector('meta[name="twitter:site"]')?.content;
  const ogPrice = doc.querySelector('meta[property="product:price:amount"]')?.content ||
                  doc.querySelector('meta[property="og:price:amount"]')?.content;

  if (ogImage) candidateImages.push({ url: ogImage, score: 1500 });
  if (ogPrice) ldData.metaPrice = ogPrice;


  // --- C. Visual DOM Scraper ---
  doc.querySelectorAll("img").forEach(img => {
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;
    if (width < 100 || height < 100) return;

    let score = width * height;
    const identifyer = (img.className + img.alt + img.src).toLowerCase();
    
    if (identifyer.includes("main") || identifyer.includes("primary") || identifyer.includes("product")) score *= 1.5;
    if (identifyer.includes("zoom") || identifyer.includes("full")) score *= 1.2;
    if (identifyer.includes("swatch") || identifyer.includes("thumb")) score *= 0.5;

    const src = img.currentSrc || img.src || img.dataset.src;
    if (src) candidateImages.push({ url: src, score: score });
  });

  // --- D. SYNTHESIZE DATA ---

  // 1. NAME
  const h1 = doc.querySelector("h1")?.textContent?.trim();
  let name = ldData.name || h1 || ogTitle || doc.title;
  
  // 2. BRAND
  let rawBrand = ldData.brand || ogSiteName || metaBrand || retailerDomain;
  let finalBrand = cleanBrand(rawBrand);
  
  // 3. PRICE (The Nuclear Fix)
  let rawPrice = ldData.price || ldData.metaPrice;
  
  if (!rawPrice) {
     const priceSelectors = [
       '[itemprop="price"]',
       '[class*="price"]', '[id*="price"]',
       '[class*="sale"]', '[class*="amount"]',
       '[data-element="product-price"]',
       '.money', '.current-price',
       '.product-prices__price' // Gilt Specific
     ];

     // Strategy 1: Selectors
     searchLoop:
     for (const sel of priceSelectors) {
       const elements = doc.querySelectorAll(sel);
       for (const el of elements) {
         // Ignore "strikethrough" prices (MSRP)
         if (el.tagName === 'S' || el.style.textDecoration === 'line-through') continue;
         
         const cleaned = cleanPrice(el.innerText || el.textContent);
         if (cleaned) {
           rawPrice = cleaned;
           break searchLoop;
         }
       }
     }

     // Strategy 2: Nuclear Text Walker (If Selectors Fail)
     if (!rawPrice) {
        // Look in the main product container or body
        const container = doc.querySelector('main') || doc.querySelector('[role="main"]') || doc.body;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let node;
        while(node = walker.nextNode()) {
          const text = node.textContent.trim();
          // Look for standalone price: "$129.99"
          if (/^[\$£€¥]\s*\d{1,3}(,\d{3})*(\.\d{2})?$/.test(text)) {
             rawPrice = text;
             break; // Found it!
          }
        }
     }
  }

  let finalPrice = cleanPrice(String(rawPrice));
  if (finalPrice && !finalPrice.match(/[\$£€¥]/)) {
    finalPrice = `$${finalPrice}`;
  }

  // 4. IMAGE SELECTION
  candidateImages.sort((a, b) => b.score - a.score);
  const uniqueImages = [];
  const seenUrls = new Set();
  
  candidateImages.forEach(item => {
    try {
      const absUrl = new URL(item.url, url).toString();
      if (!seenUrls.has(absUrl) && !absUrl.includes('.svg') && !absUrl.startsWith('data:')) {
        seenUrls.add(absUrl);
        uniqueImages.push(absUrl);
      }
    } catch (e) {}
  });

  if (!name || uniqueImages.length === 0) return null;

  return {
    url,
    retailerDomain,
    name,
    brand: finalBrand,
    price: finalPrice,
    imageUrls: uniqueImages.slice(0, 5)
  };
}


// ---------------------------------------------------------
// 3. RETRY ORCHESTRATOR
// ---------------------------------------------------------

async function extractSnapshotWithRetry() {
  let attempts = 0;
  let result = null;

  while (attempts < 3) {
    result = await scanPage();
    if (result) break;
    await delay(500 + (attempts * 200));
    attempts++;
  }

  if (!result) {
    result = {
      url: location.href,
      retailerDomain: location.hostname,
      name: document.title || "New Item",
      brand: cleanBrand(location.hostname),
      price: null,
      imageUrls: []
    };
  }

  const mainImageBase64 = await fetchImageAsBase64(result.imageUrls[0]);
  const galleryPromises = result.imageUrls.slice(1).map(u => fetchImageAsBase64(u));
  const galleryBase64 = (await Promise.all(galleryPromises)).filter(b => b !== null);

  return {
    ...result,
    imageUrl: result.imageUrls[0],
    imageBase64: mainImageBase64,
    galleryBase64: galleryBase64
  };
}


// ---------------------------------------------------------
// 4. LISTENER
// ---------------------------------------------------------
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

browserAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "extractProductSnapshot") {
    extractSnapshotWithRetry().then(payload => sendResponse(payload));
    return true;
  }
});
