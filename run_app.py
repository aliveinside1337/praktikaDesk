from __future__ import annotations

import threading
import webbrowser

import uvicorn


def open_browser() -> None:
    webbrowser.open("http://127.0.0.1:8000")


def main() -> None:
    threading.Timer(1.2, open_browser).start()
    print("Запуск FastAPI + встроенного интерфейса на http://127.0.0.1:8000")
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
