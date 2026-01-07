# VALKYRIA ECM

Sistema de Gestión de Contenido Empresarial con módulos de Recursos Humanos y Gestión Legal.

## Requisitos

- Ruby 3.4.7
- Node.js 18+
- MongoDB 6+
- LibreOffice (para conversión de documentos)
- ImageMagick (para procesamiento de imágenes)

## Instalación

### Backend (Rails)

```bash
cd /Users/mac/RubymineProjects/VALKYRIA_ECM
bundle install
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
```

## Ejecución

### Iniciar servidores

**Terminal 1 - Backend (Rails):**
```bash
cd /Users/mac/RubymineProjects/VALKYRIA_ECM
DISABLE_SPRING=1 bundle exec rails server -b 127.0.0.1 -p 3000
```

**Terminal 2 - Frontend (Vite):**
```bash
cd /Users/mac/RubymineProjects/VALKYRIA_ECM/frontend
npm run dev
```

### URLs de acceso

| Servicio | URL |
|----------|-----|
| Frontend | http://127.0.0.1:5173 |
| Backend API | http://127.0.0.1:3000/api/v1 |
| Swagger Docs | http://127.0.0.1:3000/api-docs |

> **IMPORTANTE**: Siempre usar `127.0.0.1` en lugar de `localhost` para evitar problemas de IPv4/IPv6.

### Credenciales de prueba

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@valkyria.com | Admin123! |
| Empleado | employee1@valkyria.com | Employee123! |

## Estructura del Proyecto

```
VALKYRIA_ECM/
├── app/
│   ├── controllers/api/v1/
│   │   ├── admin/           # Administración (templates, settings, usuarios)
│   │   ├── hr/              # Recursos Humanos (vacaciones, certificaciones)
│   │   └── legal/           # Gestión Legal (terceros, contratos)
│   ├── models/
│   │   ├── identity/        # Usuarios, organizaciones, firmas
│   │   ├── hr/              # Vacaciones, certificaciones
│   │   ├── legal/           # Terceros, contratos
│   │   └── templates/       # Templates, documentos generados
│   ├── policies/            # Políticas Pundit de autorización
│   └── services/            # Servicios de negocio
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── pages/           # Páginas por módulo
│   │   ├── services/        # Servicios API
│   │   └── contexts/        # Contextos React (Auth, etc.)
│   └── vite.config.js       # Configuración Vite (proxy, puerto 5173)
└── config/
    └── routes.rb            # Rutas API
```

## Módulos

### Recursos Humanos (HR)

- **Vacaciones**: Solicitud, aprobación, cálculo según ley colombiana
- **Certificaciones**: Generación de certificados laborales con firmas
- **Empleados**: Directorio y gestión de información

### Gestión Legal

- **Terceros**: Proveedores, clientes, contratistas, aliados
- **Contratos**: Gestión con aprobación multinivel según monto
- **Aprobaciones**: Workflow de 4 niveles (área -> legal -> gerencia -> CEO)

### Administración

- **Templates**: Gestión de plantillas Word con variables dinámicas
- **Configuración**: Ajustes de organización, HR, documentos, seguridad
- **Usuarios**: Gestión de usuarios y roles

## Templates de Documentos

### Categorías por Módulo

| Módulo | Categoría Principal | Subcategorías |
|--------|---------------------|---------------|
| Recursos Humanos | Laboral | Certificaciones, Vacaciones, Contratos, Terminación |
| Gestión Legal | Comercial | Contratos Comerciales, Propuestas, Acuerdos, NDA |
| Administración | Administrativo | Memorandos, Cartas, Políticas, Otros |

### Variables Disponibles

- `employee.*`: Datos del empleado (nombre, cargo, salario, etc.)
- `organization.*`: Datos de la organización
- `third_party.*`: Datos del tercero (contratos comerciales)
- `contract.*`: Datos del contrato
- `system.*`: Fecha actual, etc.

## Aprobación de Contratos

| Nivel | Monto Máximo | Aprobadores |
|-------|--------------|-------------|
| 1 | $10M | Jefe de Área |
| 2 | $50M | Jefe de Área -> Legal |
| 3 | $200M | Jefe de Área -> Legal -> Gerente General |
| 4 | >$200M | Jefe de Área -> Legal -> Gerente General -> CEO |

## Troubleshooting

### Error 404 en login

El servidor Rails puede tener rutas no cargadas (proceso zombie):

```bash
# Matar proceso zombie
lsof -ti :3000 | xargs kill -9
rm -f tmp/pids/server.pid

# Reiniciar
DISABLE_SPRING=1 bundle exec rails server -b 127.0.0.1 -p 3000
```

### Vite no conecta al backend

Reiniciar Vite después de reiniciar Rails:

```bash
lsof -ti :5173 | xargs kill -9
cd frontend && npm run dev
```

### Puerto 5173 ocupado

Vite está configurado con `strictPort: true`, fallará si el puerto está ocupado:

```bash
# Liberar puerto
lsof -ti :5173 | xargs kill -9

# Reiniciar
npm run dev
```

## API Endpoints Principales

### Autenticación
- `POST /api/v1/auth/login` - Iniciar sesión
- `GET /api/v1/auth/me` - Usuario actual
- `DELETE /api/v1/auth/logout` - Cerrar sesión

### HR
- `GET /api/v1/hr/vacations` - Mis vacaciones
- `GET /api/v1/hr/certifications` - Mis certificaciones
- `GET /api/v1/hr/employees` - Directorio de empleados
- `GET /api/v1/hr/dashboard` - Dashboard HR

### Legal
- `GET /api/v1/legal/third_parties` - Terceros
- `GET /api/v1/legal/contracts` - Contratos
- `GET /api/v1/legal/contract_approvals` - Aprobaciones pendientes

### Admin
- `GET /api/v1/admin/templates` - Templates
- `GET /api/v1/admin/settings` - Configuración
- `GET /api/v1/admin/users` - Usuarios

## Tecnologías

### Backend
- Ruby on Rails 7.2
- MongoDB (Mongoid)
- Devise + JWT (Autenticación)
- Pundit (Autorización)
- Swagger/Rswag (Documentación API)

### Frontend
- React 19
- Vite
- TanStack Query
- Tailwind CSS v4
- React Router

## Licencia

Propietario - VALKYRIA Corp
