import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict',
    },
  });
};
