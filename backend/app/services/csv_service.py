import csv
import io
from sqlalchemy.orm import Session
from app.services.order_service import create_order
from app.schemas.orders import OrderCreate

async def process_csv(db: Session, file_content: bytes):
    results = []
    successful = 0
    failed = 0

    # Absicherung: falls die Datei keine gültige Textdatei ist (z.B. ein
    # umbenanntes Binärformat mit .csv-Endung), wirft decode() sonst einen
    # unbehandelten UnicodeDecodeError -> sauberer Fehler statt 500er
    try:
        content = file_content.decode("utf-8-sig").strip()
    except UnicodeDecodeError:
        return {
            "successful": 0,
            "failed": 0,
            "total": 0,
            "details": [],
            "error": "File could not be decoded as text - is this a valid CSV file?"
        }

    # Trennzeichen automatisch erkennen; falls das Format zu uneindeutig ist
    # (z.B. nur eine Spalte ohne Trennzeichen), auf Komma als Standard zurückfallen
    # statt die ganze Anfrage mit einem 500er abstürzen zu lassen
    try:
        dialect = csv.Sniffer().sniff(content, delimiters=",;")
    except csv.Error:
        dialect = csv.excel  # Standard-Dialekt mit Komma als Trennzeichen

    reader = csv.DictReader(io.StringIO(content), dialect=dialect)
    reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    for row_number, row in enumerate(reader, start=1):
        try:
            if "color" not in row or "quantity" not in row:
                raise ValueError(f"Missing required columns: color, quantity. Found: {list(row.keys())}")

            quantity = int(row["quantity"].strip())
            if quantity <= 0:
                raise ValueError("Quantity must be greater than 0")

            order_data = OrderCreate(
                color=row["color"].strip().lower(),
                quantity=quantity,
                source="csv",
                note=row.get("note", None)
            )
            # create_order() ist jetzt async (verschickt intern selbst die
            # Bestätigungsmail) -> await notwendig
            order = await create_order(db, order_data)

            results.append({
                "row": row_number,
                "color": row["color"],
                "quantity": quantity,
                "status": "success",
                "order_id": order.id
            })
            successful += 1

        except Exception as e:
            # Fehler pro Zeile abfangen, damit eine fehlerhafte Zeile nicht kompletten Import abbricht
            results.append({
                "row": row_number,
                "color": row.get("color", "unknown"),
                "quantity": row.get("quantity", "unknown"),
                "status": "failed",
                "reason": str(e)
            })
            failed += 1

    return {
        "successful": successful,
        "failed": failed,
        "total": successful + failed,
        "details": results
    }