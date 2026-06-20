from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "contacts.db"
STATIC_DIR = BASE_DIR / "static"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                address TEXT NOT NULL,
                category TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                dark_mode INTEGER NOT NULL DEFAULT 0,
                push_alerts INTEGER NOT NULL DEFAULT 1,
                auto_backup INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                role TEXT NOT NULL
            );
            """
        )

        conn.execute(
            """
            INSERT OR IGNORE INTO app_settings (id, dark_mode, push_alerts, auto_backup)
            VALUES (1, 0, 1, 1)
            """
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO profile (id, name, email, role)
            VALUES (1, 'Иван Иванов', 'ivan@example.com', 'Администратор')
            """
        )

        seed_contacts = [
            (
                "Александр Петров",
                "+7 (999) 123-45-67",
                "a.petrov@example.com",
                "г. Москва, ул. Ленина, д. 15, кв. 42",
                "Работа",
                "2026-03-15",
            ),
            (
                "Дмитрий Сидоров",
                "+7 (977) 111-22-33",
                "dmitry.s@gmail.com",
                "г. Казань, ул. Баумана, д. 5",
                "Друзья",
                "2026-04-02",
            ),
        ]

        for contact in seed_contacts:
            exists = conn.execute("SELECT id FROM contacts WHERE email = ?", (contact[2],)).fetchone()
            if exists is None:
                conn.execute(
                    """
                    INSERT INTO contacts (name, phone, email, address, category, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    contact,
                )


class ContactBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=6, max_length=40)
    email: EmailStr
    address: str = Field(min_length=5, max_length=300)
    category: Literal["Работа", "Друзья", "Семья"]


class ContactCreate(ContactBase):
    pass


class ContactRead(ContactBase):
    id: int
    created_at: str


class SettingsModel(BaseModel):
    push_alerts: bool
    auto_backup: bool


class ProfileModel(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    role: str = Field(min_length=2, max_length=80)


app = FastAPI(title="Contacts Manager", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/", include_in_schema=False)
def root() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/contacts", response_model=list[ContactRead])
def list_contacts() -> list[ContactRead]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, phone, email, address, category, created_at
            FROM contacts
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
    return [ContactRead(**dict(row)) for row in rows]


@app.post("/api/contacts", response_model=ContactRead)
def create_contact(payload: ContactCreate) -> ContactRead:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO contacts (name, phone, email, address, category, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload.name,
                payload.phone,
                payload.email,
                payload.address,
                payload.category,
                date.today().isoformat(),
            ),
        )
        row = conn.execute(
            """
            SELECT id, name, phone, email, address, category, created_at
            FROM contacts
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="Не удалось создать контакт")
    return ContactRead(**dict(row))


@app.put("/api/contacts/{contact_id}", response_model=ContactRead)
def update_contact(contact_id: int, payload: ContactCreate) -> ContactRead:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE contacts
            SET name = ?, phone = ?, email = ?, address = ?, category = ?
            WHERE id = ?
            """,
            (payload.name, payload.phone, payload.email, payload.address, payload.category, contact_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Контакт не найден")

        row = conn.execute(
            """
            SELECT id, name, phone, email, address, category, created_at
            FROM contacts
            WHERE id = ?
            """,
            (contact_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Контакт не найден")
    return ContactRead(**dict(row))


@app.delete("/api/contacts/{contact_id}", status_code=204, response_class=Response)
def delete_contact(contact_id: int) -> Response:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Контакт не найден")
    return Response(status_code=204)


@app.post("/api/contacts/import", response_model=list[ContactRead])
def import_contacts(payload: list[ContactCreate]) -> list[ContactRead]:
    imported: list[ContactRead] = []
    with get_connection() as conn:
        for item in payload:
            cursor = conn.execute(
                """
                INSERT INTO contacts (name, phone, email, address, category, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    item.name,
                    item.phone,
                    item.email,
                    item.address,
                    item.category,
                    date.today().isoformat(),
                ),
            )
            row = conn.execute(
                """
                SELECT id, name, phone, email, address, category, created_at
                FROM contacts
                WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
            if row is not None:
                imported.append(ContactRead(**dict(row)))
    return imported


@app.get("/api/contacts/export", response_model=list[ContactRead])
def export_contacts() -> list[ContactRead]:
    return list_contacts()


@app.get("/api/settings", response_model=SettingsModel)
def get_settings() -> SettingsModel:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT push_alerts, auto_backup FROM app_settings WHERE id = 1"
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Настройки не найдены")
    return SettingsModel(push_alerts=bool(row["push_alerts"]), auto_backup=bool(row["auto_backup"]))


@app.put("/api/settings", response_model=SettingsModel)
def update_settings(payload: SettingsModel) -> SettingsModel:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE app_settings
            SET push_alerts = ?, auto_backup = ?
            WHERE id = 1
            """,
            (int(payload.push_alerts), int(payload.auto_backup)),
        )
    return payload


@app.get("/api/profile", response_model=ProfileModel)
def get_profile() -> ProfileModel:
    with get_connection() as conn:
        row = conn.execute("SELECT name, email, role FROM profile WHERE id = 1").fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Профиль не найден")
    return ProfileModel(**dict(row))


@app.put("/api/profile", response_model=ProfileModel)
def update_profile(payload: ProfileModel) -> ProfileModel:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE profile
            SET name = ?, email = ?, role = ?
            WHERE id = 1
            """,
            (payload.name, payload.email, payload.role),
        )
    return payload
