# Explorador de listados municipales · EHE PBA

Aplicación web para revisar la base maestra, cruzarla con archivos `TB_*_LISTADO_TOTAL.xls/xlsx`, explorar los 135 partidos bonaerenses, diagnosticar los tres métodos municipales y seleccionar UPM de 20 viviendas. El acceso se controla con Firebase Authentication y cuentas de Google autorizadas en Firestore.

## Configurar Firebase y los accesos

1. Crear o elegir un proyecto en [Firebase Console](https://console.firebase.google.com/) y registrar una aplicación web.
2. En **Authentication → Sign-in method**, habilitar **Google**.
3. Crear una base **Cloud Firestore**.
4. Copiar `.env.example` como `.env.local` y completar allí el objeto de configuración de la aplicación web.
5. En Firestore, crear la colección `authorizedUsers`. Cada documento debe usar como ID el correo de Google en minúsculas —por ejemplo `persona@gmail.com`— y contener el campo booleano `active: true`.
6. Copiar `.firebaserc.example` como `.firebaserc`, reemplazar el project ID y desplegar las reglas con `npx firebase-tools deploy --only firestore:rules`.

Las reglas incluidas permiten que cada persona consulte únicamente su propio permiso. Los usuarios de la aplicación no pueden crear ni modificar autorizaciones.

La cuenta configurada en `VITE_FIREBASE_ROOT_EMAIL` entra como administradora permanente. En la barra superior verá el botón **Administrar accesos**, desde donde puede agregar, suspender, habilitar o eliminar otras cuentas sin abrir Firebase Console. El correo root también está fijado en `firestore.rules`; ambos valores deben coincidir antes del despliegue.

## Inicio rápido en Windows

1. Instalar [Node.js LTS](https://nodejs.org/) si todavía no está instalado.
2. Hacer doble clic en `INICIAR_APLICATIVO.bat`.
3. La primera ejecución instala las bibliotecas en esta misma carpeta. Luego abre `http://127.0.0.1:4173`.
4. Para cerrar, usar `Ctrl+C` en la ventana negra.

También se puede iniciar desde una terminal:

```powershell
npm install
npm run dev
```

## Qué contiene

- `public/data/base-operativa.json`: versión compacta del Excel para navegación rápida.
- `public/data/base-maestra.json`: las 66 columnas, cargadas solo al abrir una ficha completa.
- `public/data/listados-resumen.json`: controles precalculados de los listados existentes.
- `public/data/partidos-pba.geojson`: mapa oficial guardado localmente; no descarga mapas al ejecutarse.
- Importador de nuevos Excel en segundo plano, almacenamiento en IndexedDB y exportación de tablas a CSV.

## Privacidad

Firebase recibe los datos necesarios para autenticar la cuenta de Google y comprobar si su correo está autorizado. Los Excel elegidos desde la interfaz siguen procesándose en el navegador y las importaciones quedan en el almacenamiento local.

> Importante: Firebase Hosting sirve los archivos estáticos de `public/data`. El login restringe la interfaz, pero para impedir también la descarga directa de esos JSON es necesario alojarlos en Cloud Storage o Firestore y aplicar reglas de lectura para usuarios autorizados.

## Actualizar datos

- Desde **Archivos**, usar **Reemplazar Excel** para trabajar con una nueva base maestra sin modificar los JSON incluidos.
- Usar **Elegir carpeta** para leer todos los `TB_*_LISTADO_TOTAL` de una carpeta.
- Para regenerar el resumen precargado desde la carpeta original del proyecto:

```powershell
npm run resumir:listados
```

- Para actualizar los tamaños de muestra y la cantidad de UPM provinciales desde `TAMAÑODEMUESTRAEHEdefinitivo.xlsx`:

```powershell
npm run configurar:municipios
```

El script busca por defecto `..\Temporada 2\Listado Municipal\Listados Originales`.

## Compilación opcional

```powershell
npm run build
npm run preview
```

## Fuente cartográfica

Límites de partidos publicados por ARBA en Datos Abiertos PBA, actualización junio de 2026, licencia CC BY 4.0.
