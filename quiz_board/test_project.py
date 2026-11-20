import io

import pytest

from project import (
    build_board,
    create_app,
    parse_teams,
    read_questions,
    template_csv,
)

GOOD_CSV = """category,points,question,answer
Maths,200,What is 2+2?,4
Maths,100,What is 1+1?,2
Science,100,What is H2O?,Water
"""


# ---------- read_questions ----------

def test_read_questions():
    questions = read_questions(GOOD_CSV)
    assert len(questions) == 3
    assert questions[0] == {
        "category": "Maths", "points": 200, "question": "What is 2+2?", "answer": "4"
    }


def test_read_questions_handles_excel_bom_and_messy_headers():
    text = "﻿ Category ,POINTS,Question,Answer\nArt, 100 , Who painted it? ,Me\n"
    assert read_questions(text) == [
        {"category": "Art", "points": 100, "question": "Who painted it?", "answer": "Me"}
    ]


def test_read_questions_skips_blank_rows():
    text = "category,points,question,answer\n,,,\nArt,100,Q,A\n\n"
    assert len(read_questions(text)) == 1


def test_read_questions_allows_commas_in_quoted_text():
    text = 'category,points,question,answer\nHistory,100,"Name 2 colours, please","Red, blue"\n'
    assert read_questions(text)[0]["answer"] == "Red, blue"


def test_read_questions_missing_column():
    with pytest.raises(ValueError) as error:
        read_questions("category,points,question\nArt,100,Q\n")
    assert "answer" in error.value.args[0][0]


def test_read_questions_reports_every_bad_row_with_row_numbers():
    text = (
        "category,points,question,answer\n"
        "Art,abc,Q,A\n"     # row 2: not a number
        "Art,-5,Q,A\n"      # row 3: not positive
        "Art,100,,A\n"      # row 4: blank question
    )
    with pytest.raises(ValueError) as error:
        read_questions(text)
    messages = error.value.args[0]
    assert len(messages) == 3
    assert messages[0].startswith("Row 2:")
    assert messages[1].startswith("Row 3:")
    assert messages[2] == "Row 4: question is blank."


def test_read_questions_empty():
    with pytest.raises(ValueError):
        read_questions("")
    with pytest.raises(ValueError):
        read_questions("category,points,question,answer\n")


# ---------- build_board ----------

def test_build_board():
    board = build_board(read_questions(GOOD_CSV))
    assert [c["name"] for c in board] == ["Maths", "Science"]
    assert [q["points"] for q in board[0]["questions"]] == [100, 200]


def test_build_board_too_many_categories():
    questions = [
        {"category": f"C{i}", "points": 100, "question": "Q", "answer": "A"}
        for i in range(7)
    ]
    with pytest.raises(ValueError):
        build_board(questions)


def test_build_board_too_many_questions_in_category():
    questions = [
        {"category": "C", "points": i, "question": "Q", "answer": "A"}
        for i in range(1, 8)
    ]
    with pytest.raises(ValueError):
        build_board(questions)


# ---------- parse_teams ----------

def test_parse_teams():
    assert parse_teams("Red, Blue") == ["Red", "Blue"]
    assert parse_teams("Red\nBlue,\n Green ") == ["Red", "Blue", "Green"]


def test_parse_teams_defaults_and_duplicates():
    assert parse_teams("") == ["Team 1", "Team 2"]
    assert parse_teams(" , ,") == ["Team 1", "Team 2"]
    assert parse_teams("Red, red, Blue") == ["Red", "Blue"]


def test_parse_teams_maximum():
    assert len(parse_teams(",".join(f"T{i}" for i in range(10)))) == 6


# ---------- template_csv ----------

def test_template_csv():
    text = template_csv()
    assert text.startswith("category,points,question,answer\n")
    board = build_board(read_questions(text))
    assert len(board) == 3


# ---------- web routes ----------

@pytest.fixture
def client():
    return create_app().test_client()


def test_home_page(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Download quiz_template.csv" in response.data


def test_download_template(client):
    response = client.get("/template.csv")
    assert response.status_code == 200
    assert response.mimetype == "text/csv"
    assert response.data.decode() == template_csv()


def test_upload_shows_board(client):
    response = client.post(
        "/play",
        data={"quiz": (io.BytesIO(GOOD_CSV.encode()), "quiz.csv"),
              "title": "Revision", "teams": "Red, Blue"},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    assert b"Revision" in response.data
    assert b"What is H2O?" in response.data


def test_upload_bad_file_shows_errors(client):
    response = client.post(
        "/play",
        data={"quiz": (io.BytesIO(b"category,points,question,answer\nArt,x,Q,A\n"), "q.csv")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert b"Row 2" in response.data


def test_question_text_is_escaped(client):
    csv_text = "category,points,question,answer\nWeb,100,</script><b>hi</b>,A\n"
    response = client.post(
        "/play",
        data={"quiz": (io.BytesIO(csv_text.encode()), "q.csv")},
        content_type="multipart/form-data",
    )
    assert b"</script><b>" not in response.data


def test_demo(client):
    response = client.post("/play", data={"demo": "1"})
    assert response.status_code == 200
    assert b"Demo Quiz" in response.data
