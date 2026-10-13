---
name: backend-best-practices
description: >
  Buenas prácticas de backend para proyectos TypeScript + Node.js con Drizzle ORM, PostgreSQL (Neon),
  AWS Lambda Function URL y Vitest. Aplica cuando se creen, modifiquen o revisen módulos de backend,
  servicios, handlers, schemas de BD, migraciones, validadores o lógica de negocio. Cubre separación
  de responsabilidades (handler -> service -> repository), manejo de errores centralizado, validación con
  Zod, migraciones obligatorias con Drizzle-Kit, soft-delete, idempotencia, pruebas unitarias y de
  integración, logging estructurado y variables de entorno tipadas.
triggers:
  - crear servicio
  - crear handler
  - crear repositorio
  - modificar schema
  - agregar campo
  - agregar tabla
  - nueva entidad
  - nueva migracion
  - nueva migración
  - manejo de errores
  - error handling
  - separacion de responsabilidades
  - separación de responsabilidades
  - buenas practicas backend
  - buenas prácticas backend
  - new endpoint
  - nuevo endpoint
  - refactor backend
  - agregar validacion
  - agregar validación
---

# 🏗️ Backend Best Practices — LIBRE_DSS Stack

> **Stack canónico**: TypeScript 5 · Node.js 22 · Drizzle ORM 0.33 · PostgreSQL (Neon Serverless) · AWS Lambda Function URL · Vitest 2

---

## 0. Lectura Obligatoria Antes de Codificar

Antes de tocar cualquier archivo de backend, lee y verifica:

