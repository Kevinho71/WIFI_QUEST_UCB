import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../src/index.js';

describe('API Endpoints (Hono)', () => {
  beforeEach(() => {
    process.env.WIFI_PASS_LEVEL_1 = 'ConejoConejo';
    process.env.WIFI_PASS_LEVEL_2 = 'SuperRedSecreta_99!';
  });

  describe('GET / and GET /api/health', () => {
    it('retorna status 200 en healthcheck', async () => {
      const res = await app.request('/api/health');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
    });

    it('retorna información general en la raíz', async () => {
      const res = await app.request('/');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.project).toBe('WIFI QUEST API');
    });
  });

  describe('POST /api/verify', () => {
    it('valida con éxito la contraseña correcta del Nivel 1', async () => {
      const res = await app.request('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 1,
          passwordGuess: '  ConejoConejo  ',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.realPassword).toBe('ConejoConejo');
      expect(data.message).toContain('Acceso Concedido');
    });

    it('rechaza una contraseña incorrecta del Nivel 1', async () => {
      const res = await app.request('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 1,
          passwordGuess: 'clave_invalida',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.realPassword).toBeUndefined();
    });

    it('valida con éxito la contraseña correcta del Nivel 2', async () => {
      const res = await app.request('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 2,
          passwordGuess: 'SuperRedSecreta_99!',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.realPassword).toBe('SuperRedSecreta_99!');
    });

    it('retorna error 400 si el nivel es inválido', async () => {
      const res = await app.request('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 99,
          passwordGuess: 'test',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('INVALID_LEVEL');
    });
  });

  describe('POST /api/chat validaciones', () => {
    it('retorna error 400 si no se envían mensajes', async () => {
      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 1,
          messages: [],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('INVALID_MESSAGES');
    });
  });
});
