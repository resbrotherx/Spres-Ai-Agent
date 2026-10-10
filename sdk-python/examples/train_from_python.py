"""Train your Brainbox from Python.

    pip install https://port.smartpowerbilling.com/sdk/downloads/spres_ai-1.1.0-py3-none-any.whl
    export BRAINBOX_SECRET_KEY=sk_live_...      # Staff dashboard -> Settings -> API keys -> Secret
    python train_from_python.py handbook.pdf

What it does:
  1. uploads a PDF (or XML/DOCX/TXT...) file,
  2. connects a support-tickets API (after a dry-run preview),
  3. pushes records from a database loop with train_text,
  4. waits until every training task has finished and prints a summary.

Use a SECRET key here (server-side only). Never put it in a browser or mobile app.
"""
import os
import sqlite3
import sys

from brainbox_sdk import BrainboxError, BrainboxPythonSDK

API_URL = os.environ.get("BRAINBOX_API_URL", "https://port.smartpowerbilling.com")


def main() -> int:
    sdk = BrainboxPythonSDK(api_url=API_URL, api_key=os.environ["BRAINBOX_SECRET_KEY"])
    task_ids = []

    # 1) Upload a document --------------------------------------------------------------
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else "employee-handbook.pdf"
    if os.path.exists(pdf_path):
        job = sdk.train_file(pdf_path, name="Employee handbook", audience="internal")
        print(f"Uploaded {pdf_path}: source {job['source']['source_id']}, task {job['task_id']}")
        task_ids.append(job["task_id"])
    else:
        print(f"Skipping file upload: {pdf_path} not found")

    # 2) Connect a support-tickets API ----------------------------------------------------
    helpdesk_token = os.environ.get("HELPDESK_TOKEN")
    if helpdesk_token:
        config = dict(
            url="https://helpdesk.example.com/api/tickets",
            method="GET",
            headers={"Authorization": f"Bearer {helpdesk_token}"},
            query={"status": "solved"},
            data_path="data.tickets",              # where the list of tickets is in the JSON
            source_type="support_tickets",
            mapping={"id_field": "id", "question_field": "subject", "answer_field": "resolution"},
            pagination={"type": "page", "page_param": "page", "max_pages": 10},
            audience="internal",
        )
        preview = sdk.test_api_source(**config)    # dry run: nothing is saved
        print(f"API preview: ok={preview['ok']} records={preview['records_found']} "
              f"fields={preview.get('detected_fields')}")
        if preview["ok"]:
            job = sdk.add_api_source(name="Helpdesk tickets", **config)
            task_ids.append(job["task_id"])
        else:
            print(f"Not connecting the API: {preview.get('error')}")

    # 3) Push records from your database --------------------------------------------------
    # Any database works; sqlite keeps the example self-contained.
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE faq (id INTEGER PRIMARY KEY, question TEXT, answer TEXT, public INTEGER)")
    db.executemany("INSERT INTO faq (question, answer, public) VALUES (?, ?, ?)", [
        ("How do I reset my meter PIN?", "Open Settings > Meter > Reset PIN and follow the SMS code.", 1),
        ("What is the refund window?", "Refunds are processed within 14 days of the request.", 1),
        ("Who approves vendor payouts?", "The finance lead approves every payout above 500.", 0),
    ])
    for row_id, question, answer, is_public in db.execute("SELECT id, question, answer, public FROM faq"):
        job = sdk.train_text(
            f"Q: {question}\nA: {answer}",
            name=f"FAQ #{row_id}",
            audience="customer" if is_public else "internal",
        )
        task_ids.append(job["task_id"])
    print(f"Queued {len(task_ids)} training task(s)")

    # 4) Wait for completion ---------------------------------------------------------------
    failures = 0
    for task_id in task_ids:
        try:
            status = sdk.wait_for_task(task_id, timeout=600, poll=3)
            print(f"  {task_id}: {status['status']}")
        except BrainboxError as e:
            failures += 1
            print(f"  {task_id}: {e}")

    totals = sdk.list_sources()["totals"]
    print(f"Done. {totals['sources']} sources, {totals['documents']} documents in your Brainbox.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
