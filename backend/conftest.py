"""
Der Fixture unten schaltet den echten E-Mail-Versand in den Tests ab.
Hintergrund: email_service.send_* würde bei fast jedem Test versuchen,
sich per SMTP mit localhost:1025 zu verbinden. Läuft da nichts, dauert
so ein Fehlversuch besonders unter Windows deutlich länger => über alle
Tests noch länger.
Deshalb Versand einfach durch Platzhalter ersetzen.

Wer den echten Mailversand mittesten will (z.B. gegen einen lokalen
Mailhog/Mailpit auf localhost:1025): einfach den Body auskommentieren
oder Datei umbenennen
"""

import pytest
from unittest.mock import AsyncMock
from app.services import email_service


@pytest.fixture(autouse=True)
def _no_real_email(monkeypatch):
    monkeypatch.setattr(email_service.fm, "send_message", AsyncMock())