export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body && !isForm && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}