# RecycleOldTech.com — Programmatic Email via PrivateEmail SMTP
## Cursor Implementation Prompt

---

## Overview

Create an Astro server-side API route that handles claim form submissions end-to-end: inserting to Supabase, notifying Adam via web3forms, and sending an automated confirmation email to the claimant from `hello@recycleoldtech.com` via PrivateEmail SMTP.

This replaces the current client-side form submission logic on `/claim` which POSTs directly to Supabase and web3forms from the browser. The new API route centralizes all three operations server-side.

The site runs on **Astro SSG deployed to Vercel**. This API route uses Astro's server endpoint feature (`output: 'hybrid'` or existing server config). Do not change the SSG configuration for any other pages — only this endpoint needs server-side rendering.

---

## Part 1: Install Dependencies

Install nodemailer and its types:

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

---

## Part 2: Create the API Route

Create a new file at `src/pages/api/submit-claim.ts`.

This endpoint accepts a POST request with the claim form data as JSON, performs three operations in order, and returns a JSON response.

```typescript
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  let data: Record<string, unknown>;

  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 1. Insert into Supabase business_claims ──────────────────────────

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY // Use service role — bypasses RLS
  );

  const claimRow = {
    business_name:   data.business_name,
    city:            data.city,
    state:           data.state,
    zip:             data.zip || null,
    address:         data.address || null,
    phone:           data.phone || null,
    website:         data.website || null,
    contact_name:    data.contact_name,
    contact_email:   data.contact_email,
    contact_phone:   data.contact_phone || null,
    tier:            data.tier || 'free',
    submission_type: data.submission_type || 'new',
    description:     data.description || null,
    accepted_items:  data.accepted_items || [],
    services_offered: data.services_offered || [],
    certifications:  data.certifications || [],
    hours:           data.hours || null,
    message:         data.message || null,
    notes: data.is_short_form
      ? 'Short form submission — follow up required'
      : null,
    status: 'pending',
  };

  const { error: supabaseError } = await supabase
    .from('business_claims')
    .insert(claimRow);

  if (supabaseError) {
    console.error('Supabase insert error:', supabaseError.message);
    // Don't block — still try to send emails even if DB insert fails
    // Log the error but continue
  }

  // ── 2. Notify Adam via web3forms ─────────────────────────────────────

  try {
    const formType = data.submission_type === 'update'
      ? 'Listing Update Request'
      : 'New Listing Claim';

    const web3formsPayload = {
      access_key: import.meta.env.WEB3FORMS_ACCESS_KEY,
      subject: `[RecycleOldTech] ${formType} — ${data.business_name} (${data.city}, ${data.state})`,
      from_name: data.contact_name,
      email: data.contact_email,
      business_name: data.business_name,
      location: `${data.city}, ${data.state}`,
      tier: data.tier,
      submission_type: data.submission_type,
      message: data.message || '(no message)',
      is_short_form: data.is_short_form ? 'Yes — follow up required' : 'No',
    };

    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(web3formsPayload),
    });
  } catch (err) {
    console.error('web3forms notification error:', err);
    // Non-blocking — continue to confirmation email
  }

  // ── 3. Send confirmation email to claimant ───────────────────────────

  try {
    const transporter = nodemailer.createTransport({
      host: 'mail.privateemail.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: import.meta.env.SMTP_USERNAME,
        pass: import.meta.env.SMTP_PASSWORD,
      },
    });

    const isUpdate = data.submission_type === 'update';
    const isPaid = data.tier === 'premium' || data.tier === 'featured';
    const tierLabel = data.tier === 'featured'
      ? 'Featured Partner ($30/mo)'
      : data.tier === 'premium'
      ? 'Verified Partner ($15/mo)'
      : 'Free Listing';

    const subject = isUpdate
      ? `We received your update request — RecycleOldTech.com`
      : `We received your listing claim — RecycleOldTech.com`;

    const textBody = `
Hi ${data.contact_name},

Thanks for reaching out about ${data.business_name}!

We received your ${isUpdate ? 'update request' : 'listing claim'} and will be in touch within 1 business day.

What you submitted:
  Business: ${data.business_name}
  Location: ${data.city}, ${data.state}
  Plan selected: ${tierLabel}

${isPaid ? `Since you selected a paid plan, we'll reach out to confirm your listing details and get billing set up. You won't be charged until we've connected.` : `Your free listing will be reviewed and published shortly.`}

In the meantime, you can view your current listing at:
https://www.recycleoldtech.com/states/${String(data.state).toLowerCase().replace(/\s+/g, '-')}

Questions? Just reply to this email.

