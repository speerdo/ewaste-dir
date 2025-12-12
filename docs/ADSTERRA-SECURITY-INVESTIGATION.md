# Adsterra Ad Network Security Investigation

**Date:** December 4, 2025  
**Investigated By:** Development Team  
**Status:** Critical Security Issue Identified

---

## Executive Summary

Our Adsterra banner ad implementation is loading malicious third-party scripts that hijack user clicks and redirect them to suspicious domains. This affects user experience, damages trust, and could harm SEO rankings.

**Recommendation:** Remove all Adsterra ad scripts and migrate to a reputable ad network (Google AdSense, Media.net, or Ezoic).

---

## Issue Description

When users click anywhere on blog pages (and likely other pages), they are redirected to malicious URLs in new tabs. Example redirect URL:

```
https://skinnycrawlinglax.com/api/users?token=...&kw=["the","hidden","environmental","cost","of","holiday","tech","gifts"...]&refer=https://www.recycleoldtech.com/blog/holiday-tech-gifts
```

This URL contains:

- Extracted keywords from our page content
- Our page URL as the referrer
- User tracking data (screen resolution, timezone, etc.)

---

## Root Cause Analysis

### The Banner Ad Script

Our `BannerAd.astro` component loads:

```html
<script src="//www.highperformanceformat.com/20016c80aa06a20da138e161bee80b71/invoke.js"></script>
```

### Scripts Loaded by the Banner Ad

Network analysis of `https://www.recycleoldtech.com/blog/holiday-tech-gifts` revealed the banner ad loads a chain of malicious scripts:

| Script URL                                | Type               | Purpose                            |
| ----------------------------------------- | ------------------ | ---------------------------------- |
| `highperformanceformat.com/.../invoke.js` | Primary            | Our banner ad script               |
| `wayfarerorthodox.com/1b/50/e5/...js`     | Secondary          | Unknown/Tracking                   |
| `wayfarerorthodox.com/53/c4/4b/...js`     | Secondary          | Unknown/Tracking                   |
| `wayfarerorthodox.com/1e/aa/5a/...js`     | Secondary          | Unknown/Tracking                   |
| `wayfarerorthodox.com/watch.*.js`         | **Click Hijacker** | Captures clicks, extracts keywords |
| `protrafficinspector.com/stats`           | Tracking           | Traffic analysis                   |
| `weirdopt.com/ad/advertisers.js`          | Ad Injection       | Additional ad loading              |
| `preferencenail.com/sfp.js`               | Fingerprinting     | Browser fingerprinting             |
| `realizationnewestfangs.com/pixel/*`      | Tracking           | Pixel tracking                     |
| `flushpersist.com/pxf.gif`                | Tracking           | Pixel tracking                     |
| `cdn.storageimagedisplay.com/*`           | Content            | Ad content delivery                |

### The Click Hijacker

The `wayfarerorthodox.com/watch.*.js` script is the primary culprit:

```
GET wayfarerorthodox.com/watch.1269389299729.js?
    key=20016c80aa06a20da138e161bee80b71    <-- Same key as our banner ad
    &kw=["the","hidden","environmental","cost","of","holiday","tech","gifts",...]
    &refer=https://www.recycleoldtech.com/blog/holiday-tech-gifts
    &tz=-5
    &dev=r
    &res=14.31
```

This script:

1. Extracts keywords from page content
2. Captures the page URL
3. Injects invisible click handlers across the entire page
4. Redirects random clicks to `skinnycrawlinglax.com` or similar domains

---

## Affected Files

### Currently Active (Causing Issues)

| File                                    | Status     | Notes                                            |
| --------------------------------------- | ---------- | ------------------------------------------------ |
| `src/components/BannerAd.astro`         | **ACTIVE** | Uses `highperformanceformat.com` - **MALICIOUS** |
| `src/layouts/Layout.astro`              | **ACTIVE** | Imports and renders BannerAd                     |
| `src/layouts/BlogPost.astro`            | **ACTIVE** | Imports and renders BannerAd                     |
| `src/layouts/StateLayout.astro`         | **ACTIVE** | Imports and renders BannerAd                     |
| `src/pages/states/[state]/[city].astro` | **ACTIVE** | Imports and renders BannerAd                     |

### Previously Removed

| File                                        | Status      | Notes                                          |
| ------------------------------------------- | ----------- | ---------------------------------------------- |
| `src/components/AdsterraNativeBanner.astro` | **DELETED** | Used `effectivegatecpm.com`                    |
| Social Bar script in Layout.astro           | **REMOVED** | Used `effectivegatecpm.com` (commit `34e7aec`) |

---

## Adsterra Domains Identified

All of these domains are associated with Adsterra's ad network:

### Primary Ad Delivery

- `highperformanceformat.com` - Banner ad delivery
- `effectivegatecpm.com` - Social bar / native ad delivery (removed)

### Tracking & Click Hijacking Network

- `wayfarerorthodox.com` - Click hijacking scripts
- `skinnycrawlinglax.com` - Redirect destination
- `protrafficinspector.com` - Traffic tracking
- `weirdopt.com` - Ad injection
- `preferencenail.com` - Browser fingerprinting
- `realizationnewestfangs.com` - Pixel tracking
- `flushpersist.com` - Pixel tracking
- `cdn.storageimagedisplay.com` - Content delivery

