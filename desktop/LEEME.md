# Ranked Pro · edición local 0.1.0

Aplicación de Windows con seguimiento fuera de Premiere y un puente UXP pequeño. Ejecutable: `dist/Ranked Pro/Ranked Pro.exe`. Conserva toda esa carpeta junto al ejecutable.

## Uso

1. Abre Ranked Pro. En Ajustes puedes cambiar nombre, metas, tarifa, moneda e inactividad.
2. El puente se instala desde Ajustes → Instalar / reparar puente. Tras instalarlo, reinicia Premiere y abre Ventana → Complementos UXP → Ranked Pro Bridge.
3. Deja el puente cargado; puedes acoplarlo detrás de otro panel. Cierra el panel VISFX original para evitar su trabajo adicional.
4. La X de Ranked Pro lo deja en la bandeja. Haz clic en su icono para volver. El menú de la bandeja permite pausar o salir. Desmarca «Seguir al cerrar la ventana» si prefieres terminar el programa con la X.

## Funciones implementadas

- Tiempo activo: proceso Premiere en primer plano y actividad reciente del teclado/ratón de Windows. No registra teclas ni títulos de otras ventanas. Límite de inactividad configurable, pausa manual y protección contra sumar tiempo de suspensión.
- Sesiones, XP, nueve rangos, niveles, rachas, multiplicadores por sesión y fines de semana alternos.
- Metas diarias/semanales, misión diaria, cinco retos semanales, catálogo de 92 logros con los no disponibles señalados, cofre semanal local y tienda de cosméticos con fichas ganadas por XP.
- Perfil, foto, insignias, fondos, decoraciones, efectos de nombre estáticos, tarjeta PNG y resumen mensual PNG. Se evitaron las animaciones continuas del panel original.
- Estadísticas, proyectos, notas, tarifas por proyecto, estimaciones por moneda y exportación CSV.
- Diario privado, galería, importación/exportación de imágenes y vídeos, captura de ventana y clips WebM de hasta 60 segundos. La grabación es manual, consume recursos adicionales y puede incluir audio del sistema solo si marcas esa opción.
- Tema claro/oscuro, inicio opcional con Windows, notificaciones opcionales, respaldo/restauración JSON.

## Alcance y límites

El tiempo funciona sin el puente; para asignarlo a proyectos y recibir eventos de edición necesitas el puente conectado. Estar en Premiere cuenta como foco, incluso en sus menús; no equivale a detectar cada acción de edición. La reproducción sin entrada también se pausa al alcanzar el límite de inactividad.

Los cortes y cambios de clips son estimaciones por diferencias de instantáneas, no un historial exacto. Los eventos de efectos/exportación dependen de lo que exponga la versión de Premiere y no se han validado exhaustivamente en todos los flujos de Adobe Media Encoder. Los guardados se estiman por cambios del archivo del proyecto en disco (cada 5 segundos), sin leer su contenido. Varias operaciones entre muestras pueden agruparse. Secuencias de más de 40 pistas omiten el recuento de clips.

Las cuentas, clasificación entre amigos, mensajes, desafíos, publicaciones públicas y sincronización están pendientes, conforme al alcance de esta primera versión. No existe una clasificación mundial ni se conecta al servidor de VISFX. Los logros sociales o sin detección fiable no se conceden artificialmente. Esta es una adaptación local funcional, no paridad completa de los servicios en línea.

## Datos y rendimiento

Datos en `%APPDATA%\Ranked Pro`. Se guarda el perfil cada 15 segundos y al cerrar; se conserva `profile.json.bak`. El respaldo JSON incluye progreso y metadatos, pero **los archivos de galería requieren copiar también la carpeta `media`**. Para trasladar todo, cierra Ranked Pro y copia su carpeta de datos completa.

El detector nativo consulta foco/inactividad cada 500 ms. La lógica trabaja a 1 Hz. Al ocultar la ventana se destruye la interfaz tras 20 segundos, salvo durante una grabación. Electron mantiene procesos propios: el consumo de RAM no es cero. El puente consulta contexto cada 3 segundos en foco y espera 5 segundos fuera de foco. Las instantáneas de clips se espacian al menos 15 segundos y se evitan durante reproducción/exportación detectada.

La conexión usa exclusivamente `127.0.0.1:49371` y un token local. No requiere abrir puertos en el router ni cuentas. Si reinstalas en otro equipo, instala el puente desde esa copia para generar la configuración correcta.

## Desarrollo

Código desktop en `app/`, puente en `bridge/`, detector en `native/FocusMonitor.cs`. Compilar con `python tools/build.py`; requiere el ZIP oficial de Electron y su manifiesto SHA256 en `tools/`, además del compilador .NET Framework de Windows. Ejecutar pruebas con `node --test tests/*.test.js`.

Para la etapa social: servidor propio con cuentas autenticadas, base de datos de usuarios/grupos/invitaciones, sesiones verificadas y clasificación por grupo/periodo. Los datos locales actuales son editables por el propietario; no constituyen un sistema antitrampas.

## Procedencia

Adaptación personal basada en el CCX VISFX Ranked 0.6.0 proporcionado por el usuario. Las reglas, traducciones y recursos visuales de `app/lib/` y `app/assets/` proceden de ese complemento, con modificaciones locales. No es una publicación oficial de VISFX. El código de integración, detector y aplicación externa se encuentra disponible en esta carpeta. Electron conserva sus archivos de licencia en la distribución. Antes de distribuir públicamente una futura versión, corresponde sustituir los recursos de terceros o disponer de su autorización.


## Publicar una actualización de Windows

La instalación pública usa Electron, NSIS y el canal estable de GitHub Releases. El identificador RankedPro.Desktop y el nombre RankedPro-Setup.exe deben conservarse para actualizar instalaciones existentes.

1. Incrementa la versión en app/package.json y actualiza app/package-lock.json. Instala las dependencias con npm ci --prefix app.
2. Copia el puente actualizado a app/bridge con el config.js de distribución (token vacío). Compila native/FocusMonitor.cs en app/bin/FocusMonitor.exe. La app empareja el puente en el primer inicio de cada versión.
3. Desde RankedPro ejecuta npx --yes electron-builder@26.18.0 --config electron-builder.yml --win nsis --x64 --publish never. El paso de iconos usa Python 3 en Windows.
4. Prueba la compilación. Con Git Credential Manager autenticado para el repositorio, ejecuta python tools/publish-release.py. El script sube el instalador, latest.yml y el blockmap a un borrador y publica después de verificar los tres archivos.
5. Comprueba la descarga de la web y la detección desde la versión anterior. Las instalaciones consultan el canal al arrancar y cada cuatro horas. La actualización descargada se aplica al reiniciar o al salir desde la bandeja.
