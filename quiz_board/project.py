"""Quiz Board: a points-board class quiz game that runs in the browser.

Teachers fill in a CSV file (download the template from the home page),
upload it, and the questions appear as a board that the class plays in teams.

Run with:  python project.py   then open http://127.0.0.1:5000
"""

import csv
import io
import sys

from flask import Flask, Response, render_template, request

REQUIRED_COLUMNS = ("category", "points", "question", "answer")
MAX_CATEGORIES = 6
MAX_QUESTIONS_PER_CATEGORY = 6
MAX_TEAMS = 6
MAX_UPLOAD_BYTES = 1024 * 1024  # 1 MB is far more than any quiz needs

TEMPLATE_ROWS = [
    ("Science", 100, "What gas do plants absorb from the air?", "Carbon dioxide"),
    ("Science", 200, "What is the closest star to Earth?", "The Sun"),
    ("Science", 300, "What part of the cell contains DNA?", "The nucleus"),
    ("Maths", 100, "What is 7 x 8?", "56"),
    ("Maths", 200, "How many sides does a hexagon have?", "6"),
    ("Maths", 300, "What is the square root of 144?", "12"),
    ("Geography", 100, "What is the capital city of Australia?", "Canberra"),
    ("Geography", 200, "Which is the largest ocean?", "The Pacific Ocean"),
    ("Geography", 300, "Which river flows through Adelaide?", "The River Torrens"),
]


def main():
    app = create_app()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    print(f"Quiz Board running: open http://127.0.0.1:{port} in your browser")
    app.run(port=port)


def read_questions(text):
    """Parse CSV text into a list of question dicts.

    Raises ValueError whose args[0] is a list of friendly error messages
    (with spreadsheet row numbers) if anything is wrong.
    """
    text = text.lstrip("﻿")  # Excel adds a byte-order mark to UTF-8 CSVs
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError(["The file is empty."])

    # Allow headings in any case/spacing, e.g. " Category " or "POINTS"
    reader.fieldnames = [name.strip().lower() for name in reader.fieldnames]
    missing = [col for col in REQUIRED_COLUMNS if col not in reader.fieldnames]
    if missing:
        raise ValueError(
            ["Missing column(s): " + ", ".join(missing)
             + ". The first row must be: category,points,question,answer"]
        )

    questions = []
    errors = []
    # Row 1 is the header, so data starts on spreadsheet row 2
    for row_number, row in enumerate(reader, start=2):
        values = {col: (row.get(col) or "").strip() for col in REQUIRED_COLUMNS}
        if not any(values.values()):
            continue  # skip blank lines

        blanks = [col for col in REQUIRED_COLUMNS if not values[col]]
        if blanks:
            errors.append(f"Row {row_number}: {', '.join(blanks)} is blank.")
            continue

        try:
            points = int(values["points"])
        except ValueError:
            errors.append(
                f"Row {row_number}: points must be a whole number, "
                f"not \"{values['points']}\"."
            )
            continue
        if points <= 0:
            errors.append(f"Row {row_number}: points must be more than 0.")
            continue

        questions.append({**values, "points": points})

    if errors:
        raise ValueError(errors)
    if not questions:
        raise ValueError(["The file has no questions in it."])
    return questions


def build_board(questions):
    """Group questions into categories (in the order they first appear),
    each sorted from lowest to highest points."""
    categories = {}
    for question in questions:
        categories.setdefault(question["category"], []).append(question)

    errors = []
    if len(categories) > MAX_CATEGORIES:
        errors.append(
            f"There are {len(categories)} categories; "
            f"the board fits at most {MAX_CATEGORIES}."
        )
    for name, items in categories.items():
        if len(items) > MAX_QUESTIONS_PER_CATEGORY:
            errors.append(
                f"Category \"{name}\" has {len(items)} questions; "
                f"the most allowed is {MAX_QUESTIONS_PER_CATEGORY}."
            )
    if errors:
        raise ValueError(errors)

    return [
        {
            "name": name,
            "questions": [
                {"points": q["points"], "question": q["question"],
                 "answer": q["answer"]}
                for q in sorted(items, key=lambda q: q["points"])
            ],
        }
        for name, items in categories.items()
    ]


def parse_teams(text):
    """Turn "Red, Blue" (commas or new lines) into ["Red", "Blue"].

    Removes blanks and duplicates; defaults to two teams; caps at MAX_TEAMS.
    """
    teams = []
    for name in text.replace("\n", ",").split(","):
        name = name.strip()
        if name and name.lower() not in [t.lower() for t in teams]:
            teams.append(name)
    if not teams:
        teams = ["Team 1", "Team 2"]
    return teams[:MAX_TEAMS]


def template_csv():
    """Return the blank-ish template CSV that teachers download and edit."""
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(REQUIRED_COLUMNS)
    writer.writerows(TEMPLATE_ROWS)
    return output.getvalue()


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/template.csv")
    def template():
        return Response(
            template_csv(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=quiz_template.csv"},
        )

    @app.post("/play")
    def play():
        teams = parse_teams(request.form.get("teams", ""))
        if request.form.get("demo"):
            text = template_csv()
            title = "Demo Quiz"
        else:
            upload = request.files.get("quiz")
            if not upload or not upload.filename:
                return render_template(
                    "index.html", errors=["Choose a CSV file to upload."]
                ), 400
            try:
                text = upload.read().decode("utf-8")
            except UnicodeDecodeError:
                # Older Excel versions save CSVs in Windows-1252
                upload.stream.seek(0)
                text = upload.read().decode("cp1252", errors="replace")
            title = request.form.get("title", "").strip() or "Class Quiz"

        try:
            board = build_board(read_questions(text))
        except ValueError as error:
            return render_template("index.html", errors=error.args[0]), 400

        return render_template("board.html", board=board, teams=teams, title=title)

    @app.errorhandler(413)
    def too_large(_error):
        return render_template(
            "index.html", errors=["That file is too big (limit 1 MB)."]
        ), 413

    return app


if __name__ == "__main__":
    main()