1. [`backend/src/db/schema.ts`](file:///c:/Users/Usuario/OneDrive%20-%20UCB/PROYECTOS%20VS%20CODE/PROYECTO%20DE%20GRADO%20UCB/LIBRE_DSS/backend/src/db/schema.ts) — Fuente de verdad del modelo de datos relacional.
2. [`backend/drizzle.config.ts`](file:///c:/Users/Usuario/OneDrive%20-%20UCB/PROYECTOS%20VS%20CODE/PROYECTO%20DE%20GRADO%20UCB/LIBRE_DSS/backend/drizzle.config.ts) — Configuración del ORM y generación de migraciones.
3. [`backend/src/db/migrate.ts`](file:///c:/Users/Usuario/OneDrive%20-%20UCB/PROYECTOS%20VS%20CODE/PROYECTO%20DE%20GRADO%20UCB/LIBRE_DSS/backend/src/db/migrate.ts) — Script ejecutor de migraciones DDL con transacciones.
4. [`backend/package.json`](file:///c:/Users/Usuario/OneDrive%20-%20UCB/PROYECTOS%20VS%20CODE/PROYECTO%20DE%20GRADO%20UCB/LIBRE_DSS/backend/package.json) — Scripts npm disponibles (`db:generate`, `db:migrate`, `test`, `typecheck`).

---

## 1. Estructura de Directorios y Capas

Cada módulo funcional del backend debe estar autocontenido bajo una arquitectura en capas estricta:

```
backend/src/
├── db/
│   ├── schema.ts                # ÚNICO lugar donde se definen tablas Drizzle
│   ├── client.ts                # Instancia Pool / Drizzle singleton
│   ├── migrate.ts               # Runner de migraciones SQL
│   └── migrations/              # Archivos SQL generados por drizzle-kit (NO editar a mano)
│
├── modules/
│   └── <modulo>/                # Ej: productos/, transacciones/, proveedores/, engine/
│       ├── <modulo>.handler.ts    # Capa 1: Transporte HTTP/Lambda (parseo, status codes)
│       ├── <modulo>.service.ts    # Capa 2: Reglas de negocio puras
│       ├── <modulo>.repository.ts # Capa 3: Acceso a datos (queries Drizzle ORM)
│       ├── <modulo>.schema.ts     # Validaciones Zod (entradas DTO y params)
│       ├── <modulo>.types.ts      # Interfaces TypeScript y tipos derivados
│       └── <modulo>.test.ts       # Tests unitarios del servicio y engine
│
├── shared/
│   ├── errors/
│   │   ├── AppError.ts          # Jerarquía de errores de dominio tipados
│   │   └── errorHandler.ts      # Interceptor y formateador global de excepciones
│   ├── middleware/
│   │   ├── validateBody.ts      # Helper para validar payload con esquemas Zod
│   │   └── requireAuth.ts       # Extracción de claims y aislamiento de tenant
│   ├── utils/
│   │   ├── env.ts               # Variables de entorno tipadas y validadas con Zod
│   │   ├── logger.ts            # Logger estructurado JSON para CloudWatch
│   │   ├── pagination.ts        # Paginación estándar (page, limit, total, offsets)
│   │   └── idempotency.ts       # Detección y manejo de llaves de idempotencia
│   └── types/
│       └── lambda.ts            # Tipado de eventos y respuestas Lambda
│
└── index.ts                     # Punto de entrada / Router central de AWS Lambda
```

### Reglas de Dependencia entre Capas

```
[Handler / Controlador]
         │  (invoca)
         ▼
     [Service]
         │  (invoca)
         ▼
   [Repository]
         │  (ejecuta)
         ▼
     [Drizzle DB]
```

- **Handler**: Solo recibe `LambdaEvent`, valida los datos con Zod, llama al `Service` y retorna HTTP responses (`200`, `201`, `204`). **CERO lógica de negocio y CERO queries de base de datos.**
- **Service**: Implementa flujos de negocio, cálculos (DSS, EOQ, ROP), validaciones semánticas, transacciones y coordinación entre repositorios. Lanza subclases de `AppError` ante cualquier regla de negocio rota.
- **Repository**: Ejecuta operaciones CRUD y queries de Drizzle ORM. Todo método recibe explícitamente `empresaId` para garantizar multi-tenancy.
- **Dirección de dependencias**: Handler depende de Service; Service depende de Repository. **Nunca a la inversa**.

---

## 2. Separación de Responsabilidades en Código

### ❌ ANTIPATRÓN: Lógica en el controlador o handler
```typescript
// ❌ PROHIBIDO: Mezclar parseo, queries SQL directas y validaciones en el handler
export async function handler(event: any) {
  const body = JSON.parse(event.body);
  if (!body.nombre) return { statusCode: 400, body: 'Falta nombre' };

  // Query directa en el handler (ROMPE ARQUITECTURA)
  const existing = await db.select().from(productos).where(eq(productos.sku, body.sku));
  if (existing.length > 0) return { statusCode: 409, body: 'SKU duplicado' };

  const [nuevo] = await db.insert(productos).values(body).returning();
  return { statusCode: 201, body: JSON.stringify(nuevo) };
}
```

### ✅ PATRÓN CANÓNICO: 3 Capas Desacopladas

#### Capa 1: Handler (`productos.handler.ts`)
```typescript
import { LambdaEvent, LambdaResponse, ok, created, parseBody } from '../../shared/types/lambda';
import { CreateProductoSchema } from './productos.schema';
import { productosService } from './productos.service';
import { extractTenantId } from '../../shared/middleware/requireAuth';

export async function crearProductoHandler(event: LambdaEvent): Promise<LambdaResponse> {
  const empresaId = extractTenantId(event);
  const body = parseBody(event.body);
  const dto = CreateProductoSchema.parse(body); // Si falla, lanza ZodError (atrapado por errorHandler)

  const nuevoProducto = await productosService.crearProducto(empresaId, dto);
  return created(nuevoProducto);
}
```

#### Capa 2: Service (`productos.service.ts`)
```typescript
import { productosRepository } from './productos.repository';
import { CreateProductoDto, ProductoDto, toProductoDto } from './productos.types';
import { ConflictError } from '../../shared/errors/AppError';
import { logger } from '../../shared/utils/logger';

export const productosService = {
  async crearProducto(empresaId: string, dto: CreateProductoDto): Promise<ProductoDto> {
    if (dto.sku) {
      const duplicado = await productosRepository.findBySku(empresaId, dto.sku);
      if (duplicado) {
        throw new ConflictError('SKU_DUPLICADO', `El SKU '${dto.sku}' ya está registrado en la empresa.`);
      }
    }

    const creado = await productosRepository.create(empresaId, dto);
    logger.info({ event: 'producto.creado', empresaId, productoId: creado.id }, 'Producto creado satisfactoriamente');

    return toProductoDto(creado);
  },
};
```

#### Capa 3: Repository (`productos.repository.ts`)
```typescript
import { db } from '../../db/client';
import { productos } from '../../db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { CreateProductoDto } from './productos.types';

export const productosRepository = {
  async findBySku(empresaId: string, sku: string) {
    const rows = await db
      .select()
      .from(productos)
      .where(and(
        eq(productos.empresaId, empresaId),
        eq(productos.sku, sku),
        isNull(productos.deletedAt),
      ))
      .limit(1);

    return rows[0] ?? null;
  },

  async create(empresaId: string, data: CreateProductoDto) {
    const [row] = await db
      .insert(productos)
      .values({
        empresaId,
        sku: data.sku,
        nombre: data.nombre,
        costoUnitario: String(data.costoUnitario),
        precioVenta: String(data.precioVenta),
        costoPedido: String(data.costoPedido ?? 50),
      })
      .returning();

    return row;
  },
};
```

---

## 3. Manejo Global y Centralizado de Excepciones

### 3.1 Jerarquía de Errores (`shared/errors/AppError.ts`)
```typescript
export abstract class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(code = 'NOT_FOUND', message = 'Recurso no encontrado', details?: unknown) {
    super(code, message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(code = 'CONFLICT', message = 'Conflicto con el estado actual del recurso', details?: unknown) {
    super(code, message, 409, details);
  }
}

export class ValidationError extends AppError {
  constructor(code = 'VALIDATION_ERROR', message = 'Datos de entrada inválidos', details?: unknown) {
    super(code, message, 422, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = 'UNAUTHORIZED', message = 'No autorizado') {
    super(code, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(code = 'FORBIDDEN', message = 'Permisos insuficientes para realizar esta acción') {
    super(code, message, 403);
  }
}
```

### 3.2 Interceptor Global (`shared/errors/errorHandler.ts`)
```typescript
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { logger } from '../utils/logger';
import { LambdaResponse } from '../types/lambda';

export function handleError(error: unknown): LambdaResponse {
  const jsonHeader = { 'Content-Type': 'application/json' };

  // 1. Error de validación Zod
  if (error instanceof ZodError) {
    logger.warn({ err: error.flatten().fieldErrors }, 'Fallo de validación en la solicitud');
    return {
      statusCode: 422,
      headers: jsonHeader,
      body: JSON.stringify({
        error: 'VALIDATION_ERROR',
        message: 'Los datos enviados no cumplen con el formato requerido',
        details: error.flatten().fieldErrors,
      }),
    };
  }

  // 2. Errores de dominio conocidos
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ code: error.code, details: error.details }, error.message);
    } else {
      logger.warn({ code: error.code, details: error.details }, error.message);
    }

    return {
      statusCode: error.statusCode,
      headers: jsonHeader,
      body: JSON.stringify({
        error: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      }),
    };
  }

  // 3. Excepciones no controladas (500) - NUNCA fugar stack trace al cliente
  logger.error({ unhandledError: error }, 'Excepción no controlada en el backend');
  return {
    statusCode: 500,
    headers: jsonHeader,
    body: JSON.stringify({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error interno en el servidor. Por favor, intente más tarde.',
    }),
  };
}
```

### 3.3 Regla de Oro de Captura
> **NUNCA** coloques bloques `try/catch` en los handlers individuales para retornar `statusCode: 400/500`.
> Los controladores y servicios deben permitir que los errores fluyan hacia el envoltorio principal en `index.ts`:

```typescript
// index.ts
export async function handler(event: LambdaEvent, context: any): Promise<LambdaResponse> {
  try {
    return await router(event, context);
  } catch (error) {
    return handleError(error); // ÚNICO punto de formateo de error HTTP
  }
}
```

---

## 4. Migraciones Obligatorias al Modificar Entidades

> ⚠️ **REGLA ABSOLUTA**: Si modificas, agregas o eliminas campos, tablas, índices o relaciones en [`backend/src/db/schema.ts`](file:///c:/Users/Usuario/OneDrive%20-%20UCB/PROYECTOS%20VS%20CODE/PROYECTO%20DE%20GRADO%20UCB/LIBRE_DSS/backend/src/db/schema.ts), **ES ESTRICTAMENTE OBLIGATORIO GENERAR LA MIGRACIÓN SQL Y PROBARLA**.

### Flujo de Trabajo Obligatorio de Migraciones:

1. **Editar Schema**: Modificar `backend/src/db/schema.ts` respetando tipos pg-core.
2. **Generar Migración**:
   ```bash
   cd "backend"
   npm run db:generate
   ```
   Esto generará un archivo SQL en `backend/src/db/migrations/XXXX_nombre.sql` y actualizará el archivo `_journal.json`.
3. **Revisar el SQL Generado**:
   - Verificar que no haga `DROP TABLE` o `DROP COLUMN` destructivo sin precaución.
   - Las nuevas columnas requeridas deben tener un `.default(...)` o ser opcionales para no romper datos existentes.
4. **Ejecutar la Migración**:
   ```bash
   npm run db:migrate
   ```
5. **Commit Atómico**:
   El commit debe incluir **obligatoriamente** tanto el cambio en `schema.ts` como el archivo SQL generado en `migrations/`.

---

## 5. Multi-Tenant y Seguridad: Aislamiento por `empresaId`

Cada tabla de datos de negocio (`producto`, `proveedor`, `transaccion`, `orden_compra`, `parametros_calculo`) pertenece a un tenant:
- **Toda query SELECT** debe incluir `where(eq(tabla.empresaId, empresaId))`
- **Toda query UPDATE / DELETE** debe condicionarse por `and(eq(tabla.empresaId, empresaId), eq(tabla.id, id))`
- **El `empresaId` NUNCA debe provenir de un body no verificado**. Debe obtenerse de las credenciales de sesión / JWT o del contexto autenticado.

---

## 6. Soft-Delete en Entidades Principales

Para mantener trazabilidad histórica y consistencia en el cálculo algorítmico del DSS:
1. No usar `DELETE` físico en productos o catálogos maestros.
2. Usar la columna `deletedAt: timestamp('deleted_at')`.
3. Todo SELECT estándar debe filtrar por activos:
   ```typescript
   where(and(
     eq(productos.empresaId, empresaId),
     isNull(productos.deletedAt),
   ))
   ```
4. La operación de borrado es un UPDATE:
   ```typescript
   await db.update(productos)
     .set({ deletedAt: new Date(), updatedAt: new Date() })
     .where(and(eq(productos.empresaId, empresaId), eq(productos.id, id)));
   ```

---

## 7. Idempotencia en Operaciones Críticas

Para operaciones de impacto contable o de inventario (e.g. transacciones de venta, mermas, órdenes de compra):
- La tabla [`transacciones`](file:///c:/Users/Usuario/OneDrive%20-%20UCB/PROYECTOS%20VS%20CODE/PROYECTO%20DE%20GRADO%20UCB/LIBRE_DSS/backend/src/db/schema.ts#L71-L87) incluye `llaveIdempotencia: varchar('llave_idempotencia', { length: 64 })` con índice único por `(empresaId, llaveIdempotencia)`.
- El servicio debe verificar si la operación con esa llave ya fue procesada y retornar el registro existente en lugar de duplicarlo.
- Manejar el error de Postgres `23505` (unique_violation) para devolver la respuesta idempotente sin lanzar error 500.

---

## 8. Variables de Entorno Tipadas (`env.ts`)

**Nunca** utilices `process.env.<VARIABLE>` directamente disperso en el código.
Usa una configuración centralizada validada con Zod:

```typescript
// backend/src/shared/utils/env.ts
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL de PostgreSQL válida'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Configuración de variables de entorno inválida:', parsed.error.format());
  throw new Error('Variables de entorno incompletas o inválidas');
}

export const env = parsed.data;
```

---

## 9. Pruebas Unitarias con Vitest

- Cada servicio y motor algorítmico debe contar con su suite de pruebas unitarias (`.test.ts`).
- **Lógica de negocio pura** (cálculo ROP, clasificación ABC, EOQ, matrices de demanda): probar exhaustivamente casos normales, bordes (demanda 0, varianza 0) y validación de entradas.
- **Servicios**: mockear los repositorios usando `vi.mock(...)` o inyección de dependencias para aislar la lógica sin requerir conexión a Neon.
- Comando para correr pruebas:
  ```bash
  cd "backend"
  npm run test
  ```
- Comando para verificación de tipos sin emitir bundle:
  ```bash
  npm run typecheck
  ```

---

## 10. Checklist de Calidad antes de Cerrar una Tarea de Backend

- [ ] **Arquitectura**: ¿Existe separación estricta Handler ➔ Service ➔ Repository?
- [ ] **Lógica en Controlador**: ¿El handler solo parsea entrada y delega al service?
- [ ] **Migraciones**: Si se tocó `schema.ts`, ¿se ejecutó `npm run db:generate` y se commiteó el archivo SQL?
- [ ] **Multi-Tenant**: ¿Todas las consultas a tablas de negocio tienen filtro por `empresaId`?
- [ ] **Soft-Delete**: ¿Se respeta el filtrado de `deletedAt` en entidades maestras?
- [ ] **Errores Centralizados**: ¿Se usan subclases de `AppError` y los errores no controlados son procesados por `handleError`?
- [ ] **Validación Zod**: ¿Todas las entradas HTTP tienen un esquema Zod estricto?
- [ ] **Pruebas y Tipos**: ¿Pasan `npm run typecheck` y `npm run test` exitosamente?
