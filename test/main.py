from pyodide.ffi import to_js
from js import document
import random

print("Math Quiz example loaded")

score = 0
current_a = 0
current_b = 0


def generate_question():
    global current_a, current_b
    current_a = random.randint(0, 9)
    current_b = random.randint(0, 9)
    question = document.getElementById("question")
    question.innerHTML = f"What is {current_a} + {current_b}?"
    feedback = document.getElementById("feedback")
    feedback.innerHTML = ""


def start_quiz(event):
    global score
    score = 0
    document.getElementById("score").innerHTML = f"Score: {score}"
    generate_question()


def submit_answer(event):
    global score
    answer_input = document.getElementById("answer")
    user_answer = answer_input.value
    feedback = document.getElementById("feedback")
    if user_answer == "":
        feedback.innerHTML = "Please enter an answer."
        return
    try:
        user_answer = int(user_answer)
    except ValueError:
        feedback.innerHTML = "Please enter a valid number."
        return
    if user_answer == current_a + current_b:
        score += 1
        feedback.innerHTML = "Correct!"
    else:
        feedback.innerHTML = f"Incorrect. The answer was {current_a + current_b}."
    document.getElementById("score").innerHTML = f"Score: {score}"
    answer_input.value = ""
    generate_question()


# Add Enter key support for answer input
def on_answer_keydown(event):
    if event.key == "Enter":
        submit_answer(event)


document.getElementById("startQuiz").addEventListener("click", to_js(start_quiz))
document.getElementById("submitAnswer").addEventListener("click", to_js(submit_answer))
document.getElementById("answer").addEventListener("keydown", to_js(on_answer_keydown))
