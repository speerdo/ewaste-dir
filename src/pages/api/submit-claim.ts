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
    contact_name:    data.contact_name || null,
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
  }

  // ── 2. Notify Adam via web3forms ─────────────────────────────────────

  try {
    const formType = data.submission_type === 'update'
      ? 'Listing Update Request'
      : 'New Listing Claim';

    const web3formsPayload = {
      access_key: import.meta.env.WEB3FORMS_ACCESS_KEY,
      subject: `[RecycleOldTech] ${formType} — ${data.business_name} (${data.city}, ${data.state})`,
      from_name: data.contact_name || data.business_name,
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

    const greeting = data.contact_name || data.business_name || 'there';

    const subject = isUpdate
      ? `We received your update request — RecycleOldTech.com`
      : `We received your listing claim — RecycleOldTech.com`;

    const textBody = `
Hi ${greeting},

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
    <p>Hi ${greeting},</p>
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
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