Adam
RecycleOldTech.com
hello@recycleoldtech.com
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #166534; color: white; padding: 24px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .summary { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .summary table { width: 100%; border-collapse: collapse; }
    .summary td { padding: 6px 0; font-size: 14px; }
    .summary td:first-child { color: #6b7280; width: 40%; }
    .tier-badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .tier-premium { background: #dcfce7; color: #166534; }
    .tier-featured { background: #fef3c7; color: #92400e; }
    .tier-free { background: #f3f4f6; color: #6b7280; }
    .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; text-align: center; }
    a { color: #166534; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RecycleOldTech.com</h1>
    <p style="margin: 4px 0 0; opacity: 0.85; font-size: 14px;">Listing ${isUpdate ? 'Update Request' : 'Claim'} Received</p>
  </div>
  <div class="body">
    <p>Hi ${data.contact_name},</p>
    <p>Thanks for reaching out about <strong>${data.business_name}</strong>! We received your ${isUpdate ? 'update request' : 'listing claim'} and will be in touch within 1 business day.</p>

    <div class="summary">
      <table>
        <tr>
          <td>Business</td>
          <td><strong>${data.business_name}</strong></td>
        </tr>
        <tr>
          <td>Location</td>
          <td>${data.city}, ${data.state}</td>
        </tr>
        <tr>
          <td>Plan selected</td>
          <td>
            <span class="tier-badge tier-${data.tier}">${tierLabel}</span>
          </td>
        </tr>
      </table>
    </div>

    ${isPaid
      ? `<p>Since you selected a paid plan, we'll reach out to confirm your listing details and get billing set up. <strong>You won't be charged until we've connected.</strong></p>`
      : `<p>Your free listing will be reviewed and published shortly.</p>`
    }

    <p>Questions? Just reply to this email.</p>

    <p style="margin-top: 24px;">
      Adam<br>
      <a href="https://www.recycleoldtech.com">RecycleOldTech.com</a>
    </p>
  </div>
  <div class="footer">
    You're receiving this because you submitted a listing claim at recycleoldtech.com.
  </div>
</body>
</html>
    `.trim();

    await transporter.sendMail({
      from: '"RecycleOldTech" <hello@recycleoldtech.com>',
      to: String(data.contact_email),
      subject,
      text: textBody,
      html: htmlBody,
    });

  } catch (err) {
    console.error('Confirmation email error:', err);
    // Non-blocking — return success even if email fails
    // The Supabase record and web3forms notification already fired
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

---

## Part 3: Update the Claim Form Submission Logic

In `src/pages/claim.astro`, update the client-side form submission JavaScript.

**Currently** the form does two separate fetches: one to web3forms and one to Supabase REST API directly from the browser.

**Replace both** with a single fetch to the new API route:

```javascript
// Replace existing form submission handler with this
async function submitClaim(formData) {
  const payload = {
    // Business info
    business_name:    formData.get('business_name'),
    address:          formData.get('address') || null,
    city:             formData.get('city'),
    state:            formData.get('state'),
    zip:              formData.get('zip') || null,
    phone:            formData.get('phone') || null,
    website:          formData.get('website') || null,

    // Contact info
    contact_name:     formData.get('contact_name'),
    contact_email:    formData.get('contact_email'),
    contact_phone:    formData.get('contact_phone') || null,

    // Listing details
    accepted_items:   formData.getAll('accepted_items'),
    services_offered: formData.getAll('services_offered'),
    certifications:   formData.getAll('certifications'),
    hours:            formData.get('hours') || null,
    description:      formData.get('description') || null,

    // Plan and meta
    tier:             formData.get('tier') || 'free',
    submission_type:  formData.get('submission_type') || 'new',
    message:          formData.get('message') || null,
    is_short_form:    formData.get('is_short_form') === 'true',
  };

  const response = await fetch('/api/submit-claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Submission failed');
  }

  return response.json();
}
```

The short form (5-field interest form) should pass `is_short_form: true` in the payload. The full detail form should pass `is_short_form: false`.

Both forms use the same endpoint. The API route handles the `is_short_form` flag by setting the appropriate `notes` value in Supabase.

---

## Part 4: Environment Variables

Add these to your `.env` file and Vercel project settings:

```
SMTP_USERNAME=hello@recycleoldtech.com
SMTP_PASSWORD=your_privateemail_password_here
WEB3FORMS_ACCESS_KEY=your_existing_web3forms_key
```

`PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` should already exist in your environment. The API route uses `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) since it runs server-side and needs to bypass RLS for the insert.

---

## Part 5: Vercel Configuration

Since this is an SSG Astro site with a single server-side API route, confirm that `astro.config.mjs` has the Vercel adapter configured and `output` is set to `'hybrid'` (not `'static'`). If it is currently `'static'`, change it to `'hybrid'` — this allows individual pages/endpoints to opt into SSR while the rest of the site remains statically generated.

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'hybrid', // allows mixed SSG + server endpoints
  adapter: vercel(),
  // ... rest of existing config unchanged
});
```

The API route at `src/pages/api/submit-claim.ts` is automatically treated as a server endpoint. No other pages are affected.

---

## Error Handling Philosophy

The three operations (Supabase insert, web3forms notify, confirmation email) are intentionally non-blocking from each other. If Supabase fails, the emails still attempt to send. If the confirmation email fails, the user still sees a success state since their data was saved and Adam was notified.

Do not return an error to the user unless all three operations fail. Log errors to the console for Vercel function logs.

---

## Definition of Done

- [ ] `src/pages/api/submit-claim.ts` created and handles POST requests
- [ ] Inserts into `business_claims` using service role key (bypasses RLS)
- [ ] Notifies Adam via web3forms with submission type and short form flag
- [ ] Sends HTML confirmation email from `hello@recycleoldtech.com` via PrivateEmail SMTP
- [ ] Email content differs for new vs. update submissions
- [ ] Email content differs for free vs. paid tier selections
- [ ] Short form submissions set `notes = 'Short form submission — follow up required'`
- [ ] Claim form on `/claim` updated to POST to `/api/submit-claim` instead of calling Supabase and web3forms directly
- [ ] Both short form and full form use the same endpoint
- [ ] `is_short_form` flag passed correctly from each form
- [ ] `SMTP_USERNAME`, `SMTP_PASSWORD`, `WEB3FORMS_ACCESS_KEY` added to `.env` and Vercel env
- [ ] `astro.config.mjs` uses `output: 'hybrid'` with Vercel adapter
- [ ] Existing SSG behavior of all other pages is unchanged
- [ ] Tested locally with a real form submission — confirmation email arrives in inbox
