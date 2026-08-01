/**
 * Production boot-time env validation. Called from server.ts before the server
 * listens so a missing/known-insecure critical secret aborts startup.
 */

type EnvCheck = {
  name: string;
  read: () => string | null;
  rejectIfEquals?: string[];
  prodOnly?: boolean;
};

const checks: EnvCheck[] = [
  {
    name: 'CHAPA_SECRET_KEY',
    read: () => process.env.CHAPA_SECRET_KEY?.trim() || null,
    rejectIfEquals: ['CHASECK_TEST-g3pDAuHMdioBphvmSN0ETveYu5KPaDD5'],
    prodOnly: true,
  },
  {
    name: 'CHAPA_WEBHOOK_SECRET',
    read: () => process.env.CHAPA_WEBHOOK_SECRET?.trim() || null,
    rejectIfEquals: ['CyNDCzoXF7JsaPig6GErkdT0'],
    prodOnly: true,
  },
  {
    name: 'APP_URL',
    read: () => process.env.APP_URL?.trim() || null,
    prodOnly: true,
  },
];

export function validateProductionEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const failures: string[] = [];

  for (const c of checks) {
    if (c.prodOnly && !isProd) continue;
    const value = c.read();
    if (!value) {
      failures.push(`${c.name} is not set`);
      continue;
    }
    if (c.rejectIfEquals && c.rejectIfEquals.includes(value)) {
      failures.push(`${c.name} is set to a known-insecure default (rotate it)`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`[env] Production boot aborted. Fix the following:\n  - ${failures.join('\n  - ')}`);
  }
}
