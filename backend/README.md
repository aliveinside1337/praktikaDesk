# FastAPI backend

## Запуск

1. Создать и активировать виртуальное окружение Python.
2. Установить зависимости:

```bash
pip install -r backend/requirements.txt
```

3. Запустить сервер:

```bash
uvicorn backend.main:app --reload
```

## Запуск в 1 команду

Если нужен формат "запустил один .py и сразу открылся сайт":

```bash
python run_app.py
```

Скрипт автоматически:

- поднимет FastAPI,
- откроет браузер на `http://127.0.0.1:8000`.


SQLite база создается автоматически в `backend/contacts.db`.

## Основные API

- `GET /api/contacts`
- `POST /api/contacts`
- `PUT /api/contacts/{id}`
- `DELETE /api/contacts/{id}`
- `POST /api/contacts/import`
- `GET /api/contacts/export`
- `GET/PUT /api/settings`
- `GET/PUT /api/profile`
