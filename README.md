# Explorador de listados municipales · EHE PBA

Aplicación local para revisar la base maestra, cruzarla con archivos `TB_*_LISTADO_TOTAL.xls/xlsx`, explorar los 135 partidos bonaerenses, diagnosticar el método General Viamonte o General San Martín y seleccionar UPM municipales de 20 viviendas.

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

La aplicación no tiene servidor, cuenta, telemetría ni integración con nubes. Todo se procesa en el navegador local. Los archivos elegidos no se envían a ningún lugar. Las importaciones agregadas desde la interfaz quedan en el almacenamiento local del navegador.

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