---

## Impact Assessment

### User Experience

- ❌ Random clicks open unwanted tabs
- ❌ Users redirected to suspicious/spammy domains
- ❌ Damages trust in our website
- ❌ Potential malware exposure for users

### SEO Impact

- ❌ Google may penalize sites with deceptive redirects
- ❌ Increased bounce rate from frustrated users
- ❌ Core Web Vitals affected by additional script loading

### Legal/Compliance

- ⚠️ Potential GDPR violations (fingerprinting without consent)
- ⚠️ User data being sent to third parties without disclosure
- ⚠️ Could be considered deceptive advertising

---

## Recommended Actions

### Immediate (Today)

1. **Remove BannerAd component** from all layouts:

   - `src/layouts/Layout.astro`
   - `src/layouts/BlogPost.astro`
   - `src/layouts/StateLayout.astro`
   - `src/pages/states/[state]/[city].astro`

2. **Delete the BannerAd component**:

   - `src/components/BannerAd.astro`

3. **Redeploy the site**

### Short-term (This Week)

4. **Apply to Google AdSense** or alternative ad network:

   - Google AdSense (most reputable)
   - Media.net (Yahoo/Bing network)
   - Ezoic (good for content sites)
   - Carbon Ads (developer-focused, ethical)

5. **Implement new ads** with proper review of loaded scripts

### Long-term

6. **Implement Content Security Policy (CSP)** headers to prevent unauthorized script loading

7. **Set up monitoring** for third-party scripts on the site

---

## Code Changes Required

### To Remove All Adsterra Ads

```bash
# Delete the BannerAd component
rm src/components/BannerAd.astro

# Edit these files to remove BannerAd imports and usage:
# - src/layouts/Layout.astro
# - src/layouts/BlogPost.astro
# - src/layouts/StateLayout.astro
# - src/pages/states/[state]/[city].astro
```

### Layout.astro Changes

Remove:

```astro
import BannerAd from '../components/BannerAd.astro';
```

Remove:

```astro
showBanner?: boolean;
```

Remove:

```astro
{showBanner && <BannerAd />}
```

---

## Alternative Ad Networks

| Network            | Pros                                    | Cons                        | Application                                      |
| ------------------ | --------------------------------------- | --------------------------- | ------------------------------------------------ |
| **Google AdSense** | Most trusted, high fill rate, good RPM  | Strict approval process     | [adsense.google.com](https://adsense.google.com) |
| **Media.net**      | Yahoo/Bing network, contextual ads      | Lower RPM than AdSense      | [media.net](https://www.media.net)               |
| **Ezoic**          | AI optimization, good for content sites | Requires 10k monthly visits | [ezoic.com](https://www.ezoic.com)               |
| **Carbon Ads**     | Ethical, developer-focused              | Limited inventory           | [carbonads.net](https://www.carbonads.net)       |
| **Mediavine**      | High RPM, quality ads                   | Requires 50k sessions/month | [mediavine.com](https://www.mediavine.com)       |

---

## Conclusion

The Adsterra ad network, despite marketing itself as legitimate, employs aggressive and deceptive practices that harm our users and our reputation. Both their "Social Bar" format and their "Banner" format load malicious click-hijacking scripts.

**We strongly recommend completely removing all Adsterra ads and migrating to Google AdSense or another reputable network.**

---

## Appendix: Full Network Request Log

<details>
<summary>Click to expand full network log from browser inspection</summary>

```
1. https://www.recycleoldtech.com/blog/holiday-tech-gifts (200)
2. https://www.recycleoldtech.com/assets/_slug_.DG29znfM.css (200)
3. https://analytics.ahrefs.com/analytics.js (200)
4. https://www.googletagmanager.com/gtag/js?id=G-3GBQV8F6PX (200)
5. https://www.highperformanceformat.com/20016c80aa06a20da138e161bee80b71/invoke.js (200)
6. https://www.recycleoldtech.com/_vercel/insights/script.js (200)
7. https://wayfarerorthodox.com/1b/50/e5/1b50e57a5911fd0a5b46962ab48ca22b.js (200)
8. https://protrafficinspector.com/stats (200)
9. https://wayfarerorthodox.com/53/c4/4b/53c44b312d6c8764f5dc8429be8a4e6f.js (200)
10. https://wayfarerorthodox.com/1e/aa/5a/1eaa5aa128c3b67f83f1021ba7df3f99.js (200)
11. https://wayfarerorthodox.com/watch.1269389299729.js?key=...&kw=[...]&refer=... (200)
12. https://weirdopt.com/ad/advertisers.js (200)
13. https://realizationnewestfangs.com/pixel/purst?... (200)
14. https://preferencenail.com/sfp.js (200)
15. https://cdn.storageimagedisplay.com/cti/18/83/64/...jpg (200)
16. https://flushpersist.com/pxf.gif?... (200)
17. https://wayfarerorthodox.com/sbar.json?key=...&uuid=... (200)
```

</details>

---

_Document created: December 4, 2025_
