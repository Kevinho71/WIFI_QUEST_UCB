/**
 * Contraseña WiFi única (ambos niveles). Debe definirse en .env.
 * Acepta WIFI_PASS o, por compatibilidad, WIFI_PASS_LEVEL_1 / WIFI_PASS_LEVEL_2 / Contrasena_WIFI.
 */
export function getWifiPassword(): string {
  const password = (
    process.env.WIFI_PASS ||
    process.env.WIFI_PASS_LEVEL_1 ||
    process.env.WIFI_PASS_LEVEL_2 ||
    process.env.Contrasena_WIFI ||
    ''
  ).trim();

  if (!password) {
    throw new Error(
      'Falta la contraseña WiFi en .env (WIFI_PASS o WIFI_PASS_LEVEL_1 / WIFI_PASS_LEVEL_2).'
    );
  }

  return password;
}
