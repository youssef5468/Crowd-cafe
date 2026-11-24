export function runtimeConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === 'production';
  const publicUrl =
    env.PUBLIC_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  const origins = (env.WEB_ORIGIN || publicUrl || 'http://localhost:5184,http://127.0.0.1:5184')
    .split(',')
    .map((s) => s.trim());
  if (env.VERCEL_URL) origins.push(`https://${env.VERCEL_URL}`);
  const loopback = (value: string) => {
    try {
      return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname);
    } catch {
      return false;
    }
  };
  const localPreview =
    env.LOCAL_PRODUCTION_PREVIEW === '1' &&
    !env.VERCEL &&
    !!publicUrl &&
    loopback(publicUrl) &&
    origins.every(loopback);
  if (production && !localPreview) {
    if (!publicUrl || new URL(publicUrl).protocol !== 'https:' || loopback(publicUrl))
      throw new Error('Production PUBLIC_URL must be a public HTTPS URL');
    if (
      origins.some((origin) => {
        try {
          const url = new URL(origin);
          return url.protocol !== 'https:' || url.origin !== origin || loopback(origin);
        } catch {
          return true;
        }
      })
    )
      throw new Error('Production WEB_ORIGIN must contain exact HTTPS origins');
    if (
      !env.JWT_SECRET ||
      env.JWT_SECRET.length < 32 ||
      /replace|change-me|GENERATE_/i.test(env.JWT_SECRET)
    )
      throw new Error('Set a strong production JWT_SECRET');
    const database = new URL(env.DATABASE_URL || '');
    if (loopback(database.href)) throw new Error('Production needs a hosted PostgreSQL database');
    if (
      !['require', 'verify-ca', 'verify-full'].includes(database.searchParams.get('sslmode') || '')
    )
      throw new Error('Production PostgreSQL must use SSL');
    if (env.VERCEL && env.UPLOAD_STORAGE !== 'cloudinary')
      throw new Error('Vercel requires UPLOAD_STORAGE=cloudinary; local disk is not persistent');
  }
  return { production, publicUrl, origins };
}
