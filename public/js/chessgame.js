const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const waitingMessage = document.querySelector('.waiting-message');
let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let touchMoveSquare = null;

const turnDisplay = document.querySelector(".turn-display");
const statusDisplay = document.querySelector(".status-display");

const updateGameStatus = () => {
    if (chess.in_checkmate()) {
        const winner = chess.turn() === 'w' ? 'Black' : 'White';
        statusDisplay.innerText = `Checkmate! ${winner} wins!`;
    } else if (chess.in_check()) {
        const playerInCheck = chess.turn() === 'w' ? 'White' : 'Black';
        statusDisplay.innerText = `${playerInCheck} is in check!`;
    } else {
        statusDisplay.innerText = '';
    }
};

const updateTurnDisplay = () => {
    const turn = chess.turn();
    turnDisplay.innerText = turn === 'w' ? "It's White's turn!" : "It's Black's turn!";
};

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = '';

    board.forEach((row, rowIndex) => {
        row.forEach((square, colIndex) => {
            const squareElement = document.createElement('div');
            squareElement.classList.add('square', (rowIndex + colIndex) % 2 === 0 ? 'light' : 'dark');
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = colIndex;

            if (square) {
                const pieceElement = document.createElement('div');
                pieceElement.classList.add('piece', square.color === 'w' ? 'white' : 'black');
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                // Handle drag for desktop
                pieceElement.addEventListener('dragstart', (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: colIndex };
                        e.dataTransfer.setData('text/plain', '');
                    }
                });

                pieceElement.addEventListener('dragend', () => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                // Handle touch for mobile
                pieceElement.addEventListener('touchstart', (e) => {
                    if (playerRole === square.color) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: colIndex };
                        e.preventDefault();
                    }
                });

                pieceElement.addEventListener('touchmove', (e) => {
                    const touch = e.touches[0];
                    const target = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (target && target.classList.contains('square')) {
                        touchMoveSquare = target;
                    }
                    e.preventDefault();
                });

                pieceElement.addEventListener('touchend', (e) => {
                    if (draggedPiece && touchMoveSquare) {
                        const targetSquare = {
                            row: parseInt(touchMoveSquare.dataset.row),
                            col: parseInt(touchMoveSquare.dataset.col)
                        };
                        handleMove(sourceSquare, targetSquare);
                    }
                    draggedPiece = null;
                    sourceSquare = null;
                    touchMoveSquare = null;
                    e.preventDefault();
                });

                squareElement.append(pieceElement);
            }

            // Handle dragover for desktop
            squareElement.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            // Handle drop for desktop
            squareElement.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    if (playerRole === 'b') {
        boardElement.classList.add('flipped');
    } else {
        boardElement.classList.remove('flipped');
    }

    updateTurnDisplay();
    updateGameStatus();
};

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q'
    };
    socket.emit('move', move);
};

const getPieceUnicode = (piece) => {
    const unicodePieces = {
        k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙',
        K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟︎'
    };
    return unicodePieces[piece.type] || '';
};

// Socket.io events handling
socket.on('playerRole', (role) => {
    playerRole = role;
    renderBoard();
});

socket.on('opponentJoined', () => {
    waitingMessage.style.display = 'none';
});

socket.on('spectatorRole', () => {
    playerRole = null;
    renderBoard();
});

socket.on('boardState', (fen) => {
    chess.load(fen);
    renderBoard();
});

socket.on('move', (move) => {
    chess.move(move);
    renderBoard();
});

socket.on('waitingForOpponent', () => {
    waitingMessage.style.display = 'block';
});

socket.on('playerDisconnected', (message) => {
    waitingMessage.innerText = message;
    waitingMessage.style.display = 'block';
    turnDisplay.innerText = '';
    chess.reset();
    renderBoard();
});

socket.emit('joinGame');
renderBoard();
