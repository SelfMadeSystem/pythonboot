from pyodide.ffi import to_js
from js import document, alert

print("Tic Tac Toe loaded")

EMPTY = ""
PLAYER_X = "X"
PLAYER_O = "O"

import random

IMG_XS = [f"/img/x{i}.png" for i in range(0, 10)]
IMG_OS = [f"/img/o{i}.png" for i in range(0, 10)]

# Store per-cell image/transform info
cell_img = [None] * 9
cell_flip = [False] * 9
cell_rot = [0] * 9

board = [EMPTY] * 9
current_player = PLAYER_X
game_active = False

def render_board():
    for i in range(9):
        cell = document.querySelector(f'.cell[data-cell="{i}"]')
        if board[i] == PLAYER_X:
            img = cell_img[i] if cell_img[i] else random.choice(IMG_XS)
            flip = cell_flip[i]
            rot = cell_rot[i]
            flip_css = 'scaleX(-1)' if flip else 'scaleX(1)'
            rot_css = f'rotate({rot}deg)'
            cell.innerHTML = f'<img src="{img}" alt="X" style="transform:{flip_css} {rot_css};">'
        elif board[i] == PLAYER_O:
            img = cell_img[i] if cell_img[i] else random.choice(IMG_OS)
            flip = cell_flip[i]
            rot = cell_rot[i]
            flip_css = 'scaleX(-1)' if flip else 'scaleX(1)'
            rot_css = f'rotate({rot}deg)'
            cell.innerHTML = f'<img src="{img}" alt="O" style="transform:{flip_css} {rot_css};">'
        else:
            cell.innerHTML = ""

def set_status(msg):
    document.getElementById("status").innerHTML = msg

def check_winner():
    wins = [
        [0,1,2], [3,4,5], [6,7,8], # rows
        [0,3,6], [1,4,7], [2,5,8], # cols
        [0,4,8], [2,4,6]           # diags
    ]
    for a,b,c in wins:
        if board[a] != EMPTY and board[a] == board[b] == board[c]:
            return board[a]
    if EMPTY not in board:
        return "draw"
    return None

def cell_click(event):
    global current_player, game_active
    if not game_active:
        return
    idx = int(event.target.getAttribute("data-cell"))
    if board[idx] != EMPTY:
        return
    board[idx] = current_player
    # Assign random image, flip, and rotation for this cell
    if current_player == PLAYER_X:
        cell_img[idx] = random.choice(IMG_XS)
    else:
        cell_img[idx] = random.choice(IMG_OS)
    cell_flip[idx] = random.choice([True, False])
    cell_rot[idx] = random.choice([0, 90, 180, 270])
    render_board()
    winner = check_winner()
    if winner == PLAYER_X:
        set_status("X wins!")
        alert("Congratulations! X has won the game!")
        game_active = False
    elif winner == PLAYER_O:
        set_status("O wins!")
        alert("Congratulations! O has won the game!")
        game_active = False
    elif winner == "draw":
        set_status("It's a draw!")
        alert("The game is a draw!")
        game_active = False
    else:
        current_player = PLAYER_O if current_player == PLAYER_X else PLAYER_X
        set_status(f"{current_player}'s turn")

def start_game(event=None):
    global board, current_player, game_active, cell_img, cell_flip, cell_rot
    board = [EMPTY] * 9
    cell_img = [None] * 9
    cell_flip = [False] * 9
    cell_rot = [0] * 9
    current_player = PLAYER_X
    game_active = True
    render_board()
    set_status(f"{current_player}'s turn")

def reset_game(event=None):
    global board, current_player, game_active, cell_img, cell_flip, cell_rot
    board = [EMPTY] * 9
    cell_img = [None] * 9
    cell_flip = [False] * 9
    cell_rot = [0] * 9
    current_player = PLAYER_X
    game_active = False
    render_board()
    set_status("Press Start to play Tic Tac Toe!")

# Attach event listeners
for i in range(9):
    cell = document.querySelector(f'.cell[data-cell="{i}"]')
    cell.addEventListener("click", to_js(cell_click))

document.getElementById("startTicTacToe").addEventListener("click", to_js(start_game))
document.getElementById("resetTicTacToe").addEventListener("click", to_js(reset_game))

reset_game()
