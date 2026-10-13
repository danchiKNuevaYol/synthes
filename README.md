# Experimental Sound Synthesizer

Версия на HTML, CSS и JavaScript, без React, Bun, npm и сборщика.

## Запуск

1. Откройте папку `experimental-sound-synthesizer` в VS Code.
2. Запустите `index.html` через расширение **Live Server** (Open with Live Server).
3. Страница откроется в браузере.

Если Live Server не установлен, можно запустить любой статический HTTP-сервер, например из этой папки:

```bash
python -m http.server 8000
```

После этого откройте `http://localhost:8000/`.

**Важно:** при первом открытии нужен доступ к интернету. Tone.js и p5.js загружаются из CDN (`esm.sh`). При прямом открытии `index.html` через `file://` модульные импорты могут не работать из-за ограничений браузера, поэтому используйте Live Server или другой локальный сервер.

Оформление и аудиологика остались без изменений.
