// content.js

function extractSnapshot() {
  const doc = document;
  const url = location.href;
  const retailerDomain = location.hostname.replace(/^www\./, "");

  // Meta tags
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.content || "";
  const ogDesc =
    doc.querySelector('meta[property="og:description"]')?.content || "";
  const ogImage =
    doc.querySelector('meta[property="og:image"]')?.content || "";

  const pageTitle =
    (ogTitle || doc.querySelector("title")?.textContent || "").trim();

  // Very rough product title heuristic – can refine later
  const h1 = doc.querySelector("h1");
  const productTitle = (h1?.textContent || pageTitle).trim() || undefined;

  // Brand heuristic: often in a strong/em, or first breadcrumb
  let brand = undefined;
  const brandCandidates = [
    doc.querySelector('[data-testid*="brand"]'),
    doc.querySelector('meta[name="brand"]'),
    doc.querySelector("h2"), // on some sites brand is h2 above title
  ].filter(Boolean);

  if (brandCandidates.length) {
    brand = brandCandidates[0].textContent?.trim() || undefined;
  }

  // JSON-LD Product schema for image, brand, price
  let ldImage = null;
  let priceText = undefined;
  let currency = undefined;

  const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  ldScripts.forEach((el) => {
    if (ldImage && priceText && brand && currency) return;
    try {
      const json = JSON.parse(el.textContent || "null");
      const nodes = Array.isArray(json) ? json : [json];

      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node["@graph"])) {
          nodes.push(...node["@graph"]);
        }

        if (node["@type"] === "Product") {
          let img = node.image || node.imageUrl || node.imageURL;
          if (Array.isArray(img)) img = img[0];
          if (typeof img === "string" && !ldImage) ldImage = img;

          if (!brand && typeof node.brand === "string") {
            brand = node.brand;
          } else if (!brand && node.brand && typeof node.brand.name === "string") {
            brand = node.brand.name;
          }

          if (!priceText && node.offers && typeof node.offers.price === "string") {
            priceText = node.offers.price;
          }
          if (!currency && node.offers && typeof node.offers.priceCurrency === "string") {
            currency = node.offers.priceCurrency;
          }
        }
      }
    } catch {
      // ignore bad ld+json
    }
  });

  // Fallback: pick a "largest" <img>
  let fallbackImage = null;
  let bestScore = 0;
  const allImages = [];
  doc.querySelectorAll("img").forEach((img) => {
    const rawSrc =
      img.getAttribute("src") ||
      img.getAttribute("data-src") ||
      img.getAttribute("data-original");
    if (!rawSrc) return;

    allImages.push(new URL(rawSrc, url).toString());

    const w = parseInt(img.getAttribute("width") || "0", 10) || 0;
    const h = parseInt(img.getAttribute("height") || "0", 10) || 0;
    let score = w * h;

    const alt = (img.getAttribute("alt") || "").toLowerCase();
    if (alt.includes("logo") || alt.includes("icon")) score *= 0.2;

    if (score > bestScore) {
      bestScore = score;
      fallbackImage = new URL(rawSrc, url).toString();
    }
  });

  const primaryImage =
    (ldImage && new URL(ldImage, url).toString()) ||
    (ogImage && new URL(ogImage, url).toString()) ||
    fallbackImage ||
    null;

  // Optional: grab some description text to help AI
  let contextText = "";
  const descEl =
    doc.querySelector('[data-testid*="description"]') ||
    doc.querySelector("section[aria-label*=Description]") ||
    doc.querySelector("div[role=main] p");
  if (descEl) {
    contextText = descEl.textContent?.trim().slice(0, 2000) || "";
  }

  return {
    url,
    retailerDomain,
    pageTitle,
    productTitle,
    imageUrl: primaryImage || undefined,
    imageUrls: primaryImage ? [primaryImage, ...allImages].slice(0, 6) : allImages.slice(0, 6),
    priceText,
    currency,
    brand,
    retailerName: undefined, // you can infer from retailerDomain on the server
    meta: {
      ogTitle: ogTitle || undefined,
      ogDescription: ogDesc || undefined,
      ogImage: ogImage || undefined,
    },
    contextText: contextText || undefined,
  };
}

// Listen for popup requests
browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "extractProductSnapshot") {
    const snapshot = extractSnapshot();
    return Promise.resolve(snapshot);
  }
});
