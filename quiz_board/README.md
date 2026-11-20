# Quiz Board

#### Video Demo: <URL HERE>

#### Description

Quiz Board is a web app that turns a spreadsheet of questions into a
points-board quiz a whole class can play in teams. The teacher fills in a CSV
template, uploads it, and the questions appear as a board of categories and
point values that can be shown on a projector or smartboard.

## How to run

```bash
pip install -r requirements.txt
python project.py
```

Then open <http://127.0.0.1:5000>. To use a different port, add it at the end,
for example `python project.py 8080`.

Run the tests with:

```bash
pytest test_project.py
```

## How a teacher uses it

1. **Download the template** (`quiz_template.csv`) from the home page.
2. **Fill it in** in Excel, Google Sheets or Numbers. There is one question per row:

   | category | points | question                    | answer         |
   |----------|--------|-----------------------------|----------------|
   | Science  | 100    | What gas do plants absorb?  | Carbon dioxide |

   A quiz can have up to 6 categories with up to 6 questions each. Rows can be
   in any order, because the board sorts each category from lowest to highest points.
3. **Upload the file**, give the quiz a title and enter team names separated by commas.
4. **Play.** Click a tile to show the question, then press **Space** to reveal
   the answer. Mark each team ✓ (gain the points) or ✗ (lose the points), then
   press **Esc** to go back to the board. When every tile has been played, the
   final scores and the winner are shown.

Other features:

- **Fixing mistakes.** Click a tile that has already been played to reopen it and
  change who got it right. The − / + buttons under each team adjust scores by
  100 for bonus or penalty points.
- **Saved progress.** Scores are saved in the browser, so an accidental refresh
  doesn't lose the game. **Restart** clears them.
- **Full screen** button for projectors.
- **Helpful errors.** If the CSV has problems, every problem is listed with its
  spreadsheet row number (for example `Row 4: points must be a whole number, not "ten"`).
- A **demo quiz** so you can try it without making a file.

## Files

- **`project.py`** contains the Flask web app and the Python logic:
  - `main()` starts the web server.
  - `read_questions(text)` parses and validates the CSV text. It accepts the
    byte-order mark Excel adds, headings in any case, blank rows, and commas inside
    quoted cells. It collects *all* errors before raising `ValueError`, so the
    teacher can fix the whole file in one go.
  - `build_board(questions)` groups questions into categories in the order
    they first appear, sorts them by points and enforces the size limits.
  - `parse_teams(text)` turns `"Red, Blue"` into a clean list of team names,
    removing blanks and duplicates and defaulting to two teams.
  - `template_csv()` produces the downloadable template.
  - `create_app()` builds the Flask app with its routes: `/` (setup page),
    `/template.csv` (download) and `/play` (upload, then show the board).
- **`test_project.py`** has pytest tests for each function above and for the web
  routes, using Flask's test client.
- **`templates/`** holds the Jinja pages: `layout.html`, `index.html` (setup and
  upload) and `board.html` (the game).
- **`static/game.js`** contains the in-browser game: the board, the question
  screen, scoring and saving progress.
- **`static/style.css`** contains the styles, with large text for projectors.
- **`sample_quiz.csv`** is an example quiz.

## Design choices

- **CSV instead of a built-in editor.** Teachers already know spreadsheets, and a
  CSV file can be shared, reused and edited offline. Writing questions in a
  web form would be slower and would need accounts and a database.
- **No database.** The server reads the uploaded file, checks it and sends the
  board to the browser. Nothing is stored on the server, so there's nothing to
  set up and no student data is kept. Game progress is kept in the browser's
  `localStorage` instead.
- **Python checks the file, JavaScript runs the game.** Checking the file in
  Python keeps the important logic testable with pytest. Running the game in
  the browser makes clicking tiles instant, with no page reloads during play.
- **Safety.** Question text is inserted with Jinja's `tojson` filter and set with
  `textContent` in JavaScript. This means a question containing HTML or
  `<script>` is shown as plain text rather than run, and there's a test for this.
  Uploads are limited to 1 MB.
